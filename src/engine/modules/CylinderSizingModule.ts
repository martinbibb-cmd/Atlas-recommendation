import type {
  EngineInputV2_3,
  CylinderSizingResult,
  CylinderSizingFlagItem,
  CylinderCurrentPerformance,
  CylinderSizingRecommendation,
  CylinderInstallLocation,
} from '../schema/EngineInputV2_3';

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

/**
 * Hot water demand per occupant per day (litres at tap target temperature, 40 °C).
 * Derived from CIBSE Guide G / MCS CH-I-06 occupancy demand assumptions:
 *   55 L/person/day at 40 °C represents moderate domestic use including showers,
 *   basin, and incidental hot water.  Calibrated against standard UK cylinder
 *   sizing charts (Megaflo, Gledhill, Heatrae Sadia).
 */
const DEMAND_L_PER_PERSON_PER_DAY = 55;

/**
 * Additional demand allocation per bathroom beyond the first (litres/day at 40 °C).
 * Each additional bathroom adds an independent morning draw point.
 * 30 L represents a typical 8-minute shower at the second bathroom.
 */
const DEMAND_L_PER_EXTRA_BATHROOM = 30;

/**
 * Simultaneous-draw reserve multipliers.
 * Applied to the computed minimum hot volume to account for concurrent peak demand.
 */
const SIMULTANEOUS_DRAW_MULTIPLIER: Record<'low' | 'medium' | 'high', number> = {
  low:    1.00,
  medium: 1.15,
  high:   1.30,
};

/** Slow-recovery warning threshold (minutes). Cylinders that take longer than this to recover
 * will leave households without hot water for extended periods between draws. */
const SLOW_RECOVERY_THRESHOLD_MINS = 60;

/** High standing-loss warning threshold (kWh/24h). Above this, standing losses are significant. */
const HIGH_STANDING_LOSS_THRESHOLD_KWH = 2.0;

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
 */
