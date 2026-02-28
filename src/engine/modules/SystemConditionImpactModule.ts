/**
 * SystemConditionImpactModule
 *
 * Deterministic helpers for the "System Condition Impact" visualiser (Step 8 Results).
 *
 * Derives "As Found" vs "After Flush + Filter" metrics from existing engine outputs
 * (SludgeVsScaleResult, HydraulicResult, NormalizerOutput) with no Math.random().
 *
 * Physics model:
 *  - CH shortfall is caused by primary-circuit sludge restricting flow.
 *  - DHW stability loss is caused by scale reducing DHW HX capacity.
 *  - Efficiency decay is from the normalizer's 10-year model.
 *  - Velocity outside band uses a UK heating load distribution (Gaussian).
 *  - Comfort stability trace uses a first-order lumped-capacitance model.
 *  - System stress metrics (cycling, run time, purge) are derived from sludge data.
 */


// Recommended hydraulic velocity band for primary copper pipework (m/s)
const VELOCITY_LOWER_M_S = 0.8;
const VELOCITY_UPPER_M_S = 1.5;

// UK heating season load distribution parameters (dimensionless fraction of design load)
// Derived from a normal distribution N(μ=0.65, σ=0.20) fitted to annual degree-day data.
const LOAD_MEAN = 0.65;
const LOAD_SD = 0.20;

// Sigmoid approximation of the normal CDF (accurate within ±0.01 for |z| < 4)
function normalCDF(z: number): number {
  return 1 / (1 + Math.exp(-1.7 * z));
}

/**
 * computeVelocityOutsideBandPct
 *
 * Returns the estimated percentage of annual heating hours during which the
 * primary-circuit hydraulic velocity exceeds the recommended upper limit of
 * 1.5 m/s, based on a UK annual heating-load distribution.
 *
 * Physics:
 *   - Velocity scales linearly with flow, which scales linearly with heat demand.
 *   - UK heat demand follows approximately N(μ=0.65, σ=0.20) × design load.
 *   - Hours outside band = P(load > 1.5/velocityMs) × 100.
 *
 * @param velocityMs  Velocity at design (peak) conditions in m/s.
 * @returns           Percentage of heating hours outside the 0.8–1.5 m/s band (0–90).
 */
export function computeVelocityOutsideBandPct(velocityMs: number): number {
  if (velocityMs <= VELOCITY_UPPER_M_S) return 0;
  // Fraction of design load above which velocity exceeds the safe limit
  const loadThreshold = VELOCITY_UPPER_M_S / velocityMs;
  const z = (loadThreshold - LOAD_MEAN) / LOAD_SD;
  const pctAbove = (1 - normalCDF(z)) * 100;
  return Math.round(Math.min(90, Math.max(0, pctAbove)));
}

/**
 * computeDesignVelocityMs
 *
 * Recovers the design (no-sludge) velocity from the as-found velocity and
 * the sludge flow derate, using the relationship:
 *   asFoundFlow = designFlow / (1 − flowDeratePct)
 *   → designVelocity = asFoundVelocity × (1 − flowDeratePct)
 */
export function computeDesignVelocityMs(
  asFoundVelocityMs: number,
  flowDeratePct: number,
): number {
  return parseFloat((asFoundVelocityMs * (1 - flowDeratePct)).toFixed(2));
}

/**
 * ConditionImpactSludgeInput
 *
 * Typed parameter interface for the sludge metrics required by
 * computeConditionImpactMetrics.  Using a named interface (rather than an
 * intersection of Pick and an object literal) avoids ambiguity at the call site.
 */
export interface ConditionImpactSludgeInput {
  /** Sludge-induced primary flow restriction (fraction, 0–0.20). */
  flowDeratePct: number;
  /** DHW heat-exchanger scale derate (fraction, 0–0.20). */
  dhwCapacityDeratePct: number;
  /** Estimated scale thickness on DHW HX (mm). */
  estimatedScaleThicknessMm: number;
  /** Short-cycling fuel loss fraction (fraction, 0–0.05). Optional — defaults to 0. */
  cyclingLossPct?: number;
}

