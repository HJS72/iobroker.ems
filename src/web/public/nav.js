'use strict';

// ─── Shared Navigation & Utilities ───────────────────────────────

// Aktuelle Seite ermitteln
const currentPage = location.pathname.replace(/^\//, '').replace(/\.html$/, '') || 'index';

// Navigation rendern
function renderNav() {
    const header = document.querySelector('header');
    if (!header) return;

    // Menü-Button vor h1 einfügen
    const menuBtn = document.createElement('button');
    menuBtn.className = 'nav-menu-btn';
    menuBtn.innerHTML = '☰';
    menuBtn.title = 'Menü';
    menuBtn.addEventListener('click', toggleNav);
    header.insertBefore(menuBtn, header.firstChild);

    // Nav-Overlay
    const nav = document.createElement('nav');
    nav.id = 'main-nav';
    nav.className = 'nav-overlay';
    nav.innerHTML = `
        <div class="nav-panel">
            <div class="nav-header">
                <span>⚡ EMS</span>
                <button class="nav-close" onclick="toggleNav()">✕</button>
            </div>
            <a href="/" class="nav-link ${currentPage === 'index' ? 'active' : ''}">
                <span class="nav-icon">📊</span> Dashboard
            </a>
            <a href="/daily.html" class="nav-link ${currentPage === 'daily' ? 'active' : ''}">
                <span class="nav-icon">📋</span> Tagesübersicht
            </a>
            <a href="/data.html" class="nav-link ${currentPage === 'data' ? 'active' : ''}">
                <span class="nav-icon">📈</span> Daten
            </a>
            <div class="nav-divider"></div>
            <a href="/config.html" class="nav-link ${currentPage === 'config' ? 'active' : ''}">
                <span class="nav-icon">⚙️</span> Konfiguration
            </a>
            <div class="nav-divider"></div>
            <a href="#" class="nav-link" id="nav-update-link" style="display:none" onclick="showUpdateDialog();return false;">
                <span class="nav-icon">🔄</span> <span id="nav-update-text">Update verfügbar</span>
                <span class="update-badge" id="nav-update-badge"></span>
            </a>
        </div>
    `;
    nav.addEventListener('click', (e) => {
        if (e.target === nav) toggleNav();
    });
    document.body.appendChild(nav);

    // Update-Dialog Container
    const dialog = document.createElement('div');
    dialog.id = 'update-dialog';
    dialog.className = 'update-overlay';
    dialog.innerHTML = `
        <div class="update-panel">
            <div class="update-header">
                <span>🔄 Update verfügbar</span>
                <button class="nav-close" onclick="hideUpdateDialog()">✕</button>
            </div>
            <div class="update-body" id="update-body">Prüfe...</div>
            <div class="update-actions">
                <button class="btn-update" id="btn-apply-update" onclick="applyUpdate()">⬇ Jetzt aktualisieren</button>
                <button class="btn-cancel" onclick="hideUpdateDialog()">Später</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
}

function toggleNav() {
    const nav = document.getElementById('main-nav');
    if (nav) nav.classList.toggle('open');
}

// ─── Shared State ─────────────────────────────────────────────────
let appConfig = null;
let currentDate = new Date().toISOString().split('T')[0];

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        appConfig = await res.json();
    } catch (e) {
        console.error('Config laden fehlgeschlagen:', e);
    }
}

// ─── Shared Header Setup ──────────────────────────────────────────
function setupHeader() {
    const datePicker = document.getElementById('date-picker');
    if (datePicker) {
        datePicker.value = currentDate;
        datePicker.addEventListener('change', (e) => {
            currentDate = e.target.value;
            if (typeof loadAllData === 'function') loadAllData();
        });
    }

    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            btnRefresh.disabled = true;
            btnRefresh.textContent = '⏳ Lade...';
            try {
                await fetch('/api/refresh-forecast', { method: 'POST' });
                if (typeof loadAllData === 'function') await loadAllData();
            } catch (e) {
                console.error('Prognose-Update fehlgeschlagen:', e);
            }
            btnRefresh.disabled = false;
            btnRefresh.textContent = '🔄 Prognose';
        });
    }
}

// ─── Shared Utilities ─────────────────────────────────────────────
function updateConnectionStatus(connected) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    el.className = 'status ' + (connected ? 'online' : 'offline');
    el.textContent = connected ? '● Verbunden' : '● Offline';
}

function updateLastUpdate(ts) {
    const el = document.getElementById('last-update');
    if (!el) return;
    if (ts) el.textContent = 'Letztes Update: ' + new Date(ts).toLocaleTimeString('de-DE');
}

function formatPower(w) {
    if (w == null || isNaN(w)) return '-- ';
    if (Math.abs(w) >= 1000) return (w / 1000).toFixed(1) + ' kW';
    return Math.round(w) + ' W';
}

function formatEnergy(wh) {
    if (wh == null || isNaN(wh)) return '--';
    if (Math.abs(wh) >= 1000) return (wh / 1000).toFixed(1) + ' kWh';
    return Math.round(wh) + ' Wh';
}

// ─── Init Nav on load ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderNav();
    setupHeader();
    fetch('/api/version').then(r => r.json()).then(d => {
        const el = document.getElementById('build-version');
        if (el) el.textContent = 'Version ' + d.version;
    }).catch(() => {});
    checkForUpdate();
});

// ─── Update System ────────────────────────────────────────────────
let _updateInfo = null;

async function checkForUpdate() {
    try {
        const res = await fetch('/api/update/check');
        const data = await res.json();
        _updateInfo = data;
        const link = document.getElementById('nav-update-link');
        const badge = document.getElementById('nav-update-badge');
        const versionEl = document.getElementById('build-version');
        if (data.updateAvailable && link) {
            link.style.display = '';
            badge.textContent = data.behind;
            document.getElementById('nav-update-text').textContent = `Update (${data.behind} Commit${data.behind > 1 ? 's' : ''})`;
            // Indicator am Version-Text
            if (versionEl) versionEl.innerHTML += ' <span class="update-dot" title="Update verfügbar" onclick="showUpdateDialog()">●</span>';
        }
    } catch (e) {
        console.log('Update-Check nicht möglich:', e.message);
    }
}

function showUpdateDialog() {
    const dialog = document.getElementById('update-dialog');
    const body = document.getElementById('update-body');
    if (!dialog) return;
    if (_updateInfo && _updateInfo.updateAvailable) {
        const commits = _updateInfo.commits ? _updateInfo.commits.split('\n').map(c => `<div class="update-commit">${c}</div>`).join('') : '';
        body.innerHTML = `
            <div class="update-info">
                <div><strong>Lokal:</strong> ${_updateInfo.localHash}</div>
                <div><strong>Remote:</strong> ${_updateInfo.remoteHash}</div>
                <div><strong>${_updateInfo.behind} neue${_updateInfo.behind > 1 ? '' : 'r'} Commit${_updateInfo.behind > 1 ? 's' : ''}:</strong></div>
            </div>
            <div class="update-commits">${commits}</div>
        `;
    } else {
        body.innerHTML = '<p>Keine Updates verfügbar.</p>';
    }
    document.getElementById('btn-apply-update').disabled = false;
    document.getElementById('btn-apply-update').textContent = '⬇ Jetzt aktualisieren';
    dialog.classList.add('open');
    // Nav schließen
    const nav = document.getElementById('main-nav');
    if (nav) nav.classList.remove('open');
}

function hideUpdateDialog() {
    const dialog = document.getElementById('update-dialog');
    if (dialog) dialog.classList.remove('open');
}

async function applyUpdate() {
    const btn = document.getElementById('btn-apply-update');
    const body = document.getElementById('update-body');
    btn.disabled = true;
    btn.textContent = '⏳ Aktualisiere...';
    try {
        const res = await fetch('/api/update/apply', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            body.innerHTML = '<div class="update-success">✅ Update erfolgreich! Server startet neu...<br>Seite wird in 5 Sekunden neu geladen.</div>';
            btn.style.display = 'none';
            setTimeout(() => location.reload(), 5000);
        } else {
            body.innerHTML = `<div class="update-error">❌ Fehler: ${data.error}</div>`;
            btn.textContent = '⬇ Erneut versuchen';
            btn.disabled = false;
        }
    } catch (e) {
        body.innerHTML = '<div class="update-success">⏳ Server startet neu... Seite wird in 5 Sekunden neu geladen.</div>';
        setTimeout(() => location.reload(), 5000);
    }
}
