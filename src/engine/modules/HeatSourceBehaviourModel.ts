/**
 * HeatSourceBehaviourModel.ts
 *
 * Core heat-source behaviour layer.
 *
 * Provides three deterministic sub-models that answer the physical questions
 * the outcome classifier was previously forced to infer from generic threshold
 * assumptions:
 *
 *   CombiBehaviourV1          — modulation, DHW priority, initiation delay,
 *                               simultaneous flow splitting, pressure lockout.
 *   BoilerCylinderBehaviourV1 — stored-volume depletion, coil recovery,
 *                               S-plan / Y-plan simultaneous CH + DHW effect.
 *   HeatPumpCylinderBehaviourV1 — larger cylinder, slower reheat, lift-based
 *                               COP penalty, low-temp space-heating suitability.
 *
 * All three models are pure functions of their inputs.  No randomness is
 * introduced — identical inputs always produce identical outputs.
 *
 * Usage:
 *   import { buildHeatSourceBehaviour } from './HeatSourceBehaviourModel';
 *   const behaviour = buildHeatSourceBehaviour(outcomeSystemSpec);
 *   // Pass to classifyHotWaterEvent via spec.heatSourceBehaviour
 */

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * Minimal input interface required by the HeatSourceBehaviourModel.
 *
 * This is intentionally a standalone type — it does not import from the logic
 * layer — to avoid circular dependencies between the engine and logic layers.
 * `OutcomeSystemSpec` (logic/outcomes/types.ts) satisfies this interface
 * structurally and can be passed directly to `buildHeatSourceBehaviour`.
 */
