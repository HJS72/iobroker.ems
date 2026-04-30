'use strict';

let config = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadConfig();
    renderConfig();

    document.getElementById('btn-save').addEventListener('click', saveConfig);
    document.getElementById('btn-test-connection').addEventListener('click', testConnection);
    document.getElementById('btn-add-pv').addEventListener('click', addPvSystem);
    document.getElementById('btn-add-consumer').addEventListener('click', addConsumer);
}

// ─── Config laden / speichern ─────────────────────────────────

async function loadConfig() {
    try {
        const res = await fetch('/api/config/full');
        config = await res.json();
    } catch (e) {
        showStatus('Konfiguration konnte nicht geladen werden', 'error');
    }
}

async function saveConfig() {
    collectConfig();

    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.textContent = '⏳ Speichere...';

    try {
        const res = await fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const result = await res.json();
        if (res.ok) {
            showStatus('✓ Gespeichert – Neustart erforderlich für Änderungen', 'success');
        } else {
            showStatus('Fehler: ' + (result.error || 'Unbekannt'), 'error');
        }
    } catch (e) {
        showStatus('Speichern fehlgeschlagen: ' + e.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = '💾 Speichern';
}

async function testConnection() {
    const resultEl = document.getElementById('connection-result');
    resultEl.textContent = '⏳ Teste...';
    resultEl.className = '';

    collectIoBrokerConfig();

    try {
        const res = await fetch('/api/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config.iobroker)
        });
        const result = await res.json();
        if (result.success) {
            resultEl.textContent = '✓ Verbindung erfolgreich';
            resultEl.className = 'ok';
        } else {
            resultEl.textContent = '✕ Nicht erreichbar';
            resultEl.className = 'fail';
        }
    } catch (e) {
        resultEl.textContent = '✕ Fehler: ' + e.message;
        resultEl.className = 'fail';
    }
}

function showStatus(msg, type) {
    const el = document.getElementById('save-status');
    el.textContent = msg;
    el.className = 'status ' + type;
    setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 5000);
}

// ─── Render ───────────────────────────────────────────────────

function renderConfig() {
    if (!config) return;

    // ioBroker
    document.getElementById('cfg-iobroker-protocol').value = config.iobroker.protocol;
    document.getElementById('cfg-iobroker-host').value = config.iobroker.host;
    document.getElementById('cfg-iobroker-port').value = config.iobroker.port;

    // Location
    document.getElementById('cfg-lat').value = config.location.latitude;
    document.getElementById('cfg-lon').value = config.location.longitude;

    // PV-Anlagen
    const pvList = document.getElementById('pv-list');
    pvList.innerHTML = '';
    config.pvSystems.forEach((pv, i) => renderPvItem(pvList, pv, i));

    // Verbraucher
    const consumerList = document.getElementById('consumer-list');
    consumerList.innerHTML = '';
    config.consumers.forEach((c, i) => renderConsumerItem(consumerList, c, i));

    // Grid
    document.getElementById('cfg-grid-name').value = config.grid.name;
    document.getElementById('cfg-grid-sign').value = config.grid.signConvention || 'positive_purchase';
    document.getElementById('cfg-grid-dp-power').value = config.grid.datapoints.power;
    document.getElementById('cfg-grid-dp-energyFeedIn').value = config.grid.datapoints.energyFeedIn;
    document.getElementById('cfg-grid-dp-energyPurchase').value = config.grid.datapoints.energyPurchase;

    // Holidays
    document.getElementById('cfg-holiday-dp').value = (config.holidays && config.holidays.datapoint) || '';

    // Polling
    document.getElementById('cfg-poll-interval').value = config.polling.intervalMs / 1000;
    document.getElementById('cfg-forecast-interval').value = config.polling.forecastUpdateMs / 60000;

    // Web
    document.getElementById('cfg-web-port').value = config.web.port;
}

// ─── PV-Anlagen rendern ──────────────────────────────────────

