'use strict';

/**
 * Verbrauchsprognose-Engine
 *
 * Erstellt stündliche Verbrauchsprognosen basierend auf:
 * 1. Tagestyp (Werktag / Wochenende / Feiertag) mit Wochentag-Feingranularität
 * 2. Saison/Monat (z.B. Wärmepumpe nur im Sommer aktiv)
 * 3. Historischen Durchschnittswerten gewichtet nach ähnlichem Tagestyp
 * 4. Aktuellem Tagesverlauf (Ist-Daten ersetzen Prognose)
 * 5. PV-Prognose für Erzeugung
 */

// Saison-Definitionen
const SEASON_MONTHS = {
    winter: [12, 1, 2],
    spring: [3, 4, 5],
    summer: [6, 7, 8],
    autumn: [9, 10, 11]
};

class ForecastEngine {
    constructor(dataStore) {
        this.store = dataStore;
    }

    /**
     * Aktuelle Saison ermitteln.
     */
    static getSeason(date) {
        const month = (typeof date === 'string' ? new Date(date) : date).getMonth() + 1;
        for (const [season, months] of Object.entries(SEASON_MONTHS)) {
            if (months.includes(month)) return season;
        }
        return 'summer';
    }

    /**
     * Tagestyp bestimmen.
     * @param {Date} date
     * @param {boolean} isHoliday - Feiertag laut Feiertage-Adapter
     * @returns {'workday'|'weekend'|'holiday'}
     */
    static getDayType(date, isHoliday = false) {
        if (isHoliday) return 'holiday';
        const dow = date.getDay(); // 0=So, 6=Sa
        return (dow === 0 || dow === 6) ? 'weekend' : 'workday';
    }

    /**
     * Prüft ob ein Verbraucher in der aktuellen Saison aktiv ist.
     * @param {object} consumer - Consumer-Config mit optionalem "seasons" Array
     * @param {string} season - Aktuelle Saison
     * @returns {boolean}
     */
    static isActiveInSeason(consumer, season) {
        if (!consumer.seasons || consumer.seasons.length === 0) return true;
        return consumer.seasons.includes(season);
    }

    /**
     * Tagesprognose für ein System berechnen – kontextbezogen.
     *
     * Reihenfolge der Profil-Auflösung (Fallback-Kaskade):
     * 1. Gleicher Wochentag (z.B. alle Montage der letzten 60 Tage)
     * 2. Gleicher Tagestyp (workday/weekend/holiday der letzten 30 Tage)
     * 3. Allgemeiner Durchschnitt (letzte 7 Tage)
     *
     * @param {string} systemId
     * @param {string} date - YYYY-MM-DD
     * @param {object} context - { dayType, weekday, season, isActive, heatpump }
     */
    calculateDayForecast(systemId, date, context = {}) {
        const now = new Date();
        const currentHour = now.getHours();
        const isToday = date === now.toISOString().split('T')[0];

        const dayType = context.dayType || 'workday';
        const weekday = context.weekday ?? now.getDay();
        const isActive = context.isActive !== false; // default: aktiv

        // Ist-Daten für heute
        const actualData = this.store.getHourlyEnergy(systemId, date);
        const actualByHour = {};
        for (const row of actualData) {
            actualByHour[row.hour] = row;
        }

        // Historisches Profil: Wochentag → Tagestyp → Allgemein (Fallback-Kaskade)
        let profile;
        if (dayType === 'workday') {
            // Für Werktage: erst gleicher Wochentag, dann alle Werktage
            profile = this.store.getAverageHourlyProfileByWeekday(systemId, weekday, dayType, 60);
        } else {
            // Wochenende/Feiertag: nach Tagestyp
            profile = this.store.getAverageHourlyProfileByDayType(systemId, dayType, 30);
        }

        const profileByHour = {};
        for (const row of profile) {
            profileByHour[row.hour] = row;
        }

        const forecast = [];
        for (let hour = 0; hour < 24; hour++) {
            let powerAvg = 0;
            let energyWh = 0;
            let source = 'forecast';

            if (isToday && hour <= currentHour && actualByHour[hour]) {
                powerAvg = actualByHour[hour].power_avg;
                energyWh = actualByHour[hour].energy_wh;
                source = 'actual';
            } else if (!isActive) {
                // Gerät in dieser Saison nicht aktiv → 0
                powerAvg = 0;
                energyWh = 0;
                source = 'season_off';
            } else if (context.tempControl && profileByHour[hour]) {
                // Temperatur-basierte Anpassung (Heizung oder Kühlung)
                const tc = context.tempControl;
                const basePower = profileByHour[hour].avg_power;
                if (tc.tempCurrent != null && tc.tempStart != null && tc.tempEnd != null) {
                    let factor;
                    if (tc.mode === 'cooling') {
                        // Kühlung: tempStart > tempEnd (z.B. 25°C → 22°C)
                        const tempRange = tc.tempStart - tc.tempEnd;
                        if (tempRange > 0) {
                            // Über tempStart: voller Bedarf, bei tempEnd: kein Bedarf
                            const tempProgress = Math.max(0, Math.min(1, (tc.tempStart - tc.tempCurrent) / tempRange));
                            factor = Math.max(0, 1 - tempProgress);
                        } else {
                            factor = 1;
                        }
                    } else {
                        // Heizung: tempStart < tempEnd (z.B. 38°C → 48°C)
                        const tempRange = tc.tempEnd - tc.tempStart;
                        if (tempRange > 0) {
                            const tempProgress = Math.max(0, Math.min(1, (tc.tempCurrent - tc.tempStart) / tempRange));
                            factor = Math.max(0, 1 - tempProgress);
                        } else {
                            factor = 1;
                        }
                    }
                    powerAvg = basePower * factor;
                    energyWh = powerAvg;
                    source = 'temp_forecast';
                } else {
                    powerAvg = basePower;
                    energyWh = profileByHour[hour].avg_energy;
                }
            } else if (profileByHour[hour]) {
                powerAvg = profileByHour[hour].avg_power;
                energyWh = profileByHour[hour].avg_energy;
                source = 'forecast';
            }

            forecast.push({
                hour,
                powerAvg: Math.round(powerAvg),
                energyWh: Math.round(energyWh),
                source,
                dayType
            });
        }

        return forecast;
    }