export interface HeatSourceBehaviourInput {
  /** Broad category driving the primary behaviour model. */
  systemType: 'combi' | 'stored_water' | 'heat_pump';
  /** Dynamic mains pressure at the property inlet (bar). */
  mainsDynamicPressureBar?: number;
  /** Survey-measured peak hot-water capacity (L/min). Used by combi model. */
  peakHotWaterCapacityLpm?: number;
  /** Total usable hot-water storage (litres). Used by stored-water / HP models. */
  hotWaterStorageLitres?: number;
  /** Recovery rate override (L/h). When absent, physics-derived values are used. */
  recoveryRateLitresPerHour?: number;
  /** Overall system condition — affects coil recovery penalty for scale/sludge. */
  systemCondition?: 'clean' | 'average' | 'poor';
  /** How well system suits low-temperature emitters. Used by HP model. */
  lowTempSuitability?: 'low' | 'medium' | 'high';
  /**
   * Zone-control topology, relevant for stored-water systems.
   *   'y_plan' — shared mid-position valve: DHW demand throttles CH.
   *   's_plan' — twin 2-port zone valves: CH and DHW circuits are independent.
   */
  systemPlanType?: 'y_plan' | 's_plan';
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * UK default cold-water mains inlet temperature (°C).
 * Used for DHW temperature-rise calculations.
 */
const COLD_WATER_INLET_C = 10;

/**
 * Target combi DHW delivery temperature (°C).
 * A typical UK combi set-point for domestic use.
 */
const COMBI_DHW_SETPOINT_C = 50;

/**
 * kW to (L/min) conversion: at a given ΔT, what flow rate does 1 kW deliver?
 *   Q = P / (cp × ΔT) = 1000 / (4186 × ΔT) L/s = 60 000 / (4186 × ΔT) L/min
 */
function kWToLpmAtDeltaT(kW: number, deltaTc: number): number {
  if (deltaTc <= 0) return 0;
  return (kW * 60_000) / (4186 * deltaTc);
}

/** Temperature rise for DHW at default cold-water inlet and combi set-point. */
const COMBI_DHW_DELTA_T = COMBI_DHW_SETPOINT_C - COLD_WATER_INLET_C; // 40 °C

/**
 * Nominal combi peak DHW output (kW).
 * Represents a typical 30 kW UK combi in full DHW-priority mode.
 */
const COMBI_PEAK_DHW_KW = 30;

/**
 * Minimum stable output (kW) for a UK combi boiler — the turndown floor.
 * Below this the burner cannot modulate further and short-cycles.
 * Typical UK combis modulate down to 20–25 % of rated output.
 */
const COMBI_MIN_STABLE_OUTPUT_KW = 6;

/**
 * Initiation delay (seconds) from first DHW draw until full-temperature hot
 * water reaches the tap (heat-exchanger warm-up + purge lag).
 * Typical UK domestic combi: 15–25 s.
 */
const COMBI_INITIATION_DELAY_S = 20;

/**
 * Minimum mains dynamic pressure (bar) required for combi burner ignition.
 * Below this the flow-rate sensor cannot trigger the gas valve; pressure
 * lockout is active.
 */
const COMBI_PRESSURE_LOCKOUT_BAR = 1.0;

/**
 * Minimum volumetric flow (L/min) required to activate combi ignition.
 * Below this threshold the flow sensor will not trigger combustion.
 */
const COMBI_MIN_IGNITION_FLOW_LPM = 2.5;

/**
 * Minimum usable DHW delivery (L/min per outlet) before the outlet is
 * classified as an inadequate combi draw.
 */
const COMBI_ADEQUATE_OUTLET_LPM = 6;

/**
 * Reference flow for pressure-proportional combi DHW capacity scaling.
 * At COMBI_PRESSURE_LOCKOUT_BAR the boiler can just about fire; above that
 * the rated DHW kW is available.
 */

/**
 * Nominal coil reheat output (kW) for a gas indirect cylinder (clean coil).
 * A typical 24 kW gas boiler delivers ~12 kW useful coil transfer after
 * thermal losses.
 */
const BOILER_COIL_REHEAT_KW = 12;

/**
 * Specific heat of water (kJ/kg·K).
 * Used to convert coil output kW to cylinder recovery L/h.
 */
const WATER_CP_KJ_PER_KG_K = 4.186;

/**
 * Cylinder target store temperature for conventional stored-water systems (°C).
 */
const CYLINDER_STORE_TARGET_C = 60;

/**
 * Fraction of cylinder volume that can be counted as "usable" after
 * stratification and temperature blending.
 *
 * In a stratified cylinder the lower half is warm rather than hot; a
 * thermostatic mixing valve blends hot store water with cold to deliver at
 * the usable temperature.  Effective usable volume = total × factor.
 */
const CYLINDER_USABLE_VOLUME_FACTOR = 0.85;

/**
 * Condition penalty applied to coil recovery rate for average / poor systems.
 * Scale and sludge reduce effective coil surface conductance.
 */
const COIL_CONDITION_PENALTY: Record<HeatSourceBehaviourInput['systemCondition'] & string, number> = {
  clean:   1.0,
  average: 0.85,
  poor:    0.65,
};

/**
 * Reference COP for ASHP DHW cylinder heating at standard EN 14511 conditions
 * (outdoor +7 °C, target store 55 °C).
 */
const HP_REF_COP = 2.5;

/**
 * COP sensitivity per °C outdoor temperature change above the reference.
 * Approximately 0.06 COP per °C.
 */
const HP_COP_OUTDOOR_SENSITIVITY = 0.06;

/**
 * COP sensitivity per °C increase in target store temperature above 55 °C.
 * Approximately 0.04 COP per °C.
 */
const HP_COP_STORE_TEMP_SENSITIVITY = 0.04;

/** Reference outdoor temperature for HP COP model (°C). */
const HP_REF_OUTDOOR_TEMP_C = 7;

/** Reference target store temperature for HP COP model (°C). */
const HP_REF_STORE_TEMP_C = 55;

/** Minimum credible HP COP (compressor still running at high lift). */
const HP_MIN_COP = 1.2;

/** Maximum credible HP COP (very mild conditions). */
const HP_MAX_COP = 4.0;

/**
 * Nominal heat-pump input power (kW) for DHW reheat.
 * Typical UK residential ASHP compressor input for cylinder heating: ~2–3 kW.
 */
const HP_INPUT_KW = 2.5;

/**
 * Standing-loss compensation factor for HP cylinder recovery.
 * HP cylinders are better insulated than gas; standing losses are lower.
 * Effective recovery rate = (inputKw × cop × 3600 / cp_kJ_per_L) - standingLossL_per_hour.
 */

// ─── Derived type for system condition ───────────────────────────────────────

type SystemCondition = NonNullable<HeatSourceBehaviourInput['systemCondition']>;

// ─── CombiBehaviourV1 ─────────────────────────────────────────────────────────

/**
 * Physics outputs from the CombiBehaviourModel.
 *
 * Answers all the key questions about how a combi boiler behaves under DHW
 * and simultaneous CH+DHW demand.
 */
export interface CombiBehaviourV1 {
  /**
   * Maximum DHW flow rate at rated conditions (litres per minute).
   * Derived from peak DHW kW output and the cold→hot temperature rise.
   */
  maxDhwLpm: number;

