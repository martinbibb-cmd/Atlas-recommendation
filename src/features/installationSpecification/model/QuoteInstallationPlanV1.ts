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
  FlueFamily,
  PipeworkRouteKind,
  PipeworkRouteStatus,
  PipeworkInstallMethod,
  QuotePipeworkCalculationV1,
  QuotePointCoordinateSpace,
  QuotePointScale,
  QuoteRoutePointV1,
} from '../calculators/quotePlannerTypes';

// ─── Condensate route ─────────────────────────────────────────────────────────

/**
 * The discharge method selected for the condensate pipe.
 *
 * internal_waste        — routed to an internal waste pipe (sink trap, soil stack, etc.).
 * external_gully        — routed to an external gully at ground level.
 * soakaway              — terminated at a soakaway (requires soil permeability check).
 * condensate_pump       — lifted via a condensate pump to an internal discharge point.
 * external_trace_heat   — external run with trace heating to prevent freezing.
 */
export type CondensateDischargeKind =
  | 'internal_waste'
  | 'external_gully'
  | 'soakaway'
  | 'condensate_pump'
  | 'external_trace_heat';

/**
 * A condensate route in the installation plan.
 *
 * Separate from the generic pipework route list so the condensate step can
 * show discharge-type tiles and freeze-risk notices without polluting the
 * main pipework view.
 *
 * `pipeRunM` is the engineer-entered or estimated pipe length.
 * When null, no fake length is introduced — the item remains
 * 'needs_verification' confidence.
 */
export interface QuotePlanCondensateRouteV1 {
  /** Discharge method selected by the engineer. */
  dischargeKind: CondensateDischargeKind;
  /**
   * Whether the pipe run is (or includes) an external section.
   * Drives the freeze-risk notice.
   */
  isExternal: boolean;
  /**
   * Approximate pipe run length in metres.
   * Null when the engineer has not entered a length yet.
   */
  pipeRunM: number | null;
  /**
   * Whether the engineer has marked this route as needing on-site verification.
   */
  needsVerification: boolean;
  /** Optional engineer-facing note. */
  notes?: string;
}
import type { QuoteScopeItemV1 } from '../scope/buildQuoteScopeFromInstallationPlan';

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
  FlueFamily,
  PipeworkRouteKind,
  PipeworkRouteStatus,
  PipeworkInstallMethod,
  QuotePipeworkCalculationV1,
};
export type { QuoteScopeItemV1 };
export type { CondensateDischargeKind };

// ─── Plan-layer location kind ─────────────────────────────────────────────────

/**
 * Extended location kind for the quote plan layer.
 *
 * Adds drainage/waste discharge points that are only relevant at the plan
 * stage (not captured by the scan session kind set).  All scan-layer kinds
 * remain valid here.
 */
export type QuotePlanLocationKind =
  | QuotePlannerLocationKind
  | 'internal_waste'
  | 'soil_stack'
  | 'gully'
  | 'soakaway';

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
  kind: QuotePlanLocationKind;
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
  /**
   * Normalised (0–1) position on the floor-plan overlay image.
   * Absent when the location has not been placed on the floor plan yet.
   */
  planCoord?: { x: number; y: number };
  /**
   * Floor index (zero-based, ground = 0) this location sits on.
   * Absent when the floor is unknown or not yet assigned.
   */
  floorIndex?: number;
  /**
   * Whether the engineer has rejected/deleted this candidate.
   *
   * Rejected locations are retained as audit evidence but excluded from
   * active plan logic.  Never delete them from the array — soft-delete only.
   */
  rejected?: boolean;
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
   * Broad family / orientation of the flue run.
   * Set to 'unknown' until the engineer confirms the family.
   */
  family: FlueFamily;
  /**
   * Location ID of the proposed boiler within this plan's `locations` array.
   * Absent when the boiler location has not been linked yet.
   */
  boilerLocationId?: string;
  /**
   * Location ID of the proposed flue terminal within this plan's `locations` array.
   * Absent when the terminal location has not been linked yet.
   */
  terminalLocationId?: string;
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

// ─── Plan pipework route ──────────────────────────────────────────────────────

/**
 * A pipework route drawn by the engineer on the floor plan.
 *
 * Design rules:
 *   - `points` may be empty when status is 'reused_existing' and the exact
 *     route is known but not yet drawn (valid without full geometry).
 *   - `calculation` is always present and recalculated whenever points,
 *     penetration counts, install method, or scale changes.
 *   - When `coordinateSpace === 'pixels'` and no `scale` is supplied,
 *     `calculation.lengthConfidence` is 'needs_scale' and
 *     `calculation.lengthM` is null — no fake metres are introduced.
 */
export interface QuotePlanPipeworkRouteV1 {
  /** Stable identifier within the plan. */
  pipeworkRouteId: string;
  /** Service type carried by this route. */
  routeKind: PipeworkRouteKind;
  /** Status assigned by the engineer. */
  status: PipeworkRouteStatus;
  /** How the pipe is or will be physically installed. */
  installMethod: PipeworkInstallMethod;
  /** Optional pipe diameter (free text, e.g. "22mm", "15mm"). */
  diameter?: string;
  /** Ordered waypoints defining the route polyline. */
  points: QuoteRoutePointV1[];
  /** Coordinate space of the point coordinates. */
  coordinateSpace: QuotePointCoordinateSpace;
  /**
   * Scale factor — required when coordinateSpace is 'pixels'.
   * Omit for metre-space routes.
   */
  scale?: QuotePointScale;
  /** Location ID from the plan's `locations` array used as the start anchor. */
  startAnchorId?: string;
  /** Location ID from the plan's `locations` array used as the end anchor. */
  endAnchorId?: string;
  /** Number of wall penetrations along the route (set by the engineer). */
  wallPenetrationCount: number;
  /** Number of floor penetrations along the route (set by the engineer). */
  floorPenetrationCount: number;
  /** Optional engineer-facing note. */
  notes?: string;
  /** Current calculation result for this route. */
  calculation: QuotePipeworkCalculationV1;
}

// ─── Top-level plan ───────────────────────────────────────────────────────────

/**
 * QuoteInstallationPlanV1 — Atlas Mind draft contract for the quote planner.
 *
 * Produced by `buildInstallationSpecificationDraft` from the current survey
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
  /** Engineer-drawn pipework routes in this plan. */
  pipeworkRoutes: QuotePlanPipeworkRouteV1[];
  /**
   * Condensate route selected and configured by the engineer.
   * Absent until the engineer reaches the condensate step.
   */
  condensateRoute?: QuotePlanCondensateRouteV1;
  /** Classified job type derived from current and proposed systems. */
  jobClassification: QuoteJobClassificationV1;
  /**
   * Generated scope items.
   * Empty until `buildQuoteScopeFromInstallationPlan` is called on this plan.
   * Must not contain customer-facing copy.
   */
  generatedScope: QuoteScopeItemV1[];
}

// ─── Backward-compatible aliases ──────────────────────────────────────────────

/** @deprecated Use QuoteInstallationPlanV1 — alias for installation specification consumers. */
export type InstallSpecificationV1 = QuoteInstallationPlanV1;
/** @deprecated Use QuotePlanLocationV1 — alias for installation specification consumers. */
export type InstallSpecLocationV1 = QuotePlanLocationV1;
