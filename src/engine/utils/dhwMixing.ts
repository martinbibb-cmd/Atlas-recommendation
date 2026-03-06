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
