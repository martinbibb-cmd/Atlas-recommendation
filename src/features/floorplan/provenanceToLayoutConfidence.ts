/**
 * provenanceToLayoutConfidence.ts
 *
 * PR11 — Single shared rule for mapping EntityProvenance → LayoutConfidence.
 *
 * All surfaces that need to display or compare confidence must use this
 * function so the labelling is consistent across:
 *   - floor objects and openings (planner inspector badges)
 *   - routes (planner + engineer handoff)
 *   - engineer layout summaries
 *
 * Rules
 * ─────
 *   manual  + corrected/reviewed → confirmed
 *   scanned + reviewed/corrected → confirmed
 *   scanned + unreviewed         → needs_verification
 *   imported_legacy + reviewed   → confirmed
 *   imported_legacy + unreviewed → needs_verification
 *   inferred                     → inferred  (review status is irrelevant)
 *   missing provenance           → fallback ?? needs_verification
 *
 * Route-status note
 * ─────────────────
 *   FloorRouteStatus ('existing' | 'proposed' | 'assumed') is orthogonal to
 *   provenance confidence. Call routeProvenanceToLayoutConfidence() for routes
 *   to ensure the 'assumed' status is never silently upgraded to 'confirmed'.
 */

import type { EntityProvenance } from '../../components/floorplan/propertyPlan.types';
import type { LayoutConfidence } from '../../contracts/EngineerLayout';

// ─── Core mapper ──────────────────────────────────────────────────────────────

/**
 * Maps an EntityProvenance record to a LayoutConfidence value.
 *
 * @param provenance  The provenance to evaluate. May be undefined.
 * @param fallback    Returned when provenance is absent or the source cannot
 *                    be resolved.  Defaults to 'needs_verification'.
 */
export function provenanceToLayoutConfidence(
  provenance?: EntityProvenance,
  fallback?: LayoutConfidence,
): LayoutConfidence {
  if (!provenance) return fallback ?? 'needs_verification';

  const { source, reviewStatus } = provenance;

  // Inferred data is always 'inferred' regardless of review status.
  if (source === 'inferred') return 'inferred';

  // Manual entries are confirmed once the user has touched them.
  if (source === 'manual') {
    if (reviewStatus === 'corrected' || reviewStatus === 'reviewed') return 'confirmed';
    return fallback ?? 'needs_verification';
  }

  // Scanned or legacy-imported data depends on whether a user has reviewed it.
  if (source === 'scanned' || source === 'imported_legacy') {
    if (reviewStatus === 'reviewed' || reviewStatus === 'corrected') return 'confirmed';
    return 'needs_verification';
  }

  return fallback ?? 'needs_verification';
}

// ─── Route helper ─────────────────────────────────────────────────────────────

/**
 * Maps provenance + FloorRouteStatus to a LayoutConfidence value.
 *
 * The 'assumed' route status is an engineer's explicit signal that the path
 * needs on-site verification and must NEVER be overridden by provenance data,
 * even if the route was drawn manually and marked 'corrected'.
 *
 * Proposed routes default to 'needs_verification' unless provenance clearly
 * confirms them (e.g. scanned + reviewed).
 *
 * @param status     The FloorRouteStatus of the route.
 * @param provenance The provenance record (may be undefined).
 */
export function routeProvenanceToLayoutConfidence(
  status: 'existing' | 'proposed' | 'assumed',
  provenance?: EntityProvenance,
): LayoutConfidence {
  // Assumed status is always preserved — provenance cannot upgrade it.
  if (status === 'assumed') return 'assumed';

  const fallback: LayoutConfidence =
    status === 'proposed' ? 'needs_verification' : 'confirmed';

  return provenanceToLayoutConfidence(provenance, fallback);
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Short human-readable labels for each LayoutConfidence value.
 * Used in inspector badge and engineer layout summary copy.
 */
export const LAYOUT_CONFIDENCE_LABELS: Record<LayoutConfidence, string> = {
  confirmed:          '✓ Confirmed',
  inferred:           '~ Inferred',
  assumed:            '? Assumed',
  needs_verification: '⚠ Needs verification',
};