export interface ConditionMetrics {
  /** CH heating shortfall at peak morning demand (%) */
  chShortfallPct: number;
  /** DHW capacity reduction vs nominal (%) */
  dhwCapacityReductionPct: number;
  /** Boiler seasonal efficiency (%) */
  efficiencyPct: number;
  /** Primary circuit velocity at design conditions (m/s) */
  velocityMs: number;
  /** Percentage of heating hours outside the 0.8–1.5 m/s velocity band */
  velocityOutsideBandPct: number;
}

export interface ConditionImpactResult {
  /** "As Found" — current degraded condition */
  asFound: ConditionMetrics;
  /** "After Flush + Filter" — restored condition */
  restored: ConditionMetrics;
  /** Reduction in CH peak shortfall achieved by restoration (percentage points) */
  chShortfallReductionPct: number;
  /** Years of gradual accumulation (from systemAgeYears) */
  systemAgeYears: number;
  /** Scale thickness on DHW HX as estimated by SludgeVsScaleModule (mm) */
  estimatedScaleThicknessMm: number;
  /** 24-hour room-temperature trace — Comfort Stability graph data. */
  comfortTrace: ComfortHourPoint[];
  /** Minutes per day below the lower comfort band (setpoint − 0.5 °C). */
  minutesBelowSetpoint: { asFound: number; restored: number };
  /**
   * 24-hour DHW deliverability trace — Graph 3.
   * Null when the system is not a combi boiler.
   */
  dhwTrace: DhwHourPoint[] | null;
  /**
   * Peak demand unmet by the as-found system (%).
   * Null when dhwTrace is null.
   */
  dhwPeakShortfallPct: number | null;
  /** System stress metrics for the degraded "As Found" state. */
  stressAsFound: SystemStressMetrics;
  /** System stress metrics for the restored state. */
  stressRestored: SystemStressMetrics;
  /** Glass-box debug panel data. */
  debugPanel: ConditionDebugPanel;
  /**
   * Projected sludge flow derate in 3 years if untreated (% of design flow).
   * Used for the Time-to-Degradation trendline.
   */
  sludgeRiskIn3yrPct: number;
}

/**
 * computeConditionImpactMetrics
 *
 * Derives before/after performance metrics for the System Condition Impact panel.
 * All values are deterministic — no randomness.
 *
 * Efficiency values are passed directly rather than computed from the normalizer
 * because the caller (FullSurveyResults) already resolves nominal and current
 * efficiency via resolveNominalEfficiencyPct / computeCurrentEfficiencyPct.
 *
 * @param sludge        Output from SludgeVsScaleModule for the surveyed system.
 * @param velocityMs    Current (as-found) primary-circuit velocity in m/s.
 *                      Use hydraulic.velocityMs (legacy) or hydraulicV1.ashp.velocityMs.
 * @param nominalEffPct Boiler nominal (as-installed) efficiency (%).
 * @param currentEffPct Current (decayed) boiler efficiency (%).
 * @param systemAgeYears System age in years.
 * @param opts          Optional extra data for DHW deliverability and debug panel.
 */