  /**
   * Effective DHW flow rate when exactly one outlet is open (litres per minute).
   * Accounts for mains pressure (below lockout → 0; at/above lockout → rated).
   */
  singleOutletDhwLpm: number;

  /**
   * Effective DHW flow rate per outlet when two outlets are open simultaneously
   * (litres per minute).  The combi splits its rated output across concurrent
   * draws — neither outlet receives full pressure or flow.
   */
  dualOutletDhwLpmPerOutlet: number;

  /**
   * Minimum stable boiler output (kW) — the turndown floor.
   * Below this the burner cannot modulate and will short-cycle.
   */
  minStableOutputKw: number;

  /**
   * Maximum boiler output (kW).
   */
  maxOutputKw: number;

  /**
   * Initiation delay (seconds) from draw open until full-temperature hot
   * water is delivered.  During this window the user experiences cold / cold
   * water before the heat exchanger reaches steady state.
   */
  initiationDelaySeconds: number;

  /**
   * True when mains pressure is below the lockout threshold.
   * When active, the combi cannot ignite and delivers cold water only.
   */
  pressureLockoutActive: boolean;

  /**
   * True when a DHW draw is active, space heating (CH) is automatically
   * paused for the duration.  This is the DHW priority mechanism: the combi
   * diverts its full output to the heat exchanger.
   *
   * Always true for a standard combi boiler.
   */
  chPausedDuringDhw: true;

  /**
   * Whether the combi can serve a single DHW event (one outlet open).
   * False when pressure lockout is active or flow is below ignition threshold.
   */
  canServeSingleDhwEvent: boolean;

  /**
   * Whether the combi can serve two simultaneous DHW outlets.
   * True when effective flow per outlet remains above COMBI_ADEQUATE_OUTLET_LPM.
   */
  canServeSimultaneousDhwEvents: boolean;
}

/**
 * Build the physics model for a combi boiler.
 *
 * @param spec - OutcomeSystemSpec for a 'combi' system.
 */
export function buildCombiBehaviour(spec: HeatSourceBehaviourInput): CombiBehaviourV1 {
  const pressure = spec.mainsDynamicPressureBar ?? 1.0;

  // Pressure lockout: below threshold the gas valve cannot open.
  const pressureLockoutActive = pressure < COMBI_PRESSURE_LOCKOUT_BAR;

  // Maximum DHW flow: use survey-provided capacity when available (more
  // accurate than the physics default); otherwise derive from rated kW output.
  const physicsDerivedMaxLpm = kWToLpmAtDeltaT(COMBI_PEAK_DHW_KW, COMBI_DHW_DELTA_T);
  const maxDhwLpm = spec.peakHotWaterCapacityLpm ?? physicsDerivedMaxLpm;

  // Single-outlet effective flow.
  // At or above lockout pressure: full rated flow.
  // Below lockout: 0 (burner cannot fire).
  const singleOutletDhwLpm = pressureLockoutActive ? 0 : maxDhwLpm;

  // Dual-outlet: rated output is split across two outlets (equal split
  // approximation — real physics depends on pipe resistance balance).
  const dualOutletDhwLpmPerOutlet = pressureLockoutActive ? 0 : maxDhwLpm / 2;

  const canServeSingleDhwEvent =
    !pressureLockoutActive && singleOutletDhwLpm >= COMBI_MIN_IGNITION_FLOW_LPM;

  const canServeSimultaneousDhwEvents =
    !pressureLockoutActive &&
    dualOutletDhwLpmPerOutlet >= COMBI_ADEQUATE_OUTLET_LPM;

  return {
    maxDhwLpm,
    singleOutletDhwLpm,
    dualOutletDhwLpmPerOutlet,
    minStableOutputKw: COMBI_MIN_STABLE_OUTPUT_KW,
    maxOutputKw: COMBI_PEAK_DHW_KW,
    initiationDelaySeconds: COMBI_INITIATION_DELAY_S,
    pressureLockoutActive,
    chPausedDuringDhw: true,
    canServeSingleDhwEvent,
    canServeSimultaneousDhwEvents,
  };
}

// ─── BoilerCylinderBehaviourV1 ────────────────────────────────────────────────

/**
 * Effect on space heating when DHW demand starts in a stored-water system.
 *
 * The behaviour depends on the zone-control topology:
 *
 *   's_plan' (twin 2-port zone valves):
 *     CH and DHW have independent motorised valves.  Both zones can run
 *     simultaneously without one throttling the other.
 *
 *   'y_plan' (3-port mid-position valve):
 *     A single valve controls both zones.  When DHW fires the valve moves
 *     to DHW priority; CH is throttled or fully interrupted until the
 *     cylinder thermostat satisfies.
 */
export interface SimultaneousChDhwEffect {
  /**
   * Zone-control topology detected or assumed.
   * 'unknown' when systemPlanType is absent from the spec.
   */
  planType: 'y_plan' | 's_plan' | 'unknown';

