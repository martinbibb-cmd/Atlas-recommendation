/**
 * DHW tap mixing utilities.
 *
 * Models the hot/cold mixing ratio that must exist at the thermostatic mixing
 * valve (TMV) to deliver a target outlet temperature.  The same tap temperature
 * requires different proportions of cylinder water depending on store setpoint:
 *
 *   f_hot = (Ttap − Tcold) / (Thot − Tcold)
 *
 * A 60 °C cylinder delivers more cold bypass per litre of mixed flow than a
 * 50 °C ASHP cylinder, which means the ASHP cylinder depletes faster in L/min
 * terms even though the energy delivered to the user is identical.
 *
 * Combi boilers bypass this function entirely — their DHW is an on-demand
 * heat-exchanger response, not a cylinder draw.
 *
 * Storage regime (the third DHW axis)
 * ------------------------------------
 * Beyond demand level and concurrency, the storage temperature regime determines
 * how much of a cylinder's nominal volume is usable at the tap:
 *
 *   usable_litres_per_stored_L = (T_store − T_cold) / (T_tap − T_cold)
 *
 * A boiler cylinder at 60 °C delivers more cold bypass per unit of stored water
 * than a heat pump cylinder at 50 °C, meaning the heat pump cylinder depletes
 * faster for the same mixed output even at identical occupancy/bathroom profiles.
 */

/** Cold-water mains inlet temperature (°C) — UK annual mean ground-water average. */
export const DEFAULT_COLD_WATER_TEMP_C = 10;

/** Target mixed temperature at the tap outlet (°C) — comfortable wash / shower. */
export const DEFAULT_TAP_TARGET_TEMP_C = 40;

/**
 * Stored boiler (gas/oil) cylinder setpoint (°C).
 * Typical UK stored cylinder connected to a gas boiler; L8 Legionella safe-store.
 */
export const DEFAULT_STORED_BOILER_STORE_TEMP_C = 55;

/**
 * ASHP cylinder setpoint (°C).
 * Typical low-temperature heat pump store; higher setpoints reduce COP.
 */
export const DEFAULT_ASHP_STORE_TEMP_C = 50;

/** Nominal mixed flow rate at the tap (L/min) — representative shower/bath draw. */
export const DEFAULT_MIXED_FLOW_LPM = 10;

// ─── Storage regime ───────────────────────────────────────────────────────────

/**
 * The three DHW storage regimes that determine usable cylinder volume behaviour.
 *
 *   'boiler_cylinder'    — stored at higher temperature (≈60–65 °C); more cold
 *                          dilution at outlets → higher usable mixed volume.
 *   'heat_pump_cylinder' — stored at lower temperature (≈48–52 °C); less cold
 *                          dilution → cylinder depletes faster per litre of draw.
 *   'instantaneous_combi'— no stored volume; throughput constrained by boiler
 *                          output and mains pressure.
 */
export type DhwStorageRegime = 'boiler_cylinder' | 'heat_pump_cylinder' | 'instantaneous_combi';

/**
 * Nominal boiler cylinder store temperature (°C).
 * UK gas boiler with stored cylinder — L8 Legionella safe-store target.
 * Higher than the legacy DEFAULT_STORED_BOILER_STORE_TEMP_C (55 °C) because
 * many modern installations target 60–65 °C for Legionella compliance.
 */
export const BOILER_CYLINDER_STORE_TEMP_C = 60;

/**
 * Nominal heat pump cylinder store temperature (°C).
 * Typical ASHP store — kept low to preserve COP; same as DEFAULT_ASHP_STORE_TEMP_C.
 */
export const HEAT_PUMP_CYLINDER_STORE_TEMP_C = 50;

/**
 * Usable volume factor for a boiler cylinder relative to itself (reference = 1.0).
 */
export const BOILER_CYLINDER_USABLE_VOLUME_FACTOR = 1.0;

