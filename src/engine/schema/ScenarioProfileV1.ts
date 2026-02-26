/**
 * ScenarioProfileV1 — User-editable day profile for the Demand Profile Painter.
 *
 * This type is UI-owned but engine-consumable: the UI paints three independent
 * 24-hour channels; the engine's `applyScenarioOverrides` converts them into
 * deterministic physics outputs for System A vs System B comparison.
 *
 * Physics rules:
 *  - Q_CH_demand_kw is derived from heatIntent + heatLossWatts (no random values)
 *  - Q_DHW_demand_kw is derived from dhwLpm × ΔT (35 °C rise by convention)
 *  - Combi service-switching: when DHW demand is active, CH output drops to 0
 *  - Boiler η uses computeCurrentEfficiencyPct from efficiency.ts (clamped 50–99 %)
 *  - ASHP COP uses spfMidpoint from SpecEdgeModule (physics-driven)
 */

import type { EngineInputV2_3 } from './EngineInputV2_3';
import { computeCurrentEfficiencyPct, DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../utils/efficiency';

// ─── Heat Intent ──────────────────────────────────────────────────────────────

/**
 * Space-heating intent for one hour:
 *  0 = Off  (no call for heat; system at frost-protection only)
 *  1 = Setback (maintain ~16 °C; low-fire or off)
 *  2 = Comfort (full call for heat to reach design setpoint ~21 °C)
 */
export type HeatIntentLevel = 0 | 1 | 2;

/** Demand fraction applied to heatLossWatts for each HeatIntentLevel. */
const HEAT_INTENT_FRACTION: Record<HeatIntentLevel, number> = {
  0: 0,    // Off
  1: 0.40, // Setback: ~40 % of design heat loss (approximate low-fire hold)
  2: 1.00, // Comfort: 100 % — full design heat loss
};

// ─── DHW constants ────────────────────────────────────────────────────────────

/** Cold-water inlet temperature (°C) used for DHW energy calculations. */
const DHW_COLD_INLET_TEMP_C = 10;
/** Target hot-water delivery temperature (°C). */
const DHW_DELIVERY_TEMP_C = 45;
/** Temperature rise for DHW energy calc (°C). */
const DHW_DELTA_T_C = DHW_DELIVERY_TEMP_C - DHW_COLD_INLET_TEMP_C; // 35 °C
/** Specific heat of water (J / kg·°C). */
const WATER_SHC_J_PER_KG_C = 4186;
/** Seconds per minute. */
const SECONDS_PER_MIN = 60;
/** Watts per kW. */
const W_PER_KW = 1000;

/**
 * Convert a DHW flow rate (L/min) to instantaneous thermal demand (kW).
 * Q = ṁ × c_p × ΔT = (lpm / 60) × 4186 × 35 / 1000
 */
export function dhwLpmToKw(lpm: number): number {
  return (lpm / SECONDS_PER_MIN) * WATER_SHC_J_PER_KG_C * DHW_DELTA_T_C / W_PER_KW;
}

// ─── Boiler capacity ──────────────────────────────────────────────────────────

/** Maximum boiler output for space heating (kW) — the 30 kW stepped sprint. */
const BOILER_MAX_CH_KW = 30;
/** Maximum combi boiler DHW output (kW). */
const BOILER_MAX_DHW_KW = 30;

/** Boiler η decay during active DHW service-switching (percentage points). */
const COMBI_DHW_ETA_DECAY_PCT = 20;

/**
 * Boiler η decay during a DHW purge event (percentage points).
 * Applied for one "slot" when dhwLpm transitions from 0 to >0 (a new draw).
 * This models the purge dump before real condensate forms — η briefly goes below zero.
 *
 * Chosen so that DEFAULT_NOMINAL_EFFICIENCY_PCT − COMBI_PURGE_ETA_DECAY_PCT < 0,
 * producing a negative effective η that represents net energy dumped during the
 * cold heat-exchanger flush.  The exact magnitude (18 pp below zero) matches
 * industry estimates for the initial purge volume in a typical 24 kW combi.
 */
const COMBI_PURGE_ETA_DECAY_PCT = DEFAULT_NOMINAL_EFFICIENCY_PCT + 18;

// ─── System archetype ─────────────────────────────────────────────────────────

/**
 * Heating system archetypes available for comparison in the Demand Profile Painter.
 * Matches the DayPainterSystem type in LifestyleInteractive.
 */
export type ComparisonSystemType = 'combi' | 'stored_vented' | 'stored_unvented' | 'ashp';

// ─── ScenarioProfileV1 ────────────────────────────────────────────────────────

/**
 * UI-editable scenario profile for one 24-hour day.
 *
 * All arrays have exactly 24 elements (one per hour, resolution = 60 min).
 * Physics is derived entirely from these arrays + EngineInputV2_3 — the UI
 * never invents any physics values.
 */
export interface ScenarioProfileV1 {
  /** Space-heating intent for each hour. 0=off, 1=setback, 2=comfort. */
  heatIntent: HeatIntentLevel[];
  /** Hot-water demand for each hour (L/min; 0 = no draw). */
  dhwLpm: number[];
  /** Cold-water draw for each hour (L/min; 0 = no draw). Optional in rendering. */
  coldLpm: number[];
  /** Whether this profile has been user-edited or reflects the measured baseline. */
  source: 'measured' | 'user_edit';
  /** Timeline resolution (minutes). Always 60 for the 24-hour painter. */
  resolutionMins: 60;
}

// ─── Per-hour physics output ──────────────────────────────────────────────────

/**
 * Physics output for a single hour, for a single system.
 *
 * All values are in kW.
 * `etaOrCop` carries:
 *   - Boiler systems: efficiency in [0, 1] (may be negative for combi purge)
 *   - ASHP: COP (dimensionless, typically 2.5–4.5)
 */
export interface SystemHourPhysicsV1 {
  /** Actual space-heating output delivered to the building (kW). */
  qToChKw: number;
  /** Actual DHW output delivered (kW). */
  qToDhwKw: number;
  /** Efficiency (boiler) or COP (ASHP). Boiler: 0–0.99 (can be negative for purge). */
  etaOrCop: number;
  /**
   * Purge / dump energy loss (kW).
   * Positive = useful energy wasted in heat dump.
   * For combi during first DHW draw of a sequence this is > 0.
   */
  qDumpKw: number;
}

/** Full physics output for one hour (demand + both system responses). */
export interface ScenarioHourOutputV1 {
  hour: number;
  /** Space-heating demand (kW) — same for both systems. */
  qChDemandKw: number;
  /** DHW demand (kW) — same for both systems. */
  qDhwDemandKw: number;
  /** Cold-water draw (L/min) — informational only. */
  coldLpm: number;
  /** System A physics. */
  systemA: SystemHourPhysicsV1;
  /** System B physics. */
  systemB: SystemHourPhysicsV1;
}

/** Complete 24-hour physics comparison output. */
export interface ScenarioPhysicsOutputV1 {
  hourly: ScenarioHourOutputV1[];
  systemAType: ComparisonSystemType;
  systemBType: ComparisonSystemType;
}

// ─── System physics functions ─────────────────────────────────────────────────

/**
 * Compute one hour's physics for a combi boiler.
 *
 * Service-switching rule: when DHW demand is active, CH output is cut to zero.
 * η is penalised during DHW draw; a purge event (first draw in a new sequence)
 * pushes η negative (energy dump before condensate forms).
 *
 * @param qChDemandKw  Space-heating demand (kW).
 * @param qDhwDemandKw DHW demand (kW).
 * @param isPurgePulse Whether this hour is the first DHW draw after an idle period.
 */
function combiHourPhysics(
  qChDemandKw: number,
  qDhwDemandKw: number,
  isPurgePulse: boolean,
): SystemHourPhysicsV1 {
  const nominalEtaPct = DEFAULT_NOMINAL_EFFICIENCY_PCT;

  if (qDhwDemandKw > 0) {
    // Service-switching: CH is off while DHW is being served
    const qToDhwKw = Math.min(qDhwDemandKw, BOILER_MAX_DHW_KW);

    const decayPct = isPurgePulse ? COMBI_PURGE_ETA_DECAY_PCT : COMBI_DHW_ETA_DECAY_PCT;
    // computeCurrentEfficiencyPct clamps to [50, 99], so we bypass clamping for purge
    const etaPct = isPurgePulse
      ? nominalEtaPct - decayPct // may be negative (purge dump)
      : computeCurrentEfficiencyPct(nominalEtaPct, decayPct);
    const eta = etaPct / 100;

    // Q_dump: energy wasted during purge (stored coolant flushed)
    const qDumpKw = isPurgePulse ? Math.max(0, -eta * qToDhwKw) : 0;

    return { qToChKw: 0, qToDhwKw, etaOrCop: eta, qDumpKw };
  }

  if (qChDemandKw > 0) {
    const qToChKw = Math.min(qChDemandKw, BOILER_MAX_CH_KW);
    const eta = computeCurrentEfficiencyPct(nominalEtaPct, 0) / 100;
    return { qToChKw, qToDhwKw: 0, etaOrCop: eta, qDumpKw: 0 };
  }

  // System idle
  return { qToChKw: 0, qToDhwKw: 0, etaOrCop: computeCurrentEfficiencyPct(nominalEtaPct, 0) / 100, qDumpKw: 0 };
}

/**
 * Compute one hour's physics for a stored-water boiler system (vented or unvented).
 *
 * No service-switching penalty: CH and DHW are served independently.
 * Stored systems have a pre-heated cylinder, so there is no purge penalty.
 *
 * @param qChDemandKw  Space-heating demand (kW).
 * @param qDhwDemandKw DHW demand (kW).
 */
function storedBoilerHourPhysics(
  qChDemandKw: number,
  qDhwDemandKw: number,
): SystemHourPhysicsV1 {
  const nominalEtaPct = DEFAULT_NOMINAL_EFFICIENCY_PCT;
  const qToChKw = Math.min(qChDemandKw, BOILER_MAX_CH_KW);
  const qToDhwKw = Math.min(qDhwDemandKw, BOILER_MAX_DHW_KW);
  const eta = computeCurrentEfficiencyPct(nominalEtaPct, 0) / 100;
  return { qToChKw, qToDhwKw, etaOrCop: eta, qDumpKw: 0 };
}

/**
 * Compute one hour's physics for an ASHP system.
 *
 * ASHP modulates to match demand (does not overshoot).
 * COP is derived from spfMidpoint with a cold-morning dip for early hours.
 * DHW is served from a pre-heated stored cylinder (separate coil circuit) —
 * no service-switching conflict.
 *
 * @param qChDemandKw  Space-heating demand (kW).
 * @param qDhwDemandKw DHW demand (kW).
 * @param hour         Hour of day (0–23) for cold-morning COP adjustment.
 * @param spfMidpoint  Seasonal Performance Factor midpoint from SpecEdgeModule.
 */

/** Hours before which outdoor temperature is assumed at its daily minimum (cold-morning zone). */
const ASHP_COLD_MORNING_END_HOUR = 7; // 00:00–06:59
/**
 * COP reduction applied during cold-morning hours (SPF units).
 * Based on a typical outdoor temperature dip of ~3 °C below the daily average,
 * reducing Carnot COP by approximately 0.3 at low-temperature design conditions.
 */
const ASHP_COLD_MORNING_COP_DIP = 0.3;
/** Hard COP floor — below 1.5 the heat pump is thermodynamically implausible. */
const ASHP_MIN_PLAUSIBLE_COP = 1.5;

function ashpHourPhysics(
  qChDemandKw: number,
  qDhwDemandKw: number,
  hour: number,
  spfMidpoint: number,
): SystemHourPhysicsV1 {
  // Cold-morning COP dip (00:00 to ASHP_COLD_MORNING_END_HOUR − 1) — outdoor temp at daily minimum
  const coldDip = hour < ASHP_COLD_MORNING_END_HOUR ? ASHP_COLD_MORNING_COP_DIP : 0;
  const cop = Math.max(ASHP_MIN_PLAUSIBLE_COP, spfMidpoint - coldDip);

  // ASHP modulates: it delivers exactly what the building asks for (up to its rated output)
  const qToChKw = qChDemandKw; // ASHP modulates, no clamp needed in this model
  // DHW served from stored cylinder — ASHP charges the cylinder; modelled as pass-through demand
  const qToDhwKw = qDhwDemandKw;

  return { qToChKw, qToDhwKw, etaOrCop: cop, qDumpKw: 0 };
}

/**
 * Dispatch physics for a given system type and hour.
 *
 * @param systemType     Which system archetype to compute.
 * @param qChDemandKw    Space-heating demand (kW).
 * @param qDhwDemandKw   DHW demand (kW).
 * @param hour           Hour of day (0–23).
 * @param spfMidpoint    ASHP SPF midpoint (used for ASHP only).
 * @param isPurgePulse   Whether this is the first DHW draw after idle (combi purge).
 */
function computeSystemHourPhysics(
  systemType: ComparisonSystemType,
  qChDemandKw: number,
  qDhwDemandKw: number,
  hour: number,
  spfMidpoint: number,
  isPurgePulse: boolean,
): SystemHourPhysicsV1 {
  switch (systemType) {
    case 'combi':
      return combiHourPhysics(qChDemandKw, qDhwDemandKw, isPurgePulse);
    case 'stored_vented':
    case 'stored_unvented':
      return storedBoilerHourPhysics(qChDemandKw, qDhwDemandKw);
    case 'ashp':
      return ashpHourPhysics(qChDemandKw, qDhwDemandKw, hour, spfMidpoint);
  }
}

// ─── Purge pulse detection ────────────────────────────────────────────────────

/**
 * Return a boolean array indicating which hours are "purge pulse" hours.
 * A purge pulse is the first hour of a new DHW draw sequence (dhwLpm transitions
 * from 0 to > 0).  This is where the combi flushes stored cold water from the
 * heat exchanger before condensate forms.
 */
function detectPurgePulses(dhwLpm: number[]): boolean[] {
  return dhwLpm.map((lpm, h) => {
    const prevLpm = h === 0 ? 0 : dhwLpm[h - 1];
    return lpm > 0 && prevLpm === 0;
  });
}

// ─── Core exports ─────────────────────────────────────────────────────────────

/**
 * DHW demand heuristic: L/min per bathroom during peak hours.
 * Based on a typical 8 L/min shower at 45 °C, divided across bathrooms.
 * Calibrated so 1 bathroom ≈ 1 shower at medium flow.
 */
const DHW_LPM_PER_BATHROOM = 1.5;

/**
 * Maximum plausible DHW demand for a domestic property (L/min).
 * Above 9 L/min the mains supply or pipe bore would become the binding constraint
 * rather than demand; this cap prevents unrealistic values from the heuristic.
 */
const DHW_MAX_PLAUSIBLE_LPM = 9;

/**
 * Derive a default measured ScenarioProfileV1 from an existing engine input.
 *
 * The default profile mirrors the professional double-peak occupancy signature:
 *  - Morning comfort (06:00–08:00)
 *  - Away (setback) (09:00–16:00)
 *  - Evening comfort (17:00–21:00)
 *  - Night setback (22:00–05:00)
 * DHW default is derived from bathroomCount × 1.5 L/min per bathroom per active hour.
 */
export function defaultScenarioProfile(input: EngineInputV2_3): ScenarioProfileV1 {
  const heatIntent: HeatIntentLevel[] = Array.from({ length: 24 }, (_, h) => {
    if ((h >= 6 && h <= 8) || (h >= 17 && h <= 21)) return 2; // comfort
    if (h >= 9 && h <= 16) return 1;                           // setback
    return 1;                                                   // night setback
  });

  // Default DHW: bathroom-count heuristic — DHW_LPM_PER_BATHROOM per bathroom during peak hours
  const bathrooms = input.bathroomCount ?? 1;
  const peakDhwLpm = Math.min(bathrooms * DHW_LPM_PER_BATHROOM, DHW_MAX_PLAUSIBLE_LPM);
  const dhwLpm: number[] = Array.from({ length: 24 }, (_, h) => {
    if (h >= 6 && h <= 8) return peakDhwLpm;       // morning peak
    if (h >= 19 && h <= 21) return peakDhwLpm * 0.5; // evening lighter use
    return 0;
  });

  const coldLpm: number[] = Array(24).fill(0);

  return { heatIntent, dhwLpm, coldLpm, source: 'measured', resolutionMins: 60 };
}

/**
 * Apply ScenarioProfileV1 overrides to derive 24-hour physics for System A vs System B.
 *
 * This is the single physics gateway for the Demand Profile Painter.
 * The UI never computes physics directly — it calls this function.
 *
 * @param engineInput  Normalised engine input (provides heatLossWatts, bathroomCount etc.).
 * @param profile      User-edited (or measured) day profile.
 * @param systemAType  System archetype for comparison channel A.
 * @param systemBType  System archetype for comparison channel B.
 * @param spfMidpoint  ASHP SPF midpoint from SpecEdgeModule (used when systemType = 'ashp').
 */
export function applyScenarioOverrides(
  engineInput: EngineInputV2_3,
  profile: ScenarioProfileV1,
  systemAType: ComparisonSystemType,
  systemBType: ComparisonSystemType,
  spfMidpoint: number,
): ScenarioPhysicsOutputV1 {
  const heatLossKw = engineInput.heatLossWatts / W_PER_KW;
  const purgePulses = detectPurgePulses(profile.dhwLpm);

  const hourly: ScenarioHourOutputV1[] = Array.from({ length: 24 }, (_, h) => {
    const intent = profile.heatIntent[h] ?? 1;
    const qChDemandKw = parseFloat((HEAT_INTENT_FRACTION[intent] * heatLossKw).toFixed(3));
    const qDhwDemandKw = parseFloat(dhwLpmToKw(profile.dhwLpm[h] ?? 0).toFixed(3));

    const systemA = computeSystemHourPhysics(systemAType, qChDemandKw, qDhwDemandKw, h, spfMidpoint, purgePulses[h]);
    const systemB = computeSystemHourPhysics(systemBType, qChDemandKw, qDhwDemandKw, h, spfMidpoint, purgePulses[h]);

    return {
      hour: h,
      qChDemandKw,
      qDhwDemandKw,
      coldLpm: profile.coldLpm[h] ?? 0,
      systemA,
      systemB,
    };
  });

  return { hourly, systemAType, systemBType };
}
