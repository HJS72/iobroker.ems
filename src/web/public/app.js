'use strict';

// ─── Dashboard (index.html) ──────────────────────────────────────
// Aktuelle Leistung, PV-Prognose, Verbrauch, Netz-Bilanz

let chartPv = null;
let chartConsumption = null;
let chartGrid = null;
let refreshTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    await loadAllData();
    refreshTimer = setInterval(loadCurrentData, 10000);
});

async function loadAllData() {
    await Promise.all([
        loadCurrentData(),
        loadForecast(),
        loadPvForecast()
    ]);
}

async function loadCurrentData() {
    try {
        const res = await fetch('/api/current');
        const data = await res.json();
        updateConnectionStatus(data.connected);
        updatePowerCards(data);
        updateLastUpdate(data.timestamp);
    } catch (e) {
        updateConnectionStatus(false);
    }
}

async function loadForecast() {
    try {
        const res = await fetch(`/api/forecast/${currentDate}`);
        const data = await res.json();
        updateConsumptionChart(data);
        updateGridChart(data);
    } catch (e) {
        console.error('Prognose laden fehlgeschlagen:', e);
    }
}

async function loadPvForecast() {
    try {
        const res = await fetch(`/api/pv-forecast/${currentDate}`);
        const data = await res.json();
        updatePvChart(data);
    } catch (e) {
        console.error('PV-Prognose laden fehlgeschlagen:', e);
    }
}

// ─── Power Cards ──────────────────────────────────────────────────
function updatePowerCards(data) {
    const container = document.getElementById('power-cards');
    let html = '';

    if (!appConfig) { container.innerHTML = '<p>Lade Konfiguration...</p>'; return; }

    for (const pv of appConfig.pvSystems) {
        const sys = data.systems?.[pv.id];
        const power = sys?.power || 0;
        const dpShort = pv.datapoints?.power ? pv.datapoints.power.split('.').pop() : '';
        html += `
            <div class="power-card pv">
                <div class="pc-label">${pv.name}</div>
                <div class="pc-value">${formatPower(power)}</div>
                <div class="pc-unit">${formatEnergy(sys?.energyTotal)} heute</div>
                ${pv.hasBattery && sys?.extra ? `
                    <div class="pc-unit">☀️ PV: ${formatPower(sys.extra.pvAcPure)} | 🔋 ${sys.extra.batterySoc?.toFixed(0)}%</div>
                    <div class="pc-unit">${sys.extra.batteryAcPower > 0 ? '▶ Entladen' : '◀ Laden'} ${formatPower(Math.abs(sys.extra.batteryAcPower))} AC</div>
                    <div class="pc-unit" style="font-size:0.6rem;opacity:0.5">η=${sys.extra.inverterEfficiency}%</div>
                ` : ''}
                ${dpShort ? `<div class="pc-dp" title="${pv.datapoints.power}">${dpShort}</div>` : ''}
            </div>`;
    }

    for (const c of appConfig.consumers) {
        const sys = data.systems?.[c.id];
        const power = sys?.power || 0;
        const dpShort = c.datapoints?.power ? c.datapoints.power.split('.').pop() : '';
        const energyLabel = c.energyType === 'balance' ? 'Bilanz' : (c.energyType === 'calculated' ? 'berechnet' : '');
        const ev = sys?.extra;
        const hasEv = ev && (ev.evSoc != null || ev.evRange != null);
        const hasTemp = ev && ev.tempCurrent != null;
        const hpStatusMap = {
            needs_heating: '🔵 Heizbedarf',
            needs_cooling: '🔴 Kühlbedarf',
            in_range: '🟡 Im Bereich',
            target_reached: '🟢 Ziel erreicht'
        };
        html += `
            <div class="power-card consumer">
                <div class="pc-label">${c.name}</div>
                <div class="pc-value">${formatPower(power)}</div>
                <div class="pc-unit">${formatEnergy(sys?.energyTotal)} ${energyLabel || 'gesamt'}</div>
                ${hasTemp ? `
                    <div class="pc-unit">🌡️ ${ev.tempCurrent?.toFixed(1)}°C (${ev.tempStart}–${ev.tempEnd}°C)</div>
                    <div class="pc-unit">${hpStatusMap[ev.hpStatus] || '–'}</div>
                ` : ''}
                ${hasEv ? `
                    <div class="pc-unit">🔋 ${ev.evSoc != null ? ev.evSoc + '%' : '–'}${ev.evBatteryCapacity ? ' (' + (ev.evSoc * ev.evBatteryCapacity / 100).toFixed(1) + ' kWh)' : ''}</div>
                    <div class="pc-unit">🚗 ${ev.evRange != null ? ev.evRange + ' km' : '–'}</div>
                    ${ev.evChargeEnd ? `<div class="pc-unit">⏱ Ladeende: ${ev.evChargeEnd}</div>` : ''}
                ` : ''}
                ${dpShort ? `<div class="pc-dp" title="${c.datapoints.power}">${dpShort}</div>` : ''}
            </div>`;
    }

    const gridSys = data.systems?.grid;
    const gridPower = gridSys?.power || 0;
    const isFeedIn = gridPower < 0;
    const gridClass = isFeedIn ? 'grid-feedin' : 'grid-purchase';
    const gridLabel = isFeedIn ? '⬇ Einspeisung' : '⬆ Bezug';
    html += `
        <div class="power-card ${gridClass}">
            <div class="pc-label">Netz</div>
            <div class="pc-value">${formatPower(Math.abs(gridPower))}</div>
            <div class="pc-unit">${gridLabel}</div>
        </div>`;

    container.innerHTML = html;
}