export function computeConditionImpactMetrics(
  sludge: ConditionImpactSludgeInput,
  velocityMs: number,
  nominalEffPct: number,
  currentEffPct: number,
  systemAgeYears: number,
  opts?: {
    /** Nominal combi DHW max heat output (kW) — from CombiDhwV1Result.maxQtoDhwKw. */
    maxQtoDhwKw?: number;
    /** Scale-derated combi DHW heat output (kW) — from CombiDhwV1Result.maxQtoDhwKwDerated. */
    maxQtoDhwKwDerated?: number;
  },
): ConditionImpactResult {
  // ── "As Found" metrics ────────────────────────────────────────────────────
  // CH shortfall: proportional to flow derate (higher flow demand → unmet at peak)
  const asFoundChShortfall = parseFloat((sludge.flowDeratePct * 100).toFixed(1));
  // DHW capacity reduction: from DHW heat-exchanger scale
  const asFoundDhwReduction = parseFloat((sludge.dhwCapacityDeratePct * 100).toFixed(1));
  // Velocity: as-found (already elevated by sludge-driven flow demand)
  const asFoundVelocity = velocityMs;
  const asFoundVelocityOutsideBand = computeVelocityOutsideBandPct(asFoundVelocity);

  const asFound: ConditionMetrics = {
    chShortfallPct: asFoundChShortfall,
    dhwCapacityReductionPct: asFoundDhwReduction,
    efficiencyPct: parseFloat(currentEffPct.toFixed(1)),
    velocityMs: parseFloat(asFoundVelocity.toFixed(2)),
    velocityOutsideBandPct: asFoundVelocityOutsideBand,
  };

  // ── "After Flush + Filter" metrics ───────────────────────────────────────
  // Restoration eliminates sludge flow derate and DHW scale derate
  const restoredVelocity = computeDesignVelocityMs(asFoundVelocity, sludge.flowDeratePct);
  const restoredVelocityOutsideBand = computeVelocityOutsideBandPct(restoredVelocity);

  const restored: ConditionMetrics = {
    chShortfallPct: 0,
    dhwCapacityReductionPct: 0,
    efficiencyPct: parseFloat(nominalEffPct.toFixed(1)),
    velocityMs: restoredVelocity,
    velocityOutsideBandPct: restoredVelocityOutsideBand,
  };

  // ── Comfort stability trace ───────────────────────────────────────────────
  const comfortTrace = computeComfortTrace(sludge.flowDeratePct);
  const minutesBelowSetpoint = computeMinutesBelowSetpoint(comfortTrace);

  // ── DHW deliverability trace (combi only) ─────────────────────────────────
  const hasDhwData = opts?.maxQtoDhwKw != null;
  const dhwTrace = hasDhwData
    ? computeDhwTrace(opts!.maxQtoDhwKw, opts?.maxQtoDhwKwDerated ?? opts!.maxQtoDhwKw)
    : null;
  const dhwPeakShortfallPct = dhwTrace != null ? computeDhwPeakShortfallPct(dhwTrace) : null;

  // ── System stress metrics ─────────────────────────────────────────────────
  const cyclingLossPct = sludge.cyclingLossPct ?? 0;
  const stressAsFound = computeSystemStress(sludge.flowDeratePct, cyclingLossPct, false);
  const stressRestored = computeSystemStress(sludge.flowDeratePct, cyclingLossPct, true);

  // ── Debug panel ───────────────────────────────────────────────────────────
  const debugPanel: ConditionDebugPanel = {
    flowDeratePct: parseFloat((sludge.flowDeratePct * 100).toFixed(1)),
    cyclingLossPct: parseFloat((cyclingLossPct * 100).toFixed(1)),
    dhwCapacityDeratePct: parseFloat((sludge.dhwCapacityDeratePct * 100).toFixed(1)),
    effectiveCOPShift: parseFloat(((currentEffPct - nominalEffPct) / 100).toFixed(2)),
  };

  // ── Time-to-degradation projection ───────────────────────────────────────
  const sludgeRiskIn3yrPct = computeSludgeRiskIn3Yr(sludge.flowDeratePct);

  return {
    asFound,
    restored,
    chShortfallReductionPct: parseFloat((asFoundChShortfall).toFixed(1)),
    systemAgeYears,
    estimatedScaleThicknessMm: sludge.estimatedScaleThicknessMm,
    comfortTrace,
    minutesBelowSetpoint,
    dhwTrace,
    dhwPeakShortfallPct,
    stressAsFound,
    stressRestored,
    debugPanel,
    sludgeRiskIn3yrPct,
  };
}

// ─── Comfort stability model constants ────────────────────────────────────────

