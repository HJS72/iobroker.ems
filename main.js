"use strict";

const utils = require("@iobroker/adapter-core");

const TYPE_ENERGIE = "Energie";
const TYPE_ENERGIETAG = "EnergieTag";
const TYPE_VERBRAUCH = "Verbrauch";
const TYPE_DURCHSCHNITT = "Durchschnitt";

class EmsAdapter extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "ems"
    });

    this.calculations = [];
    this.lastValues = {};
    this.calcsBySource = new Map();
    this.verbrauchByTarget = new Map();
    this.verbrauchTargetsBySource = new Map();
    this.energyStates = new Map();
    this.energyDayStates = new Map();
    this.averageStates = new Map();
    this.currentDayKey = this.getDayKey(new Date());
    this.dayChangeInterval = null;

    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }

  async onReady() {
    this.log.info("EMS adapter gestartet");

    this.calculations = this.parseCalculations();
    this.indexCalculations();

    await this.ensureOutputStates();

    const toSubscribe = this.getInputStateIds();
    for (const id of toSubscribe) {
      await this.subscribeForeignStatesAsync(id);
      this.log.info(`Abonniert: ${id}`);
    }

    await this.restoreInitialValues();
    await this.recalculateAllVerbrauchTargets();

    this.dayChangeInterval = this.setInterval(() => {
      void this.checkDailyReset();
    }, 60_000);
  }

  onUnload(callback) {
    try {
      if (this.dayChangeInterval) {
        this.clearInterval(this.dayChangeInterval);
        this.dayChangeInterval = null;
      }
      callback();
    } catch (_error) {
      callback();
    }
  }

  async onStateChange(id, state) {
    if (!state || state.val === null || state.val === undefined) {
      return;
    }

    const numericValue = Number(state.val);
    if (Number.isNaN(numericValue)) {
      this.log.warn(`State ${id} ist nicht numerisch: ${state.val}`);
      return;
    }

    this.lastValues[id] = numericValue;

    const ts = state.ts || Date.now();
    const calcs = this.calcsBySource.get(id) || [];
    for (const calc of calcs) {
      if (calc.type === TYPE_ENERGIE) {
        await this.processEnergie(calc, numericValue, ts);
      } else if (calc.type === TYPE_ENERGIETAG) {
        await this.processEnergieTag(calc, numericValue);
      } else if (calc.type === TYPE_DURCHSCHNITT) {
        await this.processDurchschnitt(calc, numericValue, ts);
      }
    }

    await this.recalculateVerbrauchTargetsForSource(id);
  }

  getInputStateIds() {
    const ids = new Set();
    for (const calc of this.calculations) {
      if (calc.sourceId) {
        ids.add(calc.sourceId);
      }
    }
    return Array.from(ids);
  }

  parseCalculations() {
    const rows = this.readCalculationRows();
    const result = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.enabled === false) {
        continue;
      }

      const type = this.normalizeType(row.type);
      if (!type) {
        this.log.warn(`Berechnung in Zeile ${i + 1} uebersprungen: ungueltiger Typ`);
        continue;
      }

      const sourceId = typeof row.sourceId === "string" ? row.sourceId.trim() : "";
      if (!sourceId) {
        this.log.warn(`Berechnung in Zeile ${i + 1} uebersprungen: Quell-Datenpunkt fehlt`);
        continue;
      }

      const targetName = typeof row.targetName === "string" ? row.targetName.trim() : "";
      if (!targetName) {
        this.log.warn(`Berechnung in Zeile ${i + 1} uebersprungen: Ziel-Datenpunktname fehlt`);
        continue;
      }

      const calc = {
        id: `calc_${i + 1}`,
        type,
        sourceId,
        targetName,
        targetId: this.buildTargetStateId(targetName),
        onlyPositive: row.onlyPositive !== false,
        averageSeconds: this.parsePositiveNumber(row.averageSeconds, 300),
        verbrauchType: row.verbrauchType === "producer" ? "producer" : "consumer"
      };

      result.push(calc);
    }

    this.log.info(`Konfigurierte Berechnungen: ${result.length}`);
    return result;
  }

  readCalculationRows() {
    const raw = this.config.calculations;
    if (Array.isArray(raw)) {
      return raw;
    }
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        this.log.error(`Ungueltige calculations-Konfiguration: ${error.message}`);
        return [];
      }
    }
    return [];
  }

  normalizeType(typeRaw) {
    const value = String(typeRaw || "").trim().toLowerCase();
    if (value === "energie") {
      return TYPE_ENERGIE;
    }
    if (value === "energietag") {
      return TYPE_ENERGIETAG;
    }
    if (value === "verbrauch") {
      return TYPE_VERBRAUCH;
    }
    if (value === "durchschnitt") {
      return TYPE_DURCHSCHNITT;
    }
    return "";
  }

  parsePositiveNumber(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      return fallback;
    }
    return n;
  }

  buildTargetStateId(targetName) {
    if (targetName.includes(".")) {
      return targetName;
    }
    const sanitized = targetName
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+/, "")
      .replace(/_+$/, "") || "calc";
    return `${this.namespace}.calculated.${sanitized}`;
  }

  indexCalculations() {
    this.calcsBySource.clear();
    this.verbrauchByTarget.clear();
    this.verbrauchTargetsBySource.clear();

    for (const calc of this.calculations) {
      const bySource = this.calcsBySource.get(calc.sourceId) || [];
      bySource.push(calc);
      this.calcsBySource.set(calc.sourceId, bySource);

      if (calc.type === TYPE_VERBRAUCH) {
        const targetRows = this.verbrauchByTarget.get(calc.targetId) || [];
        targetRows.push(calc);
        this.verbrauchByTarget.set(calc.targetId, targetRows);

        const targetSet = this.verbrauchTargetsBySource.get(calc.sourceId) || new Set();
        targetSet.add(calc.targetId);
        this.verbrauchTargetsBySource.set(calc.sourceId, targetSet);
      }
    }
  }

  async ensureOutputStates() {
    const seen = new Set();
    for (const calc of this.calculations) {
      if (seen.has(calc.targetId)) {
        continue;
      }
      seen.add(calc.targetId);

      const common = this.getCommonForType(calc.type, calc.targetName);
      await this.ensureForeignState(calc.targetId, common);
    }
  }

  getCommonForType(type, targetName) {
    if (type === TYPE_ENERGIE) {
      return {
        name: targetName,
        type: "number",
        role: "value.power.consumption",
        read: true,
        write: false,
        unit: "Wh",
        def: 0
      };
    }

    if (type === TYPE_ENERGIETAG) {
      return {
        name: targetName,
        type: "number",
        role: "value.power.consumption",
        read: true,
        write: false,
        unit: "Wh",
        def: 0
      };
    }

    if (type === TYPE_VERBRAUCH) {
      return {
        name: targetName,
        type: "number",
        role: "value.power",
        read: true,
        write: false,
        unit: "W",
        def: 0
      };
    }

    return {
      name: targetName,
      type: "number",
      role: "value",
      read: true,
      write: false,
      def: 0
    };
  }

  async ensureForeignState(id, common) {
    const object = await this.getForeignObjectAsync(id);
    if (!object) {
      await this.setForeignObjectAsync(id, {
        _id: id,
        type: "state",
        common,
        native: {}
      });
    }
  }

  async restoreInitialValues() {
    const inputIds = this.getInputStateIds();
    for (const id of inputIds) {
      const state = await this.getForeignStateAsync(id);
      if (state && state.val !== null && state.val !== undefined) {
        const numeric = Number(state.val);
        if (Number.isFinite(numeric)) {
          this.lastValues[id] = numeric;
        }
      }
    }

    const now = Date.now();
    for (const calc of this.calculations) {
      if (calc.type === TYPE_ENERGIE) {
        await this.initializeEnergie(calc, now);
      } else if (calc.type === TYPE_ENERGIETAG) {
        await this.initializeEnergieTag(calc);
      } else if (calc.type === TYPE_DURCHSCHNITT) {
        await this.initializeDurchschnitt(calc, now);
      }
    }
  }

  async initializeEnergie(calc, now) {
    const targetState = await this.getForeignStateAsync(calc.targetId);
    const existingEnergy = targetState && Number.isFinite(Number(targetState.val)) ? Number(targetState.val) : 0;
    const sourceValue = this.readLast(calc.sourceId) || 0;

    this.energyStates.set(calc.id, {
      lastTs: now,
      lastPower: sourceValue,
      energyWh: existingEnergy
    });

    await this.setForeignStateAsync(calc.targetId, {
      val: Number(existingEnergy.toFixed(3)),
      ack: true
    });
  }

  async initializeEnergieTag(calc) {
    const sourceValue = this.readLast(calc.sourceId) || 0;
    const currentOutState = await this.getForeignStateAsync(calc.targetId);
    const currentOut = currentOutState && Number.isFinite(Number(currentOutState.val)) ? Number(currentOutState.val) : 0;

    let dayStartValue = sourceValue - currentOut;
    if (!Number.isFinite(dayStartValue)) {
      dayStartValue = sourceValue;
    }

    this.energyDayStates.set(calc.id, {
      dayKey: this.currentDayKey,
      dayStartValue
    });

    const todayValue = Math.max(0, sourceValue - dayStartValue);
    await this.setForeignStateAsync(calc.targetId, {
      val: Number(todayValue.toFixed(3)),
      ack: true
    });
  }

  async initializeDurchschnitt(calc, now) {
    const sourceValue = this.readLast(calc.sourceId);
    if (sourceValue === null) {
      return;
    }

    this.averageStates.set(calc.id, {
      history: [{ ts: now, val: sourceValue }]
    });

    await this.setForeignStateAsync(calc.targetId, {
      val: Number(sourceValue.toFixed(3)),
      ack: true
    });
  }

  readLast(id) {
    if (!id) {
      return null;
    }
    const value = this.lastValues[id];
    return Number.isFinite(value) ? value : null;
  }

  async processEnergie(calc, sourceValue, timestamp) {
    const state = this.energyStates.get(calc.id) || {
      lastTs: timestamp,
      lastPower: sourceValue,
      energyWh: 0
    };

    const dtMs = Math.max(0, timestamp - state.lastTs);
    let powerForDelta = state.lastPower;
    if (calc.onlyPositive && powerForDelta < 0) {
      powerForDelta = 0;
    }

    state.energyWh += (powerForDelta * dtMs) / 3_600_000;
    state.lastTs = timestamp;
    state.lastPower = sourceValue;
    this.energyStates.set(calc.id, state);

    await this.setForeignStateAsync(calc.targetId, {
      val: Number(state.energyWh.toFixed(3)),
      ack: true
    });
  }

  async processEnergieTag(calc, sourceTotalEnergy) {
    let state = this.energyDayStates.get(calc.id);
    if (!state) {
      state = {
        dayKey: this.currentDayKey,
        dayStartValue: sourceTotalEnergy
      };
      this.energyDayStates.set(calc.id, state);
    }

    if (state.dayKey !== this.currentDayKey) {
      state.dayKey = this.currentDayKey;
      state.dayStartValue = sourceTotalEnergy;
    }

    let today = sourceTotalEnergy - state.dayStartValue;
    if (today < 0) {
      state.dayStartValue = sourceTotalEnergy;
      today = 0;
    }

    await this.setForeignStateAsync(calc.targetId, {
      val: Number(today.toFixed(3)),
      ack: true
    });
  }

  async processDurchschnitt(calc, value, timestamp) {
    const windowMs = calc.averageSeconds * 1000;
    const state = this.averageStates.get(calc.id) || { history: [] };
    const history = state.history;

    history.push({ ts: timestamp, val: value });
    this.pruneAverageHistory(history, timestamp - windowMs);

    const avg = this.calculateTimeWeightedAverage(history, timestamp, windowMs);
    this.averageStates.set(calc.id, state);

    await this.setForeignStateAsync(calc.targetId, {
      val: Number(avg.toFixed(3)),
      ack: true
    });
  }

  pruneAverageHistory(history, minTs) {
    if (history.length < 3) {
      return;
    }

    let keepIndex = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].ts < minTs) {
        keepIndex = i;
        break;
      }
    }

    if (keepIndex > 1) {
      history.splice(0, keepIndex - 1);
    }
  }

  calculateTimeWeightedAverage(history, nowTs, windowMs) {
    if (!history.length) {
      return 0;
    }

    const windowStart = nowTs - windowMs;
    let idx = 0;
    while (idx < history.length && history[idx].ts <= windowStart) {
      idx++;
    }

    let currentVal;
    let currentTs = windowStart;
    if (idx === 0) {
      currentVal = history[0].val;
    } else {
      currentVal = history[idx - 1].val;
    }

    let sum = 0;
    let covered = 0;

    for (let i = idx; i < history.length; i++) {
      const point = history[i];
      const endTs = Math.min(point.ts, nowTs);
      if (endTs > currentTs) {
        const dt = endTs - currentTs;
        sum += currentVal * dt;
        covered += dt;
      }
      currentTs = point.ts;
      currentVal = point.val;
    }

    if (nowTs > currentTs) {
      const dt = nowTs - currentTs;
      sum += currentVal * dt;
      covered += dt;
    }

    if (covered <= 0) {
      return currentVal;
    }
    return sum / covered;
  }

  async recalculateVerbrauchTargetsForSource(sourceId) {
    const targetSet = this.verbrauchTargetsBySource.get(sourceId);
    if (!targetSet || targetSet.size === 0) {
      return;
    }

    for (const targetId of targetSet) {
      await this.recalculateVerbrauchTarget(targetId);
    }
  }

  async recalculateAllVerbrauchTargets() {
    for (const targetId of this.verbrauchByTarget.keys()) {
      await this.recalculateVerbrauchTarget(targetId);
    }
  }

  async recalculateVerbrauchTarget(targetId) {
    const rows = this.verbrauchByTarget.get(targetId) || [];
    let total = 0;

    for (const row of rows) {
      const value = this.readLast(row.sourceId);
      if (value === null) {
        continue;
      }

      const sign = row.verbrauchType === "producer" ? -1 : 1;
      total += sign * value;
    }

    await this.setForeignStateAsync(targetId, {
      val: Number(total.toFixed(3)),
      ack: true
    });
  }

  async checkDailyReset() {
    const now = new Date();
    const dayKey = this.getDayKey(now);
    if (dayKey === this.currentDayKey) {
      return;
    }

    this.currentDayKey = dayKey;

    for (const calc of this.calculations) {
      if (calc.type !== TYPE_ENERGIETAG) {
        continue;
      }

      const sourceValue = this.readLast(calc.sourceId);
      if (sourceValue === null) {
        continue;
      }

      this.energyDayStates.set(calc.id, {
        dayKey,
        dayStartValue: sourceValue
      });

      await this.setForeignStateAsync(calc.targetId, {
        val: 0,
        ack: true
      });
    }

    this.log.info("Tageswechsel erkannt: EnergieTag-Berechnungen wurden zurueckgesetzt");
  }

  getDayKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

if (require.main !== module) {
  module.exports = (options) => new EmsAdapter(options);
} else {
  new EmsAdapter();
}