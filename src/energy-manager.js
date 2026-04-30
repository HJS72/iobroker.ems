'use strict';

const config = require('./config');
const IoBrokerClient = require('./iobroker-client');
const DataStore = require('./data-store');
const PvForecast = require('./pv-forecast');
const ForecastEngine = require('./forecast-engine');
const Scheduler = require('./scheduler');

/**
 * Zentraler Energy-Manager:
 * - Pollt Daten von ioBroker
 * - Berechnet aktuelle Verbräuche
 * - Speichert stündliche Daten
 * - Aktualisiert Prognosen
 */
class EnergyManager {
    constructor() {
        const cfg = config.get();
        this.cfg = cfg;
        this.client = new IoBrokerClient(cfg.iobroker);
        this.store = new DataStore();
        this.pvForecast = new PvForecast(cfg.location.latitude, cfg.location.longitude);
        this.forecastEngine = new ForecastEngine(this.store);
        this.scheduler = new Scheduler(this.store);

        this._pollTimer = null;
        this._forecastTimer = null;
        this._connected = false;
        this._lastPoll = null;
        this._listeners = [];
        this._isHoliday = false;
        this._dayType = 'workday';
    }

    /**
     * Event-Listener registrieren (für WebSocket-Updates etc.)
     */
    on(event, fn) {
        this._listeners.push({ event, fn });
    }

    _emit(event, data) {
        for (const l of this._listeners) {
            if (l.event === event) l.fn(data);
        }
    }

    /**
     * Manager starten: Verbindung testen, Polling starten, Prognosen laden.
     */
    async start() {
        console.log('[EMS] Starte Energy Manager...');

        // DB initialisieren
        await this.store.init();

        // Verbindungstest
        this._connected = await this.client.testConnection();
        if (this._connected) {
            console.log(`[EMS] Verbunden mit ioBroker (${this.cfg.iobroker.host}:${this.cfg.iobroker.port})`);
        } else {
            console.warn('[EMS] ioBroker nicht erreichbar - starte im Offline-Modus');
        }

        // PV-Prognose laden
        await this._updatePvForecast();

        // Verbrauchsprognose berechnen
        await this._updateConsumptionForecast();

        // Polling starten
        this._startPolling();

        // Prognose-Update-Timer
        this._forecastTimer = setInterval(
            () => this._updatePvForecast(),
            this.cfg.polling.forecastUpdateMs
        );

        // Tägliche Aufräumarbeiten
        this._scheduleCleanup();

        console.log('[EMS] Energy Manager gestartet.');
    }

    stop() {
        if (this._pollTimer) clearInterval(this._pollTimer);
        if (this._forecastTimer) clearInterval(this._forecastTimer);
        this.store.close();
        console.log('[EMS] Energy Manager gestoppt.');
    }

    // ─── Polling ──────────────────────────────────────────────────────

    _startPolling() {
        if (!this._connected) return;

        this._pollTimer = setInterval(
            () => this._poll(),
            this.cfg.polling.intervalMs
        );

        // Sofort ersten Poll
        this._poll();
    }

