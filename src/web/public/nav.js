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
        </div>
    `;
    nav.addEventListener('click', (e) => {
        if (e.target === nav) toggleNav();
    });
    document.body.appendChild(nav);
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
});
