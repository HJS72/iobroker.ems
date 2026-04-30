'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'default.json');

let _config = null;

function load() {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    _config = JSON.parse(raw);
    return _config;
}

function get() {
    if (!_config) load();
    return _config;
}

function save(cfg) {
    _config = cfg;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

/**
 * Liefert alle Datenpunkt-IDs als flache Liste für Bulk-Abfragen.
 */
function getAllDatapointIds() {
    const cfg = get();
    const ids = [];

    // PV systems
    for (const pv of cfg.pvSystems) {
        for (const dp of Object.values(pv.datapoints)) {
            if (dp) ids.push(dp);
        }
    }
    // Consumers
    for (const c of cfg.consumers) {
        for (const dp of Object.values(c.datapoints)) {
            if (dp) ids.push(dp);
        }
    }
    // Grid
    for (const dp of Object.values(cfg.grid.datapoints)) {
        ids.push(dp);
    }

    return ids;
}

module.exports = { load, get, save, getAllDatapointIds };