/**
 * Usable volume factor for a heat pump cylinder relative to a boiler cylinder.
 * Reflects that lower store temperature means a higher hot fraction is drawn per
 * litre of mixed output, so the effective usable volume is reduced.
 * Derived from mixing physics at reference conditions (60 °C vs 50 °C, 40 °C tap, 10 °C cold):
 *   usable(60°C) = (60−10)/(40−10) = 1.667 L mixed per L stored
 *   usable(50°C) = (50−10)/(40−10) = 1.333 L mixed per L stored
 *   factor       = 1.333 / 1.667 ≈ 0.80
 * Atlas uses 0.75 as a conservative design figure to account for real-world
 * variability in heat pump setpoints (48–52 °C range).
 */
export const HEAT_PUMP_CYLINDER_USABLE_VOLUME_FACTOR = 0.75;

/**
 * Returns the default store temperature (°C) for a given DHW storage regime.
 * Returns `undefined` for `'instantaneous_combi'` — combi systems have no cylinder.
 */
export function defaultStoreTempForRegime(regime: DhwStorageRegime): number | undefined {
  switch (regime) {
    case 'boiler_cylinder':
      return BOILER_CYLINDER_STORE_TEMP_C;
    case 'heat_pump_cylinder':
      return HEAT_PUMP_CYLINDER_STORE_TEMP_C;
    case 'instantaneous_combi':
      return undefined;
  }
}

export interface UsableVolumeFactorInput {
  /** Cylinder store temperature (°C). */
  storeTempC: number;
  /** Target mixed temperature at the tap outlet (°C). Default: 40. */
  tapTargetTempC?: number;
  /** Incoming cold mains temperature (°C). Default: 10. */
  coldWaterTempC?: number;
  /**
   * Reference store temperature against which the factor is normalised.
   * Default: BOILER_CYLINDER_STORE_TEMP_C (60 °C).
   * Set to the same value as storeTempC to get a factor of 1.0.
   */
  referenceStoreTempC?: number;
}

/**
 * Compute the usable mixed-volume factor for a cylinder store relative to a
 * reference store temperature.
 *
 * Physics:
 *   usable_L_per_stored_L(T) = (T_store − T_cold) / (T_tap − T_cold)
 *   factor = usable(T_store) / usable(T_reference)
 *
 * Examples at 40 °C tap, 10 °C cold, 60 °C reference:
 *   storeTempC=60 → factor=1.000  (same as reference)
 *   storeTempC=50 → factor=0.800  (50 °C HP cylinder vs 60 °C boiler reference)
 *   storeTempC=55 → factor=0.900
 *
 * Returns 0 when storeTempC ≤ tapTargetTempC (store cannot reach tap temperature).
 * Clamped to [0, 2].
 */
export function computeUsableVolumeFactor(input: UsableVolumeFactorInput): number {
  const tapTargetTempC = input.tapTargetTempC ?? DEFAULT_TAP_TARGET_TEMP_C;
  const coldWaterTempC = input.coldWaterTempC ?? DEFAULT_COLD_WATER_TEMP_C;
  const referenceStoreTempC = input.referenceStoreTempC ?? BOILER_CYLINDER_STORE_TEMP_C;
  const { storeTempC } = input;

  if (storeTempC <= tapTargetTempC) {
    return 0;
  }

  const usableForStore = (storeTempC - coldWaterTempC) / (tapTargetTempC - coldWaterTempC);
  const usableForRef = (referenceStoreTempC - coldWaterTempC) / (tapTargetTempC - coldWaterTempC);

  if (usableForRef === 0) return 1;

  const raw = usableForStore / usableForRef;
  return parseFloat(Math.min(2, Math.max(0, raw)).toFixed(3));
}

export interface TapMixingInput {
  /** Thot — cylinder/store temperature delivered to the mixing point (°C). */
  storeTempC: number;
  /** Ttap — target mixed temperature at the tap outlet (°C). Default: 40. */
  tapTargetTempC?: number;
  /** Tcold — incoming cold mains temperature (°C). Default: 10. */
  coldWaterTempC?: number;
  /** Fmixed — total mixed flow at the outlet (L/min). Default: 10. */
  mixedFlowLpm?: number;
}

