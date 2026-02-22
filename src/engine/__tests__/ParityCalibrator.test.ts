import { describe, it, expect } from 'vitest';
import { calibrateFromMeasuredData } from '../modules/ParityCalibrator';
import type { CalibrationInput } from '../schema/EngineInputV2_3';

// Well-separated data set: cold winter vs. mild shoulder season
const goodData: CalibrationInput = {
  floorAreaM2: 80,
  dataPoints: [
    { period: 'Jan', energyKwh: 900, avgIndoorTempC: 20, avgOutdoorTempC: 2, heatingHours: 300 },
    { period: 'Feb', energyKwh: 800, avgIndoorTempC: 20, avgOutdoorTempC: 4, heatingHours: 280 },
    { period: 'Mar', energyKwh: 500, avgIndoorTempC: 20, avgOutdoorTempC: 8, heatingHours: 200 },
    { period: 'Nov', energyKwh: 600, avgIndoorTempC: 20, avgOutdoorTempC: 6, heatingHours: 220 },
  ],
};

describe('ParityCalibrator', () => {
  it('returns positive UA coefficient for valid data', () => {
    const result = calibrateFromMeasuredData(goodData);
    expect(result.heatLossCoefficientWperK).toBeGreaterThan(0);
  });

  it('returns a positive design heat loss for valid data', () => {
    const result = calibrateFromMeasuredData(goodData);
    expect(result.estimatedHeatLossAtDesignW).toBeGreaterThan(0);
  });

  it('returns a confidence score between 0 and 1', () => {
    const result = calibrateFromMeasuredData(goodData);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(1);
  });

  it('returns thermal mass proportional to floor area', () => {
    const result = calibrateFromMeasuredData(goodData);
    expect(result.thermalMassKjPerK).toBeGreaterThan(0);
    const resultLarger = calibrateFromMeasuredData({ ...goodData, floorAreaM2: 160 });
    expect(resultLarger.thermalMassKjPerK).toBeCloseTo(result.thermalMassKjPerK * 2, 0);
  });

  it('returns zero confidence for fewer than 2 valid data points', () => {
    const result = calibrateFromMeasuredData({
      floorAreaM2: 80,
      dataPoints: [
        { period: 'Jan', energyKwh: 900, avgIndoorTempC: 20, avgOutdoorTempC: 2, heatingHours: 300 },
      ],
    });
    expect(result.confidenceScore).toBe(0);
    expect(result.heatLossCoefficientWperK).toBe(0);
  });

  it('filters out data points with zero heating hours', () => {
    const dataWithZeroHours: CalibrationInput = {
      ...goodData,
      dataPoints: [
        ...goodData.dataPoints,
        { period: 'Aug', energyKwh: 0, avgIndoorTempC: 20, avgOutdoorTempC: 20, heatingHours: 0 },
      ],
    };
    // Should still work correctly, ignoring the zero-hours point
    const result = calibrateFromMeasuredData(dataWithZeroHours);
    expect(result.heatLossCoefficientWperK).toBeGreaterThan(0);
  });

  it('calibratedVsTheoreticalRatio > 0 for normal data', () => {
    const result = calibrateFromMeasuredData(goodData);
    expect(result.calibratedVsTheoreticalRatio).toBeGreaterThan(0);
  });

  it('produces notes array', () => {
    const result = calibrateFromMeasuredData(goodData);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});
