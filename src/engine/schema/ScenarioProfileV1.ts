/**
 * ScenarioProfileV1 — User-editable day profile for the Demand Profile Painter.
 *
 * This type is UI-owned but engine-consumable: the UI paints three independent
 * channels across the day; the engine's `applyScenarioOverrides` converts them into
 * deterministic physics outputs for System A vs System B comparison.
 *
 * Physics rules:
 *  - Q_CH_demand_kw is derived from heatIntent + heatLossWatts (no random values)
 *  - Q_DHW_demand_kw is derived from dhwMixedLpm40 × ΔT (35 °C rise by convention)
 *  - Combi service-switching: when DHW demand is active, CH output drops to 0
 *  - Boiler η uses computeCurrentEfficiencyPct from efficiency.ts (clamped 50–99 %)
 *  - ASHP COP uses spfMidpoint from SpecEdgeModule (physics-driven)
 *
 * Resolution contract:
 *  - Array length N must equal 1440 / resolutionMins (enforced at runtime).
 *  - 60-min resolution → 24 slices; 5-min resolution → 288 slices.
 *  - Never hardcode "24" or "per hour" — always derive from resolutionMins.
 */

import type { EngineInputV2_3 } from './EngineInputV2_3';
import { computeCurrentEfficiencyPct, getNominalEfficiencyPct } from '../utils/efficiency';

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
 * Net energy wasted per combi purge event (kW, averaged over the resolution period).
 *
 * A purge occurs when the first DHW draw fires after an idle period.  The boiler
 * fires at near-full rate but the heat exchanger is cold; the initial volume of water
 * passes through cold and is dumped to drain rather than delivered usefully.
 *
 * Modelled as a fixed negative delivered-heat quantity so the renderer can display
 * qDeliveredKw < 0 directly — NOT computed via η algebra.
 * Typical 24kW combi: ~0.8L heat-exchanger volume × 4.186 kJ/(kg·°C) × 35 °C
 * ≈ 117 kJ ≈ 0.032 kWh over a 2-min flush.  Averaged over a 60-min slice and
 * uplifted for the full heat-exchanger warm-up transient: ~2.3 kW.
 */
const COMBI_PURGE_DUMP_KW = 2.3;

/**
 * Assumed boiler fuel-input rate during a DHW purge event (kW).
 * The boiler fires at near-full rate during the purge transient.
 * Used to derive η = qDeliveredKw / fuelInputKw (naturally negative during purge).
 */
const COMBI_PURGE_FUEL_INPUT_KW = 28;

// ─── System archetype ─────────────────────────────────────────────────────────

/**
 * Heating system archetypes available for comparison in the Demand Profile Painter.
 * Matches the DayPainterSystem type in LifestyleInteractive.
 */
export type ComparisonSystemType = 'combi' | 'stored_vented' | 'stored_unvented' | 'ashp';

// ─── ScenarioProfileV1 ────────────────────────────────────────────────────────

/**
 * UI-editable scenario profile for one day.
 *
 * Array length N must equal 1440 / resolutionMins.
 * At 60-min resolution N = 24; at 5-min resolution N = 288.
 * Physics is derived entirely from these arrays + EngineInputV2_3 — the UI
 * never invents any physics values.
 */
export interface ScenarioProfileV1 {
  /** Space-heating intent for each time-slice. 0=off, 1=setback, 2=comfort. */
  heatIntent: HeatIntentLevel[];
  /**
   * Hot-water demand for each time-slice (L/min MIXED @ 40 °C; 0 = no draw).
   *
   * "Mixed @ 40 °C" means the flow rate of blended hot+cold water at the tap
   * outlet measured at 40 °C delivery temperature.  The physics engine converts
   * this to a thermal demand using a 35 °C ΔT (cold inlet 10 °C → blended 45 °C).
   * The field name encodes both the unit (L/min) and the mixing convention (40 °C)
   * to prevent future ambiguity with "hot-only" flows.
   */
  dhwMixedLpm40: number[];
  /** Cold-water draw for each time-slice (L/min; 0 = no draw). Optional in rendering. */
  coldLpm: number[];
  /** Whether this profile has been user-edited or reflects the measured baseline. */
  source: 'measured' | 'user_edit';
  /**
   * Timeline resolution in minutes.
   * Array length N must equal 1440 / resolutionMins.
   * Common values: 60 (24 slices/day), 30 (48), 15 (96), 5 (288).
   */
  resolutionMins: number;
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
  const nominalEtaPct = getNominalEfficiencyPct();