/** Room comfort setpoint (°C) — typical UK thermostat setting. */
const COMFORT_SETPOINT_C = 21;
/** Comfort band half-width (°C): room must stay within setpoint ± 0.5 °C. */
const COMFORT_BAND_HALF_K = 0.5;
/** UK design outdoor temperature (°C) — SAP 2012 design point. */
const OUTDOOR_DESIGN_TEMP_C = -3;
/** Boiler sprint output (kW) — full-output reheat from cold. */
const BOILER_SPRINT_KW = 30;
/**
 * UA coefficient (kW/K) for a typical UK semi-detached with ~8 kW design heat-loss.
 * UA = Q_design / ΔT_design = 8 / 24 ≈ 0.33 kW/K.
 */
const UA_KW_PER_K = 0.33;
/**
 * Effective building thermal capacitance (kJ/K) — medium-mass construction.
 * τ = C/UA ≈ 42 h at the design UA above (BRE IP14/88 Table 3).
 */
const C_BUILDING_KJ_PER_K = 50_000;
/** Heating schedule: boiler fires during these hours (24-hour schedule typical UK). */
const HEATING_START_HOUR = 6;
const HEATING_END_HOUR = 22;
/**
 * Upper clamp for computed room temperature (°C).
 * Prevents the model from overshooting beyond a physically plausible warm-room
 * temperature on the design-point heating day (−3 °C outdoor).
 */
const MAX_ROOM_TEMP_C = 22;

// ─── DHW deliverability model constants ───────────────────────────────────────

/**
 * Nominal combi boiler peak DHW heat output (kW).
 * Realistic order-of-magnitude for UK combi DHW heat transfer capacity.
 * At Cp=4.19, ΔT=25°C (cold 15°C → 40°C): ~17 L/min deliverable.
 */
const NOMINAL_COMBI_DHW_KW = 30;
/**
 * Litres per minute per kW at the 40 °C mixed target.
 * Mixed target 40 °C from 15 °C cold, Cp = 4.186 kJ/(kg·K), density ≈ 1 kg/L:
 *   ṁ (kg/s) = Q_kW × 1000 / (4186 × 25) = Q_kW × 0.00956 kg/s per kW
 *   L/min    = ṁ × 60                     ≈ Q_kW × 0.574 L/min per kW
 * Sanity check: 30 kW × 0.574 ≈ 17.2 L/min — consistent with UK combi data sheets.
 */
const LPM_PER_KW_AT_40C = 0.574;

/**
 * Standard 24-hour DHW demand profile (L/min @40 °C mixed).
 * Models a 3-person household with 1 bathroom during a UK weekday.
 * Morning peak (07:00) represents two moderate draws (e.g., 2 × 6 L/min = 12 L/min),
 * which sits within a healthy combi's nominal capacity (~17.2 L/min at 30 kW) but exceeds
 * the derated capacity when scale has reduced HX output.
 * Index = hour (0–23).
 */
const DHW_DEMAND_PROFILE_LPM: readonly number[] = [
  0.5, 0.5, 0.5, 0.5, 0.5, 1.5,   // 00:00–05:00  (baseline trickle)
  3.0, 12.0, 9.0, 5.0, 2.0, 2.0,   // 06:00–11:00  (morning peak — simultaneous draws)
  3.5, 1.5, 1.0, 1.0, 2.0, 7.0,    // 12:00–17:00  (midday + early evening)
  13.0, 11.0, 6.0, 3.0, 1.0, 0.5,  // 18:00–23:00  (evening peak + wind-down)
];

// ─── System stress model constants ────────────────────────────────────────────

/**
 * Nominal boiler firing events per 24-hour day on a typical UK heating schedule.
 * On a clean system the thermostat cycles roughly every 40 minutes during
 * the occupied heating period (~18 h active), giving ~27 events.
 */
const BASE_CYCLING_EVENTS_PER_DAY = 27;
/**
 * Maximum additional cycling events per day at the maximum sludge flow derate (0.20).
 * A heavily sludged system short-cycles because restricted flow causes rapid
 * heat saturation near the boiler, triggering overheat cutouts frequently.
 */
