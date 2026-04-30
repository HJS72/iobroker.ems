'use strict';

// ─── Tagesübersicht (daily.html) ─────────────────────────────────
// Tageszusammenfassung, Priorisierung, Fahrplan

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    await loadAllData();
});

async function loadAllData() {
    await Promise.all([
        loadForecast(),
        loadSchedule()
    ]);
}

async function loadForecast() {
    try {
        const res = await fetch(`/api/forecast/${currentDate}`);
        const data = await res.json();
        updateDailySummary(data);
        updatePriorities(data);
    } catch (e) {
        console.error('Prognose laden fehlgeschlagen:', e);
    }
}

async function loadSchedule() {
    try {
        const res = await fetch(`/api/schedule/${currentDate}`);
        const data = await res.json();
        updateSchedule(data);
    } catch (e) {
        console.error('Fahrplan laden fehlgeschlagen:', e);
    }
}

// ─── Tageszusammenfassung ─────────────────────────────────────────
function updateDailySummary(data) {
    const container = document.getElementById('daily-summary');
    const t = data.totals || {};

    const autarkie = t.consumption > 0
        ? Math.min(100, Math.round((1 - t.purchase / t.consumption) * 100))
        : 0;
    const eigenverbrauch = t.production > 0
        ? Math.min(100, Math.round((1 - t.feedIn / t.production) * 100))
        : 0;

    container.innerHTML = `
        <div class="summary-item neutral">
            <div class="si-label">PV-Erzeugung (korrigiert)</div>
            <div class="si-value">${formatEnergy(t.production)}</div>
        </div>
        <div class="summary-item negative">
            <div class="si-label">Gesamtverbrauch (Prognose)</div>
            <div class="si-value">${formatEnergy(t.consumption)}</div>
        </div>
        <div class="summary-item positive">
            <div class="si-label">Einspeisung (Prognose)</div>
            <div class="si-value">${formatEnergy(t.feedIn)}</div>
        </div>
        <div class="summary-item negative">
            <div class="si-label">Netzbezug (Prognose)</div>
            <div class="si-value">${formatEnergy(t.purchase)}</div>
        </div>
        <div class="summary-item ${autarkie >= 80 ? 'positive' : autarkie >= 50 ? 'neutral' : 'negative'}">
            <div class="si-label">Autarkiegrad</div>
            <div class="si-value">${autarkie}%</div>
        </div>
        <div class="summary-item ${eigenverbrauch >= 60 ? 'positive' : 'neutral'}">
            <div class="si-label">Eigenverbrauch</div>
            <div class="si-value">${eigenverbrauch}%</div>
        </div>`;
}