// ─── Charts ───────────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { color: '#8b8fa3', font: { size: 11 } } }
    },
    scales: {
        x: { ticks: { color: '#8b8fa3', font: { size: 10 } }, grid: { color: '#2a2d3a' } },
        y: { ticks: { color: '#8b8fa3', font: { size: 10 } }, grid: { color: '#2a2d3a' }, beginAtZero: true }
    }
};

function updatePvChart(data) {
    const datasets = [];
    const colors = ['#f7c948', '#ff8c42', '#6dd5ed'];

    if (appConfig) {
        for (let i = 0; i < appConfig.pvSystems.length; i++) {
            const pv = appConfig.pvSystems[i];
            const pvData = data[pv.id]?.data || [];
            const values = new Array(24).fill(0);
            const corrValues = new Array(24).fill(0);
            let hasCorrected = false;

            for (const row of pvData) {
                values[row.hour] = row.watts;
                if (row.watts_corrected && row.watts_corrected !== row.watts) {
                    corrValues[row.hour] = row.watts_corrected;
                    hasCorrected = true;
                }
            }

            datasets.push({
                label: pv.name + ` (${pv.kwp} kWp)`,
                data: values,
                borderColor: colors[i] || colors[0],
                backgroundColor: (colors[i] || colors[0]) + '30',
                fill: true,
                tension: 0.3
            });

            if (hasCorrected) {
                datasets.push({
                    label: pv.name + ' (korrigiert)',
                    data: corrValues,
                    borderColor: colors[i] || colors[0],
                    borderWidth: 1,
                    borderDash: [3, 3],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0
                });
            }
        }
    }

    const combined = data.combined || {};
    const combinedValues = new Array(24).fill(0);
    for (const [hour, vals] of Object.entries(combined)) {
        combinedValues[parseInt(hour)] = vals.watts || 0;
    }
    datasets.push({
        label: 'PV Gesamt (Plan)',
        data: combinedValues,
        borderColor: '#3dd68c',
        borderWidth: 2,
        borderDash: [5, 3],
        fill: false,
        tension: 0.3
    });

    const combinedActual = data.combinedActual || {};
    const actualValues = new Array(24).fill(null);
    let hasActual = false;
    for (const [hour, watts] of Object.entries(combinedActual)) {
        actualValues[parseInt(hour)] = watts;
        hasActual = true;
    }
    if (hasActual) {
        datasets.push({
            label: 'PV Gesamt (Ist)',
            data: actualValues,
            borderColor: '#ffffff',
            borderWidth: 2,
            backgroundColor: '#ffffff20',
            fill: false,
            tension: 0.3,
            pointStyle: 'circle',
            pointRadius: 3,
            spanGaps: false
        });
    }

    if (chartPv) chartPv.destroy();
    chartPv = new Chart(document.getElementById('chart-pv-forecast'), {
        type: 'line',
        data: { labels: HOURS, datasets },
        options: {
            ...CHART_DEFAULTS,
            plugins: { ...CHART_DEFAULTS.plugins, title: { display: false } },
            scales: {
                ...CHART_DEFAULTS.scales,
                y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'Watt', color: '#8b8fa3' } }
            }
        }
    });
}

