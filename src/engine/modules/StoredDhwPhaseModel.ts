/**
 * StoredDhwPhaseModel.ts — PR4: Stored-water delivery and recharge as separate phases.
 *
 * Implements the core semantic correction for stored-water DHW systems:
 *
 *   Stored systems
 *   1.  tap opens
 *   2.  hot water is delivered from the cylinder / store
 *   3.  store usable energy / temperature drops
 *   4.  controls decide whether recharge is needed
 *   5.  appliance enters DHW reheat mode only if triggered
 *   6.  reheat proceeds as a separate cycle
 *
 * Design rules:
 *   - draw-off is always served from stored state; appliance output never directly
 *     determines immediate tap performance (Rule 1)
 *   - recharge is not automatic at tap-open; it is triggered by threshold / control
 *     logic only (Rule 2)
 *   - recharge is always a separate, distinct phase from the outlet draw (Rule 3)
 *   - heat pump stored paths follow the same indirect logic with family-appropriate
 *     slower recovery characteristics (Rule 4)
 *
 * Combi systems are not served by this module — they use CombiDhwModule exclusively.
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import {
  computeTapMixing,
  defaultStoreTempForRegime,
  BOILER_CYLINDER_STORE_TEMP_C,
  HEAT_PUMP_CYLINDER_STORE_TEMP_C,
  DEFAULT_TAP_TARGET_TEMP_C,
  DEFAULT_COLD_WATER_TEMP_C,
} from '../utils/dhwMixing';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Nominal boiler coil reheat rate (kW) for a clean coil. */
const BOILER_NOMINAL_REHEAT_KW = 12;

/** Typical ASHP compressor input power (kW) for cylinder reheat. */
const HP_COMPRESSOR_INPUT_KW = 2.5;

/** Conservative nominal heat pump COP for cylinder heating (50 °C store target). */
const HP_NOMINAL_DHW_COP = 2.0;

/** Water specific heat capacity (kJ/kg·K). */
const WATER_CP_KJ_PER_KG_K = 4.186;

/** Default cylinder nominal volume (litres) when no survey evidence is provided. */
const DEFAULT_CYLINDER_VOLUME_LITRES = 150;

/** Cylinder thermostat trigger threshold for boiler cylinders (°C).
 *  Reheat begins when store mean temperature drops below this value. */
const BOILER_THERMOSTAT_THRESHOLD_C = 55;

/** Cylinder thermostat trigger threshold for heat pump cylinders (°C). */
const HP_THERMOSTAT_THRESHOLD_C = 45;

/** Default hysteresis band (°C).
 *  In hysteresis_reheat mode, reheat fires when mean drops below
 *  (thermostatThresholdC − hysteresisBandC). */
const DEFAULT_HYSTERESIS_BAND_C = 5;

/** Temperature stratification delta (°C) between storeTopTempC and storeMeanTempC
 *  in a newly charged, stratified cylinder.  In reality this varies with draw
 *  pattern and time since last charge; a fixed 5 °C is a conservative estimate. */
const STRATIFICATION_DELTA_C = 5;

/** Representative peak shower draw flow rate for stored systems (L/min). */
const STORED_SHOWER_FLOW_LPM = 9;

/** Representative peak shower draw flow rate for heat pump stored systems (L/min). */
const HP_SHOWER_FLOW_LPM = 10;

/** Representative shower duration (minutes) for a peak occupancy draw event. */
const PEAK_SHOWER_DURATION_MINUTES = 6;

/** Usable fraction below which priority reheat is always triggered, regardless
 *  of control mode.  At this depletion level the store cannot reliably deliver
 *  the next draw, so the appliance must begin recharging immediately. */
const PRIORITY_REHEAT_USABLE_FRACTION = 0.20;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * How the stored-water system controls DHW recharge.
 *
 *   time_program      — recharge is triggered by a heating programmer / timer.
 *                       Reheat runs in scheduled windows; the cylinder thermostat
 *                       prevents overheating within the window.
 *   thermostat_call   — the cylinder thermostat calls for heat when the store mean
 *                       temperature drops below the set threshold.  Most common
 *                       mode for gas-boiler stored systems.
 *   hysteresis_reheat — reheat fires only when the mean drops below a tighter
 *                       lower bound (threshold − hysteresis band).  Used in
 *                       demand-flexible or smart-control installations to reduce
 *                       unnecessary short-cycling.
 */