    /**
     * Gesamtprognose für alle Systeme + Netz-Bilanz berechnen.
     * @param {object} config - App-Konfiguration
     * @param {string} date - YYYY-MM-DD
     * @param {object} context - { isHoliday }
     */
    calculateFullDayForecast(config, date, context = {}) {
        const targetDate = new Date(date + 'T12:00:00');
        const dayType = ForecastEngine.getDayType(targetDate, context.isHoliday);
        const weekday = targetDate.getDay();
        const season = ForecastEngine.getSeason(targetDate);

        const result = {
            date,
            dayType,
            season,
            systems: {},
            pvForecast: {},
            gridBalance: [],
            totals: { production: 0, consumption: 0, feedIn: 0, purchase: 0 }
        };

        // Verbrauchsprognosen
        for (const consumer of config.consumers) {
            const isActive = ForecastEngine.isActiveInSeason(consumer, season);

            // Temperatursteuerung: Wärmepumpe oder Klimaanlage
            let tempControl = null;
            if ((consumer.type === 'heatpump' || consumer.type === 'aircon') && consumer.datapoints.tempCurrent) {
                const currentValues = this.store.getCurrentValues();
                const cv = currentValues.find(v => v.system_id === consumer.id);
                if (cv && cv.extra_json) {
                    try {
                        const extra = JSON.parse(cv.extra_json);
                        tempControl = {
                            tempCurrent: extra.tempCurrent,
                            tempStart: extra.tempStart,
                            tempEnd: extra.tempEnd,
                            mode: consumer.type === 'aircon' ? 'cooling' : 'heating'
                        };
                    } catch (e) { /* ignore */ }
                }
            }

            const fc = this.calculateDayForecast(consumer.id, date, {
                dayType, weekday, season, isActive, tempControl
            });
            result.systems[consumer.id] = {
                name: consumer.name,
                type: 'consumer',
                seasonActive: isActive,
                forecast: fc
            };
            this.store.saveConsumptionForecast(consumer.id, date, fc);
        }

        // PV-Erzeugungsprognosen
        for (const pv of config.pvSystems) {
            const pvData = this.store.getPvForecast(pv.id, date);
            const corrections = this.store.getPvCorrectionFactors(pv.id, 14);
            const corrByHour = {};
            for (const c of corrections) {
                corrByHour[c.hour] = Math.max(0.5, Math.min(2.0, c.avg_factor));
            }

            const pvByHour = {};
            for (const row of pvData) {
                const factor = corrByHour[row.hour] || 1.0;
                pvByHour[row.hour] = {
                    watts: row.watts,
                    wattsCorrected: Math.round(row.watts * factor),
                    wattHours: row.watt_hours,
                    correctionFactor: factor
                };
            }
            result.pvForecast[pv.id] = {
                name: pv.name,
                hasBattery: pv.hasBattery,
                forecast: pvByHour
            };
        }

        // Grid-Bilanz berechnen (Stundenbasis) – korrigierte PV-Werte verwenden
        for (let hour = 0; hour < 24; hour++) {
            let pvTotal = 0;
            let pvTotalCorrected = 0;
            for (const pvId of Object.keys(result.pvForecast)) {
                const pvHour = result.pvForecast[pvId].forecast[hour];
                if (pvHour) {
                    pvTotal += pvHour.watts;
                    pvTotalCorrected += pvHour.wattsCorrected;
                }
            }

            let consumptionTotal = 0;
            for (const sysId of Object.keys(result.systems)) {
                const sysHour = result.systems[sysId].forecast.find(f => f.hour === hour);
                if (sysHour) consumptionTotal += sysHour.powerAvg;
            }

            // Bilanz auf Basis korrigierter Werte
            const balance = pvTotalCorrected - consumptionTotal;
            const feedIn = Math.max(0, balance);
            const purchase = Math.max(0, -balance);

            // Auch unkorigierte Bilanz für Vergleich
            const balanceRaw = pvTotal - consumptionTotal;
            const feedInRaw = Math.max(0, balanceRaw);
            const purchaseRaw = Math.max(0, -balanceRaw);

            result.gridBalance.push({
                hour,
                pvTotal: Math.round(pvTotal),
                pvTotalCorrected: Math.round(pvTotalCorrected),
                consumptionTotal: Math.round(consumptionTotal),
                balance: Math.round(balance),
                feedIn: Math.round(feedIn),
                purchase: Math.round(purchase),
                balanceRaw: Math.round(balanceRaw),
                feedInRaw: Math.round(feedInRaw),
                purchaseRaw: Math.round(purchaseRaw)
            });

            result.totals.production += pvTotalCorrected;
            result.totals.consumption += consumptionTotal;
            result.totals.feedIn += feedIn;
            result.totals.purchase += purchase;
        }

        // Auf Wh runden (1h Intervall → W ≈ Wh)
        result.totals.production = Math.round(result.totals.production);
        result.totals.consumption = Math.round(result.totals.consumption);
        result.totals.feedIn = Math.round(result.totals.feedIn);
        result.totals.purchase = Math.round(result.totals.purchase);

        // ─── Verbraucher-Priorisierung ──────────────────────────────
        result.priorities = this._calculatePriorities(config, result);

        return result;
    }

