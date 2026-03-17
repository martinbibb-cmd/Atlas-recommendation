/**
 * buildCompassState
 *
 * Maps EngineOutputV1 (+ optional current heat-source type) to a CompassState
 * that the HomeEnergyCompass visual can render directly.
 *
 * Coordinate system (same as the problem statement):
 *   x: -1 = West (Energy independence)  ···  +1 = East (Electrification)
 *   y: -1 = South (Low capital)          ···  +1 = North (Efficiency)
 *
 * Positions are rule-based directional signals — they are intentionally
 * approximate. Do not over-fit numeric precision: clarity is the goal.
 */

import type { EngineOutputV1, OpportunityStatus } from '../../contracts/EngineOutputV1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompassVector {
  /** East–West position: -1 = full West, +1 = full East. */
  x: number;
  /** North–South position: -1 = full South, +1 = full North. */
  y: number;
  /** Short label rendered next to the marker. */
  label?: string;
  type: 'current' | 'recommended' | 'opportunity';
}

export interface CompassState {
  /** Where the home currently sits on the compass. */
  current: CompassVector;
  /** Where the recommended system would move the home. Absent when the engine cannot recommend. */
  recommended?: CompassVector;
  /** Directional push vectors for each relevant future-energy opportunity. */
  opportunities: CompassVector[];
}

// ─── System-to-position lookup ────────────────────────────────────────────────

/**
 * Compass position for each system option ID.
 * Positions reflect the problem statement's directional model:
 *   - North: Efficiency / low running cost
 *   - East:  Electrification
 *   - South: Low capital / minimal change
 *   - West:  Energy independence
 */
const OPTION_ID_POSITION: Record<string, { x: number; y: number }> = {
  combi:           { x:  0.00, y: -0.70 }, // South — cheap, fast, minimal change
  regular_vented:  { x: -0.10, y: -0.60 }, // South — traditional, tank-fed hot water
  system_unvented: { x:  0.10, y: -0.50 }, // South — mains-fed supply, cylinder required
  stored_vented:   { x: -0.20, y: -0.40 }, // South-West — tank-fed hot water supply
  stored_unvented: { x:  0.00, y: -0.30 }, // South — mains-fed supply, cylinder
  ashp:            { x:  0.65, y:  0.65 }, // North-East — efficient + fully electric
};

/**
 * Compass position for each current heat-source type.
 * Uses the same grid as OPTION_ID_POSITION so markers align consistently.
 */
const HEAT_SOURCE_TYPE_POSITION: Record<string, { x: number; y: number }> = {
  combi:   { x:  0.00, y: -0.70 },
  regular: { x: -0.10, y: -0.60 },
  system:  { x:  0.10, y: -0.50 },
  ashp:    { x:  0.65, y:  0.65 },
  other:   { x:  0.00, y:  0.00 }, // unknown — centre
};

/** Fallback when the current system type is unknown. */
const UNKNOWN_POSITION = { x: 0, y: 0 };

// ─── Opportunity deltas ───────────────────────────────────────────────────────

/**
 * Directional push vector applied when an opportunity is at least check_required.
 * These are relative to the recommended (or current) position, not absolute.
 *
 * Solar PV  → pushes West  (energy independence)
 * EV        → pushes East  (electrification load)
 */
const OPPORTUNITY_DELTAS: Record<'solarPv' | 'evCharging', { x: number; y: number; label: string }> = {
  solarPv:    { x: -0.35, y:  0.10, label: '☀️ Solar PV' },
  evCharging: { x:  0.35, y:  0.00, label: '⚡ EV charging' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamps a value to [-1, 1]. */
function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/**
 * Derives the recommended system compass position from the engine output.
 * Returns null when the engine could not produce a single clear recommendation.
 */
function resolveRecommendedPosition(
  engineOutput: EngineOutputV1,
): { x: number; y: number; label: string } | null {
  const primary = engineOutput.recommendation.primary;

  // Ambiguous / withheld recommendations — no recommended marker.
  if (
    primary.startsWith('Recommendation withheld') ||
    primary.startsWith('Multiple') ||
    primary === ''
  ) {
    return null;
  }

  // Find the matching option card by label.
  const matchedOption = engineOutput.options?.find(
    opt => opt.label === primary,
  );

  if (matchedOption != null) {
    const pos = OPTION_ID_POSITION[matchedOption.id];
    if (pos != null) {
      return { ...pos, label: matchedOption.label };
    }
  }

  // Fallback: try matching by partial string for robustness.
  if (primary.includes('Air Source Heat Pump') || primary.includes('Heat Pump')) {
    return { ...OPTION_ID_POSITION.ashp, label: primary };
  }
  if (primary.includes('Combi') || primary.includes('On Demand')) {
    return { ...OPTION_ID_POSITION.combi, label: primary };
  }
  if (primary.includes('Unvented')) {
    return { ...OPTION_ID_POSITION.stored_unvented, label: primary };
  }
  if (primary.includes('Vented') || primary.includes('Regular')) {
    return { ...OPTION_ID_POSITION.regular_vented, label: primary };
  }
  if (primary.includes('System')) {
    return { ...OPTION_ID_POSITION.system_unvented, label: primary };
  }

  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build a CompassState from engine output and (optionally) the current
 * heat-source type from survey data.
 *
 * @param engineOutput  - Full EngineOutputV1 result.
 * @param currentHeatSourceType - Optional current system type from survey
 *   (EngineInputV2_3.currentHeatSourceType).
 */
export function buildCompassState(
  engineOutput: EngineOutputV1,
  currentHeatSourceType?: string | undefined,
): CompassState {
  // ── Current position ──────────────────────────────────────────────────────
  const currentRaw =
    currentHeatSourceType != null
      ? (HEAT_SOURCE_TYPE_POSITION[currentHeatSourceType] ?? UNKNOWN_POSITION)
      : UNKNOWN_POSITION;

  const current: CompassVector = {
    x:     clamp(currentRaw.x),
    y:     clamp(currentRaw.y),
    label: 'You are here',
    type:  'current',
  };

  // ── Recommended position ──────────────────────────────────────────────────
  const recPos = resolveRecommendedPosition(engineOutput);
  const recommended: CompassVector | undefined =
    recPos != null
      ? {
          x:     clamp(recPos.x),
          y:     clamp(recPos.y),
          label: recPos.label,
          type:  'recommended',
        }
      : undefined;

  // ── Opportunity vectors ───────────────────────────────────────────────────
  // Anchor point for opportunity arrows: recommended position, or current if absent.
  const anchorX = recommended?.x ?? current.x;
  const anchorY = recommended?.y ?? current.y;

  const opportunities: CompassVector[] = [];

  const feo = engineOutput.futureEnergyOpportunities;
  if (feo != null) {
    const statusWeight: Record<OpportunityStatus, number> = {
      suitable_now:             1.0,
      check_required:           0.65,
      not_currently_favoured:   0.0,   // do not render — not actionable
    };

    for (const key of ['solarPv', 'evCharging'] as const) {
      const assessment = feo[key];
      const delta = OPPORTUNITY_DELTAS[key];
      const weight = statusWeight[assessment.status];

      if (weight > 0) {
        opportunities.push({
          x:     clamp(anchorX + delta.x * weight),
          y:     clamp(anchorY + delta.y * weight),
          label: delta.label,
          type:  'opportunity',
        });
      }
    }
  }

  return { current, recommended, opportunities };
}
