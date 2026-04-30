'use strict';

// ─── Daten (data.html) ───────────────────────────────────────────
// Stündliche Detailtabelle

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    await loadAllData();
});

async function loadAllData() {
    try {
        const res = await fetch(`/api/forecast/${currentDate}`);
        const data = await res.json();
        updateHourlyTable(data);
    } catch (e) {
        console.error('Prognose laden fehlgeschlagen:', e);
    }
}

function updateHourlyTable(data) {
    const headerRow = document.getElementById('hourly-header');
    const tbody = document.getElementById('hourly-body');

    // Header
    let headerHtml = '<th>Stunde</th>';
    for (const [pvId, pvData] of Object.entries(data.pvForecast || {})) {
        headerHtml += `<th style="color:var(--pv-color)">${pvData.name}</th>`;
    }
    for (const [sysId, sys] of Object.entries(data.systems || {})) {
        headerHtml += `<th style="color:var(--consumer-color)">${sys.name}</th>`;
    }
    headerHtml += '<th style="color:var(--green)">Einspeisung</th>';
    headerHtml += '<th style="color:var(--red)">Bezug</th>';
    headerHtml += '<th>Bilanz</th>';
    headerRow.innerHTML = headerHtml;

    // Body
    const currentHour = new Date().getHours();
    let bodyHtml = '';
    for (let h = 0; h < 24; h++) {
        const isCurrent = h === currentHour && currentDate === new Date().toISOString().split('T')[0];
        bodyHtml += `<tr class="${isCurrent ? 'current-hour' : ''}">`;
        bodyHtml += `<td>${String(h).padStart(2, '0')}:00</td>`;

        // PV
        for (const [pvId, pvData] of Object.entries(data.pvForecast || {})) {
            const hourData = pvData.forecast?.[h];
            const w = hourData?.wattsCorrected || hourData?.watts || 0;
            const raw = hourData?.watts || 0;
            const title = w !== raw ? `Plan: ${formatPower(raw)}` : '';
            bodyHtml += `<td title="${title}">${formatPower(w)}</td>`;
        }

        // Verbraucher
        for (const [sysId, sys] of Object.entries(data.systems || {})) {
            const hourData = sys.forecast?.find(f => f.hour === h);
            const w = hourData?.powerAvg || 0;
            const cls = hourData?.source === 'forecast' ? 'val-forecast' : '';
            bodyHtml += `<td class="${cls}">${formatPower(w)}</td>`;
        }

        // Grid
        const grid = data.gridBalance?.[h] || {};
        bodyHtml += `<td class="val-positive">${formatPower(grid.feedIn)}</td>`;
        bodyHtml += `<td class="val-negative">${formatPower(grid.purchase)}</td>`;
        const balance = grid.balance || 0;
        bodyHtml += `<td class="${balance >= 0 ? 'val-positive' : 'val-negative'}">${formatPower(balance)}</td>`;

        bodyHtml += '</tr>';
    }
    tbody.innerHTML = bodyHtml;
}
