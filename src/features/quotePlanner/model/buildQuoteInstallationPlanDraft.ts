/**
 * buildQuoteInstallationPlanDraft.ts
 *
 * Builds an initial `QuoteInstallationPlanV1` draft from the current survey
 * state, Atlas recommendation, and optional scan evidence.
 *
 * Design rules:
 *   - This builder is deterministic and side-effect-free.
 *   - Scan evidence remains evidence: provenance and confidence are preserved
 *     verbatim.  `scan_inferred` locations are never promoted to confirmed.
 *   - No fake lengths are introduced for routes without measurable coordinates.
 *   - `calculationMode` is always `generic_estimate` in this version.
 *   - `generatedScope` is empty — scope generation is deferred to a later PR.
 *   - Classification falls back to `needs_review` when data is insufficient.
 *   - Does not alter recommendation decisions or customer/safety flows.
 */

import type { EngineInputV2_3Contract } from '../../../contracts/EngineInputV2_3';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { SessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';
import type {
  QuotePlannerCandidateLocationV1,
  QuotePlannerCandidateRouteV1,
  QuotePlannerCandidateFlueRouteV1,
} from '../../scanImport/contracts/sessionCaptureV2';
import type { QuoteSystemDescriptorV1, QuoteSystemFamily } from '../calculators/quotePlannerTypes';
import { classifyQuoteJob } from '../calculators/jobClassification';
import type {
  QuoteInstallationPlanV1,
  QuotePlanLocationV1,
  QuotePlanCandidateRouteV1,
  QuotePlanCandidateFlueRouteV1,
} from './QuoteInstallationPlanV1';

// ─── Inputs ───────────────────────────────────────────────────────────────────

/**
 * Optional inputs to the draft builder.
 *
 * All fields are optional — the builder must produce a valid draft even when
 * every field is absent (falling back to `unknown` system families and empty
 * location/route arrays).
 */
export interface BuildQuoteInstallationPlanDraftInput {
  /**
   * Atlas visit identifier, used to tag the plan.
   * May be absent when building outside a visit context.
   */
  visitId?: string;
  /**
   * Stable plan identifier.  When absent, a simple ISO-timestamp-based ID is
   * generated.  Callers that need true UUIDs should supply one here.
   */
  planId?: string;
  /**
   * Validated engine input (survey state).  Used to seed `currentSystem`.
   * Optional — system family falls back to `unknown` when absent.
   */
  surveyInput?: EngineInputV2_3Contract;
  /**
   * The recommended Atlas scenario.  Used to seed `proposedSystem`.
   * Optional — system family falls back to `unknown` when absent.
   */
  recommendation?: ScenarioResult;
  /**
   * Validated SessionCaptureV2 from the scan session.  Used to import
   * candidate locations, routes, and flue routes from
   * `quotePlannerEvidence`.
   * Optional — arrays are empty when absent.
   */
  sessionCapture?: SessionCaptureV2;
}

// ─── Current system derivation ────────────────────────────────────────────────

/**
 * Maps the engine input's boiler type to a QuoteSystemFamily.
 */
function boilerTypeToFamily(
  boilerType: 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown' | undefined,
): QuoteSystemFamily {
  switch (boilerType) {
    case 'combi':    return 'combi';
    case 'system':   return 'system_stored';
    case 'regular':  return 'regular_stored';
    case 'back_boiler': return 'regular_stored';
    default:         return 'unknown';
  }
}

/**
 * Derive a `QuoteSystemDescriptorV1` for the current (existing) system from
 * the engine input.  Falls back to `{ family: 'unknown' }` when the survey
 * does not record the current system type.
 */
function deriveCurrentSystem(
  surveyInput: EngineInputV2_3Contract | undefined,
): QuoteSystemDescriptorV1 {
  const boiler = surveyInput?.currentSystem?.boiler;
  const family = boilerTypeToFamily(boiler?.type);
  return {
    family,
    hasStoredHotWater:
      family === 'system_stored' || family === 'regular_stored' ? true : undefined,
  };
}

// ─── Proposed system derivation ───────────────────────────────────────────────

/**
 * Maps a ScenarioResult system type to a QuoteSystemFamily.
 */
function scenarioTypeToFamily(
  scenarioType: ScenarioResult['system']['type'] | undefined,
): QuoteSystemFamily {
  switch (scenarioType) {
    case 'combi':   return 'combi';
    case 'system':  return 'system_stored';
    case 'regular': return 'regular_stored';
    case 'ashp':    return 'heat_pump';
    default:        return 'unknown';
  }
}

/**
 * Derive a `QuoteSystemDescriptorV1` for the proposed system from the
 * recommended scenario.  Falls back to `{ family: 'unknown' }` when no
 * recommendation is available.
 */
function deriveProposedSystem(
  recommendation: ScenarioResult | undefined,
): QuoteSystemDescriptorV1 {
  if (!recommendation) {
    return { family: 'unknown' };
  }
  const family = scenarioTypeToFamily(recommendation.system.type);
  return {
    family,
    hasStoredHotWater:
      family === 'system_stored' || family === 'regular_stored' || family === 'heat_pump'
        ? true
        : undefined,
  };
}

// ─── Location import ──────────────────────────────────────────────────────────

/**
 * Import candidate locations from scan evidence.
 *
 * Provenance and confidence are preserved verbatim.
 * `scan_inferred` locations are not promoted to `scan_confirmed`.
 */
function importLocations(
  candidates: QuotePlannerCandidateLocationV1[] | undefined,
): QuotePlanLocationV1[] {
  if (!candidates || candidates.length === 0) return [];

  return candidates.map<QuotePlanLocationV1>((loc) => ({
    locationId: loc.locationId,
    kind:        loc.kind,
    provenance:  loc.provenance,
    confidence:  loc.confidence,
    linkedPinId: loc.linkedPinId,
    linkedPhotoIds: loc.linkedPhotoIds,
    notes:       loc.notes,
  }));
}

// ─── Route import ─────────────────────────────────────────────────────────────

/**
 * Import candidate routes from scan evidence.
 *
 * Confidence is preserved verbatim.
 * No geometry or length is synthesised — absent geometry stays absent.
 */
function importRoutes(
  candidates: QuotePlannerCandidateRouteV1[] | undefined,
): QuotePlanCandidateRouteV1[] {
  if (!candidates || candidates.length === 0) return [];

  return candidates.map<QuotePlanCandidateRouteV1>((route) => ({
    routeId:    route.routeId,
    routeType:  route.routeType,
    confidence: route.confidence,
    linkedPinIds: route.linkedPinIds,
    notes:      route.notes,
    // geometry is absent — not enough data to calculate lengths from raw evidence
  }));
}

// ─── Flue route import ────────────────────────────────────────────────────────

/**
 * Import candidate flue routes from scan evidence.
 *
 * Confidence is preserved verbatim.
 * `calculationMode` is always `generic_estimate` — no manufacturer rule is
 * known at draft creation time.
 * Equivalent-length calculation is not run here; insufficient segment data.
 */
function importFlueRoutes(
  candidates: QuotePlannerCandidateFlueRouteV1[] | undefined,
): QuotePlanCandidateFlueRouteV1[] {
  if (!candidates || candidates.length === 0) return [];

  return candidates.map<QuotePlanCandidateFlueRouteV1>((flue) => ({
    flueRouteId:     flue.flueRouteId,
    confidence:      flue.confidence,
    family:          'unknown',
    calculationMode: 'generic_estimate',
    linkedPinIds:    flue.linkedPinIds,
    notes:           flue.notes,
    // geometry and calculation are absent — segment data not available from raw evidence
  }));
}

// ─── Plan ID generation ───────────────────────────────────────────────────────

/**
 * Generates a simple plan identifier from the current timestamp.
 * Produces a string like "qp-20260501090000000" (all numeric chars from the ISO
 * string).  Callers that need true UUIDs should supply a `planId` in the input.
 *
 * Note: not guaranteed unique within the same millisecond.  The `planId` input
 * parameter exists precisely for callers that require true uniqueness.
 */
function generatePlanId(now: string): string {
  return `qp-${now.replace(/[^0-9]/g, '')}`;
}

// ─── buildQuoteInstallationPlanDraft ─────────────────────────────────────────

/**
 * Build an initial `QuoteInstallationPlanV1` draft.
 *
 * @param input - Optional inputs: survey state, recommendation, scan capture.
 * @returns     A fully-typed draft with all unknowns represented as `unknown`
 *              system families, empty arrays, and `needs_review` classification.
 */
export function buildQuoteInstallationPlanDraft(
  input: BuildQuoteInstallationPlanDraftInput = {},
): QuoteInstallationPlanV1 {
  const {
    visitId,
    planId,
    surveyInput,
    recommendation,
    sessionCapture,
  } = input;

  const createdAt = new Date().toISOString();
  const resolvedPlanId = planId ?? generatePlanId(createdAt);

  const currentSystem  = deriveCurrentSystem(surveyInput);
  const proposedSystem = deriveProposedSystem(recommendation);

  const evidence = sessionCapture?.quotePlannerEvidence;
  const locations  = importLocations(evidence?.candidateLocations);
  const routes     = importRoutes(evidence?.candidateRoutes);
  const flueRoutes = importFlueRoutes(evidence?.candidateFlueRoutes);

  const jobClassification = classifyQuoteJob(currentSystem, proposedSystem);

  return {
    planId:           resolvedPlanId,
    visitId,
    createdAt,
    currentSystem,
    proposedSystem,
    locations,
    routes,
    flueRoutes,
    jobClassification,
    generatedScope: [],
  };
}