export type StoredDhwControlMode = 'time_program' | 'thermostat_call' | 'hysteresis_reheat';

/**
 * Reason why a recharge phase was triggered.
 *
 *   thermostat_threshold  — store mean dropped below the cylinder thermostat threshold.
 *   hysteresis_threshold  — store mean dropped below the hysteresis lower bound.
 *   scheduled_window      — a time-programme window is active and the store needs charging.
 *   priority_reheat       — store depletion is severe enough that immediate reheat is
 *                           required regardless of normal control logic.
 */
export type StoredDhwReheatReason =
  | 'thermostat_threshold'
  | 'hysteresis_threshold'
  | 'scheduled_window'
  | 'priority_reheat';

/**
 * Instantaneous state of a stored hot-water cylinder.
 *
 * Represents the available energy / temperature at a specific moment —
 * for example, immediately before or immediately after a draw-off event.
 */
export interface StoredDhwState {
  /**
   * Volume of hot water available at the usable tap temperature (litres).
   *
   * Accounts for mixing physics: a hotter store delivers more usable mixed
   * volume per stored litre than a cooler store at the same nominal volume.
   *
   *   usableLitres = nominalVolume × (T_store − T_cold) / (T_tap − T_cold)
   */
  usableHotWaterLitres: number;

  /**
   * Temperature of the hottest stratum at the top of the cylinder (°C).
   *
   * In a stratified cylinder the top is the first zone drawn off.  This
   * temperature determines delivered water temperature until the cylinder
   * is significantly depleted.
   */
  storeTopTempC: number;

  /**
   * Volume-weighted mean temperature of the cylinder contents (°C).
   *
   * Used by the thermostat / hysteresis control logic to decide whether
   * to trigger a recharge.  Drops more quickly than storeTopTempC when
   * a draw mixes cold water through the lower strata.
   */
  storeMeanTempC: number;

  /**
   * Whether a recharge (reheat cycle) is currently required.
   *
   * True when one or more of the control conditions has been met:
   *   - thermostat threshold crossed
   *   - hysteresis lower bound crossed
   *   - scheduled window active with store below threshold
   *   - priority reheat condition (severe depletion)
   */
  reheatRequired: boolean;

  /**
   * The reason why a recharge cycle was triggered.
   * Absent when reheatRequired is false.
   */
  reheatTriggerReason?: StoredDhwReheatReason;

  /**
   * Estimated time (minutes) to restore the cylinder to its target charge
   * temperature from the current mean temperature.
   *
   * Derived from recovery rate (L/h) and current depletion:
   *   minutes ≈ depletedLitres / recoveryRateLph × 60
   *
   * Reflects family-appropriate characteristics:
   *   boiler stored  — faster recovery (~12 kW coil → ~200 L/h)
   *   heat pump stored — slower recovery (~2.5 kW × 2 COP = 5 kW → ~100 L/h)
   */
  estimatedRecoveryMinutes: number;
}

/**
 * Result of modelling a single draw-off event from a stored cylinder.
 *
 * The key invariant: delivery comes from the store, not from the appliance.
 * The appliance is only involved later, in a separate recharge phase.
 */
export interface StoredDrawOffResult {
  /**
   * Volume of hot water delivered at the target tap temperature (litres).
   *
   * Clamped to available usable store volume: if the draw exceeds what the
   * cylinder can supply, deliveredVolumeLitres < the requested draw volume.
   */
  deliveredVolumeLitres: number;

  /**
   * Volumetric flow rate at the tap outlet (L/min).
   *
   * For stored systems this is determined by supply pressure and pipe bore,
   * not by appliance output.
   */
  deliveredFlowLpm: number;

  /**
   * Temperature of the delivered water at the tap outlet (°C).
   *
   * Equals tapTargetTempC when the store has sufficient usable volume.
   * May be lower than tapTargetTempC when the store is critically depleted
   * and the remaining water is below the threshold for full mixing.
   */
  deliveredTempC: number;