function renderPvItem(container, pv, index) {
    const tpl = document.getElementById('tpl-pv');
    const el = tpl.content.cloneNode(true);
    const item = el.querySelector('.system-item');
    item.dataset.index = index;

    // Title
    item.querySelector('.system-title').textContent = pv.name || `PV-Anlage ${index + 1}`;

    // Fields
    setField(item, 'name', pv.name);
    setField(item, 'id', pv.id);
    setField(item, 'kwp', pv.kwp);
    setField(item, 'declination', pv.declination);
    setField(item, 'azimuth', pv.azimuth);
    setSelectField(item, 'powerSignPositive', pv.powerSignPositive || 'production');
    setSelectField(item, 'energyType', pv.energyType || 'total');
    setCheckbox(item, 'hasBattery', pv.hasBattery);

    // Datapoints
    setDp(item, 'power', pv.datapoints?.power || '');
    setDp(item, 'dailyYield', pv.datapoints?.dailyYield || '');
    setDp(item, 'dcPower', pv.datapoints?.dcPower || '');
    setDp(item, 'batteryPower', pv.datapoints?.batteryPower || '');
    setDp(item, 'batterySoc', pv.datapoints?.batterySoc || '');

    // Battery toggle
    const batteryFields = item.querySelector('.battery-fields');
    const batteryCheck = item.querySelector('[data-field="hasBattery"]');
    batteryFields.style.display = pv.hasBattery ? 'block' : 'none';
    batteryCheck.addEventListener('change', (e) => {
        batteryFields.style.display = e.target.checked ? 'block' : 'none';
    });

    // Name live update
    const nameInput = item.querySelector('[data-field="name"]');
    nameInput.addEventListener('input', () => {
        item.querySelector('.system-title').textContent = nameInput.value || `PV-Anlage ${index + 1}`;
    });

    // Remove
    item.querySelector('.btn-remove').addEventListener('click', () => {
        item.remove();
    });

    container.appendChild(el);
}

