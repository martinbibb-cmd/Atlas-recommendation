import type { CalibrationInput, CalibrationDataPoint } from '../schema/EngineInputV2_3';

/**
 * A single day's reading from a smart meter gateway.
 *
 * Compatible with:
 *   - DCC (Data Communications Company) Half-Hourly Energy API (GB)
 *   - Hildebrand Glow local IHD API (n3rgy / Chameleon gateway)
 *
 * Outdoor temperature is typically sourced from a co-located weather API
 * (e.g. Open-Meteo, Met Office DataPoint) keyed on the property postcode.
 */
export interface DailyMeterReading {
  /** ISO 8601 date string, e.g. "2024-01-15" */
  date: string;
  /** Total energy consumed that day (kWh) */
  energyConsumedKwh: number;
  /** Average indoor air temperature (°C) */
  avgIndoorTempC: number;
  /** Average outdoor air temperature from weather source (°C) */
  avgOutdoorTempC: number;
  /** Hours the heating system was active that day */
  heatingActiveHours: number;
}

export interface SmartMeterAdapterResult {
  /** Aggregated CalibrationInput ready for ParityCalibrator */
  calibrationInput: CalibrationInput;
  rawReadings: DailyMeterReading[];
  /** Human-readable date range label */
  periodLabel: string;
  totalEnergyKwh: number;
  daysOfData: number;
}

/**
 * Aggregates daily smart-meter readings into fixed-length periods suitable for
 * the ParityCalibrator's OLS regression engine.
 *
 * The recommended minimum dataset is 21 days spanning at least one cold and
 * one mild period so the regression has a meaningful temperature spread.
 *
 * @param readings       Raw daily readings from a DCC or Hildebrand Glow source.
 * @param floorAreaM2    Property floor area – passed through to CalibrationInput.
 * @param periodLengthDays  Number of days to aggregate into each calibration point
 *                          (default 7 = weekly).
 */
export function adaptSmartMeterData(
  readings: DailyMeterReading[],
  floorAreaM2: number,
  periodLengthDays: number = 7,
): SmartMeterAdapterResult {
  if (readings.length === 0) {
    return {
      calibrationInput: { dataPoints: [], floorAreaM2 },
      rawReadings: [],
      periodLabel: 'No data',
      totalEnergyKwh: 0,
      daysOfData: 0,
    };
  }

  // Sort chronologically
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));

  // Aggregate into periods of `periodLengthDays`
  const dataPoints: CalibrationDataPoint[] = [];
  for (let i = 0; i < sorted.length; i += periodLengthDays) {
    const slice = sorted.slice(i, i + periodLengthDays);
    // Skip periods with fewer than 3 days – too noisy for reliable regression
    if (slice.length < 3) continue;

    const totalEnergyKwh = slice.reduce((acc, r) => acc + r.energyConsumedKwh, 0);
    const totalHeatingHours = slice.reduce((acc, r) => acc + r.heatingActiveHours, 0);
    const avgIndoor = slice.reduce((acc, r) => acc + r.avgIndoorTempC, 0) / slice.length;
    const avgOutdoor = slice.reduce((acc, r) => acc + r.avgOutdoorTempC, 0) / slice.length;

    if (totalHeatingHours === 0) continue; // exclude non-heating periods

    dataPoints.push({
      period: slice[0].date,
      energyKwh: parseFloat(totalEnergyKwh.toFixed(2)),
      avgIndoorTempC: parseFloat(avgIndoor.toFixed(1)),
      avgOutdoorTempC: parseFloat(avgOutdoor.toFixed(1)),
      heatingHours: parseFloat(totalHeatingHours.toFixed(1)),
    });
  }

  const totalEnergy = sorted.reduce((acc, r) => acc + r.energyConsumedKwh, 0);

  return {
    calibrationInput: { dataPoints, floorAreaM2 },
    rawReadings: sorted,
    periodLabel: `${sorted[0].date} to ${sorted[sorted.length - 1].date}`,
    totalEnergyKwh: parseFloat(totalEnergy.toFixed(2)),
    daysOfData: sorted.length,
  };
}
