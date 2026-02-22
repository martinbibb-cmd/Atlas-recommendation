import type { CalibrationInput, CalibrationResult } from '../schema/EngineInputV2_3';

// UK design conditions (BS EN 12831)
const DESIGN_EXTERNAL_TEMP_C = -3;
const DESIGN_INTERNAL_TEMP_C = 21;
const DESIGN_DELTA_T_K = DESIGN_INTERNAL_TEMP_C - DESIGN_EXTERNAL_TEMP_C; // 24 K

// Typical effective thermal mass per m² floor area by construction era
const THERMAL_MASS_KJ_PER_K_PER_M2 = 150; // kJ/(K·m²) – mixed UK housing stock estimate

/**
 * Derive heat loss coefficient (UA, W/K) from a set of monitored data points.
 *
 * Method: simple linear regression of  P = UA × (T_in − T_out)
 *   P (W) = energyKwh × 1000 / heatingHours
 *   ΔT (K) = avgIndoorTempC − avgOutdoorTempC
 *
 * Returns the slope UA and a confidence metric based on R² of the fit.
 */
export function calibrateFromMeasuredData(data: CalibrationInput): CalibrationResult {
  const notes: string[] = [];
  const points = data.dataPoints.filter(dp => dp.heatingHours > 0);

  if (points.length < 2) {
    notes.push(
      `⚠️ Insufficient data: at least 2 data points with heating hours > 0 are required ` +
      `for calibration. Returning zero-confidence estimate.`
    );
    return {
      heatLossCoefficientWperK: 0,
      estimatedHeatLossAtDesignW: 0,
      thermalMassKjPerK: 0,
      confidenceScore: 0,
      calibratedVsTheoreticalRatio: 0,
      notes,
    };
  }

  // Convert each data point to (ΔT, power_W) pairs
  const pairs = points.map(dp => ({
    deltaT: dp.avgIndoorTempC - dp.avgOutdoorTempC,
    powerW: (dp.energyKwh * 1000) / dp.heatingHours,
  }));

  // Ordinary least-squares through origin: UA = Σ(ΔT × P) / Σ(ΔT²)
  const sumDeltaTxP = pairs.reduce((acc, p) => acc + p.deltaT * p.powerW, 0);
  const sumDeltaT2 = pairs.reduce((acc, p) => acc + p.deltaT ** 2, 0);
  const uaWperK = sumDeltaT2 > 0 ? sumDeltaTxP / sumDeltaT2 : 0;

  // R² for confidence score
  const meanP = pairs.reduce((acc, p) => acc + p.powerW, 0) / pairs.length;
  const ssTot = pairs.reduce((acc, p) => acc + (p.powerW - meanP) ** 2, 0);
  const ssRes = pairs.reduce((acc, p) => acc + (p.powerW - uaWperK * p.deltaT) ** 2, 0);
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  const estimatedHeatLossAtDesignW = uaWperK * DESIGN_DELTA_T_K;
  const thermalMassKjPerK = data.floorAreaM2 * THERMAL_MASS_KJ_PER_K_PER_M2;

  // Rough theoretical benchmark: 100 W/K per 50 m² floor area
  const theoreticalUaWperK = (data.floorAreaM2 / 50) * 100;
  const calibratedVsTheoreticalRatio =
    theoreticalUaWperK > 0 ? uaWperK / theoreticalUaWperK : 1;

  notes.push(
    `📊 Calibration complete using ${points.length} data points. ` +
    `Derived UA = ${uaWperK.toFixed(1)} W/K (R² = ${rSquared.toFixed(2)}).`
  );
  notes.push(
    `🏠 Design-condition heat loss: ${estimatedHeatLossAtDesignW.toFixed(0)} W ` +
    `(at ${DESIGN_EXTERNAL_TEMP_C}°C external, ${DESIGN_INTERNAL_TEMP_C}°C internal).`
  );

  if (calibratedVsTheoreticalRatio > 1.3) {
    notes.push(
      `⚠️ Measured UA is ${((calibratedVsTheoreticalRatio - 1) * 100).toFixed(0)}% ` +
      `above theoretical benchmark. Common causes: uninsulated solid walls, single ` +
      `glazing, or loft insulation deficiency. Consider targeted fabric improvements.`
    );
  } else if (calibratedVsTheoreticalRatio < 0.7) {
    notes.push(
      `ℹ️ Measured UA is ${((1 - calibratedVsTheoreticalRatio) * 100).toFixed(0)}% ` +
      `below theoretical benchmark. Building may benefit from thermal bridging calculations ` +
      `or the dataset may not cover cold-weather periods.`
    );
  }

  if (rSquared < 0.7) {
    notes.push(
      `🔍 Low confidence (R² = ${rSquared.toFixed(2)}): dataset spans a narrow temperature ` +
      `range or contains measurement noise. Collect readings from at least one winter month ` +
      `and one shoulder season for reliable calibration.`
    );
  }

  return {
    heatLossCoefficientWperK: parseFloat(uaWperK.toFixed(2)),
    estimatedHeatLossAtDesignW: parseFloat(estimatedHeatLossAtDesignW.toFixed(0)),
    thermalMassKjPerK: parseFloat(thermalMassKjPerK.toFixed(1)),
    confidenceScore: parseFloat(rSquared.toFixed(3)),
    calibratedVsTheoreticalRatio: parseFloat(calibratedVsTheoreticalRatio.toFixed(3)),
    notes,
  };
}
