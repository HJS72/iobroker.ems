'use strict';

/**
 * PV-Überschuss-Scheduler
 *
 * Drei Steuerungsmodi:
 * - controllable:     WP/AC – aktiv steuerbar, min 30min Lauf, min 30min Pause
 * - self_regulating:  Wallbox – nimmt sich selbst, min 1.6kW, blockiert Batterie
 * - recommend_start:  Waschmaschine/Trockner – optimale Startzeit-Empfehlung
 *
 * Batterie: Soll bei Sonnenuntergang voll sein, lädt NICHT während Wallbox aktiv.
 * Rein informativ – erstellt Empfehlungen, steuert nicht direkt.
 */

const MIN_RUN_BLOCKS = 1;   // 30min = 1 Block (bei 30-min-Raster), mapped auf 1h im Stundenraster
const MIN_PAUSE_BLOCKS = 1; // 30min Pause → im Stundenraster min 1h Pause
const WALLBOX_MIN_W = 1600;

class Scheduler {
    constructor(dataStore) {
        this.store = dataStore;
    }

    /**
     * Tagesfahrplan erstellen.
     */
    createSchedule(config, forecastResult) {
        const schedule = {
            date: forecastResult.date,
            sunsetHour: this._findSunsetHour(forecastResult),
            devices: [],
            hourly: [],
            batteryPlan: null,
            recommendations: [],
            summary: {}
        };

        // ─── Gerätebedarf ermitteln ──────────────────────────────────
        const devices = this._analyzeDevices(config, forecastResult);
        schedule.devices = devices;

        // ─── Verfügbare PV-Energie (Überschuss nach Grundverbrauch) ──
        const surplus = this._calculateSurplus(forecastResult);

        // ─── Phase 1: Steuerbare Geräte (WP/AC) mit Laufzeitregeln ──
        const controllable = devices.filter(d => d.controlMode === 'controllable' && d.status !== 'not_needed');
        this._scheduleControllable(controllable, surplus);

        // ─── Phase 2: Wallbox (self_regulating) → blockiert Batterie ─
        const wallbox = devices.find(d => d.controlMode === 'self_regulating');
        const wallboxHours = new Set();
        if (wallbox && wallbox.status !== 'not_needed') {
            this._scheduleWallbox(wallbox, surplus);
            for (const sh of wallbox.scheduledHours) wallboxHours.add(sh.hour);
        }

        // ─── Phase 3: Batterie – Voll bei Sunset, NICHT während Wallbox
        const battery = this._getBatteryInfo(config);
        if (battery) {
            schedule.batteryPlan = this._planBattery(battery, surplus, schedule.sunsetHour, wallboxHours);
        }

        // ─── Phase 4: Startzeit-Empfehlungen (Waschmaschine, Trockner)
        const recommenders = devices.filter(d => d.controlMode === 'recommend_start');
        for (const dev of recommenders) {
            this._recommendStartTime(dev, surplus, schedule);
        }

        // ─── Stundentabelle + Zusammenfassung ────────────────────────
        schedule.hourly = this._buildHourlyPlan(surplus, devices, schedule);
        schedule.summary = this._buildSummary(schedule);

        return schedule;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Hilfsfunktionen
    // ═══════════════════════════════════════════════════════════════════

    _findSunsetHour(forecastResult) {
        let sunset = 18;
        for (const gb of forecastResult.gridBalance) {
            if (gb.pvTotalCorrected > 100) sunset = gb.hour;
        }
        return Math.min(21, sunset + 1);
    }

    /**
     * Geräte analysieren inkl. controlMode.
     */
    _analyzeDevices(config, forecastResult) {
        const devices = [];

        for (const consumer of config.consumers) {
            if (consumer.energyType === 'balance') continue;

            const controlMode = consumer.controlMode || this._inferControlMode(consumer.type);
            if (controlMode === 'none') continue;

            const sys = forecastResult.systems[consumer.id];
            if (!sys) continue;

            const powerStats = this.store.getMinMeaningfulPower(consumer.id, 30);
            const dailyDemand = this.store.getAverageDailyConsumption(consumer.id, 30);

            const forecastDemandWh = (sys.forecast || [])
                .reduce((sum, f) => sum + (f.energyWh || f.powerAvg || 0), 0);

            // Temperatur / Dringlichkeit
            let tempNeed = null;
            let urgency = 'normal';
            const currentValues = this.store.getCurrentValues();
            const cv = currentValues.find(v => v.system_id === consumer.id);
            if (cv && cv.extra_json) {
                try {
                    const extra = JSON.parse(cv.extra_json);
                    if (extra.tempCurrent != null && extra.tempStart != null && extra.tempEnd != null) {
                        tempNeed = {
                            current: extra.tempCurrent,
                            start: extra.tempStart,
                            end: extra.tempEnd,
                            mode: extra.tempMode || (consumer.type === 'aircon' ? 'cooling' : 'heating')
                        };
                        if (tempNeed.mode === 'heating' && extra.tempCurrent < extra.tempStart) urgency = 'high';
                        else if (tempNeed.mode === 'cooling' && extra.tempCurrent > extra.tempStart) urgency = 'high';
                        else if (tempNeed.mode === 'heating' && extra.tempCurrent >= extra.tempEnd) urgency = 'none';
                        else if (tempNeed.mode === 'cooling' && extra.tempCurrent <= extra.tempEnd) urgency = 'none';
                    }
                } catch (e) { /* ignore */ }
            }

            // EV-Daten
            let evInfo = null;
            if (consumer.type === 'wallbox' && cv && cv.extra_json) {
                try {
                    const extra = JSON.parse(cv.extra_json);
                    evInfo = { soc: extra.evSoc, range: extra.evRange, capacity: extra.evBatteryCapacity || consumer.evBatteryCapacity };
                } catch (e) { /* ignore */ }
            }

            const avgPower = powerStats.avgRunPower || 500;
            const demandWh = forecastDemandWh || dailyDemand.totalWh;
            const estimatedRunHours = avgPower > 0 ? Math.ceil(demandWh / avgPower * 10) / 10 : 0;

            // Typische Programm-Laufzeit für recommend_start (aus Statistik)
            let typicalRunHours = null;
            if (controlMode === 'recommend_start') {
                typicalRunHours = powerStats.runHoursPerDay || estimatedRunHours || 2;
            }

            // Priorität
            let priority, minPower;
            switch (consumer.type) {
                case 'heatpump':
                    priority = urgency === 'high' ? 1 : 2;
                    minPower = powerStats.minPower || 500;
                    break;
                case 'aircon':
                    priority = urgency === 'high' ? 1 : 3;
                    minPower = powerStats.minPower || 300;
                    break;
                case 'wallbox':
                    priority = 6;
                    minPower = WALLBOX_MIN_W;
                    break;
                case 'washer': case 'dryer':
                    priority = 4;
                    minPower = powerStats.minPower || 400;
                    break;
                default:
                    priority = 5;
                    minPower = powerStats.minPower || 100;
            }

            devices.push({
                id: consumer.id,
                name: consumer.name,
                type: consumer.type,
                controlMode,
                priority,
                urgency,
                minPower,
                avgRunPower: avgPower,
                peakPower: powerStats.peak || avgPower,
                demandWh,
                estimatedRunHours,
                typicalRunHours,
                tempNeed,
                evInfo,
                scheduledHours: [],
                scheduledEnergyWh: 0,
                recommendation: null,
                status: urgency === 'none' ? 'not_needed' : 'pending'
            });
        }

        devices.sort((a, b) => a.priority - b.priority);
        return devices;
    }

    /**
     * Steuerungsmodus aus Gerätetyp ableiten (Fallback).
     */
    _inferControlMode(type) {
        switch (type) {
            case 'heatpump': case 'aircon': return 'controllable';
            case 'wallbox': return 'self_regulating';
            case 'washer': case 'dryer': return 'recommend_start';
            case 'house': return 'none';
            default: return 'none';
        }
    }

    _calculateSurplus(forecastResult) {
        const surplus = [];
        for (let hour = 0; hour < 24; hour++) {
            const gb = forecastResult.gridBalance[hour];
            surplus.push({
                hour,
                pvW: gb?.pvTotalCorrected || 0,
                baseLoadW: gb?.consumptionTotal || 0,
                availableW: gb?.feedIn || 0,
                remainingW: gb?.feedIn || 0
            });
        }
        return surplus;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Phase 1: Steuerbare Geräte (WP/AC) mit min Lauf-/Pausenzeit
    // ═══════════════════════════════════════════════════════════════════

    _scheduleControllable(devices, surplus) {
        for (const device of devices) {
            let remainingDemand = device.demandWh;

            // Alle Stunden mit genug Überschuss finden
            const candidateHours = [];
            for (let h = 0; h < 24; h++) {
                if (surplus[h].remainingW >= device.minPower) {
                    candidateHours.push({ hour: h, available: surplus[h].remainingW });
                }
            }

            // Zusammenhängende Blöcke bilden (min 1h Lauf)
            const blocks = this._findContiguousBlocks(candidateHours);

            // Blöcke nach Größe sortieren (längste zuerst für bessere Abdeckung)
            blocks.sort((a, b) => b.length - a.length);

            let lastScheduledHour = -99; // Für Pausenregel
            for (const block of blocks) {
                if (remainingDemand <= 0) break;
                if (block.length < MIN_RUN_BLOCKS) continue;

                // Pausenregel: min 1h Abstand zum letzten Block
                const blockStart = block[0].hour;
                if (lastScheduledHour >= 0 && blockStart - lastScheduledHour < MIN_PAUSE_BLOCKS + 1) {
                    continue;
                }

                for (const ch of block) {
                    if (remainingDemand <= 0) break;
                    const usableW = Math.min(ch.available, device.avgRunPower);
                    device.scheduledHours.push({ hour: ch.hour, powerW: Math.round(usableW), pvOnly: true });
                    surplus[ch.hour].remainingW -= usableW;
                    remainingDemand -= usableW;
                    device.scheduledEnergyWh += usableW;
                    lastScheduledHour = ch.hour;
                }
            }

            this._updateDeviceStatus(device);
            device.scheduledHours.sort((a, b) => a.hour - b.hour);
        }
    }

    /**
     * Zusammenhängende Stunden-Blöcke finden.
     */
    _findContiguousBlocks(hours) {
        if (hours.length === 0) return [];
        const blocks = [];
        let current = [hours[0]];
        for (let i = 1; i < hours.length; i++) {
            if (hours[i].hour === hours[i - 1].hour + 1) {
                current.push(hours[i]);
            } else {
                blocks.push(current);
                current = [hours[i]];
            }
        }
        blocks.push(current);
        return blocks;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Phase 2: Wallbox (self_regulating) – nimmt sich was da ist
    // ═══════════════════════════════════════════════════════════════════

    _scheduleWallbox(device, surplus) {
        let remainingDemand = device.demandWh;

        // Stunden mit genug Überschuss, nach Verfügbarkeit sortiert
        const candidates = [];
        for (let h = 0; h < 24; h++) {
            if (surplus[h].remainingW >= WALLBOX_MIN_W) {
                candidates.push({ hour: h, available: surplus[h].remainingW });
            }
        }
        candidates.sort((a, b) => b.available - a.available);

        for (const ch of candidates) {
            if (remainingDemand <= 0) break;
            const usableW = Math.min(ch.available, device.avgRunPower);
            device.scheduledHours.push({ hour: ch.hour, powerW: Math.round(usableW), pvOnly: true });
            surplus[ch.hour].remainingW -= usableW;
            remainingDemand -= usableW;
            device.scheduledEnergyWh += usableW;
        }

        this._updateDeviceStatus(device);
        device.scheduledHours.sort((a, b) => a.hour - b.hour);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Phase 3: Batterie – NICHT während Wallbox-Stunden
    // ═══════════════════════════════════════════════════════════════════

    _getBatteryInfo(config) {
        const batteryPv = config.pvSystems.find(pv => pv.hasBattery);
        if (!batteryPv) return null;

        const currentValues = this.store.getCurrentValues();
        const cv = currentValues.find(v => v.system_id === batteryPv.id);
        let soc = 50;
        if (cv && cv.extra_json) {
            try {
                const extra = JSON.parse(cv.extra_json);
                soc = extra.batterySoc || 50;
            } catch (e) { /* ignore */ }
        }

        return {
            pvId: batteryPv.id,
            capacityWh: 10240,
            maxChargeW: 5000,
            currentSoc: soc,
            currentEnergyWh: soc / 100 * 10240,
            targetSoc: 100,
            neededWh: Math.max(0, (100 - soc) / 100 * 10240)
        };
    }

    /**
     * Batterie-Ladestrategie: Voll bei Sonnenuntergang.
     * Kein Laden während Wallbox-Stunden (Solaredge deaktiviert Batterie bei Wallbox-Betrieb).
     */
    _planBattery(battery, surplus, sunsetHour, wallboxHours) {
        if (battery.neededWh <= 0) {
            return { ...battery, plan: 'full', chargeHours: [], wallboxBlocked: [] };
        }

        const chargeHours = [];
        const wallboxBlocked = [];
        let remainingNeedWh = battery.neededWh;

        // Von Sonnenuntergang rückwärts planen, Wallbox-Stunden auslassen
        for (let h = sunsetHour - 1; h >= 0 && remainingNeedWh > 0; h--) {
            if (wallboxHours.has(h)) {
                wallboxBlocked.push(h);
                continue; // Batterie ist deaktiviert während Wallbox lädt
            }
            const s = surplus[h];
            if (s.remainingW > 500) {
                const chargeW = Math.min(s.remainingW, battery.maxChargeW, remainingNeedWh);
                chargeHours.unshift({ hour: h, chargeW: Math.round(chargeW) });
                remainingNeedWh -= chargeW;
            }
        }

        return {
            ...battery,
            plan: remainingNeedWh <= 0 ? 'achievable' : 'partial',
            chargeHours,
            wallboxBlocked: [...wallboxBlocked].sort((a, b) => a - b),
            expectedEndSoc: Math.min(100, Math.round(
                battery.currentSoc + (battery.neededWh - remainingNeedWh) / battery.capacityWh * 100
            ))
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // Phase 4: Startzeit-Empfehlungen (Waschmaschine, Trockner)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Optimale Startzeit empfehlen basierend auf:
     * - Typischer Programmdauer (aus Statistik)
     * - Verfügbarem PV-Überschuss-Fenster
     * Gerät kann nicht gesteuert werden → nur Empfehlung.
     */
    _recommendStartTime(device, surplus, schedule) {
        const runHours = Math.ceil(device.typicalRunHours || 2);
        const avgPower = device.avgRunPower;

        // Zusammenhängende Fenster finden die groß genug sind
        let bestWindow = null;
        let bestScore = -1;

        for (let startH = 6; startH <= 20 - runHours; startH++) {
            // Prüfe ob genug Überschuss für die gesamte Laufzeit vorhanden
            let totalAvailable = 0;
            let minInWindow = Infinity;
            let viable = true;

            for (let h = startH; h < startH + runHours; h++) {
                const remaining = surplus[h].remainingW;
                if (remaining < device.minPower) {
                    viable = false;
                    break;
                }
                totalAvailable += remaining;
                minInWindow = Math.min(minInWindow, remaining);
            }

            if (!viable) continue;

            // Score: Bevorzuge Fenster wo Überschuss den Bedarf am besten deckt
            const avgSurplus = totalAvailable / runHours;
            const coverageRatio = Math.min(avgSurplus / avgPower, 2); // Cap bei 200%
            const score = coverageRatio * 100 + minInWindow / 100; // Bevorzuge gleichmäßig hohen Überschuss

            if (score > bestScore) {
                bestScore = score;
                bestWindow = {
                    startHour: startH,
                    endHour: startH + runHours,
                    avgSurplusW: Math.round(avgSurplus),
                    coveragePercent: Math.round(Math.min(avgSurplus / avgPower, 1) * 100)
                };
            }
        }

        if (bestWindow) {
            device.recommendation = {
                type: 'start_time',
                ...bestWindow,
                message: `Beste Startzeit: ${String(bestWindow.startHour).padStart(2, '0')}:00 – ${String(bestWindow.endHour).padStart(2, '0')}:00 (${bestWindow.coveragePercent}% PV-Deckung)`
            };
            device.status = bestWindow.coveragePercent >= 80 ? 'pv_covered' : 'pv_partial';
            device.coveragePercent = bestWindow.coveragePercent;
            schedule.recommendations.push({
                device: device.name,
                id: device.id,
                ...device.recommendation
            });
        } else {
            // Kein gutes PV-Fenster → empfehle trotzdem die sonnigste Zeit
            let bestHour = 12;
            let bestPv = 0;
            for (let h = 6; h <= 18; h++) {
                if (surplus[h].pvW > bestPv) {
                    bestPv = surplus[h].pvW;
                    bestHour = h;
                }
            }
            device.recommendation = {
                type: 'start_time',
                startHour: bestHour,
                endHour: Math.min(21, bestHour + runHours),
                avgSurplusW: 0,
                coveragePercent: 0,
                message: `Wenig PV-Überschuss. Ggf. ${String(bestHour).padStart(2, '0')}:00 starten (max PV-Erzeugung).`
            };
            device.status = 'grid_needed';
            device.coveragePercent = 0;
            schedule.recommendations.push({
                device: device.name,
                id: device.id,
                ...device.recommendation
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Status + Hilfsfunktionen
    // ═══════════════════════════════════════════════════════════════════

    _updateDeviceStatus(device) {
        const coveragePercent = device.demandWh > 0
            ? Math.round(device.scheduledEnergyWh / device.demandWh * 100) : 0;
        device.coveragePercent = coveragePercent;

        if (device.scheduledHours.length === 0) {
            device.status = device.urgency === 'high' ? 'grid_needed' : 'postpone';
        } else if (coveragePercent >= 80) {
            device.status = 'pv_covered';
        } else if (coveragePercent >= 30) {
            device.status = 'pv_partial';
        } else {
            device.status = device.urgency === 'high' ? 'pv_plus_grid' : 'pv_minimal';
        }
    }

    _buildHourlyPlan(surplus, devices, schedule) {
        const hourly = [];
        for (let h = 0; h < 24; h++) {
            const s = surplus[h];
            const hourDevices = [];

            for (const d of devices) {
                const sh = d.scheduledHours.find(sh => sh.hour === h);
                if (sh) {
                    hourDevices.push({
                        id: d.id, name: d.name, type: d.type,
                        controlMode: d.controlMode,
                        powerW: sh.powerW, pvOnly: sh.pvOnly
                    });
                }
            }

            let batteryChargeW = 0;
            let batteryBlocked = false;
            if (schedule.batteryPlan) {
                const bh = schedule.batteryPlan.chargeHours.find(ch => ch.hour === h);
                if (bh) batteryChargeW = bh.chargeW;
                batteryBlocked = (schedule.batteryPlan.wallboxBlocked || []).includes(h);
            }

            hourly.push({
                hour: h,
                pvW: s.pvW,
                baseLoadW: s.baseLoadW,
                surplusW: s.availableW,
                usedW: s.availableW - s.remainingW,
                unusedW: Math.max(0, s.remainingW),
                batteryChargeW,
                batteryBlocked,
                devices: hourDevices
            });
        }
        return hourly;
    }

    _buildSummary(schedule) {
        const totalPvAvailable = schedule.hourly.reduce((sum, h) => sum + h.surplusW, 0);
        const totalUsed = schedule.hourly.reduce((sum, h) => sum + h.usedW, 0);
        const totalUnused = schedule.hourly.reduce((sum, h) => sum + h.unusedW, 0);
        const totalBatteryCharge = schedule.hourly.reduce((sum, h) => sum + h.batteryChargeW, 0);

        const pvSelfUsePercent = totalPvAvailable > 0
            ? Math.round((totalUsed + totalBatteryCharge) / totalPvAvailable * 100) : 0;

        return {
            totalPvSurplusWh: Math.round(totalPvAvailable),
            totalScheduledWh: Math.round(totalUsed),
            totalBatteryChargeWh: Math.round(totalBatteryCharge),
            totalUnusedWh: Math.round(totalUnused),
            pvSelfUsePercent: Math.min(100, pvSelfUsePercent),
            sunsetHour: schedule.sunsetHour,
            batteryEndSoc: schedule.batteryPlan?.expectedEndSoc || null,
            recommendations: schedule.recommendations
        };
    }
}

module.exports = Scheduler;
