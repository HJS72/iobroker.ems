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
        updateEnergyFlow(data);
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
                    <div class="pc-unit">☀️ PV: ${formatPower(sys.extra.pvAcPure)} | 🔋 ${sys.extra.batterySoc != null ? sys.extra.batterySoc.toFixed(0) + '%' : '–'}</div>
                    <div class="pc-unit">${sys.extra.batteryAcPower != null ? (sys.extra.batteryAcPower > 0 ? '▶ Entladen' : '◀ Laden') + ' ' + formatPower(Math.abs(sys.extra.batteryAcPower)) + ' AC' : '–'}</div>
                    <div class="pc-unit" style="font-size:0.6rem;opacity:0.5">η=${sys.extra.inverterEfficiency != null ? sys.extra.inverterEfficiency + '%' : '–'}</div>
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
    const currentHour = new Date().getHours();
    
    for (const [hour, watts] of Object.entries(combinedActual)) {
        const hourInt = parseInt(hour);
        // Nur Ist-Werte bis zur aktuellen Stunde anzeigen
        if (hourInt <= currentHour) {
            actualValues[hourInt] = watts;
            hasActual = true;
        }
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

// ─── Energiefluss-Diagramm ────────────────────────────────────────

function updateEnergyFlow(data) {
    const container = document.getElementById('energy-flow');
    if (!container || !appConfig) return;

    // ── Daten sammeln ──
    const pvSystems = [];
    let pvTotal = 0;
    let batteryPower = 0;
    let batterySoc = null;
    let hasBattery = false;

    for (const pv of appConfig.pvSystems) {
        const sys = data.systems?.[pv.id];
        const power = sys?.power || 0;
        pvSystems.push({ id: pv.id, name: pv.name, power, hasBattery: pv.hasBattery });
        pvTotal += power;
        if (pv.hasBattery && sys?.extra) {
            hasBattery = true;
            batteryPower = sys.extra.batteryAcPower || 0;
            batterySoc = sys.extra.batterySoc;
        }
    }

    const gridSys = data.systems?.grid;
    const gridPower = gridSys?.power || 0;
    const feedIn = Math.max(0, -gridPower);
    const purchase = Math.max(0, gridPower);

    // Alle Verbraucher inkl. Auto über Haus – Wallbox ans Ende
    let carExtra = null;
    const houseConsumers = [];
    let houseTotalPower = 0;
    for (const c of appConfig.consumers) {
        const sys = data.systems?.[c.id];
        const power = sys?.power || 0;
        if (c.id === 'wallbox') carExtra = sys?.extra;
        houseConsumers.push({ id: c.id, name: c.name, power });
        houseTotalPower += power;
    }
    // Hausverbrauch an den Anfang, Wallbox ans Ende
    const hIdx = houseConsumers.findIndex(c => c.id === 'house');
    if (hIdx > 0) houseConsumers.unshift(houseConsumers.splice(hIdx, 1)[0]);
    const wbIdx = houseConsumers.findIndex(c => c.id === 'wallbox');
    if (wbIdx >= 0) houseConsumers.push(houseConsumers.splice(wbIdx, 1)[0]);

    const batteryCharging = batteryPower < 0;    // batteryAcPower < 0 = Laden
    const batteryDischarging = batteryPower > 0; // batteryAcPower > 0 = Entladen
    const batteryAbsPower = Math.abs(batteryPower);

    // ── Layout (orthogonal) ──
    const W = 820, H = 490;
    // SVG-Icon-Pfade (Lucide-style, 24x24 viewBox)
    const svgIcons = {
        sun: '<path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 6a6 6 0 100 12 6 6 0 000-12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        battery: '<rect x="6" y="7" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><line x1="10" y1="4" x2="10" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="4" x2="14" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        house: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 21V14h6v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        grid: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        car: '<path d="M5 17h14M7.5 17l1-5h7l1 5M6 12l1.5-4h9L18 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="17" r="1" fill="currentColor"/><circle cx="16" cy="17" r="1" fill="currentColor"/>',
        heatpump: '<path d="M12 3v18M3 12h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8a5.7 5.7 0 008 0M8 16a5.7 5.7 0 018 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        snowflake: '<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 5l-2 2 2 2m0-4l2 2-2 2m0 6l-2 2 2 2m0-4l2 2-2 2M5 12l2-2 2 2m-4 0l2 2-2 2m10 0l2-2 2 2m-4 0l2 2-2 2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
        washer: '<rect x="4" y="2" width="16" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="5" r="1" fill="currentColor"/>',
        dryer: '<rect x="4" y="2" width="16" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 11c2 1 2 3 4 4m-1-5c2 1 2 3 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="5" r="1" fill="currentColor"/>',
        gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    };
    const typeIconMap = { bwwp: 'heatpump', klima: 'snowflake', house: 'house', wm1: 'washer', tr1: 'dryer' };

    // Knotenpositionen – PV links + mitte, Akku unter Solaredge
    const pv1 = { x: 130, y: 60 };   // Solaredge links
    const pv2 = { x: 390, y: 60 };   // Hoymiles mitte
    const houseXY = { x: 390, y: 210 };
    const houseR = 52;
    const batXY = { x: 130, y: 210 }; // Batterie unter PV1
    const gridXY = { x: 250, y: 400 };
    // carXY entfernt – Auto ist jetzt Verbraucher über Haus

    // Verbraucher rechts gestapelt (ohne Auto) – mehr Abstand
    const cX = 680;
    const cSpacing = Math.min(75, (H - 80) / Math.max(houseConsumers.length, 1));
    const cStartY = houseXY.y - ((houseConsumers.length - 1) * cSpacing) / 2;

    // ── SVG Start ──
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="flow-svg">`;

    // Defs
    svg += `<defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>`;

    // ── Orthogonale Fluss-Linie ──
    // waypoints: Array von [x,y] Koordinaten
    function flowLine(waypoints, power, color, labelAtEnd) {
        if (power <= 0) return '';
        const thick = Math.max(1.5, Math.min(8, power / 600));
        const op = Math.max(0.4, Math.min(0.9, power / 3000));
        let d = `M${waypoints[0][0]},${waypoints[0][1]}`;
        for (let i = 1; i < waypoints.length; i++) {
            d += ` L${waypoints[i][0]},${waypoints[i][1]}`;
        }
        const dashLen = 8 + thick * 2;
        const gap = dashLen * 0.8;
        const speed = Math.max(0.4, 2 - power / 3000); // schneller bei mehr Leistung
        let s = `<path d="${d}" stroke="${color}" stroke-width="${thick}" fill="none" opacity="${op * 0.3}" stroke-linecap="round" stroke-linejoin="round"/>`;
        s += `<path d="${d}" stroke="${color}" stroke-width="${thick}" fill="none" opacity="${op}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashLen} ${gap}"><animate attributeName="stroke-dashoffset" from="${dashLen + gap}" to="0" dur="${speed}s" repeatCount="indefinite"/></path>`;
        // Label-Position: am letzten Segment (labelAtEnd) oder am Mittelsegment
        const li = labelAtEnd ? waypoints.length - 1 : Math.floor(waypoints.length / 2);
        const lx = (waypoints[li - 1][0] + waypoints[li][0]) / 2;
        const ly = (waypoints[li - 1][1] + waypoints[li][1]) / 2;
        const isVert = waypoints[li - 1][0] === waypoints[li][0];
        s += `<text x="${lx + (isVert ? 10 : 0)}" y="${ly + (isVert ? 0 : -8)}" text-anchor="${isVert ? 'start' : 'middle'}" class="flow-label" fill="${color}">${formatPower(power)}</text>`;
        return s;
    }

    // ── Flüsse berechnen & zeichnen ──
    const busX = 390; // Vertikale Bus-Linie (= Haus x)
    const pvBusY = 105; // Horizontale PV-Sammellinie

    // PV1 → Haus (Solaredge links, runter zum Bus, rüber zu Haus)
    const pv1Power = pvSystems[0]?.power || 0;
    if (pv1Power > 0) {
        svg += flowLine([[pv1.x, pv1.y + 26], [pv1.x, pvBusY], [busX, pvBusY]], pv1Power, '#f7c948');
    }

    // PV2 → Haus (Hoymiles mitte, direkt runter)
    const pv2Power = pvSystems[1]?.power || 0;
    if (pv2Power > 0) {
        svg += flowLine([[pv2.x, pv2.y + 26], [pv2.x, pvBusY], [busX, pvBusY]], pv2Power, '#f7c948');
    }

    // PV-Gesamt vom Bus zum Haus (nur wenn Gesamt-PV > 0)
    const totalPvPower = pv1Power + pv2Power;
    if (totalPvPower > 0) {
        svg += flowLine([[busX, pvBusY], [busX, houseXY.y - houseR]], totalPvPower, '#f7c948');
    }

    // Batterie ← PV (laden): von PV1 runter zur Batterie
    if (hasBattery && batteryCharging) {
        svg += flowLine([[pv1.x, pvBusY], [pv1.x, batXY.y - 28]], batteryAbsPower, '#22c55e');
    }
    // Batterie → Haus (entladen): Batterie rüber zu Haus
    if (hasBattery && batteryDischarging) {
        svg += flowLine([[batXY.x + 28, batXY.y], [busX - houseR, houseXY.y]], batteryAbsPower, '#22c55e');
    }

    // Haus → Netz (Einspeisung)
    if (feedIn > 0) {
        svg += flowLine([[houseXY.x, houseXY.y + houseR], [houseXY.x, 340], [gridXY.x, 340], [gridXY.x, gridXY.y - 26]], feedIn, '#3dd68c');
    }

    // Netz → Haus (Bezug)
    if (purchase > 0) {
        svg += flowLine([[gridXY.x, gridXY.y - 26], [gridXY.x, 340], [houseXY.x, 340], [houseXY.x, houseXY.y + houseR]], purchase, '#f74f4f');
    }

    // Haus → Verbraucher mit spezifischen Andockpunkten
    const cBusX = 560;
    
    // 8 Andockpunkte am Haus (im Uhrzeigersinn: 12, 1:30, 3, 4:30, 6, 7:30, 9, 10:30)
    const getConnectionPoint = (pointNumber) => {
        const angles = [0, 45, 90, 135, 180, 225, 270, 315]; // Grad
        // 90° im Uhrzeigersinn drehen (von SVG-Mathematik zu visueller Uhrzeit)
        const adjustedAngles = angles.map(a => (a - 90 + 360) % 360);
        const angleRad = (adjustedAngles[pointNumber - 1] * Math.PI) / 180; // pointNumber: 1-8
        const pointX = houseXY.x + houseR * Math.cos(angleRad);
        const pointY = houseXY.y + houseR * Math.sin(angleRad);
        return { x: pointX, y: pointY };
    };
    
    houseConsumers.forEach((c, i) => {
        if (c.power > 0) {
            const cy = cStartY + i * cSpacing;
            const lineColor = c.id === 'wallbox' ? '#10b981' : '#f7a94f';
            
            // Spezifische Andockpunkte zuweisen:
            let connectionPoint;
            if (c.id === 'house' || c.id === 'wm1' || c.id === 'tr1') {
                // Hausverbrauch, Waschmaschine, Trockner → Ausgang Nr.2 (1:30 Uhr)
                connectionPoint = getConnectionPoint(2);
            } else if (c.id === 'bwwp' || c.id === 'klima') {
                // Ochsner, Klimaanlage → Ausgang Nr.3 (3:00 Uhr)
                connectionPoint = getConnectionPoint(3);
            } else if (c.id === 'wallbox') {
                // Zappi → Ausgang Nr.4 (4:30 Uhr)
                connectionPoint = getConnectionPoint(4);
            } else {
                // Andere Verbraucher → Ausgang Nr.1 (12:00 Uhr)
                connectionPoint = getConnectionPoint(1);
            }
            
            // Flusslinie vom Andockpunkt zum Verbraucher (vertikal/horizontal)
            if (connectionPoint.x > houseXY.x) {
                // Rechte Seite: horizontal nach rechts, dann vertikal zum Verbraucher
                svg += flowLine([[connectionPoint.x, connectionPoint.y], [cX - 24, connectionPoint.y], [cX - 24, cy]], c.power, lineColor, true);
            } else if (connectionPoint.x < houseXY.x) {
                // Linke Seite: horizontal nach links, dann vertikal zum Verbraucher
                svg += flowLine([[connectionPoint.x, connectionPoint.y], [cX - 24, connectionPoint.y], [cX - 24, cy]], c.power, lineColor, true);
            } else if (connectionPoint.y < houseXY.y) {
                // Oben: vertikal nach oben, dann horizontal zum Verbraucher
                svg += flowLine([[connectionPoint.x, connectionPoint.y], [connectionPoint.x, cy - 30], [cX - 24, cy - 30], [cX - 24, cy]], c.power, lineColor, true);
            } else {
                // Unten: vertikal nach unten, dann horizontal zum Verbraucher
                svg += flowLine([[connectionPoint.x, connectionPoint.y], [connectionPoint.x, cy + 30], [cX - 24, cy + 30], [cX - 24, cy]], c.power, lineColor, true);
            }
        }
    });



    // ── Knoten zeichnen ──
    // labelPos: 'top' | 'bottom' | 'left' | 'right' – Beschriftung gegenüber dem Energiefluss
    function drawNode(x, y, r, iconKey, label, value, color, active, fontSize, labelPos) {
        const iconSize = r * 1.4;
        const svgIcon = svgIcons[iconKey] || svgIcons.gear;
        let s = `<g>`;
        s += `<circle cx="${x}" cy="${y}" r="${r}" fill="transparent" stroke="${color}" stroke-width="${active ? 2.5 : 1}" opacity="${active ? 1 : 0.35}"${active ? ' filter="url(#glow)"' : ''}/>`;
        s += `<g transform="translate(${x - iconSize / 2},${y - iconSize / 2})" color="${color}" opacity="${active ? 1 : 0.4}"><svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}">${svgIcon}</svg></g>`;
        let lx, ly, vx, vy, anchor;
        switch (labelPos) {
            case 'top':
                lx = x; ly = y - r - 22; vx = x; vy = y - r - 8; anchor = 'middle'; break;
            case 'left':
                lx = x - r - 8; ly = y - 4; vx = x - r - 8; vy = y + 10; anchor = 'end'; break;
            case 'right':
                lx = x + r + 8; ly = y - 4; vx = x + r + 8; vy = y + 10; anchor = 'start'; break;
            default: // bottom
                lx = x; ly = y + r + 13; vx = x; vy = y + r + 26; anchor = 'middle'; break;
        }
        s += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" class="flow-node-label" fill="${color}">${label}</text>`;
        if (active || value > 0) {
            s += `<text x="${vx}" y="${vy}" text-anchor="${anchor}" class="flow-node-value" fill="#e4e6eb">${formatPower(value)}</text>`;
        }
        s += '</g>';
        return s;
    }

    // PV1 & PV2 – Fluss geht nach unten → Label oben
    svg += drawNode(pv1.x, pv1.y, 26, 'sun', pvSystems[0]?.name || 'PV1', pv1Power, '#f7c948', pv1Power > 0, 20, 'top');
    svg += drawNode(pv2.x, pv2.y, 26, 'sun', pvSystems[1]?.name || 'PV2', pv2Power, '#f7c948', pv2Power > 0, 20, 'top');

    // Batterie – Fluss geht nach rechts/oben → Label links
    if (hasBattery) {
        const batLabel = `Batterie ${batterySoc != null ? batterySoc.toFixed(0) + '%' : ''}`;
        svg += drawNode(batXY.x, batXY.y, 28, 'battery', batLabel, batteryAbsPower, '#22c55e', batteryAbsPower > 0, 22, 'left');
    }

    // HAUS (groß) – zentraler Hub → Label unten
    svg += drawNode(houseXY.x, houseXY.y, houseR, 'house', 'Haus', houseTotalPower, '#4fc3f7', true, 32, 'bottom');

    // Netz – Fluss geht nach oben → Label unten
    const gridColor = feedIn > 0 ? '#3dd68c' : (purchase > 0 ? '#f74f4f' : '#555');
    const gridLabel = feedIn > 0 ? 'Einspeisung' : (purchase > 0 ? 'Netzbezug' : 'Netz');
    svg += drawNode(gridXY.x, gridXY.y, 26, 'grid', gridLabel, Math.abs(gridPower), gridColor, Math.abs(gridPower) > 0, 20, 'bottom');

    // Verbraucher (inkl. Auto) – Fluss kommt von links → Label rechts
    houseConsumers.forEach((c, i) => {
        const cy = cStartY + i * cSpacing;
        let iconKey = typeIconMap[c.id] || 'gear';
        let label = c.name;
        let color = c.power > 0 ? '#f7a94f' : '#555';
        if (c.id === 'wallbox') {
            iconKey = 'car';
            const evSoc = carExtra?.evSoc;
            label = evSoc != null ? `${c.name} ${evSoc}%` : c.name;
            color = c.power > 0 ? '#10b981' : '#555';
        }
        svg += drawNode(cX, cy, 22, iconKey, label, c.power, color, c.power > 0, 16, 'right');
    });

    svg += '</svg>';
    container.innerHTML = svg;
}