// ─── Verbraucher-Priorisierung ────────────────────────────────────
function updatePriorities(data) {
    const container = document.getElementById('priority-list');
    const priorities = data.priorities || [];

    if (priorities.length === 0) {
        container.innerHTML = '<p style="color:var(--text-dim)">Noch keine historischen Daten für Priorisierung verfügbar.</p>';
        return;
    }

    const recLabels = {
        pv_full: { text: '☀️ Voll PV-deckbar', cls: 'positive' },
        pv_partial: { text: '⛅ Teilweise PV', cls: 'neutral' },
        pv_minimal: { text: '☁️ Wenig PV', cls: 'negative' },
        grid_only: { text: '🔌 Nur Netz', cls: 'negative' },
        no_data: { text: '❓ Keine Daten', cls: '' }
    };

    let html = '';
    for (const p of priorities) {
        const rec = recLabels[p.recommendation] || recLabels.no_data;
        const demandKwh = (p.dailyDemandWh / 1000).toFixed(1);
        const viableKwh = (p.viableEnergyWh / 1000).toFixed(1);
        const hours = p.viableWindows || [];
        const windowStr = hours.length > 0
            ? hours.map(h => `${String(h.hour).padStart(2, '0')}:00`).join(', ')
            : '–';

        html += `
            <div class="priority-card ${rec.cls}">
                <div class="pri-header">
                    <span class="pri-name">${p.name}</span>
                    <span class="pri-rec">${rec.text}</span>
                </div>
                <div class="pri-stats">
                    <div class="pri-stat">
                        <span class="pri-label">Tagesbedarf</span>
                        <span class="pri-value">${demandKwh} kWh</span>
                    </div>
                    <div class="pri-stat">
                        <span class="pri-label">PV-deckbar</span>
                        <span class="pri-value">${viableKwh} kWh (${p.coveragePercent}%)</span>
                    </div>
                    <div class="pri-stat">
                        <span class="pri-label">Min. Leistung</span>
                        <span class="pri-value">${formatPower(p.minPowerW)}</span>
                    </div>
                    <div class="pri-stat">
                        <span class="pri-label">Ø Laufleistung</span>
                        <span class="pri-value">${formatPower(p.avgRunPowerW)}</span>
                    </div>
                    <div class="pri-stat">
                        <span class="pri-label">Ø Laufzeit/Tag</span>
                        <span class="pri-value">${p.avgRunHoursPerDay}h</span>
                    </div>
                    <div class="pri-stat">
                        <span class="pri-label">PV-Fenster</span>
                        <span class="pri-value">${p.viableHours}h</span>
                    </div>
                </div>
                <div class="pri-windows" title="${windowStr}">
                    🕒 ${windowStr}
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

// ─── Tagesfahrplan ────────────────────────────────────────────────
function updateSchedule(data) {
    const summaryEl = document.getElementById('schedule-summary');
    const timelineEl = document.getElementById('schedule-timeline');
    const devicesEl = document.getElementById('schedule-devices');
    if (!summaryEl || !data) return;

    const controlModeLabels = {
        controllable: '🔧 Steuerbar',
        self_regulating: '🔄 Selbstregelnd',
        recommend_start: '⏰ Empfehlung'
    };

    // ─── Zusammenfassung ──────────────────────────────
    const s = data.summary || {};
    let summaryHtml = `
        <div class="summary-item">
            <span class="summary-label">PV-Überschuss</span>
            <span class="summary-value">${formatEnergy(s.totalPvSurplusWh)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Geplant</span>
            <span class="summary-value">${formatEnergy(s.totalScheduledWh)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Batterie-Ladung</span>
            <span class="summary-value">${formatEnergy(s.totalBatteryChargeWh)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Eigenverbrauch</span>
            <span class="summary-value">${s.pvSelfUsePercent || 0}%</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Batterie Ziel-SOC</span>
            <span class="summary-value">${s.batteryEndSoc != null ? s.batteryEndSoc + '%' : '--'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Sonnenuntergang</span>
            <span class="summary-value">${s.sunsetHour || '--'}:00</span>
        </div>
    `;

    if (s.recommendations?.length) {
        summaryHtml += '<div class="summary-recommendations">';
        for (const rec of s.recommendations) {
            summaryHtml += `<div class="rec-item">⏰ <strong>${rec.device}:</strong> ${rec.message}</div>`;
        }
        summaryHtml += '</div>';
    }
    summaryEl.innerHTML = summaryHtml;

    // ─── Timeline ─────────────────────────────────────
    const deviceColors = {
        heatpump: '#f59e0b', aircon: '#3b82f6', wallbox: '#10b981',
        washer: '#a855f7', dryer: '#ec4899', default: '#8b5cf6'
    };
    const statusLabels = {
        pv_covered: '☀️ PV-Volldeckung', pv_partial: '🌤️ PV-Teildeckung',
        pv_plus_grid: '⚡ PV + Netz', pv_minimal: '🌥️ PV-Minimal',
        grid_needed: '🔌 Netz nötig', postpone: '⏳ Verschiebbar',
        not_needed: '✅ Nicht nötig', pending: '⏸️ Ausstehend'
    };

    let timelineHtml = '<div class="timeline-header">';
    for (let h = 5; h <= 21; h++) {
        timelineHtml += `<span class="tl-hour">${h}</span>`;
    }
    timelineHtml += '</div>';

    // Batterie
    if (data.batteryPlan) {
        const bp = data.batteryPlan;
        const blockedSet = new Set(bp.wallboxBlocked || []);
        timelineHtml += '<div class="timeline-row">';
        timelineHtml += `<span class="tl-label">🔋 Batterie (${bp.currentSoc}% → ${bp.expectedEndSoc || '?'}%)</span>`;
        timelineHtml += '<div class="tl-bars">';
        for (let h = 5; h <= 21; h++) {
            const ch = bp.chargeHours?.find(c => c.hour === h);
            if (blockedSet.has(h)) {
                timelineHtml += '<span class="tl-cell tl-blocked" title="Blockiert (Wallbox)">🚫</span>';
            } else if (ch) {
                const intensity = Math.min(1, ch.chargeW / (bp.maxChargeW || 5000));
                timelineHtml += `<span class="tl-cell tl-active" style="opacity:${0.4 + intensity * 0.6};background:#22c55e" title="${ch.chargeW}W laden"></span>`;
            } else {
                timelineHtml += '<span class="tl-cell"></span>';
            }
        }
        timelineHtml += '</div></div>';
    }

    // Geräte (controllable + self_regulating)
    for (const dev of (data.devices || [])) {
        if (dev.status === 'not_needed' || dev.controlMode === 'recommend_start') continue;
        const color = deviceColors[dev.type] || deviceColors.default;
        timelineHtml += '<div class="timeline-row">';
        timelineHtml += `<span class="tl-label">${dev.name}</span>`;
        timelineHtml += '<div class="tl-bars">';
        for (let h = 5; h <= 21; h++) {
            const sh = dev.scheduledHours?.find(s => s.hour === h);
            if (sh) {
                const intensity = Math.min(1, sh.powerW / (dev.peakPower || 3000));
                timelineHtml += `<span class="tl-cell tl-active" style="opacity:${0.4 + intensity * 0.6};background:${color}" title="${sh.powerW}W"></span>`;
            } else {
                timelineHtml += '<span class="tl-cell"></span>';
            }
        }
        timelineHtml += '</div></div>';
    }

    // Empfehlungs-Geräte
    for (const dev of (data.devices || [])) {
        if (dev.controlMode !== 'recommend_start' || !dev.recommendation) continue;
        const color = deviceColors[dev.type] || deviceColors.default;
        const rec = dev.recommendation;
        timelineHtml += '<div class="timeline-row">';
        timelineHtml += `<span class="tl-label">${dev.name} ⏰</span>`;
        timelineHtml += '<div class="tl-bars">';
        for (let h = 5; h <= 21; h++) {
            if (h >= rec.startHour && h < rec.endHour) {
                timelineHtml += `<span class="tl-cell tl-recommend" style="background:${color}" title="Empf. ${rec.coveragePercent}% PV"></span>`;
            } else {
                timelineHtml += '<span class="tl-cell"></span>';
            }
        }
        timelineHtml += '</div></div>';
    }
    timelineEl.innerHTML = timelineHtml;

    // ─── Geräte-Details ───────────────────────────────
    let devHtml = '';
    for (const dev of (data.devices || [])) {
        const color = deviceColors[dev.type] || deviceColors.default;
        const statusText = statusLabels[dev.status] || dev.status;
        const modeText = controlModeLabels[dev.controlMode] || '';
        const borderClass = dev.status === 'pv_covered' ? 'border-positive'
            : dev.status === 'not_needed' ? 'border-neutral'
            : (dev.status === 'grid_needed' || dev.status === 'pv_plus_grid') ? 'border-negative'
            : '';

        devHtml += `<div class="schedule-device-card ${borderClass}">`;
        devHtml += `<div class="sdc-header" style="border-left: 3px solid ${color}">`;
        devHtml += `<strong>${dev.name}</strong> <span class="sdc-mode">${modeText}</span> <span class="sdc-status">${statusText}</span>`;
        devHtml += '</div>';
        devHtml += '<div class="sdc-body">';

        if (dev.controlMode === 'recommend_start' && dev.recommendation) {
            devHtml += `<div class="sdc-recommend">${dev.recommendation.message}</div>`;
            if (dev.typicalRunHours) {
                devHtml += `<div>Typische Laufzeit: ~${dev.typicalRunHours.toFixed(1)}h | Avg: ${formatPower(dev.avgRunPower)}</div>`;
            }
        } else {
            devHtml += `<div>Bedarf: ${formatEnergy(dev.demandWh)} | Geplant: ${formatEnergy(dev.scheduledEnergyWh)} (${dev.coveragePercent || 0}%)</div>`;
            devHtml += `<div>Min: ${formatPower(dev.minPower)} | Avg: ${formatPower(dev.avgRunPower)}</div>`;
            if (dev.scheduledHours?.length) {
                const hours = dev.scheduledHours.map(h => `${String(h.hour).padStart(2, '0')}:00`).join(', ');
                devHtml += `<div>Geplant: ${hours}</div>`;
            }
        }

        if (dev.tempNeed) {
            const tn = dev.tempNeed;
            devHtml += `<div>Temp: ${tn.current}° (${tn.start}°→${tn.end}° ${tn.mode})</div>`;
        }
        if (dev.evInfo) {
            devHtml += `<div>EV: SOC ${dev.evInfo.soc || '--'}% | ${dev.evInfo.range || '--'} km</div>`;
        }
        devHtml += '</div></div>';
    }
    devicesEl.innerHTML = devHtml;
}