const MAX_EXTRA_CYCLING_AT_FULL_DERATE = 20;
/** Total active heating hours per day (morning + evening programme). */
const ACTIVE_HEATING_HOURS_PER_DAY = 14;
/** Nominal purge events per day on a clean combi (SAP pre-purge modelling). */
const BASE_PURGE_EVENTS_PER_DAY = 4;

// ─── Degradation projection constants ─────────────────────────────────────────

/**
 * Annual sludge flow derate increment (fraction of max derate per year)
 * when no magnetic filter is fitted.  At this rate, a 10-year system with
 * no filter accrues ~50 % of the maximum derate — consistent with HHIC data.
 */
const SLUDGE_DERATE_PER_YEAR = 0.005;

/**
 * Scaling factor used to convert the fractional cycling loss (0–0.05) to an
 * additional purge event count per day.  A cycling loss of 0.05 (5 %) equates
 * to 5 extra purge events, consistent with SAP short-cycle purge modelling.
 * This converts a dimensionless fraction to events/day (multiply by 100).
 */
const CYCLING_LOSS_TO_PURGE_EVENTS_SCALE = 100;

// ─── New interfaces ───────────────────────────────────────────────────────────

/** Single hourly data point for the Comfort Stability graph. */
export interface ComfortHourPoint {
  /** Hour of day (0–23). */
  hour: number;
  /** Room temperature for the degraded "As Found" system (°C). */
  asFoundTempC: number;
  /** Room temperature for the "After Flush + Filter" restored system (°C). */
  restoredTempC: number;
  /** Target comfort setpoint (°C) — constant across the trace. */
  setpointC: number;
  /** Lower comfort band limit (°C) = setpoint − 0.5 °C. */
  bandLowC: number;
  /** Upper comfort band limit (°C) = setpoint + 0.5 °C. */
  bandHighC: number;
}

/** Single hourly data point for the DHW Deliverability graph (combi only). */
export interface DhwHourPoint {
  /** Hour of day (0–23). */
  hour: number;
  /** Target mixed-water demand (L/min @40 °C). */
  requestedLpm40: number;
  /** Delivered mixed-water flow for the degraded "As Found" system (L/min @40 °C). */
  asFoundLpm40: number;
  /** Delivered mixed-water flow for the restored system (L/min @40 °C). */
  restoredLpm40: number;
}

/** System stress metrics (cycling, run time, purge) for one condition state. */
export interface SystemStressMetrics {
  /** Estimated boiler firing events per 24-hour day. */
  cyclingEventsPerDay: number;
  /** Average burner run time per firing event (minutes). */
  avgRunTimeMinutes: number;
  /** Pre-purge (fan-overrun) events per day. */
  purgeEvents: number;
}

/** Glass-box debug data panel — derived values shown in collapsed inspector. */
export interface ConditionDebugPanel {
  /** Sludge-induced primary flow restriction (fraction, 0–0.20). */
  flowDeratePct: number;
  /** Additional short-cycling fuel loss at low load (fraction, 0–0.05). */
  cyclingLossPct: number;
  /** DHW heat-exchanger scale derate (fraction, 0–0.20). */
  dhwCapacityDeratePct: number;
  /**
   * Effective COP shift — difference between restored and as-found thermal
   * efficiency expressed as a decimal shift (negative = degraded).
   * For gas boilers this equals (currentEffPct − nominalEffPct) / 100.
   */
  effectiveCOPShift: number;
}

/**
 * computeComfortTrace
 *
 * Returns a 24-point room-temperature trace for a typical UK heating day,
 * contrasting the degraded ("As Found") system against the restored system.
 *
 * Physics: first-order lumped-capacitance model.
 *   T_room[t+1] = T_room[t] + (Q_plant[t] − UA × (T_room[t] − T_outdoor)) × Δt / C
 *
 * @param flowDeratePct  Fraction by which sludge restricts primary flow (0–0.20).
 *                       Reduces effective boiler output linearly.
 */