    async _poll() {
        try {
            const allIds = config.getAllDatapointIds();
            const values = await this.client.getBulk(allIds);
            const now = new Date();
            const date = now.toISOString().split('T')[0];
            const hour = now.getHours();

            // Feiertag-Status und Tagestyp bestimmen
            if (this.cfg.holidays && this.cfg.holidays.datapoint) {
                this._isHoliday = await this.client.isHoliday(this.cfg.holidays.datapoint);
            }
            this._dayType = ForecastEngine.getDayType(now, this._isHoliday);

            // PV-Systeme verarbeiten
            for (const pv of this.cfg.pvSystems) {
                let power = values[pv.datapoints.power]?.val || 0;

                // Vorzeichen-Konvention: Leistung immer positiv für Erzeugung
                power = this._applySign(power, pv.powerSignPositive, 'production');

                // Tagesertrag berechnen
                const dailyYield = this._calcDailyEnergy(
                    pv.id, date, pv.energyType,
                    values[pv.datapoints.dailyYield]?.val || 0,
                    power
                );

                const extra = {};
                if (pv.hasBattery) {
                    // Read raw datapoints but keep `null` when a datapoint is missing.
                    const batteryDp = values[pv.datapoints.batteryPower];
                    const socDp = values[pv.datapoints.batterySoc];
                    const dcDp = values[pv.datapoints.dcPower];

                    const batteryDCraw = batteryDp != null ? batteryDp.val : null; // +Laden, -Entladen
                    const batterySocRaw = socDp != null ? socDp.val : null;
                    const dcPowerRaw = dcDp != null ? dcDp.val : null; // reiner PV-DC-Ertrag
                    const acPower = power; // I_AC_Power (bereits vorzeichenbereinigt)

                    // Wenn keine Batterie-bezogenen DPs vorhanden sind, keine nulls in Zahlen verwandeln
                    if (batteryDCraw == null && batterySocRaw == null && dcPowerRaw == null) {
                        extra.batteryPower = null;
                        extra.batterySoc = null;
                        extra.dcPower = null;
                        extra.pvAcPure = null;
                        extra.batteryAcPower = null;
                        extra.inverterEfficiency = null;
                    } else {
                        // Für Berechnungen fehlende Einzelfelder als 0 behandeln, aber im `extra` null belassen
                        const batteryDC = batteryDCraw != null ? batteryDCraw : 0;
                        const dcPower = dcPowerRaw != null ? dcPowerRaw : 0;

                        // Korrekte PV-DC-Leistung berechnen
                        // Wenn Batterie entlädt (batteryDC < 0), dann enthält dcPower auch PV-Leistung
                        // pvDC = dcPower - batteryDC (wenn batteryDC negativ ist, wird PV-Leistung addiert)
                        let pvDcPower;
                        if (batteryDC < 0) {
                            // Batterie entlädt sich: PV-DC = Gesamt-DC - (-Batterie-DC) = Gesamt-DC + Batterie-DC
                            pvDcPower = dcPower + batteryDC; // batteryDC ist negativ
                        } else {
                            // Batterie lädt oder idle: PV-DC = Gesamt-DC - Batterie-DC
                            pvDcPower = dcPower - batteryDC;
                        }
                        
                        // Sicherstellen, dass PV-DC nicht negativ wird
                        pvDcPower = Math.max(0, pvDcPower);

                        // Wechselrichter-Wirkungsgrad berechnen
                        let efficiency = 0.96; // Fallback
                        if (pvDcPower > 50) {
                            // Schutz vor Division durch 0
                            efficiency = Math.min(0.99, Math.max(0.85, acPower / pvDcPower));
                        }

                        // AC-Aufteilung
                        const pvAcPure = pvDcPower * efficiency;      // Was PV alleine in AC liefert
                        const batteryAcPower = -batteryDC * efficiency; // AC-Äquivalent Batterie (+ = speist ein, - = lädt)

                        extra.batteryPower = batteryDCraw != null ? batteryDC : null;       // DC-Leistung (roh)
                        extra.batterySoc = batterySocRaw != null ? batterySocRaw : null;
                        extra.dcPower = dcPowerRaw != null ? dcPower : null;               // Gesamt-DC (PV + Batterie)
                        extra.pvDcPower = Math.round(pvDcPower);                           // Reine PV-DC-Leistung (ohne Batterie)
                        extra.pvAcPure = Math.round(pvAcPure); // PV-Anteil am AC (ohne Batterie)
                        extra.batteryAcPower = Math.round(batteryAcPower); // Batterie AC-Äquivalent
                        extra.inverterEfficiency = Math.round(efficiency * 1000) / 10; // % mit 1 Dezimale
                    }
                }

                this.store.upsertCurrentValue(pv.id, power, dailyYield, extra);
                this.store.addHourlySample(pv.id, date, hour, power, this._dayType);
                this.store.upsertDailyStats(pv.id, date, dailyYield, power);

                // PV Plan vs Ist tracken
                const forecast = this.store.getPvForecast(pv.id, date);
                const fcHour = forecast.find(f => f.hour === hour);
                if (fcHour && fcHour.watts > 0) {
                    this.store.savePvAccuracy(pv.id, date, hour, fcHour.watts, power);
                }
            }

            // Grid – ein Leistungs-DP (Vorzeichen = Richtung), zwei Energie-DPs
            const grid = this.cfg.grid;
            let gridRaw = values[grid.datapoints.power]?.val || 0;

            // Vorzeichen-Konvention normalisieren → positiv = Bezug, negativ = Einspeisung
            let gridPower;
            if (grid.signConvention === 'positive_feedin') {
                gridPower = -gridRaw; // positiv = Einspeisung → umdrehen
            } else {
                gridPower = gridRaw;  // positive_purchase → passt schon
            }

            const purchase = Math.max(0, gridPower);  // Bezug (W)
            const feedIn   = Math.max(0, -gridPower); // Einspeisung (W)

            const energyFeedIn   = values[grid.datapoints.energyFeedIn]?.val || 0;
            const energyPurchase = values[grid.datapoints.energyPurchase]?.val || 0;

            this.store.upsertCurrentValue('grid', gridPower, 0, {
                feedIn, purchase,
                energyFeedIn,
                energyPurchase
            });
            this.store.addHourlySample('grid_feedin', date, hour, feedIn, this._dayType);
            this.store.addHourlySample('grid_purchase', date, hour, purchase, this._dayType);

            // Verbraucher – gemessene zuerst, dann Bilanz-Verbraucher
            const balanceConsumers = [];
            let measuredConsumerPower = 0;

            for (const c of this.cfg.consumers) {
                if (c.energyType === 'balance') {
                    balanceConsumers.push(c);
                    continue;
                }

                let power = values[c.datapoints.power]?.val || 0;
                power = this._applySign(power, c.powerSignPositive, 'consumption');

                const dailyEnergy = this._calcDailyEnergy(
                    c.id, date, c.energyType,
                    values[c.datapoints.energyTotal]?.val || 0,
                    power
                );

                measuredConsumerPower += power;

                // EV-Daten (optional, z.B. bei Wallbox)
                let extra = null;
                if (c.datapoints.evSoc || c.datapoints.evRange || c.datapoints.evChargeEnd) {
                    extra = extra || {};
                    if (c.datapoints.evSoc) extra.evSoc = values[c.datapoints.evSoc]?.val ?? null;
                    if (c.datapoints.evRange) extra.evRange = values[c.datapoints.evRange]?.val ?? null;
                    if (c.datapoints.evChargeEnd) extra.evChargeEnd = values[c.datapoints.evChargeEnd]?.val ?? null;
                    // Batterie-Kapazität: DP hat Vorrang, sonst Festwert
                    if (c.datapoints.evBatteryCapacity) {
                        extra.evBatteryCapacity = values[c.datapoints.evBatteryCapacity]?.val ?? c.evBatteryCapacity ?? null;
                    } else if (c.evBatteryCapacity) {
                        extra.evBatteryCapacity = c.evBatteryCapacity;
                    }
                }

                // Temperatur-Daten (Wärmepumpe / Klimaanlage)
                if (c.datapoints.tempCurrent || c.datapoints.tempStart || c.datapoints.tempEnd) {
                    extra = extra || {};
                    extra.tempCurrent = c.datapoints.tempCurrent ? (values[c.datapoints.tempCurrent]?.val ?? null) : null;
                    extra.tempStart = c.datapoints.tempStart ? (values[c.datapoints.tempStart]?.val ?? null) : null;
                    extra.tempEnd = c.datapoints.tempEnd ? (values[c.datapoints.tempEnd]?.val ?? null) : null;
                    extra.tempMode = c.type === 'aircon' ? 'cooling' : 'heating';
                    // Status ableiten
                    if (extra.tempCurrent != null && extra.tempStart != null && extra.tempEnd != null) {
                        if (c.type === 'aircon') {
                            // Kühlung: Start > End (z.B. Start=25°C, End=22°C)
                            if (extra.tempCurrent > extra.tempStart) {
                                extra.hpStatus = 'needs_cooling';
                            } else if (extra.tempCurrent <= extra.tempEnd) {
                                extra.hpStatus = 'target_reached';
                            } else {
                                extra.hpStatus = 'in_range';
                            }
                        } else {
                            // Heizung: Start < End (z.B. Start=38°C, End=48°C)
                            if (extra.tempCurrent < extra.tempStart) {
                                extra.hpStatus = 'needs_heating';
                            } else if (extra.tempCurrent >= extra.tempEnd) {
                                extra.hpStatus = 'target_reached';
                            } else {
                                extra.hpStatus = 'in_range';
                            }
                        }
                    }
                }

                this.store.upsertCurrentValue(c.id, power, dailyEnergy, extra);
                this.store.addHourlySample(c.id, date, hour, power, this._dayType);
                this.store.upsertDailyStats(c.id, date, dailyEnergy, power);
            }

            // Bilanz-Verbraucher (z.B. Hausverbrauch): P = Σ PV + Grid - Σ gemessene Verbraucher
            if (balanceConsumers.length > 0) {
                const totalPvPower = this.cfg.pvSystems.reduce((sum, pv) => {
                    const cv = this.store.getCurrentValues();
                    const pvVal = cv.find(v => v.system_id === pv.id);
                    return sum + (pvVal ? pvVal.power_w : 0);
                }, 0);

                const balancePower = Math.max(0, totalPvPower + gridPower - measuredConsumerPower);

                for (const c of balanceConsumers) {
                    const dailyEnergy = this._calcDailyEnergy(
                        c.id, date, 'calculated', 0, balancePower
                    );

                    this.store.upsertCurrentValue(c.id, balancePower, dailyEnergy, { calculated: true });
                    this.store.addHourlySample(c.id, date, hour, balancePower, this._dayType);
                    this.store.upsertDailyStats(c.id, date, dailyEnergy, balancePower);
                }
            }

            this._lastPoll = now;
            this._emit('update', this.getCurrentState());

        } catch (err) {
            console.error('[EMS] Poll-Fehler:', err.message);
        }
    }