  /**
   * True when a DHW call causes CH output to be throttled or interrupted.
   * Y-plan: true (shared valve, DHW has priority).
   * S-plan: false (independent circuits, both run simultaneously).
   */
  chThrottledByDhwDemand: boolean;

  /**
   * True when DHW and CH can run fully independently with no mutual
   * interference.  S-plan only.
   */
  dhwIndependentOfCh: boolean;

  /**
   * Human-readable explanation of the simultaneous demand behaviour.
   */
  explanation: string;
}

/**
 * Physics outputs from the BoilerCylinderBehaviourModel.
 *
 * Covers stored-volume tracking, coil recovery rate, S-plan/Y-plan topology,
 * and standing-recovery behaviour.
 */
export interface BoilerCylinderBehaviourV1 {
  /**
   * Effective usable volume of the cylinder after stratification allowance
   * (litres).  Slightly less than the nominal capacity.
   */
  effectiveUsableVolumeLitres: number;

  /**
   * Rate at which the boiler coil reheats the cylinder (litres per hour).
   * Derived from coil transfer kW and the target temperature rise;
   * degraded by system condition (scale reduces effective coil conductance).
   */
  coilRecoveryRateLph: number;

  /**
   * Time required to reheat a fully depleted cylinder to usable temperature
   * (hours).
   */
  fullRecoveryHours: number;

  /**
   * What happens when both CH and DHW demand are active simultaneously.
   */
  simultaneousChDhw: SimultaneousChDhwEffect;
}

/**
 * Compute coil recovery rate (L/h) given boiler coil output and system condition.
 *
 *   L/h = (kW × 3600) / (cp_kJ/kg·K × ΔT_usable_K × density_kg/L)
 *
 * Using water density ≈ 1 kg/L and cp = 4.186 kJ/kg·K:
 *   L/h = (kW × 3600) / (4.186 × ΔT)
 *
 * ΔT is the useful temperature rise from cold to usable (store - cold_inlet).
 */
function computeCoilRecoveryRateLph(
  coilKw: number,
  systemCondition: SystemCondition,
): number {
  const conditionFactor = COIL_CONDITION_PENALTY[systemCondition] ?? 1.0;
  const effectiveKw = coilKw * conditionFactor;
  const deltaT = CYLINDER_STORE_TARGET_C - COLD_WATER_INLET_C; // 50 °C
  return (effectiveKw * 3600) / (WATER_CP_KJ_PER_KG_K * deltaT);
}

/**
 * Build the physics model for a gas-boiler + cylinder stored-water system.
 *
 * @param spec - OutcomeSystemSpec for a 'stored_water' system.
 */
export function buildBoilerCylinderBehaviour(spec: HeatSourceBehaviourInput): BoilerCylinderBehaviourV1 {
  const nominalVolume = spec.hotWaterStorageLitres ?? 150;
  const effectiveUsableVolumeLitres = nominalVolume * CYLINDER_USABLE_VOLUME_FACTOR;
  const condition: SystemCondition = spec.systemCondition ?? 'clean';

  // Use the spec's recovery rate if provided; otherwise derive from coil physics.
  const coilRecoveryRateLph =
    spec.recoveryRateLitresPerHour ??
    computeCoilRecoveryRateLph(BOILER_COIL_REHEAT_KW, condition);

  const fullRecoveryHours =
    coilRecoveryRateLph > 0
      ? effectiveUsableVolumeLitres / coilRecoveryRateLph
      : Infinity;

  // S-plan vs Y-plan determines whether simultaneous CH+DHW is independent
  // or whether DHW demand throttles space heating.
  const planType: SimultaneousChDhwEffect['planType'] =
    (spec as { systemPlanType?: 'y_plan' | 's_plan' }).systemPlanType ?? 'unknown';

  let simultaneousChDhw: SimultaneousChDhwEffect;
  if (planType === 's_plan') {
    simultaneousChDhw = {
      planType: 's_plan',
      chThrottledByDhwDemand: false,
      dhwIndependentOfCh: true,
      explanation:
        'S-plan: twin 2-port zone valves allow CH and DHW to run independently at full output. ' +
        'A DHW call does not interrupt or throttle space heating.',
    };
  } else if (planType === 'y_plan') {
    simultaneousChDhw = {
      planType: 'y_plan',
      chThrottledByDhwDemand: true,
      dhwIndependentOfCh: false,
      explanation:
        'Y-plan: 3-port mid-position valve gives DHW priority over CH. ' +
        'When the cylinder calls for heat the valve moves to DHW position; ' +
        'space heating is throttled or interrupted until the cylinder thermostat satisfies.',
    };
  } else {
    // Default to Y-plan behaviour when topology is unknown (more common in UK
    // existing stock and more conservative classification).
    simultaneousChDhw = {
      planType: 'unknown',
      chThrottledByDhwDemand: true,
      dhwIndependentOfCh: false,
      explanation:
        'Zone-control topology unknown; assuming Y-plan behaviour (DHW priority may throttle CH). ' +
        'Survey the system wiring to confirm S-plan or Y-plan arrangement.',
    };
  }

  return {
    effectiveUsableVolumeLitres,
    coilRecoveryRateLph,
    fullRecoveryHours,
    simultaneousChDhw,
  };
}

// ─── HeatPumpCylinderBehaviourV1 ─────────────────────────────────────────────

/**
 * Physics outputs from the HeatPumpCylinderBehaviourModel.
 *
 * Heat-pump cylinders differ from gas cylinders in three key respects:
 *   1. Larger volumes (250–300 L vs 150–210 L for gas) to buffer slow reheat.
 *   2. Slower recovery — the compressor input is small (~2.5 kW) so even with
 *      a COP of 2.5 the effective reheat rate is modest.
 *   3. Low-temp suitability for space heating — the emitter system must be
 *      designed for low flow temperatures (≤ 45 °C) for the HP to perform well.
 */
export interface HeatPumpCylinderBehaviourV1 {
  /**
   * Effective usable volume after stratification allowance (litres).
   */
  effectiveUsableVolumeLitres: number;

