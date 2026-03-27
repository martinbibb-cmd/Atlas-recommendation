/**
 * heatLossDerivations.ts
 *
 * Pure helper functions for the House / Heat Loss step.
 *
 * - roofOrientationLabel()  — human-readable compass label
 * - solarSuitabilitySummary() — concise solar potential sentence
 * - heatLossConfidenceLabel() — human-readable confidence label
 */

import type {
  RoofOrientation,
  ShadingLevel,
  HeatLossState,
} from './heatLossTypes';

// ─── Roof orientation ─────────────────────────────────────────────────────────

/** Full compass label for a RoofOrientation value. */
export function roofOrientationLabel(orientation: RoofOrientation): string {
  switch (orientation) {
    case 'N':       return 'North';
    case 'NE':      return 'North-east';
    case 'E':       return 'East';
    case 'SE':      return 'South-east';
    case 'S':       return 'South';
    case 'SW':      return 'South-west';
    case 'W':       return 'West';
    case 'NW':      return 'North-west';
    case 'unknown': return 'Unknown';
  }
}

/** One-line roof orientation summary, e.g. "Main usable roof faces south-west". */
export function roofOrientationSummary(orientation: RoofOrientation): string {
  if (orientation === 'unknown') return 'Orientation not yet captured';
  return `Main usable roof faces ${roofOrientationLabel(orientation).toLowerCase()}`;
}

// ─── Solar suitability ────────────────────────────────────────────────────────

/**
 * Derive a simple solar potential band from orientation + shading.
 *
 * Returns: 'good' | 'moderate' | 'poor' | 'unknown'
 */
export type SolarPotentialBand = 'good' | 'moderate' | 'poor' | 'unknown';

export function deriveSolarPotential(
  orientation: RoofOrientation,
  shading: ShadingLevel,
): SolarPotentialBand {
  if (orientation === 'unknown') return 'unknown';

  // Orientation score: south-facing bias
  const orientationScore: Record<RoofOrientation, number> = {
    S:       3,
    SE:      3,
    SW:      3,
    E:       2,
    W:       2,
    NE:      1,
    NW:      1,
    N:       0,
    unknown: -1,
  };
  const oScore = orientationScore[orientation];

  // Shading penalty
  const shadingPenalty: Record<ShadingLevel, number> = {
    little_or_none: 0,
    some:           1,
    heavy:          2,
    unknown:        0,
  };
  const penalty = shadingPenalty[shading];
  const net = oScore - penalty;

  if (net >= 3) return 'good';
  if (net >= 1) return 'moderate';
  return 'poor';
}

/** One-line solar suitability sentence. */
export function solarSuitabilitySummary(state: HeatLossState): string {
  const { roofOrientation, shadingLevel } = state;

  const shadingLabel: Record<ShadingLevel, string> = {
    little_or_none: 'Little or no shading',
    some:           'Some shading',
    heavy:          'Heavy shading',
    unknown:        '',
  };

  const parts: string[] = [];
  if (roofOrientation !== 'unknown') {
    parts.push(roofOrientationSummary(roofOrientation));
  }
  if (shadingLevel !== 'unknown') {
    parts.push(shadingLabel[shadingLevel]);
  }

  const potential = deriveSolarPotential(roofOrientation, shadingLevel);
  const potentialLabel: Record<SolarPotentialBand, string> = {
    good:     'Good PV potential',
    moderate: 'Moderate PV potential',
    poor:     'Limited PV potential',
    unknown:  '',
  };
  if (potential !== 'unknown') {
    parts.push(potentialLabel[potential]);
  }

  return parts.join(' · ');
}

// ─── Heat loss confidence ─────────────────────────────────────────────────────

/** Human-readable label for the heat loss confidence level. */
export function heatLossConfidenceLabel(
  confidence: HeatLossState['heatLossConfidence'],
): string {
  switch (confidence) {
    case 'measured':  return 'Measured';
    case 'estimated': return 'Estimated';
    case 'default':   return 'Default (unverified)';
    case 'unknown':   return 'Not set';
  }
}
