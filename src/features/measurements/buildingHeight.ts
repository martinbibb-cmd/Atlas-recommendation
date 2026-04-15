export type BuildingHeightConfidenceLevel = 'high' | 'medium' | 'low';

export type BuildingHeightIssueSeverity = 'error' | 'warn';

export interface BuildingHeightIssue {
  code:
    | 'distance_invalid'
    | 'base_angle_invalid'
    | 'top_angle_invalid'
    | 'top_not_above_base'
    | 'small_angle_separation';
  severity: BuildingHeightIssueSeverity;
  message: string;
}

export interface BuildingHeightMeasurementInput {
  distanceMeters: number;
  baseAngleDeg: number;
  topAngleDeg: number;
  usedSensorCapture: boolean;
}

export interface BuildingHeightMeasurementResult {
  valid: boolean;
  heightMeters: number | null;
  angleSeparationDeg: number | null;
  confidenceLevel: BuildingHeightConfidenceLevel;
  issues: BuildingHeightIssue[];
  notes: string[];
}

const SMALL_ANGLE_WARNING_DEG = 5;

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateBuildingHeightMeters(
  distanceMeters: number,
  topAngleDeg: number,
  baseAngleDeg: number,
): number {
  return distanceMeters * (Math.tan(toRadians(topAngleDeg)) - Math.tan(toRadians(baseAngleDeg)));
}

export function evaluateBuildingHeightMeasurement(
  input: BuildingHeightMeasurementInput,
): BuildingHeightMeasurementResult {
  const issues: BuildingHeightIssue[] = [];

  if (!isFiniteNumber(input.distanceMeters) || input.distanceMeters <= 0) {
    issues.push({
      code: 'distance_invalid',
      severity: 'error',
      message: 'Distance to wall must be greater than 0 m.',
    });
  }

  if (!isFiniteNumber(input.baseAngleDeg)) {
    issues.push({
      code: 'base_angle_invalid',
      severity: 'error',
      message: 'Base angle is required.',
    });
  }

  if (!isFiniteNumber(input.topAngleDeg)) {
    issues.push({
      code: 'top_angle_invalid',
      severity: 'error',
      message: 'Top angle is required.',
    });
  }

  const angleSeparationDeg = isFiniteNumber(input.baseAngleDeg) && isFiniteNumber(input.topAngleDeg)
    ? input.topAngleDeg - input.baseAngleDeg
    : null;

  if (angleSeparationDeg != null && angleSeparationDeg <= 0) {
    issues.push({
      code: 'top_not_above_base',
      severity: 'error',
      message: 'Top angle must be greater than base angle.',
    });
  }

  if (angleSeparationDeg != null && angleSeparationDeg > 0 && angleSeparationDeg < SMALL_ANGLE_WARNING_DEG) {
    issues.push({
      code: 'small_angle_separation',
      severity: 'warn',
      message: 'Very small angle separation can reduce result confidence.',
    });
  }

  const hasError = issues.some(issue => issue.severity === 'error');

  const heightMeters = hasError
    ? null
    : calculateBuildingHeightMeters(input.distanceMeters, input.topAngleDeg, input.baseAngleDeg);

  let confidenceScore = 3;
  if (!input.usedSensorCapture) confidenceScore -= 1;
  if (angleSeparationDeg != null && angleSeparationDeg < 10) confidenceScore -= 1;
  if (angleSeparationDeg != null && angleSeparationDeg < SMALL_ANGLE_WARNING_DEG) confidenceScore -= 1;
  if (hasError) confidenceScore = 0;

  const confidenceLevel: BuildingHeightConfidenceLevel = confidenceScore >= 3
    ? 'high'
    : confidenceScore === 2
      ? 'medium'
      : 'low';

  const notes = [
    'Use horizontal distance to the wall base when entering laser distance.',
    'Line-of-sight laser readings can reduce accuracy unless corrected to horizontal distance.',
  ];

  return {
    valid: !hasError,
    heightMeters,
    angleSeparationDeg,
    confidenceLevel,
    issues,
    notes,
  };
}