  /**
   * Coefficient of performance at the modelled outdoor and store-target
   * conditions.  Higher COP → faster effective recovery.
   */
  cop: number;

  /**
   * Rate at which the heat pump reheats the cylinder (litres per hour).
   * Derived from compressor input power × COP, then converted to L/h.
   * Significantly slower than gas coil recovery.
   */
  recoveryRateLph: number;

  /**
   * Time required to reheat a fully depleted cylinder (hours).
   * Longer than gas, typically 4–8 h for a 250 L cylinder.
   */
  fullRecoveryHours: number;

  /**
   * Penalty factor (0–1) applied to recovery rate due to thermal lift.
   * At high lift (cold outdoor + high store temperature) COP drops, reducing
   * effective recovery.  1.0 = no penalty; lower values = degraded recovery.
   */
  liftPenaltyFactor: number;

  /**
   * How well the system is suited to low-temperature space-heating operation.
   *
   *   'suitable'   — emitters and low-temp design make HP operation efficient.
   *   'marginal'   — medium-temperature emitters, some efficiency penalty.
   *   'unsuitable' — high-temp emitters; HP must over-drive to maintain comfort.
   */
  lowTempSuitability: 'suitable' | 'marginal' | 'unsuitable';
}

/**
 * Compute the ASHP COP for cylinder reheat at given outdoor and store temperatures.
 *
 *   COP = REF_COP
 *       + OUTDOOR_SENSITIVITY × (outdoor − REF_OUTDOOR)
 *       − STORE_TEMP_SENSITIVITY × (storeTemp − REF_STORE)
 *
 * Clamped to [HP_MIN_COP, HP_MAX_COP].
 */
export function computeHpCopForCylinder(
  outdoorTempC: number,
  storeTargetC: number,
): number {
  const raw =
    HP_REF_COP +
    HP_COP_OUTDOOR_SENSITIVITY * (outdoorTempC - HP_REF_OUTDOOR_TEMP_C) -
    HP_COP_STORE_TEMP_SENSITIVITY * (storeTargetC - HP_REF_STORE_TEMP_C);
  return parseFloat(Math.min(HP_MAX_COP, Math.max(HP_MIN_COP, raw)).toFixed(2));
}

/**
 * Map low-temp suitability from the spec's 'lowTempSuitability' field to the
 * HeatPumpCylinderBehaviourV1 suitability enum.
 */
function mapLowTempSuitability(
  specSuitability: HeatSourceBehaviourInput['lowTempSuitability'],
): HeatPumpCylinderBehaviourV1['lowTempSuitability'] {
  switch (specSuitability) {
    case 'high':   return 'suitable';
    case 'medium': return 'marginal';
    case 'low':    return 'unsuitable';
    default:       return 'marginal'; // conservative default
  }
}

/**
 * Build the physics model for a heat-pump + cylinder system.
 *
 * @param spec - OutcomeSystemSpec for a 'heat_pump' system.
 * @param outdoorTempC - Outdoor temperature for COP calculation (default +7 °C,
 *                        the EN 14511 standard test condition).
 */
export function buildHeatPumpCylinderBehaviour(
  spec: HeatSourceBehaviourInput,
  outdoorTempC = 7,
): HeatPumpCylinderBehaviourV1 {
  const nominalVolume = spec.hotWaterStorageLitres ?? 250;
  const effectiveUsableVolumeLitres = nominalVolume * CYLINDER_USABLE_VOLUME_FACTOR;
  const storeTargetC = HP_REF_STORE_TEMP_C; // 55 °C typical HP store target

  const cop = computeHpCopForCylinder(outdoorTempC, storeTargetC);

  // Lift penalty factor: ratio of actual COP to reference COP.
  // At cold conditions the COP drops → longer recovery.
  const liftPenaltyFactor = parseFloat((cop / HP_REF_COP).toFixed(3));

  // Effective thermal power = compressor input × COP.
  const effectiveKw = HP_INPUT_KW * cop;

  // Convert kW to L/h: heat to raise 1 L of water by ΔT = (ΔT × cp) kJ per litre.
  const deltaT = CYLINDER_STORE_TARGET_C - COLD_WATER_INLET_C; // 50 °C
  const recoveryRateLph = (effectiveKw * 3600) / (WATER_CP_KJ_PER_KG_K * deltaT);

  // If the spec already declares a recovery rate (from a resimulation or
  // override), respect it; the physics-derived value is used as a fallback.
  const finalRecoveryRateLph = spec.recoveryRateLitresPerHour ?? recoveryRateLph;

  const fullRecoveryHours =
    finalRecoveryRateLph > 0
      ? effectiveUsableVolumeLitres / finalRecoveryRateLph
      : Infinity;

  const lowTempSuitability = mapLowTempSuitability(spec.lowTempSuitability);

  return {
    effectiveUsableVolumeLitres,
    cop,
    recoveryRateLph: finalRecoveryRateLph,
    fullRecoveryHours,
    liftPenaltyFactor,
    lowTempSuitability,
  };
}

// ─── Unified HeatSourceBehaviourV1 ───────────────────────────────────────────

/**
 * Unified heat-source behaviour result for any system type.
 *
 * Exactly one of `combi`, `boilerCylinder`, or `heatPumpCylinder` is
 * populated, matching the `systemType` field.
 */
export interface HeatSourceBehaviourV1 {
  /** The system family this result describes. */
  systemType: HeatSourceBehaviourInput['systemType'];

