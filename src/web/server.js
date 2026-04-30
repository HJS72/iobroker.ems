'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, spawn } = require('child_process');
const fetch = require('node-fetch');
const cfgModule = require('../config');

function getUpdateConfig() {
    try {
        const cfg = cfgModule.get();
        return cfg.update || {};
    } catch (e) {
        return {};
    }
}

function getLocalVersion() {
    // Prefer build env var, fallback to package.json
    if (process.env.EMS_BUILD_VERSION && process.env.EMS_BUILD_VERSION.length > 0) return process.env.EMS_BUILD_VERSION;
    try {
        const p = require(path.join(PROJECT_ROOT, 'package.json'));
        return p.version || null;
    } catch (e) {
        return null;
    }
}

function parseGithubOwnerRepo(url) {
    // Accept forms: https://github.com/owner/repo(.git), git@github.com:owner/repo.git
    try {
        let owner = null; let repo = null;
        if (url.startsWith('git@')) {
            // git@github.com:owner/repo.git
            const m = url.match(/^git@[^:]+:([^/]+)\/(.+?)(\.git)?$/);
            if (m) { owner = m[1]; repo = m[2]; }
        } else {
            const u = new URL(url);
            if (u.hostname.endsWith('github.com')) {
                const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
                if (parts.length >= 2) { owner = parts[0]; repo = parts[1]; }
            }
        }
        if (owner && repo) return { owner, repo };
    } catch (e) {}
    return null;
}

function normalizeVersion(v) {
    if (!v) return v;
    return String(v).replace(/^v/i, '');
}