function updateConsumptionChart(data) {
    const datasets = [];
    const colors = { bwwp: '#4fc3f7', klima: '#9f6ff7', house: '#8b8fa3', wallbox: '#f7a94f' };

    for (const [sysId, sys] of Object.entries(data.systems || {})) {
        const color = colors[sysId] || '#4f8ff7';
        const forecastValues = new Array(24).fill(0);
        for (const f of sys.forecast || []) {
            forecastValues[f.hour] = f.powerAvg;
        }
        datasets.push({
            label: sys.name + ' (Plan)',
            data: forecastValues,
            backgroundColor: color + '40',
            borderColor: color + '80',
            borderWidth: 1,
            stack: 'forecast'
        });

        const actual = sys.actual || {};
        if (Object.keys(actual).length > 0) {
            const actualValues = new Array(24).fill(null);
            for (const [h, v] of Object.entries(actual)) {
                actualValues[parseInt(h)] = v;
            }
            datasets.push({
                label: sys.name + ' (Ist)',
                data: actualValues,
                type: 'line',
                borderColor: color,
                borderWidth: 2,
                pointRadius: 2,
                pointBackgroundColor: color,
                fill: false,
                spanGaps: false,
                stack: 'actual_' + sysId
            });
        }
    }

    if (chartConsumption) chartConsumption.destroy();
    chartConsumption = new Chart(document.getElementById('chart-consumption'), {
        type: 'bar',
        data: { labels: HOURS, datasets },
        options: {
            ...CHART_DEFAULTS,
            plugins: { ...CHART_DEFAULTS.plugins, tooltip: { mode: 'index', intersect: false } },
            scales: {
                ...CHART_DEFAULTS.scales,
                x: { ...CHART_DEFAULTS.scales.x, stacked: true },
                y: { ...CHART_DEFAULTS.scales.y, stacked: true, title: { display: true, text: 'Watt', color: '#8b8fa3' } }
            }
        }
    });
}

function updateGridChart(data) {
    const feedInValues = new Array(24).fill(0);
    const purchaseValues = new Array(24).fill(0);
    const feedInRawValues = new Array(24).fill(0);
    const purchaseRawValues = new Array(24).fill(0);
    let hasRaw = false;

    for (const g of data.gridBalance || []) {
        feedInValues[g.hour] = g.feedIn;
        purchaseValues[g.hour] = -g.purchase;
        if (g.feedInRaw != null) {
            feedInRawValues[g.hour] = g.feedInRaw;
            purchaseRawValues[g.hour] = -g.purchaseRaw;
            if (g.feedInRaw !== g.feedIn || g.purchaseRaw !== g.purchase) hasRaw = true;
        }
    }

    const datasets = [
        { label: 'Einspeisung (korrigiert)', data: feedInValues, backgroundColor: '#3dd68c80', borderColor: '#3dd68c', borderWidth: 1 },
        { label: 'Netzbezug (korrigiert)', data: purchaseValues, backgroundColor: '#f74f4f80', borderColor: '#f74f4f', borderWidth: 1 }
    ];

    if (hasRaw) {
        datasets.push({ label: 'Einspeisung (Plan)', data: feedInRawValues, type: 'line', borderColor: '#3dd68c', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false });
        datasets.push({ label: 'Netzbezug (Plan)', data: purchaseRawValues, type: 'line', borderColor: '#f74f4f', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false });
    }

    if (chartGrid) chartGrid.destroy();
    chartGrid = new Chart(document.getElementById('chart-grid'), {
        type: 'bar',
        data: { labels: HOURS, datasets },
        options: {
            ...CHART_DEFAULTS,
            plugins: {
                ...CHART_DEFAULTS.plugins,
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatPower(Math.abs(ctx.parsed.y))}`
                    }
                }
            },
            scales: {
                ...CHART_DEFAULTS.scales,
                y: {
                    ...CHART_DEFAULTS.scales.y,
                    beginAtZero: false,
                    title: { display: true, text: 'Watt (↑ Einspeisung  ↓ Bezug)', color: '#8b8fa3' }
                }
            }
        }
    });
}