    /**
     * Vorzeichen anpassen: Stellt sicher, dass der Rückgabewert positiv ist
     * für die erwartete Richtung.
     * @param {number} raw - Rohwert vom Datenpunkt
     * @param {string} signPositive - Was bedeutet positiv? "production" oder "consumption"
     * @param {string} wantPositive - Was soll positiv sein? "production" oder "consumption"
     */
    _applySign(raw, signPositive, wantPositive) {
        // Default: positiv = das was wir wollen
        if (!signPositive) return Math.abs(raw);
        if (signPositive === wantPositive) {
            // positiv = gewünschte Richtung → Betrag nehmen (negative Werte ignorieren)
            return Math.max(0, raw);
        } else {
            // positiv = entgegengesetzte Richtung → Vorzeichen umdrehen
            return Math.max(0, -raw);
        }
    }

    /**
     * Tagesenergie berechnen.
     * Bei energyType "total": Summenzähler → Differenz zum Tagesstart.
     * Bei energyType "daily": Wert ist bereits Tagesertrag (in kWh → umrechnen in Wh).
     * Bei energyType "calculated": Energie aus Leistung berechnen (Integration über Zeit).
     */
    _calcDailyEnergy(systemId, date, energyType, rawValue, powerW) {
        if (!energyType || energyType === 'total') {
            // Summenzähler: Referenzwert für Tagesbeginn setzen (beim ersten Abruf des Tages)
            this.store.setEnergyReference(systemId, date, rawValue);
            const ref = this.store.getEnergyReference(systemId, date);
            // Differenz = heutiger Verbrauch/Ertrag (Wh)
            const diff = rawValue - ref;
            return Math.max(0, diff);
        } else if (energyType === 'daily') {
            // Datenpunkt liefert bereits Tagesertrag (Annahme: kWh → Wh)
            return rawValue * 1000;
        } else if (energyType === 'calculated') {
            // Kein Energiezähler: Energie aus Leistung integrieren
            return this._integrateEnergy(systemId, date, powerW || 0);
        }
        return 0;
    }