export interface TapMixingResult {
  /** Cylinder/store temperature used in the calculation (°C). */
  storeTempC: number;
  /** Target mixed temperature at the tap outlet (°C). */
  tapTargetTempC: number;
  /** Incoming cold mains temperature (°C). */
  coldWaterTempC: number;
  /** Total mixed flow rate at the outlet (L/min). */
  mixedFlowLpm: number;
  /**
   * Hot fraction of the mixed flow: f_hot = (Ttap − Tcold) / (Thot − Tcold).
   * Clamped to [0, 1].  When storeTempC ≤ tapTargetTempC the store cannot
   * reach tap temperature by mixing — hotFraction is set to 1 and
   * insufficientStoreTemp is flagged true.
   */
  hotFraction: number;
  /** Hot draw from the cylinder (L/min): hotFraction × mixedFlowLpm. */
  hotLpm: number;
  /** Cold bypass (L/min): (1 − hotFraction) × mixedFlowLpm. */
  coldLpm: number;
  /**
   * Energy delivered to the tap outlet (kW).
   *
   *   kW_tap = 0.0697 × Fmixed × (Ttap − Tcold)
   *
   * This term is independent of store temperature — it represents the thermal
   * energy in the mixed stream above cold-mains temperature.  What changes with
   * store temperature is the cylinder depletion rate (hotLpm), not the energy
   * experienced by the user.
   */
  kwTap: number;
  /**
   * True when storeTempC ≤ tapTargetTempC.
   * The store is too cool to reach target tap temperature by mixing; 100 % hot
   * draw is assumed and the system requires a reheat / boost event.
   */
  insufficientStoreTemp: boolean;
}

/**
 * Compute the hot/cold mixing ratio for a DHW tap event.
 *
 * Core formulae:
 *   f_hot    = (Ttap − Tcold) / (Thot − Tcold)      [clamped to 0–1]
 *   hot_lpm  = f_hot  × Fmixed
 *   cold_lpm = (1 − f_hot) × Fmixed
 *   kW_tap   = 0.0697 × Fmixed × (Ttap − Tcold)
 *
 * Example — 10 L/min mixed at 40 °C, cold mains 10 °C:
 *   60 °C store → f_hot = 27/50 = 0.54 → hot 5.4 L/min, cold 4.6 L/min
 *   50 °C store → f_hot = 27/40 = 0.675 → hot 6.75 L/min, cold 3.25 L/min
 *
 * Edge cases:
 *   storeTempC ≤ tapTargetTempC → hotFraction = 1, insufficientStoreTemp = true
 *   raw f_hot is clamped to [0, 1] to guard against numerical out-of-range inputs
 */
export function computeTapMixing(input: TapMixingInput): TapMixingResult {
  const tapTargetTempC = input.tapTargetTempC ?? DEFAULT_TAP_TARGET_TEMP_C;
  const coldWaterTempC = input.coldWaterTempC ?? DEFAULT_COLD_WATER_TEMP_C;
  const mixedFlowLpm = input.mixedFlowLpm ?? DEFAULT_MIXED_FLOW_LPM;
  const { storeTempC } = input;

  const insufficientStoreTemp = storeTempC <= tapTargetTempC;

  let hotFraction: number;
  if (insufficientStoreTemp) {
    // Store too cool to mix — treat as 100 % hot draw and flag
    hotFraction = 1;
  } else {
    const raw = (tapTargetTempC - coldWaterTempC) / (storeTempC - coldWaterTempC);
    hotFraction = parseFloat(Math.min(1, Math.max(0, raw)).toFixed(4));
  }

  const hotLpm = parseFloat((hotFraction * mixedFlowLpm).toFixed(3));
  const coldLpm = parseFloat(((1 - hotFraction) * mixedFlowLpm).toFixed(3));

  // Energy delivered to the tap (kW) — independent of store temperature
  const kwTap = parseFloat((0.0697 * mixedFlowLpm * (tapTargetTempC - coldWaterTempC)).toFixed(3));

  return {
    storeTempC,
    tapTargetTempC,
    coldWaterTempC,
    mixedFlowLpm,
    hotFraction,
    hotLpm,
    coldLpm,
    kwTap,
    insufficientStoreTemp,
  };
}
