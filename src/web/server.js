'use strict';

const express = require('express');
const path = require('path');

/**
 * Web-Server für das EMS Dashboard.
 * REST-API + statische Dateien.
 */
function createWebServer(energyManager, port) {
    const app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    // ─── REST API ─────────────────────────────────────────────────────

    // Build-Version
    app.get('/api/version', (req, res) => {
        res.json({ version: process.env.EMS_BUILD_VERSION || '0.000000.0000' });
    });

    // Aktueller Zustand aller Systeme
    app.get('/api/current', (req, res) => {
        res.json(energyManager.getCurrentState());
    });

    // Konfiguration (ohne sensible Daten)
    app.get('/api/config', (req, res) => {
        const cfg = require('../config').get();
        res.json({
            pvSystems: cfg.pvSystems.map(pv => ({
                id: pv.id, name: pv.name, kwp: pv.kwp,
                hasBattery: pv.hasBattery,
                datapoints: pv.datapoints
            })),
            consumers: cfg.consumers.map(c => ({
                id: c.id, name: c.name, type: c.type,
                energyType: c.energyType,
                datapoints: c.datapoints,
                evBatteryCapacity: c.evBatteryCapacity || null
            })),
            grid: { name: cfg.grid.name },
            location: cfg.location
        });
    });

    // Tagesprognose komplett
    app.get('/api/forecast/:date?', (req, res) => {
        const date = req.params.date || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Ungültiges Datum (YYYY-MM-DD)' });
        }
        res.json(energyManager.getDayForecast(date));
    });

    // PV-Prognose
    app.get('/api/pv-forecast/:date?', (req, res) => {
        const date = req.params.date || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Ungültiges Datum (YYYY-MM-DD)' });
        }
        res.json(energyManager.getPvForecastData(date));
    });

    // Tagesfahrplan / Scheduling
    app.get('/api/schedule/:date?', (req, res) => {
        const date = req.params.date || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Ungültiges Datum (YYYY-MM-DD)' });
        }
        res.json(energyManager.getSchedule(date));
    });

    // Stündliche Daten eines Systems
    app.get('/api/hourly/:systemId/:date?', (req, res) => {
        const { systemId } = req.params;
        const date = req.params.date || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Ungültiges Datum (YYYY-MM-DD)' });
        }
        res.json(energyManager.getHourlyData(systemId, date));
    });

    // Tagesstatistiken
    app.get('/api/daily-stats/:date?', (req, res) => {
        const date = req.params.date || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Ungültiges Datum (YYYY-MM-DD)' });
        }
        res.json(energyManager.getDailyStats(date));
    });

    // PV-Prognose manuell aktualisieren
    app.post('/api/refresh-forecast', async (req, res) => {
        try {
            await energyManager._updatePvForecast();
            res.json({ success: true, message: 'Prognose aktualisiert' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─── Konfigurations-API ──────────────────────────────────────

    // Vollständige Konfiguration lesen (für Config-Seite)
    app.get('/api/config/full', (req, res) => {
        const cfg = require('../config').get();
        res.json(cfg);
    });

    // Konfiguration speichern
    app.put('/api/config', (req, res) => {
        try {
            const newCfg = req.body;

            // Validierung
            if (!newCfg || typeof newCfg !== 'object') {
                return res.status(400).json({ error: 'Ungültige Konfiguration' });
            }
            if (!newCfg.iobroker || !newCfg.iobroker.host) {
                return res.status(400).json({ error: 'ioBroker Host ist erforderlich' });
            }
            if (!newCfg.location || typeof newCfg.location.latitude !== 'number') {
                return res.status(400).json({ error: 'Standort (Latitude) ist erforderlich' });
            }
            if (!Array.isArray(newCfg.pvSystems)) {
                return res.status(400).json({ error: 'PV-Systeme müssen ein Array sein' });
            }
            if (!Array.isArray(newCfg.consumers)) {
                return res.status(400).json({ error: 'Verbraucher müssen ein Array sein' });
            }

            // IDs auf gültige Zeichen prüfen
            const idPattern = /^[a-z0-9_]+$/;
            for (const pv of newCfg.pvSystems) {
                if (!pv.id || !idPattern.test(pv.id)) {
                    return res.status(400).json({ error: `PV-ID "${pv.id}" ungültig (nur a-z, 0-9, _)` });
                }
            }
            for (const c of newCfg.consumers) {
                if (!c.id || !idPattern.test(c.id)) {
                    return res.status(400).json({ error: `Verbraucher-ID "${c.id}" ungültig (nur a-z, 0-9, _)` });
                }
            }

            // Doppelte IDs prüfen
            const allIds = [
                ...newCfg.pvSystems.map(p => p.id),
                ...newCfg.consumers.map(c => c.id)
            ];
            const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
            if (dupes.length > 0) {
                return res.status(400).json({ error: `Doppelte IDs: ${dupes.join(', ')}` });
            }

            require('../config').save(newCfg);
            console.log('[Web] Konfiguration gespeichert.');
            res.json({ success: true, message: 'Konfiguration gespeichert' });
        } catch (err) {
            console.error('[Web] Config-Save Fehler:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Verbindungstest
    app.post('/api/test-connection', async (req, res) => {
        try {
            const { protocol, host, port: p } = req.body;
            if (!host) return res.status(400).json({ error: 'Host fehlt' });

            const IoBrokerClient = require('../iobroker-client');
            const testClient = new IoBrokerClient({
                protocol: protocol || 'http',
                host,
                port: p || 8087
            });
            const ok = await testClient.testConnection();
            res.json({ success: ok });
        } catch (err) {
            res.json({ success: false, error: err.message });
        }
    });

    // Server starten
    const server = app.listen(port, () => {
        console.log(`[Web] Dashboard: http://localhost:${port}`);
        console.log(`[Web] Konfiguration: http://localhost:${port}/config.html`);
    });

    return server;
}

module.exports = createWebServer;
