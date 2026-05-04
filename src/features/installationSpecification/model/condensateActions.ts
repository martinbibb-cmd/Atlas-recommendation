/**
 * condensateActions.ts
 *
 * Pure action helpers for managing `QuotePlanCondensateRouteV1` entries.
 *
 * Design rules:
 *   - All functions are pure and side-effect-free.
 *   - No React dependencies — usable in reducers, tests, and non-React contexts.
 *   - Does not alter recommendation logic.
 *   - Never fabricates lengths: pipeRunM stays null until explicitly set.
 */

import type { QuotePlanCondensateRouteV1, CondensateDischargeKind } from './QuoteInstallationPlanV1';

// ─── External discharge kinds ─────────────────────────────────────────────────

/**
 * Discharge kinds that involve an external run and therefore carry freeze risk.
 */
const EXTERNAL_DISCHARGE_KINDS = new Set<CondensateDischargeKind>([
  'external_gully',
  'soakaway',
  'external_trace_heat',
]);

/**
 * Returns true when the discharge kind involves an external pipe section.
 */
export function isExternalDischargeKind(kind: CondensateDischargeKind): boolean {
  return EXTERNAL_DISCHARGE_KINDS.has(kind);
}

/**
 * Human-readable label map for discharge kinds.
 *
 * Defined in the model layer so both the UI and the scope builder can import
 * it without the scope builder depending on a React component file.
 */
export const CONDENSATE_DISCHARGE_LABELS: Record<CondensateDischargeKind, string> = {
  internal_waste:       'Internal waste',
  external_gully:       'External gully',
  soakaway:             'Soakaway',
  condensate_pump:      'Condensate pump',
  external_trace_heat:  'External with trace heat',
};

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Creates a new condensate route draft with the given discharge kind.
 *
 * `isExternal` is derived automatically from the discharge kind.
 * `pipeRunM` is null until explicitly set — no fake lengths.
 */
export function buildCondensateRouteDraft(
  dischargeKind: CondensateDischargeKind,
): QuotePlanCondensateRouteV1 {
  return {
    dischargeKind,
    isExternal:        isExternalDischargeKind(dischargeKind),
    pipeRunM:          null,
    needsVerification: false,
  };
}

// ─── Mutation helpers ─────────────────────────────────────────────────────────

/**
 * Updates the discharge kind on an existing condensate route.
 *
 * `isExternal` is re-derived from the new kind automatically.
 */
export function updateCondensateDischargeKind(
  route: QuotePlanCondensateRouteV1,
  dischargeKind: CondensateDischargeKind,
): QuotePlanCondensateRouteV1 {
  return {
    ...route,
    dischargeKind,
    isExternal: isExternalDischargeKind(dischargeKind),
  };
}

/**
 * Sets the estimated pipe run length.
 *
 * Passing null clears the length (e.g. when the engineer removes their estimate).
 */
export function updateCondensatePipeRun(
  route: QuotePlanCondensateRouteV1,
  pipeRunM: number | null,
): QuotePlanCondensateRouteV1 {
  return { ...route, pipeRunM };
}

/**
 * Toggles the `needsVerification` flag on the condensate route.
 */
export function toggleCondensateNeedsVerification(
  route: QuotePlanCondensateRouteV1,
): QuotePlanCondensateRouteV1 {
  return { ...route, needsVerification: !route.needsVerification };
}

/**
 * Sets the engineer note on the condensate route.
 */
export function updateCondensateNotes(
  route: QuotePlanCondensateRouteV1,
  notes: string,
): QuotePlanCondensateRouteV1 {
  return { ...route, notes: notes || undefined };
}
