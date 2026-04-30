'use strict';

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'ems.db');

class DataStore {
    constructor() {
        this.db = null;
        this._saveInterval = null;
    }

    async init() {
        if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
        const SQL = await initSqlJs();
        if (fs.existsSync(DB_PATH)) {
            const buf = fs.readFileSync(DB_PATH);
            this.db = new SQL.Database(buf);
        } else {
            this.db = new SQL.Database();
        }
        this._initSchema();
        this._saveInterval = setInterval(() => this._persist(), 30000);
    }

    _initSchema() {
        this.db.run(`CREATE TABLE IF NOT EXISTS energy_hourly (
            system_id TEXT NOT NULL, date TEXT NOT NULL, hour INTEGER NOT NULL,
            power_avg REAL DEFAULT 0, energy_wh REAL DEFAULT 0, samples INTEGER DEFAULT 0,
            day_type TEXT DEFAULT 'workday',
            updated_at INTEGER NOT NULL, PRIMARY KEY (system_id, date, hour))`);
        // Migration: day_type-Spalte hinzufügen falls nicht vorhanden
        try { this.db.run('ALTER TABLE energy_hourly ADD COLUMN day_type TEXT DEFAULT \'workday\''); } catch(e) { /* exists */ }
        this.db.run(`CREATE TABLE IF NOT EXISTS current_values (
            system_id TEXT PRIMARY KEY, power_w REAL DEFAULT 0,
            energy_total_wh REAL DEFAULT 0, extra_json TEXT, updated_at INTEGER NOT NULL)`);
        this.db.run(`CREATE TABLE IF NOT EXISTS pv_forecast (
            pv_id TEXT NOT NULL, date TEXT NOT NULL, hour INTEGER NOT NULL,
            watts REAL DEFAULT 0, watt_hours REAL DEFAULT 0, fetched_at INTEGER NOT NULL,
            PRIMARY KEY (pv_id, date, hour))`);
        this.db.run(`CREATE TABLE IF NOT EXISTS consumption_forecast (
            system_id TEXT NOT NULL, date TEXT NOT NULL, hour INTEGER NOT NULL,
            power_avg REAL DEFAULT 0, energy_wh REAL DEFAULT 0, calculated_at INTEGER NOT NULL,
            PRIMARY KEY (system_id, date, hour))`);
        this.db.run(`CREATE TABLE IF NOT EXISTS daily_stats (
            system_id TEXT NOT NULL, date TEXT NOT NULL, total_wh REAL DEFAULT 0,
            peak_w REAL DEFAULT 0, updated_at INTEGER NOT NULL,
            PRIMARY KEY (system_id, date))`);
        // Referenzwerte für Summenzähler (Wert bei Tagesbeginn)
        this.db.run(`CREATE TABLE IF NOT EXISTS energy_reference (
            system_id TEXT NOT NULL, date TEXT NOT NULL,
            ref_value REAL DEFAULT 0, updated_at INTEGER NOT NULL,
            PRIMARY KEY (system_id, date))`);
        // PV-Prognose-Genauigkeit: Plan vs Ist pro Stunde
        this.db.run(`CREATE TABLE IF NOT EXISTS pv_forecast_accuracy (
            pv_id TEXT NOT NULL, date TEXT NOT NULL, hour INTEGER NOT NULL,
            forecast_w REAL DEFAULT 0, actual_w REAL DEFAULT 0,
            deviation REAL DEFAULT 0, correction_factor REAL DEFAULT 1.0,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (pv_id, date, hour))`);
    }

    _persist() {
        try {
            const data = this.db.export();
            fs.writeFileSync(DB_PATH, Buffer.from(data));
        } catch (e) {
            console.error('[DB] Persist fehlgeschlagen:', e.message);
        }
    }

    _all(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
    }

    _run(sql, params = []) {
        this.db.run(sql, params);
    }

