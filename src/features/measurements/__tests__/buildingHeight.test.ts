import { describe, expect, it } from 'vitest';
import {
  calculateBuildingHeightMeters,
  evaluateBuildingHeightMeasurement,
} from '../buildingHeight';

describe('buildingHeight', () => {
  it('calculates expected height from distance and angles', () => {
    const height = calculateBuildingHeightMeters(10, 45, 0);
    expect(height).toBeCloseTo(10, 4);
  });

  it('flags invalid distance', () => {
    const result = evaluateBuildingHeightMeasurement({
      distanceMeters: 0,
      baseAngleDeg: 0,
      topAngleDeg: 20,
      usedSensorCapture: true,
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.code === 'distance_invalid')).toBe(true);
  });

  it('flags top angle when not above base angle', () => {
    const result = evaluateBuildingHeightMeasurement({
      distanceMeters: 10,
      baseAngleDeg: 15,
      topAngleDeg: 15,
      usedSensorCapture: true,
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.code === 'top_not_above_base')).toBe(true);
  });

  it('warns on very small angle separation', () => {
    const result = evaluateBuildingHeightMeasurement({
      distanceMeters: 10,
      baseAngleDeg: 10,
      topAngleDeg: 13,
      usedSensorCapture: true,
    });
    expect(result.valid).toBe(true);
    expect(result.issues.some(issue => issue.code === 'small_angle_separation')).toBe(true);
  });

  it('reduces confidence when sensor capture is not used', () => {
    const sensorResult = evaluateBuildingHeightMeasurement({
      distanceMeters: 8,
      baseAngleDeg: -5,
      topAngleDeg: 25,
      usedSensorCapture: true,
    });
    const manualResult = evaluateBuildingHeightMeasurement({
      distanceMeters: 8,
      baseAngleDeg: -5,
      topAngleDeg: 25,
      usedSensorCapture: false,
    });
    expect(sensorResult.confidenceLevel).toBe('high');
    expect(manualResult.confidenceLevel).toBe('medium');
  });
});
