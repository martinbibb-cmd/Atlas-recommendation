import type {
  EngineInputV2_3,
  CylinderSizingResult,
  CylinderSizingFlagItem,
  CylinderCurrentPerformance,
  CylinderSizingRecommendation,
  CylinderInstallLocation,
} from '../schema/EngineInputV2_3';
import {
  findDemandPreset,
  resolveTimingOverrides,
} from '../schema/OccupancyPreset';

// ─── Physics constants ────────────────────────────────────────────────────────

/**
 * Specific heat capacity of water times density: 1 kg/L × 4186 J/(kg·°C).
 * Combined into a single constant for the recovery-time formula:
 *   t_min = V × ΔT / (P_kW × RECOVERY_DIVISOR)
 * where RECOVERY_DIVISOR = (3600 s/h) / (4.186 kJ/(kg·°C) × 1.0 kg/L × 60 s/min × 1 kJ/kWh-equivalent)
 *   = 3600 / (4.186 × 60) = 3600 / 251.16 ≈ 14.33   [L·°C / (kW·min)]
 */
const RECOVERY_DIVISOR = 14.33;

/** Density of water (kg/L) used in energy calculations. */
const WATER_DENSITY_KG_PER_L = 1.0;

/** Specific heat capacity of water (kJ / (kg·°C)). */
const WATER_CP_KJ_PER_KG_K = 4.186;

/** Hours in a day — used for kWh/24h standing loss. */
const HOURS_PER_DAY = 24;

// ─── Default temperatures ─────────────────────────────────────────────────────

/** Default store temperature for a boiler-heated cylinder (°C). */
const DEFAULT_BOILER_STORE_TEMP_C = 60;

/** Default store temperature for a heat-pump-heated cylinder (°C). */
const DEFAULT_HP_STORE_TEMP_C = 50;

/** Default cold-water inlet temperature (°C) — UK annual ground-water mean. */
const DEFAULT_COLD_WATER_TEMP_C = 10;

/** Default tap target (mixed) temperature (°C). */
const DEFAULT_TAP_TARGET_TEMP_C = 40;

// ─── Ambient temperatures by installation location ────────────────────────────

/**
 * Annual-mean ambient temperature (°C) by cylinder installation location.
 *
 * Values are conservative full-year averages for the UK context:
 *   airing_cupboard — typically heated by cylinder self-radiation; warm but not as hot as store
 *   utility_room    — heated interior room; moderate and stable
 *   garage          — unheated outbuilding; significantly colder in winter
 *   basement        — cool but relatively stable sub-grade temperature
 *   unknown         — conservative intermediate default
 *
 * Source: BRE guidance and Mixergy/Megaflo installation documentation.
 */
const AMBIENT_TEMP_C: Record<CylinderInstallLocation, number> = {
  airing_cupboard: 20,
  utility_room:    16,
  garage:          10,
  basement:        12,
  unknown:         15,
};

// ─── Heat source assumptions ──────────────────────────────────────────────────

/**
 * Assumed heat source power (kW) when none can be derived from input.
 * Based on a typical UK gas-fired system boiler with an indirect cylinder coil.
 * The coil rating rather than the boiler nameplate limits recovery:
 * most domestic fast-recovery coils are rated 18–20 kW.
 */
const ASSUMED_BOILER_HEAT_SOURCE_KW = 18;

/**
 * Maximum effective coil rating (kW) for typical UK cylinder heat exchangers.
 *
 * Even when a boiler outputs >20 kW, real-world coil/pipe hydraulics constrain
 * the effective heat transfer to the cylinder.  This cap reflects the fast-recovery
 * coil specification on Megaflo Eco / Gledhill StainlessLite HP cylinders.
 */
const MAX_COIL_RATING_KW = 20;

/** Nominal heat source power (kW) for an air-source heat pump. */
const ASSUMED_ASHP_HEAT_SOURCE_KW = 6;

/** Nominal power (kW) for a standard domestic immersion heater. */
const IMMERSION_HEATER_KW = 3;

// ─── Standing loss empirical data ─────────────────────────────────────────────

/**
 * Nominal standing-loss coefficient (W per litre) at a 40 °C ambient-to-store
 * temperature difference.  Calibrated against published product data:
 *   Megaflo Eco 210i (195 L): 59 W at test conditions → 0.302 W/L
 *   Megaflo Eco 125i (137 L): 44 W → 0.321 W/L
 *   Gledhill HP210   (210 L): 62 W → 0.295 W/L
 * Average for a modern factory-insulated cylinder ≈ 0.28 W/L.
 */
const STANDING_LOSS_W_PER_L_STANDARD = 0.28;

/**
 * Nominal standing-loss coefficient (W per litre) for a Mixergy-style cylinder.
 *   Mixergy X 210L: 45 W → 0.214 W/L (better geometry + top-down stratification)
 *   Mixergy X 120L: 39 W → 0.325 W/L (smaller cylinder, surface-area-dominant)
 *   Average for Mixergy product range ≈ 0.22 W/L
 */
const STANDING_LOSS_W_PER_L_MIXERGY = 0.22;

/**
 * Reference ambient-delta-T (°C) at which the standing-loss coefficients above
 * were measured: 60 °C store, 20 °C ambient → ΔT_ref = 40 °C.
 */
const STANDING_LOSS_REF_DELTA_T = 40;

// ─── Usable volume fractions ──────────────────────────────────────────────────

/**
 * Practical usable fraction of a conventional (non-Mixergy) cylinder.
 * Turbulent inlet mixing and stratification degradation mean only ~75 % of the
 * nominal volume can be reliably drawn at or above the usable threshold (≥ 40 °C).
 * Source: industry consensus; BRE / CIBSE guidance.
 */
const USABLE_FRACTION_STANDARD = 0.75;

/**
 * Practical usable fraction for a Mixergy-style top-down stratification cylinder.
 * The inlet diffuser and pump-driven top-slice charging maintain a sharp thermocline,
 * delivering up to 95 % of the nominal volume as usable hot water.
 * Source: Mixergy X product data; independent field measurements (HeatGeek).
 */
const USABLE_FRACTION_MIXERGY = 0.95;

// ─── Standard cylinder sizes ──────────────────────────────────────────────────

/**
 * Standard UK hot-water cylinder nominal volumes (litres).
 * The sizing module rounds the calculated minimum up to the next size in this list
 * so that the recommendation corresponds to a real purchasable product.
 * Includes 400 L to cover large households and heat-pump-optimised cylinders
 * (e.g. Gledhill HP400, suitable for 5+ occupants in ASHP systems).
 */
const STANDARD_CYLINDER_SIZES_L = [120, 150, 180, 210, 250, 300, 400] as const;

// ─── Sizing thresholds ────────────────────────────────────────────────────────

/** Daily hot-water demand per occupant (background demand signal only; not storage sizing basis). */
const DEMAND_L_PER_PERSON_PER_DAY = 55;

/** Daily hot-water demand per extra bathroom (background demand signal only; not storage sizing basis). */
const DEMAND_L_PER_EXTRA_BATHROOM = 30;

/** Mixed litres for one heavy shower draw in the peak window. */
const PEAK_SHOWER_EVENT_L = 40;

/** Mixed litres for a queued follow-on draw within the same peak period. */
const FOLLOW_ON_PEAK_DRAW_L_BY_SEVERITY: Record<'low' | 'medium' | 'high', number> = {
  low:    20,
  medium: 30,
  high:   40,
};

/** Additional overlap reserve per extra bathroom. */
const PEAK_OVERLAP_L_PER_EXTRA_BATHROOM = 15;

/** Bath reserve that can land in the same peak-use window. */
const PEAK_BATH_LOAD_L_BY_INTENSITY = {
  occasional: 25,
  medium:     45,
  high:       80,
} as const;

/** Recovery time Atlas assumes is realistically available between peak draws. */
const EFFECTIVE_RECOVERY_WINDOW_MINS: Record<'low' | 'medium' | 'high', number> = {
  low:    15,
  medium: 10,
  high:   5,
};