    _get(sql, params = []) {
        const rows = this._all(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }

    // ─── Aktuelle Werte ───────────────────────────────────────────────

    upsertCurrentValue(systemId, powerW, energyTotalWh, extra = null) {
        this._run(`INSERT OR REPLACE INTO current_values (system_id, power_w, energy_total_wh, extra_json, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
            [systemId, powerW, energyTotalWh, extra ? JSON.stringify(extra) : null, Date.now()]);
    }

    getCurrentValues() {
        return this._all('SELECT * FROM current_values');
    }

    // ─── Stündliche Energie ───────────────────────────────────────────

    upsertHourlyEnergy(systemId, date, hour, powerAvg, energyWh, samples) {
        this._run(`INSERT OR REPLACE INTO energy_hourly
            (system_id, date, hour, power_avg, energy_wh, samples, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [systemId, date, hour, powerAvg, energyWh, samples, Date.now()]);
    }

    addHourlySample(systemId, date, hour, powerW, dayType = 'workday') {
        const existing = this._get(
            'SELECT power_avg, samples FROM energy_hourly WHERE system_id = ? AND date = ? AND hour = ?',
            [systemId, date, hour]);
        if (existing) {
            const newSamples = existing.samples + 1;
            const newAvg = existing.power_avg + (powerW - existing.power_avg) / newSamples;
            this._run(`UPDATE energy_hourly SET power_avg=?, energy_wh=?, samples=?, day_type=?, updated_at=?
                WHERE system_id=? AND date=? AND hour=?`,
                [newAvg, newAvg, newSamples, dayType, Date.now(), systemId, date, hour]);
        } else {
            this._run(`INSERT INTO energy_hourly (system_id, date, hour, power_avg, energy_wh, samples, day_type, updated_at)
                VALUES (?,?,?,?,?,?,?,?)`,
                [systemId, date, hour, powerW, powerW, 1, dayType, Date.now()]);
        }
    }

    getHourlyEnergy(systemId, date) {
        return this._all('SELECT * FROM energy_hourly WHERE system_id=? AND date=? ORDER BY hour',
            [systemId, date]);
    }

    getHourlyEnergyRange(systemId, dateFrom, dateTo) {
        return this._all(
            'SELECT * FROM energy_hourly WHERE system_id=? AND date>=? AND date<=? ORDER BY date, hour',
            [systemId, dateFrom, dateTo]);
    }

    getAverageHourlyProfile(systemId, days = 7) {
        return this._all(`SELECT hour, AVG(power_avg) as avg_power, AVG(energy_wh) as avg_energy, COUNT(*) as day_count
            FROM energy_hourly WHERE system_id=? AND date >= date('now', '-' || ? || ' days')
            GROUP BY hour ORDER BY hour`, [systemId, days]);
    }

    /**
     * Stundenprofil nach Tagestyp gefiltert (workday, weekend, holiday).
     * Fällt automatisch auf allgemeines Profil zurück wenn zu wenig Daten.
     */
    getAverageHourlyProfileByDayType(systemId, dayType, days = 30) {
        const typed = this._all(`SELECT hour, AVG(power_avg) as avg_power, AVG(energy_wh) as avg_energy, COUNT(*) as day_count
            FROM energy_hourly WHERE system_id=? AND day_type=? AND date >= date('now', '-' || ? || ' days')
            GROUP BY hour ORDER BY hour`, [systemId, dayType, days]);
        // Mindestens 3 Tage Daten für vertrauenswürdige Prognose
        if (typed.length > 0 && typed.some(r => r.day_count >= 3)) {
            return typed;
        }
        // Fallback: allgemeines Profil
        return this.getAverageHourlyProfile(systemId, days);
    }

    /**
     * Stundenprofil nach Wochentag (0=So, 1=Mo, ..., 6=Sa).
     * Fällt auf Tagestyp-Profil zurück wenn zu wenig Daten.
     */
    getAverageHourlyProfileByWeekday(systemId, weekday, dayType, days = 60) {
        // strftime('%w', date) gibt 0=So, 1=Mo, ..., 6=Sa
        const byDay = this._all(`SELECT hour, AVG(power_avg) as avg_power, AVG(energy_wh) as avg_energy, COUNT(*) as day_count
            FROM energy_hourly WHERE system_id=? AND CAST(strftime('%w', date) AS INTEGER)=?
            AND date >= date('now', '-' || ? || ' days')
            GROUP BY hour ORDER BY hour`, [systemId, weekday, days]);
        if (byDay.length > 0 && byDay.some(r => r.day_count >= 2)) {
            return byDay;
        }
        // Fallback: Tagestyp-Profil
        return this.getAverageHourlyProfileByDayType(systemId, dayType, days);
    }

    // ─── PV-Prognose ─────────────────────────────────────────────────

    savePvForecastBatch(pvId, entries) {
        const now = Date.now();
        for (const e of entries) {
            this._run(`INSERT OR REPLACE INTO pv_forecast (pv_id, date, hour, watts, watt_hours, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)`, [pvId, e.date, e.hour, e.watts, e.wattHours, now]);
        }
    }

    getPvForecast(pvId, date) {
        return this._all('SELECT * FROM pv_forecast WHERE pv_id=? AND date=? ORDER BY hour',
            [pvId, date]);
    }

    getAllPvForecastForDate(date) {
        return this._all('SELECT * FROM pv_forecast WHERE date=? ORDER BY pv_id, hour', [date]);
    }

    // ─── PV-Prognose-Genauigkeit ─────────────────────────────────────

    /**
     * Plan vs Ist für eine Stunde speichern.
     */
    savePvAccuracy(pvId, date, hour, forecastW, actualW) {
        const deviation = forecastW > 0 ? (actualW - forecastW) / forecastW : 0;
        const corrFactor = forecastW > 0 ? actualW / forecastW : 1.0;
        this._run(`INSERT OR REPLACE INTO pv_forecast_accuracy
            (pv_id, date, hour, forecast_w, actual_w, deviation, correction_factor, updated_at)
            VALUES (?,?,?,?,?,?,?,?)`,
            [pvId, date, hour, forecastW, actualW, deviation, corrFactor, Date.now()]);
    }

    /**
     * Plan vs Ist für einen Tag abfragen.
     */
    getPvAccuracy(pvId, date) {
        return this._all(
            'SELECT * FROM pv_forecast_accuracy WHERE pv_id=? AND date=? ORDER BY hour',
            [pvId, date]);
    }

    /**
     * Durchschnittlicher Korrekturfaktor pro Stunde der letzten N Tage.
     * Nur Stunden mit Prognose > 0 berücksichtigen.
     * Faktor wird auf 0.5..2.0 begrenzt (Ausreißer-Schutz).
     */
    getPvCorrectionFactors(pvId, days = 14) {
        return this._all(`SELECT hour,
                AVG(correction_factor) as avg_factor,
                AVG(deviation) as avg_deviation,
                COUNT(*) as day_count
            FROM pv_forecast_accuracy
            WHERE pv_id=? AND date >= date('now', '-' || ? || ' days')
                AND forecast_w > 50
            GROUP BY hour ORDER BY hour`, [pvId, days]);
    }

    /**
     * Tages-Zusammenfassung Plan vs Ist für die letzten N Tage.
     */
    getPvAccuracySummary(pvId, days = 14) {
        return this._all(`SELECT date,
                SUM(forecast_w) as total_forecast,
                SUM(actual_w) as total_actual,
                CASE WHEN SUM(forecast_w) > 0
                     THEN SUM(actual_w) / SUM(forecast_w)
                     ELSE 1.0 END as day_factor
            FROM pv_forecast_accuracy
            WHERE pv_id=? AND date >= date('now', '-' || ? || ' days')
            GROUP BY date ORDER BY date`, [pvId, days]);
    }

    // ─── Verbrauchsprognose ──────────────────────────────────────────

    saveConsumptionForecast(systemId, date, entries) {
        const now = Date.now();
        for (const e of entries) {
            this._run(`INSERT OR REPLACE INTO consumption_forecast
                (system_id, date, hour, power_avg, energy_wh, calculated_at)
                VALUES (?, ?, ?, ?, ?, ?)`, [systemId, date, e.hour, e.powerAvg, e.energyWh, now]);
        }
    }

    getConsumptionForecast(systemId, date) {
        return this._all('SELECT * FROM consumption_forecast WHERE system_id=? AND date=? ORDER BY hour',
            [systemId, date]);
    }

    // ─── Tagesstatistiken ────────────────────────────────────────────

    upsertDailyStats(systemId, date, totalWh, peakW) {
        const existing = this._get('SELECT total_wh, peak_w FROM daily_stats WHERE system_id=? AND date=?',
            [systemId, date]);
        if (existing) {
            this._run('UPDATE daily_stats SET total_wh=?, peak_w=?, updated_at=? WHERE system_id=? AND date=?',
                [Math.max(totalWh, existing.total_wh), Math.max(peakW, existing.peak_w), Date.now(), systemId, date]);
        } else {
            this._run('INSERT INTO daily_stats (system_id, date, total_wh, peak_w, updated_at) VALUES (?,?,?,?,?)',
                [systemId, date, totalWh, peakW, Date.now()]);
        }
    }

    getDailyStats(date) {
        return this._all('SELECT * FROM daily_stats WHERE date=?', [date]);
    }

    /**
     * Durchschnittlicher Tagesverbrauch (Wh) eines Systems über die letzten N Tage.
     * Optional nach Tagestyp filtern.
     */
    getAverageDailyConsumption(systemId, days = 30, dayType = null) {
        if (dayType) {
            // daily_stats hat kein day_type, aber energy_hourly schon
            // Summe der stündlichen Durchschnitte für den Tagestyp
            const rows = this._all(`SELECT hour, AVG(power_avg) as avg_power
                FROM energy_hourly WHERE system_id=? AND day_type=?
                AND date >= date('now', '-' || ? || ' days')
                GROUP BY hour`, [systemId, dayType, days]);
            const totalWh = rows.reduce((sum, r) => sum + (r.avg_power || 0), 0);
            return { totalWh: Math.round(totalWh), dayCount: rows.length > 0 ? rows[0].day_count || days : 0 };
        }
        const row = this._get(`SELECT AVG(total_wh) as avg_wh, COUNT(*) as day_count
            FROM daily_stats WHERE system_id=? AND total_wh > 0
            AND date >= date('now', '-' || ? || ' days')`, [systemId, days]);
        return { totalWh: Math.round(row?.avg_wh || 0), dayCount: row?.day_count || 0 };
    }

    /**
     * Minimale sinnvolle Betriebsleistung eines Verbrauchers berechnen.
     * = Durchschnitt der Leistung in Stunden, in denen das Gerät aktiv war (power > Schwelle).
     * Die Schwelle wird als 5% der Peak-Leistung gesetzt um Standby rauszufiltern.
     */
    getMinMeaningfulPower(systemId, days = 30) {
        // Erst Peak ermitteln
        const peakRow = this._get(`SELECT MAX(power_avg) as peak
            FROM energy_hourly WHERE system_id=?
            AND date >= date('now', '-' || ? || ' days')`, [systemId, days]);
        const peak = peakRow?.peak || 0;
        if (peak < 10) return { minPower: 0, avgRunPower: 0, peak: 0, runHoursPerDay: 0 };

        const threshold = peak * 0.05; // 5% vom Peak = Standby-Grenze

        // Durchschnittliche Laufleistung und Laufstunden pro Tag
        const row = this._get(`SELECT
                AVG(power_avg) as avg_run_power,
                COUNT(*) as total_run_hours
            FROM energy_hourly WHERE system_id=?
            AND power_avg > ?
            AND date >= date('now', '-' || ? || ' days')`, [systemId, threshold, days]);

        const dayCountRow = this._get(`SELECT COUNT(DISTINCT date) as days
            FROM energy_hourly WHERE system_id=?
            AND date >= date('now', '-' || ? || ' days')`, [systemId, days]);
        const totalDays = dayCountRow?.days || 1;

        const avgRunPower = Math.round(row?.avg_run_power || 0);
        const runHoursPerDay = Math.round((row?.total_run_hours || 0) / totalDays * 10) / 10;

        return {
            minPower: Math.round(avgRunPower * 0.6),  // 60% der mittleren Laufleistung = sinnvolle Minimalleistung
            avgRunPower,
            peak: Math.round(peak),
            runHoursPerDay
        };
    }

    // ─── Energie-Referenz (Summenzähler Tagesbeginn) ─────────────────

    /**
     * Referenzwert für den Tag setzen (erster Wert des Tages = Summenzählerstand um Mitternacht).
     * Wird nur gesetzt, wenn noch kein Wert für den Tag existiert.
     */
    setEnergyReference(systemId, date, refValue) {
        const existing = this._get(
            'SELECT ref_value FROM energy_reference WHERE system_id=? AND date=?',
            [systemId, date]);
        if (!existing) {
            this._run('INSERT INTO energy_reference (system_id, date, ref_value, updated_at) VALUES (?,?,?,?)',
                [systemId, date, refValue, Date.now()]);
        }
    }

    getEnergyReference(systemId, date) {
        const row = this._get(
            'SELECT ref_value FROM energy_reference WHERE system_id=? AND date=?',
            [systemId, date]);
        return row ? row.ref_value : null;
    }

    /**
     * Referenzwert erzwingen (überschreibt bestehenden Wert).
     * Wird für "calculated" energyType verwendet, um akkumulierte Energie zu persistieren.
     */
    setEnergyReferenceForce(systemId, date, refValue) {
        this._run(`INSERT OR REPLACE INTO energy_reference (system_id, date, ref_value, updated_at)
            VALUES (?,?,?,?)`,
            [systemId, date, refValue, Date.now()]);
    }

    // ─── Aufräumen ───────────────────────────────────────────────────

    cleanupOldData(keepDays = 90) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - keepDays);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        this._run('DELETE FROM energy_hourly WHERE date < ?', [cutoffStr]);
        this._run('DELETE FROM pv_forecast WHERE date < ?', [cutoffStr]);
        this._run('DELETE FROM consumption_forecast WHERE date < ?', [cutoffStr]);
        this._run('DELETE FROM daily_stats WHERE date < ?', [cutoffStr]);
        this._run('DELETE FROM energy_reference WHERE date < ?', [cutoffStr]);
    }

    close() {
        this._persist();
        if (this._saveInterval) clearInterval(this._saveInterval);
        this.db.close();
    }
}

module.exports = DataStore;