    /**
     * Verbraucher-Priorisierung basierend auf verfügbarer PV-Energie.
     *
     * Berechnet für jeden Verbraucher:
     * - Erwarteter Tagesbedarf (aus historischen Daten)
     * - Minimale sinnvolle Leistung (Ø Laufleistung × 0.6)
     * - Stunden mit PV-Überschuss >= Mindestleistung
     * - Ob der Bedarf aus PV gedeckt werden kann
     */
    _calculatePriorities(config, forecastResult) {
        const priorities = [];

        // Verfügbarer PV-Überschuss pro Stunde (korrigiert, nach Abzug des Grundverbrauchs)
        // Grundverbrauch = Hausverbrauch (balance consumer)
        const surplusByHour = {};
        for (const gb of forecastResult.gridBalance) {
            surplusByHour[gb.hour] = gb.feedIn; // Einspeisung = verfügbar für steuerbare Verbraucher
        }

        for (const consumer of config.consumers) {
            // Balance-Verbraucher (Haus) nicht priorisieren
            if (consumer.energyType === 'balance') continue;

            const sys = forecastResult.systems[consumer.id];
            if (!sys) continue;

            // Historische Daten
            const dailyDemand = this.store.getAverageDailyConsumption(consumer.id, 30);
            const powerStats = this.store.getMinMeaningfulPower(consumer.id, 30);

            // Prognostizierter Bedarf heute (Summe der Prognose-Stunden)
            const forecastDemandWh = (sys.forecast || [])
                .reduce((sum, f) => sum + (f.energyWh || f.powerAvg || 0), 0);

            // Stunden in denen PV-Überschuss >= Mindestleistung
            const viableHours = [];
            let viableEnergyWh = 0;
            for (let h = 0; h < 24; h++) {
                const surplus = surplusByHour[h] || 0;
                if (surplus >= powerStats.minPower && powerStats.minPower > 0) {
                    viableHours.push({ hour: h, surplusW: surplus });
                    viableEnergyWh += Math.min(surplus, powerStats.avgRunPower); // begrenzt auf reale Nutzung
                }
            }

            // Deckungsgrad: wieviel % des Bedarfs aus PV-Überschuss deckbar
            const demandWh = forecastDemandWh || dailyDemand.totalWh;
            const coveragePercent = demandWh > 0 ? Math.min(100, Math.round(viableEnergyWh / demandWh * 100)) : 0;

            // Empfehlung
            let recommendation;
            if (powerStats.minPower === 0) {
                recommendation = 'no_data'; // Noch keine Daten
            } else if (viableHours.length === 0) {
                recommendation = 'grid_only'; // Kein PV-Überschuss ausreichend
            } else if (coveragePercent >= 80) {
                recommendation = 'pv_full'; // Voll aus PV deckbar
            } else if (coveragePercent >= 30) {
                recommendation = 'pv_partial'; // Teilweise aus PV
            } else {
                recommendation = 'pv_minimal'; // Nur minimal aus PV
            }

            priorities.push({
                id: consumer.id,
                name: consumer.name,
                type: consumer.type,
                dailyDemandWh: demandWh,
                forecastDemandWh: Math.round(forecastDemandWh),
                historicalDailyWh: dailyDemand.totalWh,
                minPowerW: powerStats.minPower,
                avgRunPowerW: powerStats.avgRunPower,
                peakPowerW: powerStats.peak,
                avgRunHoursPerDay: powerStats.runHoursPerDay,
                viableHours: viableHours.length,
                viableWindows: viableHours,
                viableEnergyWh: Math.round(viableEnergyWh),
                coveragePercent,
                recommendation
            });
        }

        // Sortieren: höchster Deckungsgrad zuerst (PV-optimale Reihenfolge)
        priorities.sort((a, b) => b.coveragePercent - a.coveragePercent);

        return priorities;
    }
}

module.exports = ForecastEngine;