function resolveHeatSourcePower(
  input: EngineInputV2_3,
): { powerKw: number; source: 'measured' | 'assumed' } {
  if (input.currentHeatSourceType === 'ashp') {
    return { powerKw: ASSUMED_ASHP_HEAT_SOURCE_KW, source: 'assumed' };
  }
  if (
    input.currentHeatSourceType === 'system' ||
    input.currentHeatSourceType === 'regular' ||
    input.currentHeatSourceType === 'combi'
  ) {
    const boilerKw = input.currentBoilerOutputKw ?? input.currentSystem?.boiler?.nominalOutputKw;
    if (boilerKw !== undefined && boilerKw > 0) {
      return { powerKw: Math.min(boilerKw, MAX_COIL_RATING_KW), source: 'measured' };
    }
  }
  // No heat source type or no power data
  if (input.dhwStorageRegime === 'heat_pump_cylinder') {
    return { powerKw: ASSUMED_ASHP_HEAT_SOURCE_KW, source: 'assumed' };
  }
  return { powerKw: ASSUMED_BOILER_HEAT_SOURCE_KW, source: 'assumed' };
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

/**
 * Compute the minimum cylinder nominal volume (litres) required to satisfy the
 * household's daily hot-water demand.
 *
 * Algorithm:
 *   1. Daily demand (at tap target temp) = occupants × 55L + extra bathrooms × 30L
 *   2. Required hot volume = dailyDemand × (tapDelta / storeDelta)
 *      — the volume that must be stored at store temperature to produce that demand
 *   3. Minimum cylinder = requiredHot / usableFraction
 *      — accounts for turbulence/mixing losses
 *   4. Apply simultaneous-draw reserve multiplier
 *   5. Apply heat-pump uplift if regime is HP (lower store temp → higher required volume)
 *      — already captured implicitly through the (tapDelta/storeDelta) ratio
 */
function computeMinimumCylinderVolumeL(params: {
  occupancyCount: number;
  bathroomCount: number;
  storeTempC: number;
  tapTargetTempC: number;
  coldWaterTempC: number;
  usableFraction: number;
  drawSeverity: 'low' | 'medium' | 'high';
}): number {
  const {
    occupancyCount,
    bathroomCount,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
    usableFraction,
    drawSeverity,
  } = params;

  const tapDelta   = tapTargetTempC - coldWaterTempC;
  const storeDelta = storeTempC - coldWaterTempC;

  if (tapDelta <= 0 || storeDelta <= 0 || usableFraction <= 0) return 120;

  const dailyDemandL = computeDailyDemandL(occupancyCount, bathroomCount);

  // Hot volume required at store temperature
  const requiredHotL = dailyDemandL * (tapDelta / storeDelta);

  // Minimum cylinder = hot volume ÷ usable fraction
  const minCylinderL = requiredHotL / usableFraction;

  // Apply draw-severity reserve
  const multiplier = SIMULTANEOUS_DRAW_MULTIPLIER[drawSeverity];
  return minCylinderL * multiplier;
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
 *   Demand = occupants × 50 L + extra bathrooms × 20 L (at tap temp, 40 °C)
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

  const { powerKw: heatSourceKw, source: heatSourceSource } = resolveHeatSourcePower(input);
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
    `(${heatSourceSource === 'measured' ? 'from boiler output' : 'assumed typical'}).`,
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

  // ── Minimum required volume (using recommended cylinder's usable fraction) ────
  const minimumRawL = computeMinimumCylinderVolumeL({
    occupancyCount,
    bathroomCount,
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
    usableFraction: recUsableFraction,
    drawSeverity,
  });

  const minimumVolumeL = roundUpToStandardSize(minimumRawL);

  assumptions.push(
    `Minimum volume (raw): ${minimumRawL.toFixed(1)} L → ` +
    `rounded to nearest standard size: ${minimumVolumeL} L ` +
    `(${occupancyCount} occupant(s), ${bathroomCount} bathroom(s), ` +
    `${drawSeverity} simultaneous-draw severity, ` +
    `${recUsableFraction * 100} % usable fraction for ${recommendedType} cylinder type).`,
  );

  // ── Recommend target volume ────────────────────────────────────────────────
  // The target volume adds a comfort margin of one size above the minimum for
  // 'medium' or 'high' draw severity, to provide a buffer against back-to-back
  // demand and allow for real-world installation variability.
  let targetVolumeL = minimumVolumeL;
  if (drawSeverity === 'high') {
    // For high simultaneous draw, move up one standard size for comfort headroom
    const currentIdx = STANDARD_CYLINDER_SIZES_L.indexOf(minimumVolumeL as typeof STANDARD_CYLINDER_SIZES_L[number]);
    if (currentIdx >= 0 && currentIdx < STANDARD_CYLINDER_SIZES_L.length - 1) {
      targetVolumeL = STANDARD_CYLINDER_SIZES_L[currentIdx + 1];
    }
  }

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
  const dailyDemandL = computeDailyDemandL(occupancyCount, bathroomCount);

  reasoning.push(
    `Estimated daily hot-water demand: ${dailyDemandL} L at ${tapTargetTempC} °C ` +
    `(${occupancyCount} occupant(s), ${bathroomCount} bathroom(s)).`,
  );
  reasoning.push(
    `Store temperature ${storeTempC} °C and ${recUsableFraction * 100} % usable fraction → ` +
    `minimum cylinder: ${minimumVolumeL} L nominal.`,
  );
  if (recommendedType === 'mixergy') {
    reasoning.push(
      `Mixergy-style top-down stratification recommended: higher usable fraction (95 %) ` +
      `means the same deliverable hot water from a smaller cylinder, reducing standing losses ` +
      `and improving heat pump COP by minimising reheat frequency.`,
    );
  } else if (recommendedType === 'heat_pump_optimised') {
    reasoning.push(
      `Heat-pump-optimised cylinder required: the lower store temperature (${storeTempC} °C) ` +
      `reduces the usable hot-water fraction per litre — specify a large-coil HP cylinder ` +
      `(coil area ≥ 3 m²) to maintain COP throughout the reheat cycle.`,
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
        occupancyCount, bathroomCount, storeTempC, tapTargetTempC, coldWaterTempC,
        usableFraction: USABLE_FRACTION_STANDARD,
        drawSeverity,
      }),
    );
    const mixergyMinL = roundUpToStandardSize(
      computeMinimumCylinderVolumeL({
        occupancyCount, bathroomCount, storeTempC, tapTargetTempC, coldWaterTempC,
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
        occupancyCount, bathroomCount,
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

    // Minimum volume for the current cylinder type (using current cylinder's usable fraction).
    // This is the adequate threshold for judging whether the existing cylinder is sufficient.
    //
    // Adequacy is assessed against the raw physics minimum (currentMinRawL), NOT the
    // nearest purchasable standard size.  The standard-size rounding is only for recommending
    // what to buy when replacing — it is not appropriate for evaluating an existing cylinder.
    //
    // Example: for 1 occupant, 1 bathroom the physics minimum is ~44 L.  A 98 L cylinder
    // clearly satisfies this even though roundUpToStandardSize(44) = 120 L.  Without this
    // distinction, any sub-120 L cylinder would be incorrectly flagged as undersized.
    const currentMinRawL = computeMinimumCylinderVolumeL({
      occupancyCount,
      bathroomCount,
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

    const sizeAdequacy: CylinderCurrentPerformance['sizeAdequacy'] =
      currentVolumeL >= currentMinRawL ? 'adequate'  :
      currentVolumeL >= currentMinRawL * 0.85 ? 'marginal' :
      'undersized';

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
          `Current cylinder (${currentVolumeL} L nominal) is below the estimated ` +
          `physics minimum ${currentMinPhysicsL} L required for ${occupancyCount} occupant(s) and ` +
          `${bathroomCount} bathroom(s). This is likely causing back-to-back hot-water ` +
          `shortfalls. Upgrade to at least ${currentMinPhysicsL} L (recommended: ${targetVolumeL} L).`,
      });
    } else if (sizeAdequacy === 'marginal') {
      flags.push({
        id: 'sizing-undersized-for-demand',
        severity: 'info',
        title: 'Cylinder is marginally sized for demand',
        detail:
          `Current cylinder (${currentVolumeL} L) is slightly below the estimated ` +
          `physics minimum ${currentMinPhysicsL} L. Hot-water shortfalls may occur during back-to-back ` +
          `draws or high-demand periods. Consider upgrading to ${targetVolumeL} L.`,
      });
    } else {
      flags.push({
        id: 'sizing-current-adequate',
        severity: 'info',
        title: 'Current cylinder volume is adequate',
        detail:
          `Current cylinder (${currentVolumeL} L nominal) meets the estimated ` +
          `physics minimum ${currentMinPhysicsL} L for this household. Replacement may not be ` +
          `required on size grounds alone.`,
      });
    }

    // ── Flag: slow recovery ─────────────────────────────────────────────────
    if (recoveryMins > SLOW_RECOVERY_THRESHOLD_MINS) {
      flags.push({
        id: 'sizing-recovery-slow',
        severity: 'warn',
        title: 'Extended recovery time — risk of hot-water gaps',
        detail:
          `Estimated full recovery time: ${recoveryMins.toFixed(0)} min ` +
          `(${currentVolumeL} L, ${heatSourceKw} kW source, ΔT = ${deltaTc.toFixed(0)} °C). ` +
          `Back-to-back high-demand periods may leave the cylinder unable to recover ` +
          `before the next draw. ` +
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
};
