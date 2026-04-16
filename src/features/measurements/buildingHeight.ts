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
  ladderLengthMeters: number | null;
  ladderBaseDistanceMeters: number | null;
}

const SMALL_ANGLE_WARNING_DEG = 5;
const LADDER_RATIO = 4;
const MEASUREMENT_NOTES = [
  'Use horizontal distance to the wall base when entering laser distance.',
  'Line-of-sight laser readings can reduce accuracy unless corrected to horizontal distance.',
] as const;

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

export function generateMathBreakdown(
  distanceMeters: number,
  baseAngleDeg: number,
  topAngleDeg: number,
  heightMeters: number,
): string {
  const baseRad = toRadians(baseAngleDeg);
  const topRad = toRadians(topAngleDeg);
  const tanBase = Math.tan(baseRad);
  const tanTop = Math.tan(topRad);
  return [
    'Formula:',
    'H = d \u00d7 (tan(\u03b8_top) \u2212 tan(\u03b8_base))',
    '',
    `d = ${distanceMeters.toFixed(2)} m`,
    `\u03b8_base = ${baseAngleDeg.toFixed(2)}\u00b0 (${baseRad.toFixed(4)} rad)`,
    `\u03b8_top = ${topAngleDeg.toFixed(2)}\u00b0 (${topRad.toFixed(4)} rad)`,
    `tan(\u03b8_base) = ${tanBase.toFixed(6)}`,
    `tan(\u03b8_top) = ${tanTop.toFixed(6)}`,
    '',
    `H = ${distanceMeters.toFixed(2)} \u00d7 (${tanTop.toFixed(6)} \u2212 ${tanBase.toFixed(6)})`,
    `H = ${heightMeters.toFixed(2)} m`,
  ].join('\n');
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

  const ladderBaseDistanceMeters = heightMeters != null ? heightMeters / LADDER_RATIO : null;
  const ladderLengthMeters = heightMeters != null
    ? Math.sqrt(heightMeters ** 2 + (heightMeters / LADDER_RATIO) ** 2)
    : null;

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

  return {
    valid: !hasError,
    heightMeters,
    angleSeparationDeg,
    confidenceLevel,
    issues,
    notes: [...MEASUREMENT_NOTES],
    ladderLengthMeters,
    ladderBaseDistanceMeters,
  };
}