    /**
     * Energie aus Leistung berechnen durch Integration über die Zeit.
     * Bei jedem Poll wird P * Δt zum Tagesakkumulator addiert.
     */
    _integrateEnergy(systemId, date, powerW) {
        const now = Date.now();
        const key = `${systemId}_${date}`;

        if (!this._lastPollTimes) this._lastPollTimes = {};
        if (!this._accumulatedEnergy) this._accumulatedEnergy = {};

        // Bei neuem Tag zurücksetzen
        const prevKey = this._lastPollTimes[systemId]?.key;
        if (prevKey && prevKey !== key) {
            this._accumulatedEnergy[key] = 0;
        }

        // Initialisieren falls erster Aufruf
        if (this._accumulatedEnergy[key] == null) {
            // Bestehenden Wert aus DB laden (falls App neugestartet)
            const existing = this.store.getEnergyReference(systemId, date);
            this._accumulatedEnergy[key] = existing || 0;
        }

        // Δt berechnen (in Stunden)
        const lastTime = this._lastPollTimes[systemId]?.ts;
        if (lastTime) {
            const dtHours = (now - lastTime) / 3600000; // ms → h
            // P (W) × t (h) = E (Wh)
            this._accumulatedEnergy[key] += powerW * dtHours;
        }

        this._lastPollTimes[systemId] = { ts: now, key };

        // Akkumulierte Energie als Referenz speichern (für App-Neustart)
        this.store.setEnergyReferenceForce(systemId, date, this._accumulatedEnergy[key]);

        return Math.max(0, this._accumulatedEnergy[key]);
    }