function buildGitEnv(updateCfg) {
    const env = { ...process.env };
    if (!updateCfg) return env;
    if (updateCfg.sshCommand && updateCfg.sshCommand.length > 0) {
        env.GIT_SSH_COMMAND = updateCfg.sshCommand;
    } else if (updateCfg.sshKey && updateCfg.sshKey.length > 0) {
        const sshOptions = updateCfg.sshOptions || '-o IdentitiesOnly=yes -o StrictHostKeyChecking=no';
        env.GIT_SSH_COMMAND = `ssh -i ${updateCfg.sshKey} ${sshOptions}`;
    }
    return env;
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

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

    // ─── Update Check & Apply ─────────────────────────────────────────

    app.get('/api/update/check', async (req, res) => {
        try {
            const updateCfg = getUpdateConfig();
            if (updateCfg.enabled === false) return res.json({ enabled: false, updateAvailable: false });

            const repoUrl = req.query.url || updateCfg.repoUrl || null;
            const localVersionRaw = getLocalVersion();
            const localVersion = normalizeVersion(localVersionRaw || '');

            if (repoUrl && repoUrl.includes('github.com')) {
                const parsed = parseGithubOwnerRepo(repoUrl);
                if (!parsed) return res.status(400).json({ error: 'Ungültige GitHub-URL' });

                // 1) Try latest GitHub Release
                try {
                    const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/releases/latest`;
                    const r = await fetch(apiUrl, { headers: { 'User-Agent': 'ems-update' } });
                    if (r.ok) {
                        const json = await r.json();
                        const remoteVersionRaw = json.tag_name || json.name || null;
                        const remoteVersion = normalizeVersion(remoteVersionRaw || '');
                        const assetUrl = (json.assets && json.assets.length > 0) ? json.assets[0].browser_download_url : null;
                        const tarball = json.tarball_url || json.zipball_url || assetUrl || null;
                        const updateAvailable = remoteVersion && localVersion ? (remoteVersion !== localVersion) : !!remoteVersion;
                        return res.json({ enabled: true, updateAvailable, localVersion: localVersionRaw, remoteVersion: remoteVersionRaw, downloadUrl: tarball, repo: `${parsed.owner}/${parsed.repo}`, releaseName: json.name || '' });
                    }
                } catch (e) { /* ignore and continue */ }

                // 2) Try tags via GitHub API
                try {
                    const tagsUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/tags`;
                    const rt = await fetch(tagsUrl, { headers: { 'User-Agent': 'ems-update' } });
                    if (rt.ok) {
                        const tags = await rt.json();
                        if (Array.isArray(tags) && tags.length > 0) {
                            const remoteVersionRaw = tags[0].name;
                            const remoteVersion = normalizeVersion(remoteVersionRaw || '');
                            const downloadUrl = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/tags/${encodeURIComponent(remoteVersionRaw)}.tar.gz`;
                            const updateAvailable = remoteVersion && localVersion ? (remoteVersion !== localVersion) : !!remoteVersion;
                            return res.json({ enabled: true, updateAvailable, localVersion: localVersionRaw, remoteVersion: remoteVersionRaw, downloadUrl, repo: `${parsed.owner}/${parsed.repo}` });
                        }
                    }
                } catch (e) { /* ignore and continue */ }

                // 3) Fallback to git ls-remote to list tags and pick highest semver-like tag
                try {
                    const out = execSync(`git ls-remote --tags --refs ${repoUrl}`, { encoding: 'utf8', timeout: 15000 });
                    const tags = out.split('\n').map(l => l.trim()).filter(l => l.length > 0).map(l => {
                        const parts = l.split('\t');
                        return parts[1] ? parts[1].replace(/^refs\/tags\//, '') : null;
                    }).filter(Boolean);
                    if (tags.length > 0) {
                        tags.sort((a, b) => {
                            const aa = normalizeVersion(a).split('.').map(n => parseInt(n || '0', 10));
                            const bb = normalizeVersion(b).split('.').map(n => parseInt(n || '0', 10));
                            const len = Math.max(aa.length, bb.length);
                            for (let i = 0; i < len; i++) {
                                const av = aa[i] || 0;
                                const bv = bb[i] || 0;
                                if (av !== bv) return av - bv;
                            }
                            return 0;
                        });
                        const remoteVersionRaw = tags[tags.length - 1];
                        const remoteVersion = normalizeVersion(remoteVersionRaw || '');
                        const downloadUrl = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/tags/${encodeURIComponent(remoteVersionRaw)}.tar.gz`;
                        const updateAvailable = remoteVersion && localVersion ? (remoteVersion !== localVersion) : !!remoteVersion;
                        return res.json({ enabled: true, updateAvailable, localVersion: localVersionRaw, remoteVersion: remoteVersionRaw, downloadUrl, repo: `${parsed.owner}/${parsed.repo}` });
                    }
                } catch (e) { /* ignore and continue */ }
            }

            // Legacy: git remote check (branch-based)
            const env = buildGitEnv(updateCfg);
            execSync('git fetch', { cwd: PROJECT_ROOT, timeout: 15000, stdio: 'pipe', env });
            const localHash = execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8', env }).trim();

            // determine branch / upstream
            let branch = updateCfg.branch;
            if (!branch || branch.length === 0) {
                branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8', env }).trim();
            }
            const remote = updateCfg.remote || 'origin';
            const upstreamRef = `${remote}/${branch}`;

            // try to resolve remote hash / behind count
            let remoteHash = '';
            let behind = 0;
            try {
                remoteHash = execSync(`git rev-parse ${upstreamRef}`, { cwd: PROJECT_ROOT, encoding: 'utf8', env }).trim();
                behind = parseInt(execSync(`git rev-list HEAD..${upstreamRef} --count`, { cwd: PROJECT_ROOT, encoding: 'utf8', env }).trim(), 10);
            } catch (e) {
                try {
                    remoteHash = execSync('git rev-parse @{u}', { cwd: PROJECT_ROOT, encoding: 'utf8', env }).trim();
                    behind = parseInt(execSync('git rev-list HEAD..@{u} --count', { cwd: PROJECT_ROOT, encoding: 'utf8', env }).trim(), 10);
                } catch (e2) {
                    behind = 0;
                }
            }

            let commitLog = '';
            if (behind > 0) {
                try {
                    commitLog = execSync(`git log HEAD..${upstreamRef} --oneline --no-decorate -n 50`, { cwd: PROJECT_ROOT, encoding: 'utf8', env }).trim();
                } catch (e) {
                    try {
                        commitLog = execSync('git log HEAD..@{u} --oneline --no-decorate -n 50', { cwd: PROJECT_ROOT, encoding: 'utf8', env }).trim();
                    } catch (e2) { commitLog = ''; }
                }
            }

            res.json({ enabled: true, updateAvailable: behind > 0, behind, localHash: localHash.slice(0, 7), remoteHash: remoteHash ? remoteHash.slice(0, 7) : null, commits: commitLog, remote, branch });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/update/apply', async (req, res) => {
        try {
            const updateCfg = getUpdateConfig();
            if (updateCfg.enabled === false) return res.status(400).json({ success: false, error: 'Updates disabled in config' });

            // Allow URL override via query param
            const repoUrl = req.query.url || updateCfg.repoUrl || null;

            // If a GitHub repo URL is provided, download latest release and deploy
            if (repoUrl && repoUrl.includes('github.com')) {
                const parsed = parseGithubOwnerRepo(repoUrl);
                if (!parsed) return res.status(400).json({ success: false, error: 'Ungültige GitHub-URL' });

                // Try releases/latest first, then fallback to tags archive
                let tarball = null;
                try {
                    const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/releases/latest`;
                    const r = await fetch(apiUrl, { headers: { 'User-Agent': 'ems-update' } });
                    if (r.ok) {
                        const json = await r.json();
                        const assetUrl = (json.assets && json.assets.length > 0) ? json.assets[0].browser_download_url : null;
                        tarball = assetUrl || json.tarball_url || json.zipball_url || null;
                    }
                } catch (e) {
                    // ignore and fallback
                }

                if (!tarball) {
                    // fallback to latest tag via API
                    try {
                        const tagsUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/tags`;
                        const rt = await fetch(tagsUrl, { headers: { 'User-Agent': 'ems-update' } });
                        if (rt.ok) {
                            const tags = await rt.json();
                            if (Array.isArray(tags) && tags.length > 0) {
                                const latestTag = tags[0].name;
                                tarball = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/tags/${encodeURIComponent(latestTag)}.tar.gz`;
                            }
                        }
                    } catch (e) { /* ignore */ }
                }

                if (!tarball) {
                    // final fallback: use git ls-remote and pick highest semver-like tag
                    try {
                        const out = execSync(`git ls-remote --tags --refs ${repoUrl}`, { encoding: 'utf8', timeout: 15000 });
                        const tags = out.split('\n').map(l => l.trim()).filter(l => l.length > 0).map(l => {
                            const parts = l.split('\t');
                            return parts[1] ? parts[1].replace(/^refs\/tags\//, '') : null;
                        }).filter(Boolean);
                        if (tags.length > 0) {
                            tags.sort((a, b) => {
                                const aa = normalizeVersion(a).split('.').map(n => parseInt(n || '0', 10));
                                const bb = normalizeVersion(b).split('.').map(n => parseInt(n || '0', 10));
                                const len = Math.max(aa.length, bb.length);
                                for (let i = 0; i < len; i++) {
                                    const av = aa[i] || 0;
                                    const bv = bb[i] || 0;
                                    if (av !== bv) return av - bv;
                                }
                                return 0;
                            });
                            const latestTag = tags[tags.length - 1];
                            tarball = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/tags/${encodeURIComponent(latestTag)}.tar.gz`;
                        }
                    } catch (e) { /* ignore */ }
                }

                if (!tarball) throw new Error('Kein Release-Asset, tarball oder Tag-Archiv verfügbar');

                // Prepare temp dir
                const tmpDir = path.join(os.tmpdir(), `ems_update_${Date.now()}`);
                fs.mkdirSync(tmpDir, { recursive: true });

                // Download and extract
                const tmpArchive = path.join(tmpDir, 'release.tar.gz');
                execSync(`curl -L -s -o "${tmpArchive}" "${tarball}"`, { timeout: 120000 });
                const extractDir = path.join(tmpDir, 'extract');
                fs.mkdirSync(extractDir);
                execSync(`tar -xzf "${tmpArchive}" -C "${extractDir}"`, { timeout: 120000 });

                // Find extracted dir
                const extractedChildren = fs.readdirSync(extractDir);
                if (extractedChildren.length === 0) throw new Error('Archiv leer');
                const srcDirCandidate = path.join(extractDir, extractedChildren[0]);
                const srcDir = fs.statSync(srcDirCandidate).isDirectory() ? srcDirCandidate : extractDir;

                // Copy files into project (use tar stream to preserve modes). Exclude node_modules, data, logs, config/*.json
                const excludeArgs = [
                    "--exclude=./node_modules",
                    "--exclude=./data",
                    "--exclude=./logs",
                    "--exclude=./config/*.json",
                    "--exclude=./.git"
                ].join(' ');
                execSync(`tar -C "${srcDir}" -c ${excludeArgs} . | tar -C "${PROJECT_ROOT}" -xpf -`, { timeout: 120000 });

                // Install deps
                const npmArgs = updateCfg.npmInstallArgs || '--omit=dev';
                execSync(`npm install ${npmArgs}`, { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 600000 });

                // Cleanup temp
                try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { }

                // Restart via configured command if present
                if (updateCfg.restartCommand && updateCfg.restartCommand.length > 0) {
                    try {
                        execSync(updateCfg.restartCommand, { cwd: PROJECT_ROOT, stdio: 'inherit' });
                        return res.json({ success: true, message: 'Update applied and restart command executed.' });
                    } catch (e) {
                        console.error('[Update] restart command failed:', e.message);
                    }
                }

                res.json({ success: true, message: 'Update erfolgreich. Server startet neu...' });
                // Default: spawn a new node process and exit
                setTimeout(() => {
                    console.log('[Update] Starte Server neu...');
                    const child = spawn(process.argv[0], process.argv.slice(1), {
                        cwd: PROJECT_ROOT,
                        detached: true,
                        stdio: 'ignore',
                        env: { ...process.env }
                    });
                    child.unref();
                    process.exit(0);
                }, 1000);
                return;
            }

            // Legacy: git pull from remote
            const env = buildGitEnv(updateCfg);
            const remote = updateCfg.remote || 'origin';
            let branch = updateCfg.branch;
            if (!branch || branch.length === 0) {
                branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8', env }).trim();
            }

            const pullCmd = (remote && branch) ? `git pull --ff-only ${remote} ${branch}` : 'git pull --ff-only';
            const pullOutput = execSync(pullCmd, { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 30000, env });
            console.log('[Update] git pull:', pullOutput.trim());

            const npmArgs = updateCfg.npmInstallArgs || '--omit=dev';
            execSync(`npm install ${npmArgs}`, { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 600000, env });
            console.log('[Update] npm install done');

            // If a custom restart command is configured, run it instead of respawning Node
            if (updateCfg.restartCommand && updateCfg.restartCommand.length > 0) {
                try {
                    console.log('[Update] running restart command');
                    execSync(updateCfg.restartCommand, { cwd: PROJECT_ROOT, stdio: 'inherit', env });
                    return res.json({ success: true, message: 'Update applied and restart command executed.' });
                } catch (e) {
                    console.error('[Update] restart command failed:', e.message);
                    // fallthrough to default behavior
                }
            }

            res.json({ success: true, message: 'Update erfolgreich. Server startet neu...' });
            // Default: spawn a new node process and exit
            setTimeout(() => {
                console.log('[Update] Starte Server neu...');
                const child = spawn(process.argv[0], process.argv.slice(1), {
                    cwd: PROJECT_ROOT,
                    detached: true,
                    stdio: 'ignore',
                    env: { ...env }
                });
                child.unref();
                process.exit(0);
            }, 1000);
        } catch (err) {
            console.error('[Update] Fehler:', err.message);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return server;
}

module.exports = createWebServer;