/** Only part of the theoretical reheat is practically available before the next draw arrives. */
const RECOVERY_CREDIT_FACTOR = 0.5;

/** Slow-recovery warning threshold (minutes). Cylinders that take longer than this to recover
 * will leave households without hot water for extended periods between draws. */
const SLOW_RECOVERY_THRESHOLD_MINS = 60;

/** High standing-loss warning threshold (kWh/24h). Above this, standing losses are significant. */
const HIGH_STANDING_LOSS_THRESHOLD_KWH = 2.0;

/** Minimum reserve fraction before a concurrent draw is treated as a collapse risk. */
const SIMULTANEOUS_COLLAPSE_RESERVE_FRACTION = 0.15;

/** Approximate top-layer share of usable water in a stratified cylinder. */
const STRATIFIED_TOP_LAYER_FRACTION = 0.55;

/** Approximate top-layer share of usable water in a mixed cylinder. */
const MIXED_TOP_LAYER_FRACTION = 0.25;

/** Search bounds for scenario-derived adequacy sizing. */
const MIN_SCENARIO_VOLUME_L = 40;
const MAX_SCENARIO_VOLUME_L = 400;

type ScenarioProbability = 'low' | 'medium' | 'high';

type ScenarioVerdict = 'adequate' | 'borderline' | 'fail';

interface PeakWindowDrawEvent {
  minute: number;
  volumeL: number;
  label: string;
  concurrentOutlets: number;
}

interface PeakWindowScenario {
  id: 'simultaneous_use' | 'recovery_lag' | 'bath_follow_on';
  label: string;
  probability: ScenarioProbability;
  draws: PeakWindowDrawEvent[];
}

