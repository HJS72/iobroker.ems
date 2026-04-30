'use strict';

const fetch = require('node-fetch');

/**
 * PV-Prognose über forecast.solar (kostenlose API, kein API-Key nötig).
 *
 * API: https://api.forecast.solar/estimate/:lat/:lon/:dec/:az/:kwp
 * Rückgabe: watts (stündlich), watt_hours, watt_hours_period, watt_hours_day
 * Rate-Limit (free): 12 Aufrufe pro Stunde
 */
class PvForecast {
    constructor(latitude, longitude) {
        this.lat = latitude;
        this.lon = longitude;
        this.baseUrl = 'https://api.forecast.solar';
    }

    /**
     * Prognose für eine PV-Anlage abrufen.
     * @param {number} declination - Neigung 0-90°
     * @param {number} azimuth - Ausrichtung -180..180 (0=Süd)
     * @param {number} kwp - Installierte Leistung in kWp
     * @returns {Promise<Object>} Stündliche Prognosedaten
     */
    async fetchForecast(declination, azimuth, kwp) {
        const url = `${this.baseUrl}/estimate/${this.lat}/${this.lon}/${declination}/${azimuth}/${kwp}`;

        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            timeout: 15000
        });

        if (res.status === 429) {
            console.warn('[PV-Forecast] Rate limit erreicht, nächster Versuch später.');
            return null;
        }
        if (!res.ok) {
            throw new Error(`forecast.solar: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        if (data.message && data.message.code !== 0) {
            throw new Error(`forecast.solar Fehler: ${data.message.text}`);
        }

        return this._parseResponse(data.result);
    }

    /**
     * Parst die API-Antwort in ein strukturiertes stündliches Format.
     */
    _parseResponse(result) {
        const hourly = {};  // { "YYYY-MM-DD": { 0: {watts, wh}, 1: {...}, ... } }

        // watts: Durchschnittsleistung pro Periode
        if (result.watts) {
            for (const [timestamp, watts] of Object.entries(result.watts)) {
                const dt = new Date(timestamp.replace(' ', 'T'));
                const date = timestamp.split(' ')[0];
                const hour = dt.getHours();

                if (!hourly[date]) hourly[date] = {};
                if (!hourly[date][hour]) hourly[date][hour] = { watts: 0, wattHours: 0 };

                // Nimm den höheren Watt-Wert pro Stunde (mehrere Messpunkte möglich)
                hourly[date][hour].watts = Math.max(hourly[date][hour].watts, watts);
            }
        }

        // watt_hours_period: Energie pro Periode
        if (result.watt_hours_period) {
            for (const [timestamp, wh] of Object.entries(result.watt_hours_period)) {
                const dt = new Date(timestamp.replace(' ', 'T'));
                const date = timestamp.split(' ')[0];
                const hour = dt.getHours();

                if (!hourly[date]) hourly[date] = {};
                if (!hourly[date][hour]) hourly[date][hour] = { watts: 0, wattHours: 0 };

                hourly[date][hour].wattHours += wh;
            }
        }

        // Tageserträge
        const dailyTotals = {};
        if (result.watt_hours_day) {
            for (const [date, wh] of Object.entries(result.watt_hours_day)) {
                dailyTotals[date] = wh;
            }
        }

        // Flache Liste für DB-Speicherung
        const entries = [];
        for (const [date, hours] of Object.entries(hourly)) {
            for (const [hour, data] of Object.entries(hours)) {
                entries.push({
                    date,
                    hour: parseInt(hour),
                    watts: Math.round(data.watts),
                    wattHours: Math.round(data.wattHours)
                });
            }
        }

        return { hourly, dailyTotals, entries };
    }

    /**
     * Prognosen für alle PV-Systeme abrufen und in der DB speichern.
     * Beachtet das Rate-Limit (max 12/h free) - wartet zwischen Aufrufen.
     */
    async fetchAllForecasts(pvSystems, dataStore) {
        const results = {};
        for (let i = 0; i < pvSystems.length; i++) {
            const pv = pvSystems[i];
            console.log(`[PV-Forecast] Lade Prognose für ${pv.name} (${pv.kwp} kWp)...`);

            try {
                const forecast = await this.fetchForecast(pv.declination, pv.azimuth, pv.kwp);
                if (forecast) {
                    dataStore.savePvForecastBatch(pv.id, forecast.entries);
                    results[pv.id] = forecast;
                    console.log(`[PV-Forecast] ${pv.name}: ${forecast.entries.length} Stunden-Werte gespeichert.`);
                }
            } catch (err) {
                console.error(`[PV-Forecast] Fehler bei ${pv.name}:`, err.message);
            }

            // Pause zwischen API-Aufrufen (Rate-Limit schonen)
            if (i < pvSystems.length - 1) {
                await new Promise(r => setTimeout(r, 6000));
            }
        }
        return results;
    }

    /**
     * Kombinierte PV-Prognose für alle Anlagen an einem Tag (summiert).
     */
    getCombinedForecast(dataStore, date) {
        const allData = dataStore.getAllPvForecastForDate(date);
        const combined = {};
        for (const row of allData) {
            if (!combined[row.hour]) combined[row.hour] = { watts: 0, wattHours: 0 };
            combined[row.hour].watts += row.watts;
            combined[row.hour].wattHours += row.watt_hours;
        }
        return combined;
    }
}

module.exports = PvForecast;
