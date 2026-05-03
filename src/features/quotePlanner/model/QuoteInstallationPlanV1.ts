/**
 * QuoteInstallationPlanV1.ts — Atlas Mind state types for the Quote Planner.
 *
 * Defines the `QuoteInstallationPlanV1` draft contract and the supporting
 * sub-types used by the builder and selectors.
 *
 * Design rules:
 *   - This is an Atlas Mind–owned draft.  It is NOT a customer-facing output.
 *   - Scan evidence remains evidence (provenance/confidence preserved) until
 *     the engineer reviews and confirms it.
 *   - `generatedScope` is empty in this version — scope generation is deferred
 *     to a later PR.
 *   - Never generate customer-facing copy here.
 *   - Do not alter recommendation decisions or customer/safety flows.
 */

import type {
  QuoteSystemDescriptorV1,
  QuoteJobClassificationV1,
  QuoteFlueCalculationV1,
  QuoteFlueCalculationMode,
  QuoteRouteV1,
  QuoteFlueRouteV1,
} from '../calculators/quotePlannerTypes';

import type {
  QuotePlannerLocationKind,
  QuotePlannerLocationProvenance,
  QuotePlannerLocationConfidence,
  QuotePlannerRouteType,
  QuotePlannerRouteConfidence,
} from '../../scanImport/contracts/sessionCaptureV2';

// Re-export scan evidence types used by the plan — single import point for consumers.
export type {
  QuotePlannerLocationKind,
  QuotePlannerLocationProvenance,
  QuotePlannerLocationConfidence,
  QuotePlannerRouteType,
  QuotePlannerRouteConfidence,
};

// ─── Plan location ────────────────────────────────────────────────────────────

/**
 * A single candidate or confirmed install location in the quote plan.
 *
 * Provenance and confidence are always preserved verbatim from the source
 * (scan evidence, manual entry, etc.).  Never auto-promote `scan_inferred`
 * to `scan_confirmed` without an explicit engineer action.
 */
export interface QuotePlanLocationV1 {
  /** Stable identifier within the plan. */
  locationId: string;
  /** Role this location plays in the installation. */
  kind: QuotePlannerLocationKind;
  /** How this location was identified — preserved from evidence. */
  provenance: QuotePlannerLocationProvenance;
  /** Confidence in this location — preserved from evidence. */
  confidence: QuotePlannerLocationConfidence;
  /** Human-readable room label, if known. */
  roomLabel?: string;
  /** Object-pin ID from the originating scan session, if present. */
  linkedPinId?: string;
  /** Photo IDs from the originating scan session, if present. */
  linkedPhotoIds?: string[];
  /** Optional engineer-facing note. */
  notes?: string;
}

// ─── Plan route ───────────────────────────────────────────────────────────────

/**
 * A candidate pipe or service route in the quote plan.
 *
 * Physical lengths are only calculated when measurable coordinates and a
 * scale factor are available.  Routes without geometry carry confidence and
 * type only — no fake lengths are introduced.
 */
export interface QuotePlanCandidateRouteV1 {
  /** Stable identifier within the plan. */
  routeId: string;
  /** Service type this route carries. */
  routeType: QuotePlannerRouteType;
  /** Confidence in the route geometry / evidence. */
  confidence: QuotePlannerRouteConfidence;
  /**
   * Route geometry, if sufficient coordinate and scale data is available.
   * Absent when the scan evidence does not provide measurable coordinates.
   */
  geometry?: QuoteRouteV1;
  /** Object-pin IDs that trace this route, if present. */
  linkedPinIds?: string[];
  /** Optional engineer-facing note. */
  notes?: string;
}

// ─── Plan flue route ──────────────────────────────────────────────────────────

/**
 * A candidate flue route in the quote plan.
 *
 * Equivalent-length calculations are only run when enough data exists.
 * `calculationMode` must always be `generic_estimate` unless a confirmed
 * manufacturer rule set has been applied.
 */
export interface QuotePlanCandidateFlueRouteV1 {
  /** Stable identifier within the plan. */
  flueRouteId: string;
  /** Confidence in the flue route geometry / evidence. */
  confidence: QuotePlannerRouteConfidence;
  /**
   * Flue route geometry (segments), if sufficient data is available.
   * Absent when the scan evidence does not provide segment data.
   */
  geometry?: QuoteFlueRouteV1;
  /**
   * Equivalent-length calculation result, if the calculation could be run.
   * Absent when insufficient segment data exists.
   */
  calculation?: QuoteFlueCalculationV1;
  /**
   * How the equivalent-length calculation was (or would be) performed.
   * Always `generic_estimate` in this draft version unless manufacturer
   * data is explicitly supplied.
   */
  calculationMode: QuoteFlueCalculationMode;
  /** Object-pin IDs that trace this flue route, if present. */
  linkedPinIds?: string[];
  /** Optional engineer-facing note. */
  notes?: string;
}

// ─── Top-level plan ───────────────────────────────────────────────────────────

/**
 * QuoteInstallationPlanV1 — Atlas Mind draft contract for the quote planner.
 *
 * Produced by `buildQuoteInstallationPlanDraft` from the current survey
 * state, recommendation, and optional scan evidence.  This is an internal
 * Mind-owned draft — it is not a customer-facing output and must not drive
 * any customer or safety flow directly.
 *
 * `generatedScope` is intentionally empty in V1 — scope generation is owned
 * by a later PR.
 */
export interface QuoteInstallationPlanV1 {
  /** Stable plan identifier (UUID or opaque string). */
  planId: string;
  /**
   * Atlas visit ID this plan is associated with, if available.
   * May be absent when the plan is built outside a visit context.
   */
  visitId?: string;
  /** ISO-8601 timestamp when this draft was created. */
  createdAt: string;
  /**
   * Descriptor for the system being replaced.
   * `family` is `unknown` when the current system type cannot be determined.
   */
  currentSystem: QuoteSystemDescriptorV1;
  /**
   * Descriptor for the proposed system to be installed.
   * `family` is `unknown` when no recommendation is available.
   */
  proposedSystem: QuoteSystemDescriptorV1;
  /** Candidate or confirmed install locations in this plan. */
  locations: QuotePlanLocationV1[];
  /** Candidate pipe and service routes in this plan. */
  routes: QuotePlanCandidateRouteV1[];
  /** Candidate flue routes in this plan. */
  flueRoutes: QuotePlanCandidateFlueRouteV1[];
  /** Classified job type derived from current and proposed systems. */
  jobClassification: QuoteJobClassificationV1;
  /**
   * Generated scope items.
   * Empty in V1 — populated by a later PR.
   * Must not contain customer-facing copy in this version.
   */
  generatedScope: string[];
}