    // ─── Prognosen ────────────────────────────────────────────────────

    async _updatePvForecast() {
        try {
            console.log('[EMS] Aktualisiere PV-Prognose...');
            await this.pvForecast.fetchAllForecasts(this.cfg.pvSystems, this.store);
            this._updateConsumptionForecast();
        } catch (err) {
            console.error('[EMS] PV-Prognose Fehler:', err.message);
        }
    }

    async _updateConsumptionForecast() {
        const today = new Date().toISOString().split('T')[0];
        // Feiertag-Status für Prognose bestimmen
        let isHoliday = this._isHoliday;
        if (!isHoliday && this.cfg.holidays && this.cfg.holidays.datapoint) {
            isHoliday = await this.client.isHoliday(this.cfg.holidays.datapoint);
        }
        const forecast = this.forecastEngine.calculateFullDayForecast(this.cfg, today, { isHoliday });
        this._emit('forecast', forecast);
        console.log(`[EMS] Verbrauchsprognose aktualisiert (${forecast.dayType}, ${forecast.season}).`);
        return forecast;
    }

    // ─── Datenabfragen ───────────────────────────────────────────────

    /**
     * Aktueller Zustand aller Systeme.
     */
    getCurrentState() {
        const currentValues = this.store.getCurrentValues();
        const state = {
            timestamp: this._lastPoll,
            connected: this._connected,
            systems: {}
        };

        for (const row of currentValues) {
            state.systems[row.system_id] = {
                power: row.power_w,
                energyTotal: row.energy_total_wh,
                extra: row.extra_json ? JSON.parse(row.extra_json) : null,
                updatedAt: row.updated_at
            };
        }

        return state;
    }

