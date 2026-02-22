import { describe, it, expect } from 'vitest';
import { adaptSmartMeterData } from '../modules/SmartMeterAdapter';
import type { DailyMeterReading } from '../modules/SmartMeterAdapter';

// 28 days of realistic winter + shoulder data
const winterReadings: DailyMeterReading[] = Array.from({ length: 28 }, (_, i) => ({
  date: `2024-01-${String(i + 1).padStart(2, '0')}`,
  energyConsumedKwh: 25 + Math.sin(i / 7) * 5, // 20–30 kWh/day
  avgIndoorTempC: 20,
  avgOutdoorTempC: 2 + (i % 7) * 0.5, // 2–5°C range
  heatingActiveHours: 8,
}));

describe('SmartMeterAdapter', () => {
  it('returns empty result for empty readings array', () => {
    const result = adaptSmartMeterData([], 80);
    expect(result.daysOfData).toBe(0);
    expect(result.calibrationInput.dataPoints).toHaveLength(0);
    expect(result.totalEnergyKwh).toBe(0);
  });

  it('aggregates 28 days into 4 weekly calibration points', () => {
    const result = adaptSmartMeterData(winterReadings, 80, 7);
    expect(result.calibrationInput.dataPoints).toHaveLength(4);
  });

  it('passes floorAreaM2 through to CalibrationInput', () => {
    const result = adaptSmartMeterData(winterReadings, 120);
    expect(result.calibrationInput.floorAreaM2).toBe(120);
  });

  it('produces correct totalEnergyKwh', () => {
    const result = adaptSmartMeterData(winterReadings, 80);
    const expectedTotal = winterReadings.reduce((acc, r) => acc + r.energyConsumedKwh, 0);
    expect(result.totalEnergyKwh).toBeCloseTo(expectedTotal, 1);
  });

  it('records daysOfData', () => {
    const result = adaptSmartMeterData(winterReadings, 80);
    expect(result.daysOfData).toBe(28);
  });

  it('sorts readings chronologically', () => {
    const shuffled = [...winterReadings].sort(() => Math.random() - 0.5);
    const result = adaptSmartMeterData(shuffled, 80);
    const dates = result.rawReadings.map(r => r.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('excludes periods where heatingActiveHours is 0', () => {
    const noHeatReadings: DailyMeterReading[] = winterReadings.slice(0, 14).map(r => ({
      ...r,
      heatingActiveHours: 0,
    }));
    const result = adaptSmartMeterData(noHeatReadings, 80, 7);
    expect(result.calibrationInput.dataPoints).toHaveLength(0);
  });

  it('skips incomplete periods with fewer than 3 days', () => {
    const twoReadings = winterReadings.slice(0, 2);
    const result = adaptSmartMeterData(twoReadings, 80, 7);
    expect(result.calibrationInput.dataPoints).toHaveLength(0);
  });

  it('produces a period label with start and end dates', () => {
    const result = adaptSmartMeterData(winterReadings, 80);
    expect(result.periodLabel).toContain('2024-01-01');
    expect(result.periodLabel).toContain('2024-01-28');
  });

  it('calibration input is compatible with ParityCalibrator', () => {
    const { calibrationInput } = adaptSmartMeterData(winterReadings, 80, 7);
    // All data points must have valid fields for the calibrator
    for (const dp of calibrationInput.dataPoints) {
      expect(dp.heatingHours).toBeGreaterThan(0);
      expect(dp.energyKwh).toBeGreaterThan(0);
    }
  });
});