  if (qDhwDemandKw > 0) {
    // Service-switching: CH is off while DHW is being served
    const qToDhwKw = Math.min(qDhwDemandKw, BOILER_MAX_DHW_KW);

    if (isPurgePulse) {
      // Purge event: model as explicit negative delivered heat (energy/heat-flow, NOT η algebra).
      // The boiler fires at COMBI_PURGE_FUEL_INPUT_KW but all heat goes to warming the cold
      // heat exchanger; net delivered heat is negative (cold water flushed to drain).
      const qDeliveredKw = -COMBI_PURGE_DUMP_KW;
      const eta = qDeliveredKw / COMBI_PURGE_FUEL_INPUT_KW; // naturally negative
      return { qToChKw: 0, qToDhwKw: qDeliveredKw, etaOrCop: eta, qDumpKw: COMBI_PURGE_DUMP_KW };
    }

    const eta = computeCurrentEfficiencyPct(nominalEtaPct, COMBI_DHW_ETA_DECAY_PCT) / 100;
    return { qToChKw: 0, qToDhwKw, etaOrCop: eta, qDumpKw: 0 };
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
  const nominalEtaPct = getNominalEfficiencyPct();
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
 * Return a boolean array indicating which time-slices are "purge pulse" slices.
 * A purge pulse is the first slice of a new DHW draw sequence (dhwMixedLpm40 transitions
 * from 0 to > 0).  This is where the combi flushes stored cold water from the
 * heat exchanger before condensate forms.
 */
function detectPurgePulses(dhwMixedLpm40: number[]): boolean[] {
  return dhwMixedLpm40.map((lpm, h) => {
    const prevLpm = h === 0 ? 0 : dhwMixedLpm40[h - 1];
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
 * DHW default is derived from bathroomCount × 1.5 L/min per bathroom per active slice.
 *
 * @param input          Normalised engine input.
 * @param resolutionMins Timeline resolution (minutes per slice). Default: 60.
 */
export function defaultScenarioProfile(input: EngineInputV2_3, resolutionMins = 60): ScenarioProfileV1 {
  const N = 1440 / resolutionMins;

  const heatIntent: HeatIntentLevel[] = Array.from({ length: N }, (_, i) => {
    // Convert slice index to hour-of-day for schedule lookup
    const h = (i * resolutionMins) / 60;
    if ((h >= 6 && h < 9) || (h >= 17 && h < 22)) return 2; // comfort
    return 1;                                                  // setback
  });

  // Default DHW: bathroom-count heuristic — DHW_LPM_PER_BATHROOM per bathroom during peak slices
  const bathrooms = input.bathroomCount ?? 1;
  const peakDhwLpm = Math.min(bathrooms * DHW_LPM_PER_BATHROOM, DHW_MAX_PLAUSIBLE_LPM);
  const dhwMixedLpm40: number[] = Array.from({ length: N }, (_, i) => {
    const h = (i * resolutionMins) / 60;
    if (h >= 6 && h < 9) return peakDhwLpm;         // morning peak
    if (h >= 19 && h < 22) return peakDhwLpm * 0.5; // evening lighter use
    return 0;
  });

  const coldLpm: number[] = Array(N).fill(0);

  return { heatIntent, dhwMixedLpm40, coldLpm, source: 'measured', resolutionMins };
}

/**
 * Apply ScenarioProfileV1 overrides to derive physics for System A vs System B.
 *
 * This is the single physics gateway for the Demand Profile Painter.
 * The UI never computes physics directly — it calls this function.
 *
 * Fairness guarantee:
 *  ONE shared DemandTimeline is built from the profile; BOTH system simulations
 *  run against the SAME timeline.  System selection never affects demand values.
 *
 * Resolution invariant:
 *  profile.heatIntent.length, profile.dhwMixedLpm40.length, and profile.coldLpm.length
 *  must all equal 1440 / profile.resolutionMins.  Throws if violated.
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
  // ── Resolution invariant ────────────────────────────────────────────────────
  const N = 1440 / profile.resolutionMins;
  if (
    profile.heatIntent.length !== N ||
    profile.dhwMixedLpm40.length !== N ||
    profile.coldLpm.length !== N
  ) {
    throw new Error(
      `ScenarioProfileV1 array length mismatch: expected ${N} slices ` +
      `(1440 / resolutionMins=${profile.resolutionMins}) but got ` +
      `heatIntent=${profile.heatIntent.length}, ` +
      `dhwMixedLpm40=${profile.dhwMixedLpm40.length}, ` +
      `coldLpm=${profile.coldLpm.length}.`,
    );
  }

  const heatLossKw = engineInput.heatLossWatts / W_PER_KW;
  const purgePulses = detectPurgePulses(profile.dhwMixedLpm40);

  // Build ONE shared demand timeline — both systems are run against the same values.
  // This is the "fair comparison" contract: demand is never influenced by system choice.
  const hourly: ScenarioHourOutputV1[] = Array.from({ length: N }, (_, i) => {
    const intent = profile.heatIntent[i] ?? 1;
    const qChDemandKw = parseFloat((HEAT_INTENT_FRACTION[intent] * heatLossKw).toFixed(3));
    const qDhwDemandKw = parseFloat(dhwLpmToKw(profile.dhwMixedLpm40[i] ?? 0).toFixed(3));

    // Derive the hour-of-day from the slice index for COP cold-morning calculations
    const hourOfDay = (i * profile.resolutionMins) / 60;

    const systemA = computeSystemHourPhysics(systemAType, qChDemandKw, qDhwDemandKw, hourOfDay, spfMidpoint, purgePulses[i]);
    const systemB = computeSystemHourPhysics(systemBType, qChDemandKw, qDhwDemandKw, hourOfDay, spfMidpoint, purgePulses[i]);

    return {
      hour: i,
      qChDemandKw,
      qDhwDemandKw,
      coldLpm: profile.coldLpm[i] ?? 0,
      systemA,
      systemB,
    };
  });

  return { hourly, systemAType, systemBType };
}

/**
 * Assert that two ScenarioPhysicsOutputV1 results share the same demand timeline.
 *
 * Throws if the demand channels (qChDemandKw, qDhwDemandKw, coldLpm) differ between
 * the two outputs at any slice.  Use this to guard against future refactors that
 * could accidentally bias one system with a different demand profile.
 *
 * Example:
 * ```ts
 * const resultAB = applyScenarioOverrides(input, profile, 'combi', 'ashp', spf);
 * const resultBA = applyScenarioOverrides(input, profile, 'ashp', 'combi', spf);
 * assertDemandTimelinesEqual(resultAB, resultBA); // invariant: demand is system-agnostic
 * ```
 */
export function assertDemandTimelinesEqual(
  a: ScenarioPhysicsOutputV1,
  b: ScenarioPhysicsOutputV1,
): void {
  if (a.hourly.length !== b.hourly.length) {
    throw new Error(
      `assertDemandTimelinesEqual: length mismatch ${a.hourly.length} vs ${b.hourly.length}`,
    );
  }
  for (let i = 0; i < a.hourly.length; i++) {
    const ra = a.hourly[i];
    const rb = b.hourly[i];
    if (ra.qChDemandKw !== rb.qChDemandKw || ra.qDhwDemandKw !== rb.qDhwDemandKw || ra.coldLpm !== rb.coldLpm) {
      throw new Error(
        `assertDemandTimelinesEqual: demand mismatch at slice ${i}: ` +
        `qCH=${ra.qChDemandKw} vs ${rb.qChDemandKw}, ` +
        `qDHW=${ra.qDhwDemandKw} vs ${rb.qDhwDemandKw}, ` +
        `coldLpm=${ra.coldLpm} vs ${rb.coldLpm}`,
      );
    }
  }
}