export function computeComfortTrace(flowDeratePct: number): ComfortHourPoint[] {
  const dtSec = 3600; // 1 hour steps

  let asFoundTemp = 19.5; // °C — typical overnight setback temperature
  let restoredTemp = 19.5;

  const trace: ComfortHourPoint[] = [];

  for (let h = 0; h < 24; h++) {
    const isHeating = h >= HEATING_START_HOUR && h < HEATING_END_HOUR;

    // As-found: boiler output derated by flow restriction
    const asFoundQKw = isHeating
      ? BOILER_SPRINT_KW * (1 - flowDeratePct)
      : 0;
    // Restored: full boiler output — no derate
    const restoredQKw = isHeating ? BOILER_SPRINT_KW : 0;

    // Thermostat clamp: once setpoint is reached, boiler idles (modelling hysteresis)
    const asFoundFire = isHeating && asFoundTemp < COMFORT_SETPOINT_C + COMFORT_BAND_HALF_K;
    const restoredFire = isHeating && restoredTemp < COMFORT_SETPOINT_C + COMFORT_BAND_HALF_K;

    const asFoundQ = asFoundFire ? asFoundQKw : 0;
    const restoredQ = restoredFire ? restoredQKw : 0;

    // Record before updating temperature (represents start-of-hour value)
    trace.push({
      hour: h,
      asFoundTempC: parseFloat(asFoundTemp.toFixed(1)),
      restoredTempC: parseFloat(restoredTemp.toFixed(1)),
      setpointC: COMFORT_SETPOINT_C,
      bandLowC: COMFORT_SETPOINT_C - COMFORT_BAND_HALF_K,
      bandHighC: COMFORT_SETPOINT_C + COMFORT_BAND_HALF_K,
    });

    // Advance by one hour
    const dTAsFound =
      (asFoundQ - UA_KW_PER_K * (asFoundTemp - OUTDOOR_DESIGN_TEMP_C)) * dtSec / C_BUILDING_KJ_PER_K;
    const dTRestored =
      (restoredQ - UA_KW_PER_K * (restoredTemp - OUTDOOR_DESIGN_TEMP_C)) * dtSec / C_BUILDING_KJ_PER_K;

    asFoundTemp = Math.min(MAX_ROOM_TEMP_C, Math.max(OUTDOOR_DESIGN_TEMP_C, asFoundTemp + dTAsFound));
    restoredTemp = Math.min(MAX_ROOM_TEMP_C, Math.max(OUTDOOR_DESIGN_TEMP_C, restoredTemp + dTRestored));
  }

  return trace;
}

/**
 * computeMinutesBelowSetpoint
 *
 * Returns the number of hours in the comfort trace that fall below the lower
 * comfort band, multiplied by 60 to give minutes per day.
 *
 * @param trace  Output of computeComfortTrace.
 */
export function computeMinutesBelowSetpoint(
  trace: ComfortHourPoint[],
): { asFound: number; restored: number } {
  const bandLow = COMFORT_SETPOINT_C - COMFORT_BAND_HALF_K;
  const asFound = trace.filter(p => p.asFoundTempC < bandLow).length * 60;
  const restored = trace.filter(p => p.restoredTempC < bandLow).length * 60;
  return { asFound, restored };
}

/**
 * computeDhwTrace
 *
 * Returns a 24-point DHW deliverability trace for a combi boiler,
 * contrasting as-found (scale-derated) vs restored (nominal) output.
 *
 * @param maxQtoDhwKw         Nominal combi DHW heat output (kW) — pre-scale.
 *                            Defaults to NOMINAL_COMBI_DHW_KW when not supplied.
 * @param maxQtoDhwKwDerated  As-found combi DHW heat output after scale derate (kW).
 *                            When not supplied, defaults to maxQtoDhwKw (no derate).
 */