  /**
   * Volume drawn from the cylinder store (litres of stored hot water, not mixed).
   *
   * Always ≤ the store's nominal volume.  Higher than deliveredVolumeLitres when
   * the store temperature requires less cold dilution (hotter store → more cold
   * bypass per litre of mixed output → fewer store litres depleted per mixed litre).
   */
  storeDepletionLitres: number;

  /**
   * Store state immediately after this draw-off event.
   *
   * Reflects reduced usableHotWaterLitres, lower storeTopTempC and storeMeanTempC,
   * and a fresh assessment of whether recharge is now needed.
   */
  postDrawStoreState: StoredDhwState;

  /**
   * Whether a recharge cycle has been triggered by this draw-off event.
   *
   * This is NOT automatic: recharge fires only when one of the control conditions
   * in postDrawStoreState is satisfied.
   */
  reheatTriggered: boolean;

  /**
   * Reason why reheat was triggered, when applicable.
   * Matches postDrawStoreState.reheatTriggerReason.
   */
  reheatTriggerReason?: StoredDhwReheatReason;

  /**
   * Whether space heating (CH) would be interrupted if a recharge cycle begins now.
   *
   * True only when:
   *   - reheatTriggered is true
   *   - simultaneousChActive is true
   *   - zone control is Y-plan (DHW has priority over CH in the 3-port valve)
   *
   * False for S-plan (independent circuits) or when CH is not active.
   */
  chInterruptedByReheat: boolean;
}

/**
 * Top-level result produced by `runStoredDhwPhaseModel`.
 *
 * Captures the full two-phase semantic picture: delivery from store, then
 * (conditionally) a separate recharge phase.
 */
export interface StoredDhwPhaseResult {
  /**
   * Store state immediately before the modelled draw-off event.
   */
  initialStoreState: StoredDhwState;

  /**
   * Result of modelling the draw-off event.
   */
  drawOffResult: StoredDrawOffResult;

  /**
   * Control mode that governed reheat trigger logic.
   */
  controlMode: StoredDhwControlMode;

  /**
   * Invariant marker: stored systems never use the combi DHW path.
   *
   * This field is always `false`.  It exists as a machine-checkable assertion
   * that the caller can verify to confirm the combi path was not invoked.
   */
  usedCombiDhwPath: false;

  /**
   * Recovery characteristic family — determines the recovery rate used to
   * calculate estimatedRecoveryMinutes.
   *
   *   boiler_stored   — gas boiler coil, faster recovery (~12 kW → ~200 L/h)
   *   heat_pump_stored — heat pump indirect, slower recovery (~5 kW effective → ~100 L/h)
   */
  recoveryCharacteristic: 'boiler_stored' | 'heat_pump_stored';

  /**
   * Cylinder nominal volume used in this computation (litres).
   */
  cylinderVolumeLitres: number;