  /** Populated when systemType is 'combi'. */
  combi?: CombiBehaviourV1;

  /** Populated when systemType is 'stored_water'. */
  boilerCylinder?: BoilerCylinderBehaviourV1;

  /** Populated when systemType is 'heat_pump'. */
  heatPumpCylinder?: HeatPumpCylinderBehaviourV1;
}

/**
 * Build the heat-source behaviour model for the given system spec.
 *
 * Dispatches to the appropriate sub-model based on systemType, then returns
 * a unified HeatSourceBehaviourV1 result ready for consumption by the
 * outcome classifier.
 *
 * @param spec        - System specification from the outcome classifier.
 * @param outdoorTempC - Optional outdoor temperature (°C) for heat-pump COP
 *                       modelling.  Defaults to +7 °C (EN 14511 standard).
 */
export function buildHeatSourceBehaviour(
  spec: HeatSourceBehaviourInput,
  outdoorTempC = 7,
): HeatSourceBehaviourV1 {
  switch (spec.systemType) {
    case 'combi':
      return {
        systemType: 'combi',
        combi: buildCombiBehaviour(spec),
      };
    case 'stored_water':
      return {
        systemType: 'stored_water',
        boilerCylinder: buildBoilerCylinderBehaviour(spec),
      };
    case 'heat_pump':
      return {
        systemType: 'heat_pump',
        heatPumpCylinder: buildHeatPumpCylinderBehaviour(spec, outdoorTempC),
      };
  }
}
