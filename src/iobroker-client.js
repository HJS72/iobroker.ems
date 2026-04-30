'use strict';

const fetch = require('node-fetch');

class IoBrokerClient {
    constructor(cfg) {
        this.baseUrl = `${cfg.protocol}://${cfg.host}:${cfg.port}`;
    }

    /**
     * Einzelnen State lesen.
     * @param {string} id - z.B. "alias.0.pv1.power"
     * @returns {Promise<{val: number, ts: number, ack: boolean}>}
     */
    async getState(id) {
        const url = `${this.baseUrl}/get/${encodeURIComponent(id)}`;
        const res = await fetch(url, { timeout: 5000 });
        if (!res.ok) throw new Error(`ioBroker GET ${id}: ${res.status} ${res.statusText}`);
        return res.json();
    }

    /**
     * Mehrere States auf einmal lesen (SimpleAPI getBulk).
     * @param {string[]} ids
     * @returns {Promise<Object<string, {val: number, ts: number}>>}
     */
    async getBulk(ids) {
        const url = `${this.baseUrl}/getBulk/${ids.map(encodeURIComponent).join(',')}`;
        const res = await fetch(url, { timeout: 10000 });
        if (!res.ok) throw new Error(`ioBroker getBulk: ${res.status} ${res.statusText}`);
        const data = await res.json();

        // SimpleAPI gibt Array zurück: [{id, val, ts, ack}, ...]
        const result = {};
        if (Array.isArray(data)) {
            for (const item of data) {
                result[item.id] = { val: parseFloat(item.val) || 0, ts: item.ts };
            }
        } else if (typeof data === 'object') {
            // Manche SimpleAPI-Versionen geben ein Objekt zurück
            for (const [key, item] of Object.entries(data)) {
                if (typeof item === 'object' && item !== null) {
                    result[key] = { val: parseFloat(item.val) || 0, ts: item.ts };
                } else {
                    result[key] = { val: parseFloat(item) || 0, ts: Date.now() };
                }
            }
        }
        return result;
    }

    /**
     * Einen Wert als Plaintext lesen.
     */
    async getPlainValue(id) {
        const url = `${this.baseUrl}/getPlainValue/${encodeURIComponent(id)}`;
        const res = await fetch(url, { timeout: 5000 });
        if (!res.ok) throw new Error(`ioBroker getPlainValue ${id}: ${res.status}`);
        const text = await res.text();
        return parseFloat(text) || 0;
    }

    /**
     * State setzen.
     */
    async setState(id, value) {
        const url = `${this.baseUrl}/set/${encodeURIComponent(id)}?value=${encodeURIComponent(value)}`;
        const res = await fetch(url, { timeout: 5000 });
        if (!res.ok) throw new Error(`ioBroker SET ${id}: ${res.status}`);
        return res.json();
    }

    /**
     * Verbindungstest
     */
    async testConnection() {
        try {
            const url = `${this.baseUrl}/get/system.adapter.admin.0.alive`;
            console.log(`[ioBroker] Testing connection to: ${url}`);
            const res = await fetch(url, { timeout: 5000 });
            if (res.ok) {
                const data = await res.json();
                console.log(`[ioBroker] Connection successful, admin alive: ${data.val}`);
                return true;
            } else {
                console.log(`[ioBroker] Connection failed: ${res.status} ${res.statusText}`);
                return false;
            }
        } catch (error) {
            console.log(`[ioBroker] Connection error: ${error.message}`);
            return false;
        }
    }

    /**
     * Feiertag-Status abfragen (Feiertage-Adapter).
     * @param {string} dpId - z.B. "feiertage.0.heute.boolean"
     * @returns {Promise<boolean>}
     */
    async isHoliday(dpId) {
        try {
            const state = await this.getState(dpId);
            return !!state.val;
        } catch {
            return false;
        }
    }
}

module.exports = IoBrokerClient;