export function computeDhwTrace(
  maxQtoDhwKw: number = NOMINAL_COMBI_DHW_KW,
  maxQtoDhwKwDerated: number = maxQtoDhwKw,
): DhwHourPoint[] {
  const nominalCapLpm = maxQtoDhwKw * LPM_PER_KW_AT_40C;
  const deratedCapLpm = maxQtoDhwKwDerated * LPM_PER_KW_AT_40C;

  return DHW_DEMAND_PROFILE_LPM.map((demand, h) => ({
    hour: h,
    requestedLpm40: parseFloat(demand.toFixed(1)),
    asFoundLpm40: parseFloat(Math.min(demand, deratedCapLpm).toFixed(1)),
    restoredLpm40: parseFloat(Math.min(demand, nominalCapLpm).toFixed(1)),
  }));
}

/**
 * computeDhwPeakShortfallPct
 *
 * Returns the fraction of peak demand unmet by the as-found system (%).
 * Uses the maximum requested L/min in the profile as the peak reference.
 */
export function computeDhwPeakShortfallPct(trace: DhwHourPoint[]): number {
  const peakDemand = Math.max(...trace.map(p => p.requestedLpm40));
  if (peakDemand <= 0) return 0;
  const peakDeliveredAsFound = Math.max(...trace.map(p => p.asFoundLpm40));
  const shortfallPct = ((peakDemand - peakDeliveredAsFound) / peakDemand) * 100;
  return parseFloat(Math.max(0, shortfallPct).toFixed(1));
}

/**
 * computeSystemStress
 *
 * Derives per-day system stress metrics from sludge and cycling data.
 *
 * Physics: sludge-laden systems short-cycle because restricted flow causes
 * rapid heat saturation near the heat exchanger, triggering overheat cutouts.
 * The cycling penalty is proportional to the flow derate fraction.
 *
 * @param flowDeratePct    Primary flow restriction (0–0.20).
 * @param cyclingLossPct   Short-cycling fuel loss fraction (0–0.05).
 * @param restored         If true, returns metrics for the clean (restored) state.
 */
export function computeSystemStress(
  flowDeratePct: number,
  cyclingLossPct: number,
  restored: boolean,
): SystemStressMetrics {
  const effectiveDerate = restored ? 0 : flowDeratePct;
  const effectiveCyclingLoss = restored ? 0 : cyclingLossPct;

  // Cycling events: base + sludge-driven short-cycling penalty
  const extraCycling = Math.round(
    (effectiveDerate / 0.20) * MAX_EXTRA_CYCLING_AT_FULL_DERATE,
  );
  const cyclingEventsPerDay = BASE_CYCLING_EVENTS_PER_DAY + extraCycling;

  // Average run time: total active heating minutes / number of firing events
  const avgRunTimeMinutes = parseFloat(
    ((ACTIVE_HEATING_HOURS_PER_DAY * 60) / cyclingEventsPerDay).toFixed(1),
  );

  // Purge events: base + sludge-driven short-firing increase
  const purgeEvents = Math.round(
    BASE_PURGE_EVENTS_PER_DAY + effectiveCyclingLoss * CYCLING_LOSS_TO_PURGE_EVENTS_SCALE,
  );

  return { cyclingEventsPerDay, avgRunTimeMinutes, purgeEvents };
}

/**
 * computeSludgeRiskIn3Yr
 *
 * Projects the sludge flow derate 3 years into the future, assuming no
 * intervention and linear annual accumulation at SLUDGE_DERATE_PER_YEAR.
 *
 * Returns the projected derate as a percentage (0–20).
 */
export function computeSludgeRiskIn3Yr(currentFlowDeratePct: number): number {
  const projected = Math.min(0.20, currentFlowDeratePct + 3 * SLUDGE_DERATE_PER_YEAR);
  return parseFloat((projected * 100).toFixed(1));
}

// ─── Constants re-exported for the visualiser ─────────────────────────────────
export { VELOCITY_LOWER_M_S, VELOCITY_UPPER_M_S, COMFORT_SETPOINT_C, COMFORT_BAND_HALF_K };