    /**
     * Stündliche Daten eines Systems für einen Tag.
     */
    getHourlyData(systemId, date) {
        return this.store.getHourlyEnergy(systemId, date);
    }

    /**
     * Komplette Tagesprognose mit allen Systemen + Ist-Daten.
     */
    getDayForecast(date) {
        const d = date || new Date().toISOString().split('T')[0];
        const result = this.forecastEngine.calculateFullDayForecast(this.cfg, d);

        // Ist-Daten pro Verbraucher anhängen
        for (const c of this.cfg.consumers) {
            if (result.systems[c.id]) {
                const hourly = this.store.getHourlyEnergy(c.id, d);
                const actual = {};
                for (const row of hourly) {
                    actual[row.hour] = row.power_avg;
                }
                result.systems[c.id].actual = actual;
            }
        }

        return result;
    }

    /**
     * Optimierten Tagesfahrplan erstellen.
     */
    getSchedule(date) {
        const d = date || new Date().toISOString().split('T')[0];
        const forecast = this.forecastEngine.calculateFullDayForecast(this.cfg, d);
        return this.scheduler.createSchedule(this.cfg, forecast);
    }

    /**
     * PV-Prognose für einen Tag inkl. Ist-Daten und Korrekturfaktoren.
     */
    getPvForecastData(date) {
        const today = date || new Date().toISOString().split('T')[0];
        const result = {};
        for (const pv of this.cfg.pvSystems) {
            const forecast = this.store.getPvForecast(pv.id, today);
            const accuracy = this.store.getPvAccuracy(pv.id, today);
            const corrections = this.store.getPvCorrectionFactors(pv.id, 14);

            // Korrigierte Prognose berechnen
            const corrByHour = {};
            for (const c of corrections) {
                corrByHour[c.hour] = Math.max(0.5, Math.min(2.0, c.avg_factor));
            }

            const correctedForecast = forecast.map(f => ({
                ...f,
                watts_corrected: Math.round(f.watts * (corrByHour[f.hour] || 1.0)),
                correction_factor: corrByHour[f.hour] || 1.0
            }));

            // Ist-Daten pro Stunde
            const actualByHour = {};
            for (const a of accuracy) {
                actualByHour[a.hour] = { actual_w: a.actual_w, deviation: a.deviation };
            }

            result[pv.id] = {
                name: pv.name,
                data: correctedForecast,
                actual: actualByHour,
                correctionDays: corrections.length > 0 ? corrections[0].day_count : 0
            };
        }
        result.combined = this.pvForecast.getCombinedForecast(this.store, today);

        // Kombinierte Ist-Daten
        const combinedActual = {};
        for (const pv of this.cfg.pvSystems) {
            const accuracy = this.store.getPvAccuracy(pv.id, today);
            for (const a of accuracy) {
                if (!combinedActual[a.hour]) combinedActual[a.hour] = 0;
                combinedActual[a.hour] += a.actual_w;
            }
        }
        result.combinedActual = combinedActual;

        return result;
    }

    /**
     * Tagesstatistiken.
     */
    getDailyStats(date) {
        return this.store.getDailyStats(date || new Date().toISOString().split('T')[0]);
    }

    _scheduleCleanup() {
        // Einmal täglich um 2:00 Uhr aufräumen
        const now = new Date();
        const next2am = new Date(now);
        next2am.setHours(2, 0, 0, 0);
        if (next2am <= now) next2am.setDate(next2am.getDate() + 1);
        const delay = next2am - now;

        setTimeout(() => {
            this.store.cleanupOldData(90);
            console.log('[EMS] Alte Daten aufgeräumt (> 90 Tage).');
            // Dann täglich wiederholen
            setInterval(() => this.store.cleanupOldData(90), 24 * 60 * 60 * 1000);
        }, delay);
    }
}

module.exports = EnergyManager;
