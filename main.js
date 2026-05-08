"use strict";

const utils = require("@iobroker/adapter-core");

const TYPE_ENERGIE = "Energie";
const TYPE_ENERGIETAG = "EnergieTag";
const TYPE_BERECHNUNG = "Berechnung";
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
    this.on("message", this.onMessage.bind(this));
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
    await this.recalculateAllVerbrauch();

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

    await this.recalculateVerbrauchForSources(id);
  }

  onMessage(obj) {
    if (!obj || obj.command !== "validateConfig") {
      return;
    }
    void this.handleValidateConfigMessage(obj);
  }

  async handleValidateConfigMessage(obj) {
    const validation = await this.validateIncomingCalculations(obj && obj.message);

    if (!obj.callback) {
      return;
    }

    if (validation.ok) {
      this.sendTo(obj.from, obj.command, {
        native: {
          _validationPassed: true
        },
        result: "ok"
      }, obj.callback);
      return;
    }

    this.sendTo(obj.from, obj.command, {
      native: {
        _validationPassed: false
      },
      error: validation.errors.join("\n")
    }, obj.callback);
  }

  async validateIncomingCalculations(message) {
    const rows = this.readCalculationsFromMessage(message);
    const errors = [];

    if (!rows.length) {
      return {
        ok: false,
        errors: ["Keine Berechnungen zur Pruefung uebergeben"]
      };
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.enabled === false) {
        continue;
      }

      const rowNo = i + 1;
      const type = this.normalizeType(row.type);
      if (!type) {
        errors.push(`Zeile ${rowNo}: ungueltige Berechnungsart`);
        continue;
      }

      const targetName = typeof row.targetName === "string" ? row.targetName.trim() : "";
      if (!targetName) {
        errors.push(`Zeile ${rowNo}: Ziel-Datenpunktname fehlt`);
      }

      if (type === TYPE_BERECHNUNG) {
        const formula = this.extractBerechnungFormula(row);
        if (!formula) {
          errors.push(`Zeile ${rowNo}: Formel fehlt`);
          continue;
        }

        const parsed = this.parseBerechnungFormula(formula);
        if (!parsed.sources.length) {
          errors.push(`Zeile ${rowNo}: Formel enthaelt keine gueltigen Quellen`);
          continue;
        }

        for (const sourceId of parsed.sources) {
          const sourceErr = await this.validateSourceState(sourceId, rowNo);
          if (sourceErr) {
            errors.push(sourceErr);
          }
        }
      } else {
        const sourceId = typeof row.sourceId === "string" ? row.sourceId.trim() : "";
        if (!sourceId) {
          errors.push(`Zeile ${rowNo}: Quell-Datenpunkt fehlt`);
          continue;
        }

        const sourceErr = await this.validateSourceState(sourceId, rowNo);
        if (sourceErr) {
          errors.push(sourceErr);
        }
      }

      if (type === TYPE_DURCHSCHNITT) {
        const averageSeconds = Number(row.averageSeconds);
        if (!Number.isFinite(averageSeconds) || averageSeconds <= 0) {
          errors.push(`Zeile ${rowNo}: Fenster (Sek.) muss groesser als 0 sein`);
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors
    };
  }

  readCalculationsFromMessage(message) {
    if (!message) {
      return [];
    }

    if (Array.isArray(message.calculations)) {
      return message.calculations;
    }

    if (typeof message.calculationsJson === "string" && message.calculationsJson.trim()) {
      try {
        const parsed = JSON.parse(message.calculationsJson);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_error) {
        return [];
      }
    }

    return [];
  }

  extractBerechnungFormula(row) {
    const fromNew = typeof row.berechnungFormula === "string" ? row.berechnungFormula.trim() : "";
    if (fromNew) {
      return fromNew;
    }

    const fromLegacy = typeof row.verbrauchFormula === "string" ? row.verbrauchFormula.trim() : "";
    if (fromLegacy) {
      return fromLegacy;
    }

    return this.buildFormulaFromTerms(row.berechnungTerms);
  }

  buildFormulaFromTerms(terms) {
    if (!Array.isArray(terms)) {
      return "";
    }

    let out = "";
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i] || {};
      const id = String(term.id || "").trim();
      if (!id) {
        continue;
      }

      if (out) {
        const op = term.op === "-" ? "-" : "+";
        out += ` ${op} `;
      }
      out += id;
    }

    return out;
  }

  async validateSourceState(sourceId, rowNo) {
    const obj = await this.getForeignObjectAsync(sourceId);
    if (!obj) {
      return `Zeile ${rowNo}: Datenpunkt ${sourceId} nicht gefunden`;
    }
    if (obj.type !== "state") {
      return `Zeile ${rowNo}: Objekt ${sourceId} ist kein State`;
    }
    const commonType = obj.common && obj.common.type;
    if (commonType !== "number") {
      return `Zeile ${rowNo}: Datenpunkt ${sourceId} ist nicht numerisch`;
    }
    return "";
  }

  getInputStateIds() {
    const ids = new Set();
    for (const calc of this.calculations) {
      if (calc.sourceId) {
        ids.add(calc.sourceId);
      }
      if (calc.formulaSources && Array.isArray(calc.formulaSources)) {
        for (const src of calc.formulaSources) {
          ids.add(src);
        }
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
      if (!sourceId && type !== TYPE_BERECHNUNG) {
        this.log.warn(`Berechnung in Zeile ${i + 1} uebersprungen: Quell-Datenpunkt fehlt`);
        continue;
      }

      const targetName = typeof row.targetName === "string" ? row.targetName.trim() : "";
      if (!targetName) {
        this.log.warn(`Berechnung in Zeile ${i + 1} uebersprungen: Ziel-Datenpunktname fehlt`);
        continue;
      }

      let calc;

      if (type === TYPE_BERECHNUNG) {
        const formula = this.extractBerechnungFormula(row);
        if (!formula) {
          this.log.warn(`Berechnung in Zeile ${i + 1} uebersprungen: Formel fehlt`);
          continue;
        }
        const parsed = this.parseBerechnungFormula(formula);
        if (!parsed.sources || parsed.sources.length === 0) {
          this.log.warn(`Berechnung in Zeile ${i + 1} uebersprungen: keine Quellen in Formel gefunden`);
          continue;
        }
        calc = {
          id: `calc_${i + 1}`,
          type,
          targetName,
          targetId: this.buildTargetStateId(targetName),
          berechnungFormula: formula,
          formulaSources: parsed.sources,
          formulaOps: parsed.ops,
          unit: this.normalizeUnit(row.unit)
        };
      } else {
        calc = {
          id: `calc_${i + 1}`,
          type,
          sourceId,
          targetName,
          targetId: this.buildTargetStateId(targetName),
          onlyPositive: row.onlyPositive !== false,
          invertValue: row.invertValue === true,
          averageSeconds: this.parsePositiveNumber(row.averageSeconds, 300),
          unit: this.normalizeUnit(row.unit)
        };
      }

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
    if (value === "verbrauch" || value === "berechnung") {
      return TYPE_BERECHNUNG;
    }
    if (value === "durchschnitt") {
      return TYPE_DURCHSCHNITT;
    }
    return "";
  }

  normalizeUnit(value) {
    return String(value || "").trim();
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
    return `${this.namespace}.${sanitized}`;
  }

  indexCalculations() {
    this.calcsBySource.clear();
    this.verbrauchByTarget.clear();
    this.verbrauchTargetsBySource.clear();

    for (const calc of this.calculations) {
      if (calc.sourceId) {
        const bySource = this.calcsBySource.get(calc.sourceId) || [];
        bySource.push(calc);
        this.calcsBySource.set(calc.sourceId, bySource);
      }

      if (calc.type === TYPE_BERECHNUNG) {
        this.verbrauchByTarget.set(calc.targetId, calc);
        if (calc.formulaSources && Array.isArray(calc.formulaSources)) {
          for (const src of calc.formulaSources) {
            const targetSet = this.verbrauchTargetsBySource.get(src) || new Set();
            targetSet.add(calc.targetId);
            this.verbrauchTargetsBySource.set(src, targetSet);
          }
        }
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
      const unit = this.resolveUnitForType(calc);
      if (unit) {
        common.unit = unit;
      }
      await this.ensureForeignState(calc.targetId, common);
    }
  }

  resolveUnitForType(calc) {
    if (calc.unit) {
      return calc.unit;
    }
    if (calc.type === TYPE_ENERGIE || calc.type === TYPE_ENERGIETAG) {
      return "Wh";
    }
    if (calc.type === TYPE_BERECHNUNG) {
      return "W";
    }
    return "";
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

    if (type === TYPE_BERECHNUNG) {
      return {
        name: targetName,
        type: "number",
        role: "value.power",
        read: true,
        write: false,
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
    const processedValue = calc.invertValue ? -sourceValue : sourceValue;
    const currentOutState = await this.getForeignStateAsync(calc.targetId);
    const currentOut = currentOutState && Number.isFinite(Number(currentOutState.val)) ? Number(currentOutState.val) : 0;

    let dayStartValue = processedValue - currentOut;
    if (!Number.isFinite(dayStartValue)) {
      dayStartValue = processedValue;
    }

    this.energyDayStates.set(calc.id, {
      dayKey: this.currentDayKey,
      dayStartValue
    });

    const todayValue = Math.max(0, processedValue - dayStartValue);
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
    let prevPower = state.lastPower;
    let nextPower = sourceValue;

    if (calc.invertValue) {
      prevPower = -prevPower;
      nextPower = -nextPower;
    }

    if (calc.onlyPositive) {
      prevPower = Math.max(0, prevPower);
      nextPower = Math.max(0, nextPower);
    }

    const avgPower = (prevPower + nextPower) / 2;
    state.energyWh += (avgPower * dtMs) / 3_600_000;
    state.lastTs = timestamp;
    state.lastPower = sourceValue;
    this.energyStates.set(calc.id, state);

    await this.setForeignStateAsync(calc.targetId, {
      val: Number(state.energyWh.toFixed(3)),
      ack: true
    });
  }

  async processEnergieTag(calc, sourceTotalEnergy) {
    let processedValue = sourceTotalEnergy;
    if (calc.invertValue) {
      processedValue = -processedValue;
    }

    let state = this.energyDayStates.get(calc.id);
    if (!state) {
      state = {
        dayKey: this.currentDayKey,
        dayStartValue: processedValue
      };
      this.energyDayStates.set(calc.id, state);
    }

    if (state.dayKey !== this.currentDayKey) {
      state.dayKey = this.currentDayKey;
      state.dayStartValue = processedValue;
    }

    let today = processedValue - state.dayStartValue;
    if (today < 0) {
      state.dayStartValue = processedValue;
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

  async recalculateVerbrauchForSources(sourceId) {
    const targetSet = this.verbrauchTargetsBySource.get(sourceId);
    if (!targetSet || targetSet.size === 0) {
      return;
    }

    for (const targetId of targetSet) {
      await this.recalculateVerbrauch(targetId);
    }
  }

  async recalculateAllVerbrauch() {
    for (const targetId of this.verbrauchByTarget.keys()) {
      await this.recalculateVerbrauch(targetId);
    }
  }

  async recalculateVerbrauch(targetId) {
    const calc = this.verbrauchByTarget.get(targetId);
    if (!calc || calc.type !== TYPE_BERECHNUNG) {
      return;
    }

    const result = this.evaluateBerechnungFormula(calc);
    await this.setForeignStateAsync(targetId, {
      val: Number(result.toFixed(3)),
      ack: true
    });
  }

  evaluateBerechnungFormula(calc) {
    const sources = calc.formulaSources || [];
    const ops = calc.formulaOps || [];

    if (sources.length === 0) {
      return 0;
    }

    let result = 0;
    const firstVal = this.readLast(sources[0]);
    if (firstVal !== null) {
      result = firstVal;
    }

    for (let i = 1; i < sources.length; i++) {
      const val = this.readLast(sources[i]);
      if (val === null) {
        continue;
      }
      const op = ops[i - 1] || "+";
      if (op === "-") {
        result -= val;
      } else {
        result += val;
      }
    }

    return result;
  }

  parseBerechnungFormula(formula) {
    const compact = String(formula || "").replace(/\s+/g, "");
    const tokens = compact.split(/([+-])/).filter((token) => token);
    const sources = [];
    const ops = [];
    let pendingOp = "+";

    for (const token of tokens) {
      if (token === "+" || token === "-") {
        pendingOp = token;
        continue;
      }

      sources.push(token);
      if (sources.length > 1) {
        ops.push(pendingOp);
      }
      pendingOp = "+";
    }

    return { sources, ops };
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

      const processedValue = calc.invertValue ? -sourceValue : sourceValue;
      this.energyDayStates.set(calc.id, {
        dayKey,
        dayStartValue: processedValue
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