function addPvSystem() {
    const list = document.getElementById('pv-list');
    const index = list.children.length;
    const newPv = {
        name: `PV-Anlage ${index + 1}`,
        id: `pv${index + 1}`,
        declination: 30,
        azimuth: 0,
        kwp: 5.0,
        hasBattery: false,
        powerSignPositive: 'production',
        energyType: 'total',
        datapoints: { power: '', dailyYield: '' }
    };
    renderPvItem(list, newPv, index);
    list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Verbraucher rendern ─────────────────────────────────────

function renderConsumerItem(container, consumer, index) {
    const tpl = document.getElementById('tpl-consumer');
    const el = tpl.content.cloneNode(true);
    const item = el.querySelector('.system-item');
    item.dataset.index = index;

    item.querySelector('.system-title').textContent = consumer.name || `Verbraucher ${index + 1}`;

    setField(item, 'name', consumer.name);
    setField(item, 'id', consumer.id);
    setSelectField(item, 'type', consumer.type);
    setSelectField(item, 'powerSignPositive', consumer.powerSignPositive || 'consumption');
    setSelectField(item, 'energyType', consumer.energyType || 'total');

    setDp(item, 'power', consumer.datapoints?.power || '');
    setDp(item, 'energyTotal', consumer.datapoints?.energyTotal || '');

    // EV fields (nur bei Typ wallbox sichtbar)
    setDp(item, 'evSoc', consumer.datapoints?.evSoc || '');
    setDp(item, 'evRange', consumer.datapoints?.evRange || '');
    setDp(item, 'evChargeEnd', consumer.datapoints?.evChargeEnd || '');
    setDp(item, 'evBatteryCapacity', consumer.datapoints?.evBatteryCapacity || '');
    setField(item, 'evBatteryCapacity', consumer.evBatteryCapacity || '');

    const evFields = item.querySelector('.ev-fields');
    const hpFields = item.querySelector('.hp-fields');
    const typeSelect = item.querySelector('select[data-field="type"]');
    const controlModeSelect = item.querySelector('select[data-field="controlMode"]');
    evFields.style.display = consumer.type === 'wallbox' ? 'block' : 'none';
    hpFields.style.display = (consumer.type === 'heatpump' || consumer.type === 'aircon') ? 'block' : 'none';
    if (controlModeSelect && consumer.controlMode) {
        controlModeSelect.value = consumer.controlMode;
    }
    typeSelect.addEventListener('change', () => {
        evFields.style.display = typeSelect.value === 'wallbox' ? 'block' : 'none';
        hpFields.style.display = (typeSelect.value === 'heatpump' || typeSelect.value === 'aircon') ? 'block' : 'none';
        // Auto-set controlMode based on type
        if (controlModeSelect) {
            const autoMode = { heatpump: 'controllable', aircon: 'controllable', wallbox: 'self_regulating', washer: 'recommend_start', dryer: 'recommend_start', house: 'none' };
            controlModeSelect.value = autoMode[typeSelect.value] || 'none';
        }
    });

    // Heatpump temp DPs
    setDp(item, 'tempCurrent', consumer.datapoints?.tempCurrent || '');
    setDp(item, 'tempStart', consumer.datapoints?.tempStart || '');
    setDp(item, 'tempEnd', consumer.datapoints?.tempEnd || '');

    // Seasons checkboxes
    const seasons = consumer.seasons || [];
    ['winter', 'spring', 'summer', 'autumn'].forEach(s => {
        const cb = item.querySelector(`[data-season="${s}"]`);
        if (cb) cb.checked = seasons.includes(s);
    });

    // Name live update
    const nameInput = item.querySelector('[data-field="name"]');
    nameInput.addEventListener('input', () => {
        item.querySelector('.system-title').textContent = nameInput.value || `Verbraucher ${index + 1}`;
    });

    // Remove
    item.querySelector('.btn-remove').addEventListener('click', () => {
        item.remove();
    });

    container.appendChild(el);
}

function addConsumer() {
    const list = document.getElementById('consumer-list');
    const index = list.children.length;
    const newConsumer = {
        name: `Verbraucher ${index + 1}`,
        id: `device${index + 1}`,
        type: 'other',
        powerSignPositive: 'consumption',
        energyType: 'total',
        datapoints: { power: '', energyTotal: '' }
    };
    renderConsumerItem(list, newConsumer, index);
    list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Config sammeln (DOM → Objekt) ──────────────────────────

function collectIoBrokerConfig() {
    config.iobroker.protocol = document.getElementById('cfg-iobroker-protocol').value;
    config.iobroker.host = document.getElementById('cfg-iobroker-host').value.trim();
    config.iobroker.port = parseInt(document.getElementById('cfg-iobroker-port').value) || 8087;
}

function collectConfig() {
    if (!config) config = {};

    collectIoBrokerConfig();

    // Location
    config.location = {
        latitude: parseFloat(document.getElementById('cfg-lat').value) || 0,
        longitude: parseFloat(document.getElementById('cfg-lon').value) || 0
    };

    // PV-Anlagen
    config.pvSystems = [];
    document.querySelectorAll('#pv-list .system-item').forEach(item => {
        const pv = {
            name: getField(item, 'name'),
            id: getField(item, 'id'),
            declination: parseFloat(getField(item, 'declination')) || 0,
            azimuth: parseFloat(getField(item, 'azimuth')) || 0,
            kwp: parseFloat(getField(item, 'kwp')) || 0,
            hasBattery: getCheckbox(item, 'hasBattery'),
            powerSignPositive: getSelectField(item, 'powerSignPositive') || 'production',
            energyType: getSelectField(item, 'energyType') || 'total',
            datapoints: {
                power: getDp(item, 'power'),
                dailyYield: getDp(item, 'dailyYield')
            }
        };
        if (pv.hasBattery) {
            pv.datapoints.dcPower = getDp(item, 'dcPower');
            pv.datapoints.batteryPower = getDp(item, 'batteryPower');
            pv.datapoints.batterySoc = getDp(item, 'batterySoc');
        }
        config.pvSystems.push(pv);
    });

    // Verbraucher
    config.consumers = [];
    document.querySelectorAll('#consumer-list .system-item').forEach(item => {
        const seasons = [];
        ['winter', 'spring', 'summer', 'autumn'].forEach(s => {
            const cb = item.querySelector(`[data-season="${s}"]`);
            if (cb && cb.checked) seasons.push(s);
        });

        const consumer = {
            name: getField(item, 'name'),
            id: getField(item, 'id'),
            type: getSelectField(item, 'type'),
            controlMode: getSelectField(item, 'controlMode') || 'none',
            powerSignPositive: getSelectField(item, 'powerSignPositive') || 'consumption',
            energyType: getSelectField(item, 'energyType') || 'total',
            datapoints: {
                power: getDp(item, 'power'),
                energyTotal: getDp(item, 'energyTotal')
            }
        };
        // EV datapoints (bei Wallbox)
        if (consumer.type === 'wallbox') {
            const evSoc = getDp(item, 'evSoc');
            const evRange = getDp(item, 'evRange');
            const evChargeEnd = getDp(item, 'evChargeEnd');
            const evBatCapDp = getDp(item, 'evBatteryCapacity');
            if (evSoc) consumer.datapoints.evSoc = evSoc;
            if (evRange) consumer.datapoints.evRange = evRange;
            if (evChargeEnd) consumer.datapoints.evChargeEnd = evChargeEnd;
            if (evBatCapDp) consumer.datapoints.evBatteryCapacity = evBatCapDp;
            const evCap = parseFloat(getField(item, 'evBatteryCapacity'));
            if (evCap > 0) consumer.evBatteryCapacity = evCap;
        }
        // Heatpump/Aircon temp DPs
        if (consumer.type === 'heatpump' || consumer.type === 'aircon') {
            const tempCurrent = getDp(item, 'tempCurrent');
            const tempStart = getDp(item, 'tempStart');
            const tempEnd = getDp(item, 'tempEnd');
            if (tempCurrent) consumer.datapoints.tempCurrent = tempCurrent;
            if (tempStart) consumer.datapoints.tempStart = tempStart;
            if (tempEnd) consumer.datapoints.tempEnd = tempEnd;
        }
        if (seasons.length > 0) consumer.seasons = seasons;
        config.consumers.push(consumer);
    });

    // Grid
    config.grid = {
        name: document.getElementById('cfg-grid-name').value.trim(),
        signConvention: document.getElementById('cfg-grid-sign').value || 'positive_purchase',
        datapoints: {
            power: document.getElementById('cfg-grid-dp-power').value.trim(),
            energyFeedIn: document.getElementById('cfg-grid-dp-energyFeedIn').value.trim(),
            energyPurchase: document.getElementById('cfg-grid-dp-energyPurchase').value.trim()
        }
    };

    // Holidays
    const holidayDp = document.getElementById('cfg-holiday-dp').value.trim();
    if (holidayDp) {
        config.holidays = { datapoint: holidayDp };
    } else {
        config.holidays = { datapoint: '' };
    }

    // Polling
    config.polling = {
        intervalMs: (parseInt(document.getElementById('cfg-poll-interval').value) || 10) * 1000,
        forecastUpdateMs: (parseInt(document.getElementById('cfg-forecast-interval').value) || 15) * 60000
    };

    // Web
    config.web = {
        port: parseInt(document.getElementById('cfg-web-port').value) || 3000
    };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────

function setField(item, field, value) {
    const el = item.querySelector(`[data-field="${field}"]`);
    if (el) el.value = value ?? '';
}

function getField(item, field) {
    const el = item.querySelector(`[data-field="${field}"]`);
    return el ? el.value.trim() : '';
}

function setSelectField(item, field, value) {
    const el = item.querySelector(`select[data-field="${field}"]`);
    if (el) el.value = String(value);
}

function getSelectField(item, field) {
    const el = item.querySelector(`select[data-field="${field}"]`);
    return el ? el.value : '';
}

function setCheckbox(item, field, value) {
    const el = item.querySelector(`[data-field="${field}"]`);
    if (el) el.checked = !!value;
}

function getCheckbox(item, field) {
    const el = item.querySelector(`[data-field="${field}"]`);
    return el ? el.checked : false;
}

function setDp(item, dp, value) {
    const el = item.querySelector(`[data-dp="${dp}"]`);
    if (el) el.value = value ?? '';
}

function getDp(item, dp) {
    const el = item.querySelector(`[data-dp="${dp}"]`);
    return el ? el.value.trim() : '';
}