interface ScenarioSimulationResult {
  scenario: PeakWindowScenario;
  verdict: ScenarioVerdict;
  requestedVolumeL: number;
  deliveredVolumeL: number;
  shortfallL: number;
  exhaustionPointMinute: number | null;
  recoveryToTargetMins: number;
  simultaneousUseCollapse: boolean;
  topLayerDepletionMinute: number | null;
  lowestReserveL: number;
  finalReserveL: number;
  usableCapacityL: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round up a volume to the nearest standard cylinder size. */
function roundUpToStandardSize(volumeL: number): number {
  for (const size of STANDARD_CYLINDER_SIZES_L) {
    if (size >= volumeL) return size;
  }
  return STANDARD_CYLINDER_SIZES_L[STANDARD_CYLINDER_SIZES_L.length - 1];
}

/**
 * Recovery time formula from the technical framework:
 *   t_min = V × ΔT / (P_kW × 14.33)
 *
 * Derivation:
 *   Q_kWh = V [L] × ρ [kg/L] × Cp [kJ/(kg·°C)] × ΔT [°C] / 3600 [kJ/kWh]
 *         = V × 1.0 × 4.186 × ΔT / 3600
 *   t_min  = Q_kWh / P_kW × 60
 *           = (V × 4.186 × ΔT / 3600) / P_kW × 60
 *           = V × ΔT × 4.186 × 60 / (3600 × P_kW)
 *           = V × ΔT / (P_kW × 14.33)
 */
function computeRecoveryTimeMins(volumeL: number, deltaTc: number, powerKw: number): number {
  if (powerKw <= 0 || deltaTc <= 0) return Infinity;
  return (volumeL * deltaTc) / (powerKw * RECOVERY_DIVISOR);
}

/**
 * Usable mixed hot-water volume at the tap target temperature.
 *
 * For `usableFraction` of the cylinder volume at `storeTempC`, diluted with cold water
 * to reach `tapTargetTempC`:
 *
 *   V_mixed = V_cylinder × usableFraction
 *             × (storeTempC − coldWaterTempC) / (tapTargetTempC − coldWaterTempC)
 *
 * Physics: conservation of heat in mixing.
 *   V_hot × (T_store − T_tap) = V_cold × (T_tap − T_cold)
 *   → V_mixed = V_hot × (T_store − T_cold) / (T_tap − T_cold)
 */
function computeUsableVolumeMixedL(
  volumeL: number,
  usableFraction: number,
  storeTempC: number,
  tapTargetTempC: number,
  coldWaterTempC: number,
): number {
  const tapDelta = tapTargetTempC - coldWaterTempC;
  if (tapDelta <= 0) return volumeL * usableFraction;
  const storeDelta = storeTempC - coldWaterTempC;
  if (storeDelta <= 0) return 0;
  return volumeL * usableFraction * (storeDelta / tapDelta);
}

/**
 * Standing heat loss (watts) using an empirically-calibrated per-litre coefficient
 * scaled for the actual ambient-to-store temperature difference.
 *
 * Formula: P_loss = coeff_W_per_L × volumeL × (ΔT_actual / ΔT_ref)
 *   where ΔT_actual = storeTempC − ambientTempC
 *         ΔT_ref   = STANDING_LOSS_REF_DELTA_T (40 °C)
 *
 * Also applies the insulation degradation factor (from cylinderInsulationFactor):
 *   P_loss_degraded = P_loss / insulationFactor
 */
function computeStandingLossW(
  volumeL: number,
  storeTempC: number,
  ambientTempC: number,
  coeffWPerL: number,
  insulationFactor: number,
): number {
  const actualDelta = storeTempC - ambientTempC;
  if (actualDelta <= 0) return 0;
  const nominalLoss = coeffWPerL * volumeL * (actualDelta / STANDING_LOSS_REF_DELTA_T);
  return nominalLoss / Math.max(insulationFactor, 0.1);
}

/**
 * Resolve the heat source power (kW) and its provenance.
 *
 * Priority:
 *   1. For ASHP: use assumed ASHP value (6 kW); boilerOutputKw is the space-heating
 *      appliance rating and should not be used for DHW cylinder sizing.
 *   2. For boiler paths: use min(currentBoilerOutputKw, MAX_COIL_RATING_KW) when available.
 *   3. For immersion-only (no heat source type): 3 kW.
 *   4. Otherwise: assume 18 kW (typical system boiler with fast-recovery coil).
 *
 * Backup boost:
 *   When `electricalImmersionBackup` or `pvDiversionEnabled` is true, IMMERSION_HEATER_KW
 *   (3 kW) is added to the primary heat source power (capped at MAX_COIL_RATING_KW) to
 *   model the effective recovery rate when the immersion or PV diverter assists reheat.
 */
function resolveHeatSourcePower(
  input: EngineInputV2_3,
): { powerKw: number; source: 'measured' | 'assumed'; boostedByBackup: boolean } {
  let basePowerKw: number;
  let source: 'measured' | 'assumed';

  if (input.currentHeatSourceType === 'ashp') {
    basePowerKw = ASSUMED_ASHP_HEAT_SOURCE_KW;
    source = 'assumed';
  } else if (
    input.currentHeatSourceType === 'system' ||
    input.currentHeatSourceType === 'regular' ||
    input.currentHeatSourceType === 'combi'
  ) {
    const boilerKw = input.currentBoilerOutputKw ?? input.currentSystem?.boiler?.nominalOutputKw;
    if (boilerKw !== undefined && boilerKw > 0) {
      basePowerKw = Math.min(boilerKw, MAX_COIL_RATING_KW);
      source = 'measured';
    } else {
      basePowerKw = ASSUMED_BOILER_HEAT_SOURCE_KW;
      source = 'assumed';
    }
  } else if (input.dhwStorageRegime === 'heat_pump_cylinder') {
    basePowerKw = ASSUMED_ASHP_HEAT_SOURCE_KW;
    source = 'assumed';
  } else {
    basePowerKw = ASSUMED_BOILER_HEAT_SOURCE_KW;
    source = 'assumed';
  }

  const hasBackup = input.electricalImmersionBackup === true || input.pvDiversionEnabled === true;
  if (hasBackup) {
    return {
      powerKw: Math.min(basePowerKw + IMMERSION_HEATER_KW, MAX_COIL_RATING_KW),
      source,
      boostedByBackup: true,
    };
  }

  return { powerKw: basePowerKw, source, boostedByBackup: false };
}

/**
 * Resolve the effective store temperature (°C) for this input.
 */
function resolveStoreTemp(input: EngineInputV2_3): number {
  if (input.storeTempC !== undefined) return input.storeTempC;
  if (input.dhwStorageRegime === 'heat_pump_cylinder') return DEFAULT_HP_STORE_TEMP_C;
  return DEFAULT_BOILER_STORE_TEMP_C;
}

/**
 * Resolve the ambient temperature (°C) for the installation location.
 */
function resolveAmbientTemp(input: EngineInputV2_3): number {
  const loc: CylinderInstallLocation = input.cylinderInstallLocation ?? 'unknown';
  return AMBIENT_TEMP_C[loc];
}

/**
 * Determine the usable fraction and standing-loss coefficient for the effective
 * cylinder type (Mixergy vs standard).
 */
function resolveCylinderTypeFactors(
  input: EngineInputV2_3,
): {
  usableFraction: number;
  standingLossCoeff: number;
  isMixergy: boolean;
} {
  const isMixergy = input.dhwStorageType === 'mixergy';

  return {
    usableFraction:    isMixergy ? USABLE_FRACTION_MIXERGY    : USABLE_FRACTION_STANDARD,
    standingLossCoeff: isMixergy ? STANDING_LOSS_W_PER_L_MIXERGY : STANDING_LOSS_W_PER_L_STANDARD,
    isMixergy,
  };
}

// ─── Minimum volume formula ───────────────────────────────────────────────────

/**
 * Compute the daily hot-water demand (litres at tap target temperature).
 *   Demand = occupancyCount × 55 L + extraBathroomCount × 30 L
 */
function computeDailyDemandL(occupancyCount: number, bathroomCount: number): number {
  const extraBathroomCount = Math.max(0, bathroomCount - 1);
  return (
    occupancyCount * DEMAND_L_PER_PERSON_PER_DAY +
    extraBathroomCount * DEMAND_L_PER_EXTRA_BATHROOM
  );
}

function resolveBathFrequencyPerWeek(input: EngineInputV2_3): number {
  const presetId = input.demandPreset;
  const preset = presetId ? findDemandPreset(presetId) : undefined;
  const timingOverrides = presetId
    ? resolveTimingOverrides(presetId, input.demandTimingOverrides)
    : undefined;

  return input.demandTimingOverrides?.bathFrequencyPerWeek
    ?? timingOverrides?.bathFrequencyPerWeek
    ?? preset?.defaults.bathFrequencyPerWeek
    ?? 2;
}

function resolvePeakConcurrentOutlets(
  input: EngineInputV2_3,
  bathroomCount: number,
): number {
  if ((input.peakConcurrentOutlets ?? 0) > 0) return input.peakConcurrentOutlets!;
  return bathroomCount >= 2 ? 2 : 1;
}

function resolvePeakBathLoadL(bathFrequencyPerWeek: number): number {
  if (bathFrequencyPerWeek >= 4) return PEAK_BATH_LOAD_L_BY_INTENSITY.high;
  if (bathFrequencyPerWeek >= 2) return PEAK_BATH_LOAD_L_BY_INTENSITY.medium;
  if (bathFrequencyPerWeek >= 1) return PEAK_BATH_LOAD_L_BY_INTENSITY.occasional;
  return 0;
}

function computePeakWindowDemandL(params: {
  occupancyCount: number;
  bathroomCount: number;
  peakConcurrentOutlets: number;
  drawSeverity: 'low' | 'medium' | 'high';
  bathPeakLoadL: number;
}): number {
  const {
    occupancyCount,
    bathroomCount,
    peakConcurrentOutlets,
    drawSeverity,
    bathPeakLoadL,
  } = params;

  const peakWindowUsers = Math.max(1, Math.min(occupancyCount, peakConcurrentOutlets + 1));
  const overlappingDrawL = peakConcurrentOutlets * PEAK_SHOWER_EVENT_L;
  const queuedDrawL =
    Math.max(0, peakWindowUsers - peakConcurrentOutlets) *
    FOLLOW_ON_PEAK_DRAW_L_BY_SEVERITY[drawSeverity];
  const bathroomOverlapReserveL =
    Math.max(0, bathroomCount - 1) * PEAK_OVERLAP_L_PER_EXTRA_BATHROOM;

  return overlappingDrawL + queuedDrawL + bathroomOverlapReserveL + bathPeakLoadL;
}

function resolveRecoveryCreditWindowMins(
  recoveryWindowMins: number,
  drawSeverity: 'low' | 'medium' | 'high',
): number {
  return Math.min(recoveryWindowMins, EFFECTIVE_RECOVERY_WINDOW_MINS[drawSeverity]);
}

function computeRecoveredMixedVolumeWithinWindowL(params: {
  heatSourceKw: number;
  recoveryWindowMins: number;
  storeTempC: number;
  tapTargetTempC: number;
  coldWaterTempC: number;
  usableFraction: number;
}): number {
  const {
    heatSourceKw,
    recoveryWindowMins,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
    usableFraction,
  } = params;
  const storeDelta = storeTempC - coldWaterTempC;
  if (heatSourceKw <= 0 || recoveryWindowMins <= 0 || storeDelta <= 0) return 0;
  const recoveredNominalVolumeL = (heatSourceKw * RECOVERY_DIVISOR * recoveryWindowMins) / storeDelta;
  return computeUsableVolumeMixedL(
    recoveredNominalVolumeL,
    usableFraction,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
  );
}

function probabilityRank(probability: ScenarioProbability): number {
  if (probability === 'high') return 3;
  if (probability === 'medium') return 2;
  return 1;
}

function computeRecoveryTargetReserveL(
  usableCapacityL: number,
  scenario: PeakWindowScenario,
  isStratified: boolean,
): number {
  const largestDrawL = Math.max(...scenario.draws.map((draw) => draw.volumeL));
  const capacityFractionReserve = usableCapacityL * (isStratified ? 0.15 : 0.2);
  return Math.min(
    usableCapacityL,
    Math.max(
      PEAK_SHOWER_EVENT_L,
      Math.min(largestDrawL, PEAK_SHOWER_EVENT_L * 2),
      capacityFractionReserve,
    ),
  );
}

function buildPeakWindowScenarios(params: {
  occupancyCount: number;
  bathroomCount: number;
  peakConcurrentOutlets: number;
  bathPeakLoadL: number;
  drawSeverity: 'low' | 'medium' | 'high';
  effectiveRecoveryWindowMins: number;
}): PeakWindowScenario[] {
  const {
    occupancyCount,
    bathroomCount,
    peakConcurrentOutlets,
    bathPeakLoadL,
    drawSeverity,
    effectiveRecoveryWindowMins,
  } = params;

  const overlapReserveL = Math.max(0, bathroomCount - 1) * PEAK_OVERLAP_L_PER_EXTRA_BATHROOM;
  const concurrentDrawL = peakConcurrentOutlets * PEAK_SHOWER_EVENT_L + overlapReserveL;
  const followOnDrawL = FOLLOW_ON_PEAK_DRAW_L_BY_SEVERITY[drawSeverity];
  const simultaneousProbability: ScenarioProbability =
    peakConcurrentOutlets >= 3 || drawSeverity === 'high'
      ? 'high'
      : peakConcurrentOutlets >= 2 || bathroomCount >= 2
      ? 'medium'
      : 'low';
  const recoveryProbability: ScenarioProbability =
    occupancyCount >= 4 || drawSeverity === 'high'
      ? 'high'
      : occupancyCount >= 2
      ? 'medium'
      : 'low';

  const scenarios: PeakWindowScenario[] = [
    {
      id: 'simultaneous_use',
      label: 'simultaneous shower overlap',
      probability: simultaneousProbability,
      draws: [
        {
          minute: 0,
          volumeL: concurrentDrawL,
          label: `${peakConcurrentOutlets} overlapping outlet(s)`,
          concurrentOutlets: peakConcurrentOutlets,
        },
        ...(occupancyCount > peakConcurrentOutlets
          ? [{
              minute: Math.max(4, Math.round(effectiveRecoveryWindowMins / 2)),
              volumeL: followOnDrawL,
              label: 'queued follow-on draw',
              concurrentOutlets: 1,
            }]
          : []),
      ],
    },
    {
      id: 'recovery_lag',
      label: 'back-to-back recovery window',
      probability: recoveryProbability,
      draws: [
        {
          minute: 0,
          volumeL: Math.max(PEAK_SHOWER_EVENT_L, concurrentDrawL - Math.max(0, bathPeakLoadL * 0.25)),
          label: 'first peak draw',
          concurrentOutlets: Math.max(1, peakConcurrentOutlets),
        },
        {
          minute: effectiveRecoveryWindowMins,
          volumeL: followOnDrawL + Math.max(0, occupancyCount - peakConcurrentOutlets - 1) * 10,
          label: 'follow-on draw after recovery window',
          concurrentOutlets: 1,
        },
      ],
    },
  ];

  if (bathPeakLoadL > 0) {
    scenarios.push({
      id: 'bath_follow_on',
      label: 'bath after showers',
      probability: bathPeakLoadL >= PEAK_BATH_LOAD_L_BY_INTENSITY.high
        ? 'medium'
        : 'low',
      draws: [
        {
          minute: 0,
          volumeL: Math.max(PEAK_SHOWER_EVENT_L, concurrentDrawL - PEAK_SHOWER_EVENT_L),
          label: 'initial shower demand',
          concurrentOutlets: Math.max(1, peakConcurrentOutlets - 1),
        },
        {
          minute: effectiveRecoveryWindowMins,
          volumeL: bathPeakLoadL,
          label: 'bath draw',
          concurrentOutlets: 1,
        },
      ],
    });
  }

  return scenarios;
}

function simulatePeakWindowScenario(params: {
  scenario: PeakWindowScenario;
  volumeL: number;
  heatSourceKw: number;
  storeTempC: number;
  tapTargetTempC: number;
  coldWaterTempC: number;
  usableFraction: number;
  isStratified: boolean;
  effectiveRecoveryWindowMins: number;
}): ScenarioSimulationResult {
  const {
    scenario,
    volumeL,
    heatSourceKw,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
    usableFraction,
    isStratified,
    effectiveRecoveryWindowMins,
  } = params;

  const usableCapacityL = computeUsableVolumeMixedL(
    volumeL,
    usableFraction,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
  );
  const recoveryRateMixedLPerMin = computeRecoveredMixedVolumeWithinWindowL({
    heatSourceKw,
    recoveryWindowMins: 1,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
    usableFraction,
  });
  const topLayerCapacityL = usableCapacityL * (isStratified ? STRATIFIED_TOP_LAYER_FRACTION : MIXED_TOP_LAYER_FRACTION);
  const topLayerRecoveryFactor = isStratified ? 1.0 : 0.45;

  let availableL = usableCapacityL;
  let topLayerL = topLayerCapacityL;
  let deliveredVolumeL = 0;
  let requestedVolumeL = 0;
  let shortfallL = 0;
  let exhaustionPointMinute: number | null = null;
  let simultaneousUseCollapse = false;
  let topLayerDepletionMinute: number | null = null;
  let lowestReserveL = usableCapacityL;
  let previousMinute = 0;

  for (const draw of scenario.draws) {
    const deltaMins = Math.max(0, draw.minute - previousMinute);
    if (deltaMins > 0) {
      const recoveredL = recoveryRateMixedLPerMin * deltaMins;
      availableL = Math.min(usableCapacityL, availableL + recoveredL);
      topLayerL = Math.min(topLayerCapacityL, topLayerL + recoveredL * topLayerRecoveryFactor);
    }

    requestedVolumeL += draw.volumeL;
    const topLayerBeforeDrawL = topLayerL;
    const servedL = Math.min(availableL, draw.volumeL);
    const eventShortfallL = Math.max(0, draw.volumeL - servedL);
    deliveredVolumeL += servedL;
    shortfallL += eventShortfallL;

    availableL -= servedL;
    lowestReserveL = Math.min(lowestReserveL, availableL);

    const topLayerServedL = Math.min(topLayerL, servedL);
    topLayerL = Math.max(0, topLayerL - topLayerServedL);
    if (topLayerDepletionMinute === null && topLayerCapacityL > 0 && topLayerL <= 0) {
      topLayerDepletionMinute = draw.minute;
    }

    if (eventShortfallL > 0 && exhaustionPointMinute === null) {
      exhaustionPointMinute = draw.minute;
    }

    if (
      draw.concurrentOutlets >= 2 &&
      (
        eventShortfallL > 0 ||
        topLayerBeforeDrawL < draw.volumeL * 0.5 ||
        availableL <= usableCapacityL * SIMULTANEOUS_COLLAPSE_RESERVE_FRACTION
      )
    ) {
      simultaneousUseCollapse = true;
    }

    previousMinute = draw.minute;
  }

  const targetUsableL = computeRecoveryTargetReserveL(usableCapacityL, scenario, isStratified);
  const recoveryToTargetMins =
    availableL >= targetUsableL
      ? 0
      : recoveryRateMixedLPerMin > 0
      ? Math.ceil((targetUsableL - availableL) / recoveryRateMixedLPerMin)
      : Infinity;
  const recoveryLagLimitMins = Math.max(
    15,
    Math.ceil(effectiveRecoveryWindowMins * (scenario.probability === 'high' ? 1.5 : scenario.probability === 'medium' ? 2 : 2.5)),
  );

  let verdict: ScenarioVerdict = 'adequate';
  if (shortfallL > 0) {
    verdict = probabilityRank(scenario.probability) >= 2 ? 'fail' : 'borderline';
  } else if (simultaneousUseCollapse || recoveryToTargetMins > recoveryLagLimitMins) {
    verdict = probabilityRank(scenario.probability) >= 2 && simultaneousUseCollapse ? 'fail' : 'borderline';
  }

  return {
    scenario,
    verdict,
    requestedVolumeL,
    deliveredVolumeL,
    shortfallL: Math.round(shortfallL * 10) / 10,
    exhaustionPointMinute,
    recoveryToTargetMins,
    simultaneousUseCollapse,
    topLayerDepletionMinute: isStratified ? topLayerDepletionMinute : null,
    lowestReserveL: Math.round(lowestReserveL * 10) / 10,
    finalReserveL: Math.round(availableL * 10) / 10,
    usableCapacityL: Math.round(usableCapacityL * 10) / 10,
  };
}

function evaluateScenarioResults(
  results: ScenarioSimulationResult[],
): ScenarioVerdict {
  if (results.some(result =>
    result.verdict === 'fail' && probabilityRank(result.scenario.probability) >= 2,
  )) {
    return 'fail';
  }
  if (results.some(result => result.verdict !== 'adequate')) {
    return 'borderline';
  }
  return 'adequate';
}

function pickScenarioEvidence(results: ScenarioSimulationResult[]): ScenarioSimulationResult {
  const rank = (result: ScenarioSimulationResult): number => {
    if (result.verdict === 'fail') return 300 + probabilityRank(result.scenario.probability);
    if (result.verdict === 'borderline') return 200 + probabilityRank(result.scenario.probability);
    return 100 + probabilityRank(result.scenario.probability);
  };

  return [...results].sort((left, right) => {
    const verdictDelta = rank(right) - rank(left);
    if (verdictDelta !== 0) return verdictDelta;
    if (left.shortfallL !== right.shortfallL) return right.shortfallL - left.shortfallL;
    if (left.recoveryToTargetMins !== right.recoveryToTargetMins) {
      return right.recoveryToTargetMins - left.recoveryToTargetMins;
    }
    return left.lowestReserveL - right.lowestReserveL;
  })[0];
}

/**
 * Compute the minimum cylinder nominal volume (litres) required to satisfy the
 * explicit peak-window scenarios that are likely for the surveyed household.
 */
function computeMinimumCylinderVolumeL(params: {
  occupancyCount: number;
  bathroomCount: number;
  peakConcurrentOutlets?: number;
  bathPeakLoadL?: number;
  heatSourceKw?: number;
  recoveryWindowMins?: number;
  storeTempC: number;
  tapTargetTempC: number;
  coldWaterTempC: number;
  usableFraction: number;
  drawSeverity: 'low' | 'medium' | 'high';
}): number {
  const {
    occupancyCount,
    bathroomCount,
    peakConcurrentOutlets = 1,
    bathPeakLoadL = 0,
    heatSourceKw = ASSUMED_BOILER_HEAT_SOURCE_KW,
    recoveryWindowMins = 60,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
    usableFraction,
    drawSeverity,
  } = params;
  const effectiveRecoveryWindowMins = resolveRecoveryCreditWindowMins(
    recoveryWindowMins,
    drawSeverity,
  );
  const scenarios = buildPeakWindowScenarios({
    occupancyCount,
    bathroomCount,
    peakConcurrentOutlets,
    bathPeakLoadL,
    drawSeverity,
    effectiveRecoveryWindowMins,
  });
  const isStratified = usableFraction >= USABLE_FRACTION_MIXERGY;

  for (let candidateVolumeL = MIN_SCENARIO_VOLUME_L; candidateVolumeL <= MAX_SCENARIO_VOLUME_L; candidateVolumeL += 1) {
    const results = scenarios.map((scenario) =>
      simulatePeakWindowScenario({
        scenario,
        volumeL: candidateVolumeL,
        heatSourceKw,
        storeTempC,
        tapTargetTempC,
        coldWaterTempC,
        usableFraction,
        isStratified,
        effectiveRecoveryWindowMins,
      }),
    );
    if (evaluateScenarioResults(results) === 'adequate') {
      return candidateVolumeL;
    }
  }

  return MAX_SCENARIO_VOLUME_L;
}

// ─── CylinderSizingModule public API ─────────────────────────────────────────

/**
 * CylinderSizingModule
 *
 * Physics-based cylinder performance gauging and sizing recommendation.
 *
 * ## Core equations
 *
 * **Recovery time** (from technical framework §3):
 *   t_min = V × ΔT / (P_kW × 14.33)
 *   where V = nominal volume (L), ΔT = store − cold inlet (°C), P_kW = heat source power.
 *
 * **Standing loss** (calibrated against product data):
 *   P_loss_W = coeff × V × (ΔT_ambient / 40) / insulationFactor
 *   where ΔT_ambient = store − ambient (°C), coeff = 0.28 W/L (standard), 0.22 W/L (Mixergy).
 *
 * **Usable mixed volume** (mixing physics):
 *   V_mixed = V × usableFraction × (T_store − T_cold) / (T_tap − T_cold)
 *   Usable fraction: 0.75 (standard), 0.95 (Mixergy).
 *
 * **Minimum cylinder volume**:
 *   Demand = peak-use window + follow-on peak users − realistic recovery credit
 *   V_min = (Demand × (T_tap − T_cold) / (T_store − T_cold)) / usableFraction × reserveFactor
 *   Rounded up to the nearest standard size from [120, 150, 180, 210, 250, 300, 400] L.
 */
export function runCylinderSizingModule(input: EngineInputV2_3): CylinderSizingResult {
  const flags: CylinderSizingFlagItem[] = [];
  const assumptions: string[] = [];

  // ── Resolve physics inputs ────────────────────────────────────────────────
  const storeTempC      = resolveStoreTemp(input);
  const coldWaterTempC  = input.coldWaterTempC  ?? DEFAULT_COLD_WATER_TEMP_C;
  const tapTargetTempC  = input.tapTargetTempC  ?? DEFAULT_TAP_TARGET_TEMP_C;
  const ambientTempC    = resolveAmbientTemp(input);
  const occupancyCount  = input.occupancyCount  ?? (input.highOccupancy ? 4 : 2);
  const bathroomCount   = input.bathroomCount   ?? 1;
  const drawSeverity    = input.simultaneousDrawSeverity ?? 'low';
  const insulationFactor = input.cylinderInsulationFactor ?? 1.0;
  const isHpRegime      = input.dhwStorageRegime === 'heat_pump_cylinder';
  const recoveryWindowMins = isHpRegime ? 120 : 60;
  const bathFrequencyPerWeek = resolveBathFrequencyPerWeek(input);
  const bathPeakLoadL = resolvePeakBathLoadL(bathFrequencyPerWeek);
  const peakConcurrentOutlets = resolvePeakConcurrentOutlets(input, bathroomCount);
  const effectiveRecoveryWindowMins = resolveRecoveryCreditWindowMins(
    recoveryWindowMins,
    drawSeverity,
  );

  const { powerKw: heatSourceKw, source: heatSourceSource, boostedByBackup } = resolveHeatSourcePower(input);
  const { usableFraction, standingLossCoeff, isMixergy } = resolveCylinderTypeFactors(input);

  // Record assumptions
  assumptions.push(
    `Store temperature: ${storeTempC} °C ` +
    `(${input.storeTempC !== undefined ? 'user-specified' : isHpRegime ? 'default HP cylinder' : 'default boiler cylinder'}).`,
  );
  assumptions.push(
    `Cold-water inlet: ${coldWaterTempC} °C ` +
    `(${input.coldWaterTempC !== undefined ? 'user-specified' : 'UK ground-water mean'}).`,
  );
  assumptions.push(`Tap target: ${tapTargetTempC} °C.`);
  assumptions.push(
    `Ambient temperature: ${ambientTempC} °C ` +
    `(location: ${input.cylinderInstallLocation ?? 'unknown'}).`,
  );
  assumptions.push(
    `Heat source: ${heatSourceKw} kW ` +
    `(${heatSourceSource === 'measured' ? 'from boiler output' : 'assumed typical'}` +
    `${boostedByBackup ? `, boosted by +${IMMERSION_HEATER_KW} kW ${input.electricalImmersionBackup ? 'immersion backup' : ''}${input.electricalImmersionBackup && input.pvDiversionEnabled ? ' + ' : ''}${input.pvDiversionEnabled ? 'PV diverter' : ''}` : ''}).`,
  );
  assumptions.push(
    `Peak demand assumption: ${peakConcurrentOutlets} likely overlapping outlet(s) ` +
    `with ${bathroomCount} bathroom(s) shaping overlap risk${bathPeakLoadL > 0 ? ` and ~${bathPeakLoadL} L bath reserve` : ''}.`,
  );
  assumptions.push(
    `Recovery credit: ${effectiveRecoveryWindowMins} min of reheat assumed between peak draws ` +
    `(from a ${recoveryWindowMins} min base window, counted as a partial reserve rather than full tank recovery).`,
  );
  assumptions.push(
    `Cylinder type: ${isMixergy ? 'Mixergy (usable fraction 95%)' : 'standard (usable fraction 75%)'}.`,
  );
  if (insulationFactor < 1.0) {
    assumptions.push(
      `Insulation degradation factor: ${insulationFactor.toFixed(2)} ` +
      `(standing losses elevated by ~${Math.round((1 / insulationFactor - 1) * 100)} %).`,
    );
  }

  if (heatSourceSource === 'assumed') {
    flags.push({
      id: 'sizing-no-heat-source-data',
      severity: 'info',
      title: 'Recovery time based on assumed heat source power',
      detail:
        `No measured heat source power was available — recovery time uses an assumed ` +
        `${heatSourceKw} kW ${isHpRegime ? '(air-source heat pump)' : '(typical system boiler)'}. ` +
        `Confirm the boiler or heat pump output rating to obtain an accurate recovery time.`,
    });
  }

  // ── Recommended cylinder type (determined first so volume uses the right usable fraction) ──
  // The recommended type drives the usable fraction used for minimum-volume calculation,
  // ensuring the sizing recommendation is physics-consistent with the proposed product.
  const isHighDemand      = bathroomCount >= 2 || occupancyCount >= 4;
  const isSpaceTight      = input.availableSpace === 'tight';
  const recommendedType: CylinderSizingRecommendation['cylinderType'] = isHpRegime
    ? 'heat_pump_optimised'
    : isHighDemand || isSpaceTight
    ? 'mixergy'
    : 'standard';

  // Usable fraction and standing-loss coefficient for the RECOMMENDED cylinder type.
  // Mixergy cylinders use top-down stratification → higher usable fraction.
  // Heat-pump-optimised and standard cylinders use conventional inlet design → standard fraction.
  const recUsableFraction = recommendedType === 'mixergy' ? USABLE_FRACTION_MIXERGY : USABLE_FRACTION_STANDARD;
  const recStandingCoeff  = recommendedType === 'mixergy' ? STANDING_LOSS_W_PER_L_MIXERGY : STANDING_LOSS_W_PER_L_STANDARD;
  const recommendedIsStratified = recommendedType === 'mixergy';
  const peakWindowScenarios = buildPeakWindowScenarios({
    occupancyCount,
    bathroomCount,
    peakConcurrentOutlets,
    bathPeakLoadL,
    drawSeverity,
    effectiveRecoveryWindowMins,
  });

  // ── Minimum required volume (using recommended cylinder's usable fraction) ────
  const minimumRawL = computeMinimumCylinderVolumeL({
    occupancyCount,
    bathroomCount,
    peakConcurrentOutlets,
    bathPeakLoadL,
    heatSourceKw,
    recoveryWindowMins,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
    usableFraction: recUsableFraction,
    drawSeverity,
  });
  const minimumScenarioResults = peakWindowScenarios.map((scenario) =>
    simulatePeakWindowScenario({
      scenario,
      volumeL: minimumRawL,
      heatSourceKw,
      storeTempC,
      tapTargetTempC,
      coldWaterTempC,
      usableFraction: recUsableFraction,
      isStratified: recommendedIsStratified,
      effectiveRecoveryWindowMins,
    }),
  );
  const minimumScenarioEvidence = pickScenarioEvidence(minimumScenarioResults);
  const peakWindowDemandL = computePeakWindowDemandL({
    occupancyCount,
    bathroomCount,
    peakConcurrentOutlets,
    drawSeverity,
    bathPeakLoadL,
  });
  const recoveredMixedVolumeWithinWindowL = computeRecoveredMixedVolumeWithinWindowL({
    heatSourceKw,
    recoveryWindowMins: effectiveRecoveryWindowMins,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
    usableFraction: recUsableFraction,
  });
  const practicalRecoveryCreditL = recoveredMixedVolumeWithinWindowL * RECOVERY_CREDIT_FACTOR;

  const minimumVolumeL = roundUpToStandardSize(minimumRawL);

  assumptions.push(
    `Minimum volume (raw): ${minimumRawL.toFixed(1)} L → ` +
    `rounded to nearest standard size: ${minimumVolumeL} L ` +
    `(${occupancyCount} occupant(s), ${bathroomCount} bathroom(s), ` +
    `${drawSeverity} simultaneous-draw severity, ` +
    `${peakWindowDemandL.toFixed(0)} L peak-window demand, ` +
    `${practicalRecoveryCreditL.toFixed(0)} L practical recovery credit from ${recoveredMixedVolumeWithinWindowL.toFixed(0)} L reheated within ${effectiveRecoveryWindowMins} min, ` +
    `${recUsableFraction * 100} % usable fraction for ${recommendedType} cylinder type).`,
  );
  assumptions.push(
    `Scenario evidence: ${minimumScenarioEvidence.scenario.label} (${minimumScenarioEvidence.scenario.probability} probability) ` +
    `${minimumScenarioEvidence.exhaustionPointMinute === null
    ? `keeps usable hot water available with a ${minimumScenarioEvidence.lowestReserveL.toFixed(0)} L lowest reserve`
    : `exhausts usable hot water at ~${minimumScenarioEvidence.exhaustionPointMinute} min`} ` +
    `and recovers the target reserve in ` +
    `${Number.isFinite(minimumScenarioEvidence.recoveryToTargetMins) ? `${minimumScenarioEvidence.recoveryToTargetMins} min` : 'no practical time'}.`,
  );

  // ── Recommend target volume ────────────────────────────────────────────────
  let targetVolumeL = minimumVolumeL;
  if (
    minimumScenarioEvidence.lowestReserveL <= minimumScenarioEvidence.usableCapacityL * 0.12 ||
    minimumScenarioEvidence.recoveryToTargetMins > Math.max(20, effectiveRecoveryWindowMins * 1.5) ||
    minimumScenarioEvidence.verdict !== 'adequate'
  ) {
    const currentIdx = STANDARD_CYLINDER_SIZES_L.indexOf(minimumVolumeL as typeof STANDARD_CYLINDER_SIZES_L[number]);
    if (currentIdx >= 0 && currentIdx < STANDARD_CYLINDER_SIZES_L.length - 1) {
    targetVolumeL = STANDARD_CYLINDER_SIZES_L[currentIdx + 1];
    }
  }

  const targetScenarioResults = peakWindowScenarios.map((scenario) =>
    simulatePeakWindowScenario({
      scenario,
      volumeL: targetVolumeL,
      heatSourceKw,
      storeTempC,
      tapTargetTempC,
      coldWaterTempC,
      usableFraction: recUsableFraction,
      isStratified: recommendedIsStratified,
      effectiveRecoveryWindowMins,
    }),
  );
  const recommendationEvidence = pickScenarioEvidence(targetScenarioResults);
  const hasBathScenarioEvidence = peakWindowScenarios.some((scenario) => scenario.id === 'bath_follow_on');
  const maxScenarioRequestL = Math.max(...targetScenarioResults.map((result) => result.requestedVolumeL));
  const requiresComfortUplift =
    recommendationEvidence.verdict !== 'adequate' ||
    recommendationEvidence.lowestReserveL <= recommendationEvidence.usableCapacityL * 0.12 ||
    recommendationEvidence.recoveryToTargetMins > Math.max(20, effectiveRecoveryWindowMins * 1.5) ||
    maxScenarioRequestL >= 110 ||
    (hasBathScenarioEvidence && maxScenarioRequestL >= 100);

  if (requiresComfortUplift && targetVolumeL === minimumVolumeL) {
    const currentIdx = STANDARD_CYLINDER_SIZES_L.indexOf(targetVolumeL as typeof STANDARD_CYLINDER_SIZES_L[number]);
    if (currentIdx >= 0 && currentIdx < STANDARD_CYLINDER_SIZES_L.length - 1) {
      targetVolumeL = STANDARD_CYLINDER_SIZES_L[currentIdx + 1];
    }
  }

  const adjustedTargetScenarioResults = targetVolumeL === minimumVolumeL
    ? targetScenarioResults
    : peakWindowScenarios.map((scenario) =>
        simulatePeakWindowScenario({
          scenario,
          volumeL: targetVolumeL,
          heatSourceKw,
          storeTempC,
          tapTargetTempC,
          coldWaterTempC,
          usableFraction: recUsableFraction,
          isStratified: recommendedIsStratified,
          effectiveRecoveryWindowMins,
        }),
      );
  const adjustedRecommendationEvidence = pickScenarioEvidence(adjustedTargetScenarioResults);

  // ── Recommendation performance estimates ──────────────────────────────────
  const recDeltaT = storeTempC - coldWaterTempC;
  const recRecoveryMins = computeRecoveryTimeMins(targetVolumeL, recDeltaT, heatSourceKw);
  const recStandingLossW = computeStandingLossW(
    targetVolumeL, storeTempC, ambientTempC, recStandingCoeff, 1.0,
  );
  const recStandingLossKwh = (recStandingLossW * HOURS_PER_DAY) / 1000;
  const recUsableL = computeUsableVolumeMixedL(
    targetVolumeL, recUsableFraction, storeTempC, tapTargetTempC, coldWaterTempC,
  );

  // ── Recommendation reasoning ───────────────────────────────────────────────
  const reasoning: string[] = [];

  reasoning.push(
    `Peak hot-water window scenario "${adjustedRecommendationEvidence.scenario.label}" (${adjustedRecommendationEvidence.scenario.probability} probability) ` +
    `${adjustedRecommendationEvidence.exhaustionPointMinute === null
      ? `keeps usable hot water available throughout the peak window`
      : `exhausts usable hot water at about ${adjustedRecommendationEvidence.exhaustionPointMinute} min`} ` +
    `for ${occupancyCount} occupant(s), ${bathroomCount} bathroom(s), and ${peakConcurrentOutlets} likely overlapping outlet(s).`,
  );
  reasoning.push(
    `Usable hot-water reserve bottoms out at about ${adjustedRecommendationEvidence.lowestReserveL.toFixed(0)} L ` +
    `and returns to the target reserve in ` +
    `${Number.isFinite(adjustedRecommendationEvidence.recoveryToTargetMins) ? `${adjustedRecommendationEvidence.recoveryToTargetMins} min` : 'no practical time'}, ` +
    `with reheated volume within the window materially shaping adequacy instead of all-day litres.`,
  );
  reasoning.push(
    `Store temperature ${storeTempC} °C and ${recUsableFraction * 100} % usable fraction ` +
    `support a scenario-derived minimum of ${minimumRawL.toFixed(0)} L, rounded to ${minimumVolumeL} L nominal.`,
  );
  if (recommendedType === 'mixergy' && adjustedRecommendationEvidence.topLayerDepletionMinute !== null) {
    reasoning.push(
      `Top-layer depletion occurs at about ${adjustedRecommendationEvidence.topLayerDepletionMinute} min in the stratified scenario trace, ` +
      `but top-down recovery preserves usable hot water longer than a mixed cylinder and can justify smaller storage.`,
    );
  } else if (recommendedType === 'heat_pump_optimised') {
    reasoning.push(
      `Heat-pump-optimised cylinder required: the lower store temperature (${storeTempC} °C) ` +
      `reduces the usable hot-water fraction per litre — specify a large-coil HP cylinder ` +
      `(coil area ≥ 3 m²) to maintain COP throughout the reheat cycle.`,
    );
  } else if (recommendedType === 'mixergy') {
    reasoning.push(
      `Mixergy-style top-down stratification recommended: higher usable fraction (95 %) ` +
      `keeps the top slice usable for longer, so fast-recovery operation can justify smaller storage.`,
    );
  }
  reasoning.push(
    `Expected recovery time at ${targetVolumeL} L: ${recRecoveryMins.toFixed(0)} min ` +
    `(${heatSourceKw} kW heat source, ΔT = ${recDeltaT} °C).`,
  );
  reasoning.push(
    `Expected standing loss: ${recStandingLossKwh.toFixed(2)} kWh/24h ` +
    `(at ${ambientTempC} °C ambient, nominal insulation).`,
  );

  // ── Flag: Mixergy advantage ────────────────────────────────────────────────
  // Compare standard cylinder requirement vs Mixergy cylinder requirement.
  // Show only when the current cylinder is standard (not already Mixergy) AND
  // the demand profile would benefit from Mixergy's higher usable fraction.
  if (!isMixergy && (isHighDemand || isSpaceTight)) {
    const standardMinL = roundUpToStandardSize(
      computeMinimumCylinderVolumeL({
        occupancyCount, bathroomCount, peakConcurrentOutlets, bathPeakLoadL, heatSourceKw, recoveryWindowMins,
        storeTempC, tapTargetTempC, coldWaterTempC,
        usableFraction: USABLE_FRACTION_STANDARD,
        drawSeverity,
      }),
    );
    const mixergyMinL = roundUpToStandardSize(
      computeMinimumCylinderVolumeL({
        occupancyCount, bathroomCount, peakConcurrentOutlets, bathPeakLoadL, heatSourceKw, recoveryWindowMins,
        storeTempC, tapTargetTempC, coldWaterTempC,
        usableFraction: USABLE_FRACTION_MIXERGY,
        drawSeverity,
      }),
    );
    if (mixergyMinL < standardMinL) {
      flags.push({
        id: 'sizing-mixergy-advantage',
        severity: 'info',
        title: 'Mixergy stratification reduces required cylinder size',
        detail:
          `For this demand profile (${occupancyCount} occupant(s), ${bathroomCount} bathroom(s)), ` +
          `a standard cylinder requires ${standardMinL} L. ` +
          `A Mixergy-style cylinder with 95 % usable fraction can satisfy the same demand in ` +
          `${mixergyMinL} L — saving installation space and reducing standing losses.`,
      });
    }
  }

  // ── Flag: HP volume uplift ─────────────────────────────────────────────────
  if (isHpRegime) {
    // Compare to what a boiler cylinder would require at 60 °C
    const boilerMinL = roundUpToStandardSize(
      computeMinimumCylinderVolumeL({
        occupancyCount, bathroomCount, peakConcurrentOutlets, bathPeakLoadL, heatSourceKw, recoveryWindowMins,
        storeTempC: DEFAULT_BOILER_STORE_TEMP_C,
        tapTargetTempC, coldWaterTempC,
        usableFraction: USABLE_FRACTION_STANDARD,
        drawSeverity,
      }),
    );
    if (targetVolumeL > boilerMinL) {
      flags.push({
        id: 'sizing-hp-volume-uplift',
        severity: 'info',
        title: 'Heat pump cylinder requires larger volume than boiler equivalent',
        detail:
          `A standard boiler cylinder (60 °C) would require ${boilerMinL} L for this household. ` +
          `At the lower heat pump store temperature (${storeTempC} °C), the same demand ` +
          `requires ${targetVolumeL} L — an uplift of ${targetVolumeL - boilerMinL} L ` +
          `due to the reduced hot-to-cold mixing ratio at lower store temperatures.`,
      });
    }
  }

  // ── Current cylinder performance assessment ────────────────────────────────
  let currentPerformance: CylinderCurrentPerformance | undefined;

  if (input.cylinderVolumeLitres !== undefined) {
    const currentVolumeL = input.cylinderVolumeLitres;
    const deltaTc        = storeTempC - coldWaterTempC;
    const recoveryMins   = computeRecoveryTimeMins(currentVolumeL, deltaTc, heatSourceKw);
    const standingLossW  = computeStandingLossW(
      currentVolumeL, storeTempC, ambientTempC, standingLossCoeff, insulationFactor,
    );
    const standingLossKwh = (standingLossW * HOURS_PER_DAY) / 1000;
    const usableMixedL   = computeUsableVolumeMixedL(
      currentVolumeL, usableFraction, storeTempC, tapTargetTempC, coldWaterTempC,
    );

    const currentMinRawL = computeMinimumCylinderVolumeL({
      occupancyCount,
      bathroomCount,
      peakConcurrentOutlets,
      bathPeakLoadL,
      heatSourceKw,
      recoveryWindowMins,
      storeTempC,
      tapTargetTempC,
      coldWaterTempC,
      usableFraction,
      drawSeverity,
    });
    // Physics minimum rounded up to the nearest whole litre (for display only — adequacy
    // comparison uses the unrounded value so a 98 L cylinder is not penalised against a
    // 120 L purchase threshold intended for new-install sizing recommendations).
    const currentMinPhysicsL = Math.ceil(currentMinRawL);
    const currentScenarioResults = peakWindowScenarios.map((scenario) =>
      simulatePeakWindowScenario({
        scenario,
        volumeL: currentVolumeL,
        heatSourceKw,
        storeTempC,
        tapTargetTempC,
        coldWaterTempC,
        usableFraction,
        isStratified: isMixergy,
        effectiveRecoveryWindowMins,
      }),
    );
    const currentScenarioVerdict = evaluateScenarioResults(currentScenarioResults);
    const currentScenarioEvidence = pickScenarioEvidence(currentScenarioResults);

    const sizeAdequacy: CylinderCurrentPerformance['sizeAdequacy'] =
      currentScenarioVerdict === 'adequate'
        ? 'adequate'
        : currentScenarioVerdict === 'borderline'
        ? 'marginal'
        : 'undersized';

    currentPerformance = {
      nominalVolumeL:       currentVolumeL,
      usableVolumeMixedL:   Math.round(usableMixedL),
      recoveryTimeMins:     Math.round(recoveryMins * 10) / 10,
      heatSourcePowerKw:    heatSourceKw,
      heatSourcePowerSource: heatSourceSource,
      standingLossWatts:    Math.round(standingLossW * 10) / 10,
      standingLossKwhPer24h: Math.round(standingLossKwh * 100) / 100,
      ambientTempC,
      sizeAdequacy,
      minimumAdequateVolumeL: currentMinPhysicsL,
    };

    // ── Flag: undersized ────────────────────────────────────────────────────
    if (sizeAdequacy === 'undersized') {
      flags.push({
        id: 'sizing-undersized-for-demand',
        severity: 'warn',
        title: 'Cylinder undersized for household demand',
        detail:
          `Scenario "${currentScenarioEvidence.scenario.label}" ` +
          `${currentScenarioEvidence.exhaustionPointMinute === null
            ? 'collapses reserve during simultaneous use'
            : `exhausts usable hot water at ~${currentScenarioEvidence.exhaustionPointMinute} min`} ` +
          `for the current ${currentVolumeL} L cylinder. Upgrade to at least ${currentMinPhysicsL} L ` +
          `(recommended: ${targetVolumeL} L).`,
      });
    } else if (sizeAdequacy === 'marginal') {
      flags.push({
        id: 'sizing-undersized-for-demand',
        severity: 'info',
        title: 'Cylinder is marginally sized for demand',
        detail:
          `Scenario evidence for the current ${currentVolumeL} L cylinder is borderline: ` +
          `"${currentScenarioEvidence.scenario.label}" leaves about ${currentScenarioEvidence.lowestReserveL.toFixed(0)} L ` +
          `usable reserve and needs ${currentScenarioEvidence.recoveryToTargetMins} min to recover to target. ` +
          `Consider upgrading to ${targetVolumeL} L or increasing recovery rate.`,
      });
    } else {
      flags.push({
        id: 'sizing-current-adequate',
        severity: 'info',
        title: 'Current cylinder volume is adequate',
        detail:
          `Current cylinder (${currentVolumeL} L nominal) stays ahead of the selected peak-window scenarios ` +
          `for this household. Lowest usable reserve is about ${currentScenarioEvidence.lowestReserveL.toFixed(0)} L, ` +
          `with recovery to target in ${currentScenarioEvidence.recoveryToTargetMins} min.`,
      });
    }

    // ── Flag: slow recovery ─────────────────────────────────────────────────
    if (currentScenarioEvidence.recoveryToTargetMins > SLOW_RECOVERY_THRESHOLD_MINS || recoveryMins > SLOW_RECOVERY_THRESHOLD_MINS) {
      flags.push({
        id: 'sizing-recovery-slow',
        severity: 'warn',
        title: 'Extended recovery time — risk of hot-water gaps',
        detail:
          `Scenario recovery back to the target reserve takes ` +
          `${Number.isFinite(currentScenarioEvidence.recoveryToTargetMins) ? `${currentScenarioEvidence.recoveryToTargetMins} min` : 'too long to be practical'} ` +
          `(${currentVolumeL} L, ${heatSourceKw} kW source, ΔT = ${deltaTc.toFixed(0)} °C). ` +
          `Back-to-back high-demand periods may leave the cylinder unable to recover before the next draw. ` +
          (heatSourceSource === 'assumed'
            ? `Confirm heat source power — if the coil or boiler output is higher, ` +
              `recovery time will be shorter.`
            : `Consider a Mixergy-style cylinder to deliver usable hot water from the ` +
              `top slice within minutes of partial recharge.`),
      });
    }

    // ── Flag: high standing loss ────────────────────────────────────────────
    if (standingLossKwh > HIGH_STANDING_LOSS_THRESHOLD_KWH) {
      flags.push({
        id: 'sizing-standing-loss-high',
        severity: 'warn',
        title: 'Elevated standing loss — heat escaping from cylinder',
        detail:
          `Estimated standing loss: ${standingLossKwh.toFixed(2)} kWh/24h ` +
          `(${standingLossW.toFixed(0)} W at ${ambientTempC} °C ambient). ` +
          (insulationFactor < 0.9
            ? `Insulation degradation (factor ${insulationFactor.toFixed(2)}) is a significant ` +
              `contributor — a modern factory-insulated replacement cylinder would reduce ` +
              `standing losses materially.`
            : input.cylinderInstallLocation === 'garage'
            ? `The unheated garage location significantly increases standing losses — ` +
              `consider insulating the installation space or relocating the cylinder.`
            : `Consider upgrading to a modern factory-insulated or Mixergy unit.`),
      });
    }

    assumptions.push(
      `Current cylinder: ${currentVolumeL} L — size adequacy: ${sizeAdequacy}. ` +
      `Scenario evidence: ${currentScenarioEvidence.scenario.label}, ` +
      `${currentScenarioEvidence.exhaustionPointMinute === null
        ? `${currentScenarioEvidence.lowestReserveL.toFixed(0)} L lowest reserve`
        : `exhausted at ${currentScenarioEvidence.exhaustionPointMinute} min`}, ` +
      `${currentScenarioEvidence.recoveryToTargetMins} min to target reserve. ` +
      `Recovery: ${recoveryMins.toFixed(0)} min. ` +
      `Standing loss: ${standingLossW.toFixed(0)} W (${standingLossKwh.toFixed(2)} kWh/24h).`,
    );
  }

  return {
    ...(currentPerformance !== undefined && { currentPerformance }),
    recommendation: {
      targetVolumeL,
      minimumVolumeL,
      cylinderType: recommendedType,
      expectedRecoveryTimeMins: Math.round(recRecoveryMins * 10) / 10,
      expectedStandingLossKwhPer24h: Math.round(recStandingLossKwh * 100) / 100,
      usableVolumeMixedL: Math.round(recUsableL),
      reasoning,
    },
    flags,
    assumptions,
  };
}

// ─── Exported helpers (for testing) ──────────────────────────────────────────

/** Exported for unit tests. */
export {
  computeRecoveryTimeMins,
  computeUsableVolumeMixedL,
  computeStandingLossW,
  computeMinimumCylinderVolumeL,
  computeDailyDemandL,
  computePeakWindowDemandL,
  computeRecoveredMixedVolumeWithinWindowL,
  resolveBathFrequencyPerWeek,
  resolvePeakBathLoadL,
  resolvePeakConcurrentOutlets,
  resolveRecoveryCreditWindowMins,
  roundUpToStandardSize,
  RECOVERY_DIVISOR,
  WATER_DENSITY_KG_PER_L,
  WATER_CP_KJ_PER_KG_K,
  STANDING_LOSS_W_PER_L_STANDARD,
  STANDING_LOSS_W_PER_L_MIXERGY,
  STANDING_LOSS_REF_DELTA_T,
  USABLE_FRACTION_STANDARD,
  USABLE_FRACTION_MIXERGY,
  STANDARD_CYLINDER_SIZES_L,
  AMBIENT_TEMP_C,
  ASSUMED_BOILER_HEAT_SOURCE_KW,
  ASSUMED_ASHP_HEAT_SOURCE_KW,
  IMMERSION_HEATER_KW,
  // Temperature defaults — exported so dependent modules use the same values
  DEFAULT_BOILER_STORE_TEMP_C,
  DEFAULT_HP_STORE_TEMP_C,
  DEFAULT_COLD_WATER_TEMP_C,
  DEFAULT_TAP_TARGET_TEMP_C,
  // Demand constants — exported for use in InsightPack cylinder sizing rationale
  DEMAND_L_PER_PERSON_PER_DAY,
  DEMAND_L_PER_EXTRA_BATHROOM,
  PEAK_SHOWER_EVENT_L,
};