  /**
   * Recovery rate used to compute estimatedRecoveryMinutes (litres per hour).
   */
  recoveryRateLph: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Compute the cylinder coil recovery rate (L/h) from an effective reheat power (kW).
 *
 *   L/h = (kW × 3600) / (cp × ΔT)
 *
 * ΔT is the temperature rise from cold to store target.
 */
function computeRecoveryRateLph(effectiveReheatKw: number, storeTargetC: number, coldC: number): number {
  const deltaT = storeTargetC - coldC;
  if (deltaT <= 0) return 0;
  return (effectiveReheatKw * 3600) / (WATER_CP_KJ_PER_KG_K * deltaT);
}

/**
 * Compute the usable hot-water volume from stored-cylinder mixing physics.
 *
 *   usableLitres = nominalVolume × (T_store − T_cold) / (T_tap − T_cold)
 *
 * Returns 0 when the store is too cool to reach tap temperature.
 */
function computeUsableHotWaterLitres(
  cylinderVolumeLitres: number,
  storeMeanTempC: number,
  tapTargetTempC: number,
  coldWaterTempC: number,
): number {
  if (storeMeanTempC <= tapTargetTempC) return 0;
  const usableFactor = (storeMeanTempC - coldWaterTempC) / (tapTargetTempC - coldWaterTempC);
  return cylinderVolumeLitres * usableFactor;
}

/**
 * Estimate how many minutes remain until the cylinder is fully recharged,
 * given the current mean temperature and the recovery rate.
 *
 * If the store is already at or above the thermostat threshold, recovery
 * time is zero.  Otherwise it is proportional to the energy deficit.
 */
function computeEstimatedRecoveryMinutes(
  cylinderVolumeLitres: number,
  storeMeanTempC: number,
  storeTargetC: number,
  coldWaterTempC: number,
  recoveryRateLph: number,
): number {
  if (storeMeanTempC >= storeTargetC) return 0;
  if (recoveryRateLph <= 0) return Infinity;
  // Volume equivalent of the temperature deficit
  const tempDeficit = storeTargetC - storeMeanTempC;
  const fullRangeTemp = storeTargetC - coldWaterTempC;
  const proportionalDepletion = cylinderVolumeLitres * (tempDeficit / fullRangeTemp);
  return Math.round((proportionalDepletion / recoveryRateLph) * 60);
}

/**
 * Determine whether a recharge phase is triggered based on the post-draw store
 * state and the active control mode.
 *
 * Rules (evaluated in priority order):
 *   1. Priority reheat   — store usable fraction < PRIORITY_REHEAT_USABLE_FRACTION;
 *                          always fires regardless of control mode.
 *   2. Control-mode gate — thermostat_call / hysteresis_reheat / time_program.
 *
 * Returns the trigger reason, or undefined if no condition is met.
 */
function resolveReheatTrigger(
  postDrawMeanTempC: number,
  cylinderVolumeLitres: number,
  usableHotWaterLitres: number,
  controlMode: StoredDhwControlMode,
  thermostatThresholdC: number,
  hysteresisBandC: number,
  scheduledWindowActive: boolean,
): StoredDhwReheatReason | undefined {
  // Rule 1 — priority reheat (severe depletion regardless of control mode)
  const totalPossibleUsable = computeUsableHotWaterLitres(
    cylinderVolumeLitres,
    thermostatThresholdC, // use threshold as the reference "full" temperature
    DEFAULT_TAP_TARGET_TEMP_C,
    DEFAULT_COLD_WATER_TEMP_C,
  );
  const usableFraction = totalPossibleUsable > 0
    ? usableHotWaterLitres / totalPossibleUsable
    : 0;
  if (usableFraction < PRIORITY_REHEAT_USABLE_FRACTION) {
    return 'priority_reheat';
  }

  // Rule 2 — control-mode gate
  switch (controlMode) {
    case 'thermostat_call':
      if (postDrawMeanTempC < thermostatThresholdC) {
        return 'thermostat_threshold';
      }
      break;

    case 'hysteresis_reheat': {
      const hysteresisLower = thermostatThresholdC - hysteresisBandC;
      if (postDrawMeanTempC < hysteresisLower) {
        return 'hysteresis_threshold';
      }
      break;
    }

    case 'time_program':
      if (scheduledWindowActive && postDrawMeanTempC < thermostatThresholdC) {
        return 'scheduled_window';
      }
      break;
  }

  return undefined;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Input parameters for `runStoredDhwPhaseModel`.
 *
 * Callers (hydronic runners) should derive these from `EngineInputV2_3` via
 * the helper `adaptEngineInputToStoredPhase`.  Direct construction is supported
 * for testing.
 */
export interface StoredDhwPhaseInput {
  /** Nominal cylinder volume (litres). */
  cylinderVolumeLitres: number;
  /** Initial store top temperature (°C) — hottest stratum at start of draw. */
  storeTopTempC: number;
  /** Initial store mean temperature (°C) — volume-weighted average. */
  storeMeanTempC: number;
  /** Volume of hot water requested at tap temperature (litres). */
  drawVolumeLitres: number;
  /** Draw flow rate at the tap outlet (L/min). */
  drawFlowLpm: number;
  /** Target tap temperature (°C). Default: 40. */
  tapTargetTempC?: number;
  /** Cold mains temperature (°C). Default: 10. */
  coldWaterTempC?: number;
  /** Control mode governing recharge trigger logic. Default: 'thermostat_call'. */
  controlMode?: StoredDhwControlMode;
  /** Temperature (°C) at which the cylinder thermostat fires. */
  thermostatThresholdC?: number;
  /** Hysteresis band (°C). Only used in 'hysteresis_reheat' mode. */
  hysteresisBandC?: number;
  /** True when a scheduled heating window is currently active.
   *  Only used in 'time_program' mode. Default: false. */
  scheduledWindowActive?: boolean;
  /**
   * Recovery characteristic — determines reheat rate and recovery time.
   *   'boiler_stored'    — gas boiler coil reheat (~12 kW nominal)
   *   'heat_pump_stored' — heat pump indirect reheat (~5 kW effective)
   */
  recoveryCharacteristic: 'boiler_stored' | 'heat_pump_stored';
  /** True when CH is currently active (affects chInterruptedByReheat). Default: false. */
  simultaneousChActive?: boolean;
  /**
   * Zone control topology for simultaneous CH/DHW.
   * Determines whether a recharge cycle interrupts space heating.
   * Default: 'unknown' (assumed independent, matching HeatSourceBehaviourModel default).
   */
  zoneControlTopology?: 'y_plan' | 's_plan' | 'unknown';
}

/**
 * Build a `StoredDhwPhaseInput` from an `EngineInputV2_3` and a system family.
 *
 * This adapter centralises the derivation logic so that each runner does not
 * duplicate it.
 *
 * @param input          Engine input from the survey layer.
 * @param characteristic Recovery characteristic derived from the runner's family.
 */
export function adaptEngineInputToStoredPhase(
  input: EngineInputV2_3,
  characteristic: 'boiler_stored' | 'heat_pump_stored',
): StoredDhwPhaseInput {
  const tapTargetTempC = input.tapTargetTempC ?? DEFAULT_TAP_TARGET_TEMP_C;
  const coldWaterTempC = input.coldWaterTempC ?? DEFAULT_COLD_WATER_TEMP_C;

  // Resolve store temperature from explicit override → regime → family default.
  const resolvedRegime = input.dhwStorageRegime;
  let storeTargetC: number;
  if (input.storeTempC !== undefined) {
    storeTargetC = input.storeTempC;
  } else if (resolvedRegime) {
    storeTargetC =
      defaultStoreTempForRegime(resolvedRegime) ??
      (characteristic === 'heat_pump_stored' ? HEAT_PUMP_CYLINDER_STORE_TEMP_C : BOILER_CYLINDER_STORE_TEMP_C);
  } else {
    storeTargetC =
      characteristic === 'heat_pump_stored' ? HEAT_PUMP_CYLINDER_STORE_TEMP_C : BOILER_CYLINDER_STORE_TEMP_C;
  }

  // storeTopTempC = target charge temperature; storeMeanTempC ≈ top − stratification delta.
  const storeTopTempC = storeTargetC;
  const storeMeanTempC = Math.max(tapTargetTempC + 1, storeTargetC - STRATIFICATION_DELTA_C);

  // Cylinder volume: prefer explicit cylinderVolumeLitres → dhwStorageLitres → default.
  const cylinderVolumeLitres =
    input.cylinderVolumeLitres ??
    input.dhwStorageLitres ??
    DEFAULT_CYLINDER_VOLUME_LITRES;

  // Representative peak draw: occupancy-weighted shower event.
  const bathroomCount = input.bathroomCount ?? 1;
  const drawFlowLpm =
    characteristic === 'heat_pump_stored' ? HP_SHOWER_FLOW_LPM : STORED_SHOWER_FLOW_LPM;
  // Peak draw: one bathroom per concurrent shower, up to 2 bathrooms.
  const concurrentBaths = Math.min(bathroomCount, 2);
  const drawVolumeLitres = drawFlowLpm * PEAK_SHOWER_DURATION_MINUTES * concurrentBaths;

  // Family-specific thermostat threshold.
  const thermostatThresholdC =
    characteristic === 'heat_pump_stored' ? HP_THERMOSTAT_THRESHOLD_C : BOILER_THERMOSTAT_THRESHOLD_C;

  // Zone control topology from survey data.
  const zoneControlTopology =
    (input as { systemPlanType?: 'y_plan' | 's_plan' }).systemPlanType ?? 'unknown';

  return {
    cylinderVolumeLitres,
    storeTopTempC,
    storeMeanTempC,
    drawVolumeLitres,
    drawFlowLpm,
    tapTargetTempC,
    coldWaterTempC,
    controlMode: 'thermostat_call',
    thermostatThresholdC,
    hysteresisBandC: DEFAULT_HYSTERESIS_BAND_C,
    scheduledWindowActive: false,
    recoveryCharacteristic: characteristic,
    simultaneousChActive: false,
    zoneControlTopology: zoneControlTopology as 'y_plan' | 's_plan' | 'unknown',
  };
}

/**
 * Model stored-water DHW delivery and recharge as two separate phases.
 *
 * Phase 1 — Draw-off from store:
 *   Hot water is served from the cylinder.  Store temperature and usable volume
 *   decrease.  The appliance does not directly serve the tap.
 *
 * Phase 2 — Recharge decision:
 *   After the draw, control logic evaluates whether the store has crossed a
 *   trigger condition.  If yes, a recharge phase is flagged.  The recharge is
 *   a separate, later event — it is not part of the draw-off itself.
 *
 * @param input  Explicit phase model inputs (see `StoredDhwPhaseInput`).
 * @returns      `StoredDhwPhaseResult` describing the two-phase event.
 *
 * @throws {Error}  Never — all edge-case inputs are handled gracefully.
 */
export function runStoredDhwPhaseModel(input: StoredDhwPhaseInput): StoredDhwPhaseResult {
  const tapTargetTempC = input.tapTargetTempC ?? DEFAULT_TAP_TARGET_TEMP_C;
  const coldWaterTempC = input.coldWaterTempC ?? DEFAULT_COLD_WATER_TEMP_C;
  const controlMode: StoredDhwControlMode = input.controlMode ?? 'thermostat_call';
  const thermostatThresholdC =
    input.thermostatThresholdC ??
    (input.recoveryCharacteristic === 'heat_pump_stored'
      ? HP_THERMOSTAT_THRESHOLD_C
      : BOILER_THERMOSTAT_THRESHOLD_C);
  const hysteresisBandC = input.hysteresisBandC ?? DEFAULT_HYSTERESIS_BAND_C;
  const scheduledWindowActive = input.scheduledWindowActive ?? false;
  const simultaneousChActive = input.simultaneousChActive ?? false;
  const zoneControlTopology = input.zoneControlTopology ?? 'unknown';

  // ── Recovery rate ─────────────────────────────────────────────────────────
  const storeTargetC = input.storeTopTempC; // charge target
  const effectiveReheatKw =
    input.recoveryCharacteristic === 'heat_pump_stored'
      ? HP_COMPRESSOR_INPUT_KW * HP_NOMINAL_DHW_COP
      : BOILER_NOMINAL_REHEAT_KW;
  const recoveryRateLph = computeRecoveryRateLph(effectiveReheatKw, storeTargetC, coldWaterTempC);

  // ── Phase 1a: initial store state ─────────────────────────────────────────
  const initialUsableHotWaterLitres = computeUsableHotWaterLitres(
    input.cylinderVolumeLitres,
    input.storeMeanTempC,
    tapTargetTempC,
    coldWaterTempC,
  );
  const initialRecoveryMinutes = computeEstimatedRecoveryMinutes(
    input.cylinderVolumeLitres,
    input.storeMeanTempC,
    storeTargetC,
    coldWaterTempC,
    recoveryRateLph,
  );

  // Initial store state — no recharge required yet (this is before the draw).
  const initialStoreState: StoredDhwState = {
    usableHotWaterLitres: Math.round(initialUsableHotWaterLitres * 10) / 10,
    storeTopTempC: input.storeTopTempC,
    storeMeanTempC: input.storeMeanTempC,
    reheatRequired: false,
    estimatedRecoveryMinutes: initialRecoveryMinutes,
  };

  // ── Phase 1b: compute draw-off from store ─────────────────────────────────
  // The tap is served from stored hot water; the appliance is not involved here.

  // Use tap mixing to find the hot fraction drawn from store.
  const mixing = computeTapMixing({
    storeTempC: input.storeMeanTempC,
    tapTargetTempC,
    coldWaterTempC,
    mixedFlowLpm: input.drawFlowLpm,
  });

  // Hot fraction of each mixed litre that must come from the cylinder.
  const hotFraction = mixing.hotFraction;

  // Clamp delivery to what the store can supply.
  const deliveredVolumeLitres = Math.min(input.drawVolumeLitres, initialUsableHotWaterLitres);
  const actualStoreDepletion = deliveredVolumeLitres * hotFraction;

  // Delivery temperature: full tap target if store can supply; lower if depleted.
  const deliveredTempC = deliveredVolumeLitres >= input.drawVolumeLitres
    ? tapTargetTempC
    : Math.max(
        coldWaterTempC,
        input.storeMeanTempC *
          (deliveredVolumeLitres / Math.max(1, input.drawVolumeLitres)),
      );

  // ── Phase 1c: compute post-draw store state ───────────────────────────────
  // Cold water replaces drawn hot water from the bottom of the cylinder.
  // Mean temperature drops proportionally to the fraction drawn and cooled.
  const tempDropMean =
    actualStoreDepletion * (input.storeMeanTempC - coldWaterTempC) /
    Math.max(1, input.cylinderVolumeLitres);
  const postDrawMeanTempC = Math.max(coldWaterTempC, input.storeMeanTempC - tempDropMean);

  // Top temperature: drops more slowly (stratification preserved until significant depletion).
  const depletionFraction = actualStoreDepletion / Math.max(1, input.cylinderVolumeLitres);
  const topTempDrop = depletionFraction * (input.storeTopTempC - input.storeMeanTempC + STRATIFICATION_DELTA_C);
  const postDrawTopTempC = Math.max(postDrawMeanTempC, input.storeTopTempC - topTempDrop);

  const postDrawUsableHotWaterLitres = computeUsableHotWaterLitres(
    input.cylinderVolumeLitres,
    postDrawMeanTempC,
    tapTargetTempC,
    coldWaterTempC,
  );

  // ── Phase 2: recharge decision ────────────────────────────────────────────
  // Recharge is NOT automatic — it fires only when a trigger condition is met.
  const reheatTriggerReason = resolveReheatTrigger(
    postDrawMeanTempC,
    input.cylinderVolumeLitres,
    postDrawUsableHotWaterLitres,
    controlMode,
    thermostatThresholdC,
    hysteresisBandC,
    scheduledWindowActive,
  );
  const reheatTriggered = reheatTriggerReason !== undefined;

  // Recovery time post-draw
  const postDrawRecoveryMinutes = computeEstimatedRecoveryMinutes(
    input.cylinderVolumeLitres,
    postDrawMeanTempC,
    storeTargetC,
    coldWaterTempC,
    recoveryRateLph,
  );

  const postDrawStoreState: StoredDhwState = {
    usableHotWaterLitres: Math.round(postDrawUsableHotWaterLitres * 10) / 10,
    storeTopTempC: Math.round(postDrawTopTempC * 10) / 10,
    storeMeanTempC: Math.round(postDrawMeanTempC * 10) / 10,
    reheatRequired: reheatTriggered,
    reheatTriggerReason,
    estimatedRecoveryMinutes: postDrawRecoveryMinutes,
  };

  // CH interruption: only when reheat is triggered AND CH is active AND zone is Y-plan.
  const chInterruptedByReheat =
    reheatTriggered && simultaneousChActive && zoneControlTopology === 'y_plan';

  const drawOffResult: StoredDrawOffResult = {
    deliveredVolumeLitres: Math.round(deliveredVolumeLitres * 10) / 10,
    deliveredFlowLpm: input.drawFlowLpm,
    deliveredTempC: Math.round(deliveredTempC * 10) / 10,
    storeDepletionLitres: Math.round(actualStoreDepletion * 10) / 10,
    postDrawStoreState,
    reheatTriggered,
    reheatTriggerReason,
    chInterruptedByReheat,
  };

  return {
    initialStoreState,
    drawOffResult,
    controlMode,
    usedCombiDhwPath: false,
    recoveryCharacteristic: input.recoveryCharacteristic,
    cylinderVolumeLitres: input.cylinderVolumeLitres,
    recoveryRateLph: Math.round(recoveryRateLph * 10) / 10,
  };
}
