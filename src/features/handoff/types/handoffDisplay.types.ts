/**
 * handoffDisplay.types.ts
 *
 * View-model types for the Atlas Mind handoff arrival surface.
 *
 * HandoffDisplayModel is the single flattened read-model consumed by all
 * handoff arrival components.  It is derived by buildHandoffDisplayModel()
 * from an AtlasPropertyImportResult and shields the UI from the full depth
 * of AtlasPropertyV1.
 *
 * Architecture rule: components in src/components/handoff/ must depend only
 * on these types — never on AtlasPropertyV1 directly.
 */

import type { PlanOverallStatus, PlanChecklistItem } from '../../../features/floorplan/planReadinessValidator';

// ─── Knowledge confidence bucket ─────────────────────────────────────────────

/**
 * Three-state confidence bucket used for knowledge-summary fields.
 *
 *   confirmed — field is present and has high or medium confidence
 *   review    — field is present but has low confidence, is null, or
 *               carries a value of 'unknown'
 *   missing   — field is entirely absent
 */
export type KnowledgeStatus = 'confirmed' | 'review' | 'missing';

// ─── Knowledge summary ────────────────────────────────────────────────────────

export interface HandoffKnowledgeSummary {
  /** Adult/child composition of the household. */
  household: KnowledgeStatus;
  /** Occupancy pattern / hot-water usage. */
  usage: KnowledgeStatus;
  /** Current heating/DHW system family. */
  currentSystem: KnowledgeStatus;
  /** Customer-stated upgrade or comfort priorities. */
  priorities: KnowledgeStatus;
  /** Installation or access constraints. */
  constraints: KnowledgeStatus;
}

// ─── Readiness summary ────────────────────────────────────────────────────────

export interface HandoffReadinessSummary {
  /** True when the engine can run without any further data entry. */
  readyForSimulation: boolean;
  /** Required fields that are absent and will prevent simulation. */
  missingCritical: string[];
  /** Recommended fields that are absent but will not prevent simulation. */
  missingRecommended: string[];
  /** Human-readable warnings about low-confidence or borderline data. */
  confidenceWarnings: string[];
}

// ─── Spatial review summary ───────────────────────────────────────────────────

/**
 * Plan-readiness summary for the engineer handoff.
 *
 * Derived from validatePlanReadiness() when a PropertyPlan is available.
 * When no plan is attached to the handoff the `status` is 'incomplete' and
 * `items` is empty.
 */
export interface SpatialReviewSummary {
  /** Overall plan readiness status. */
  status: PlanOverallStatus;
  /** Short label for the status (e.g. "Ready for install review"). */
  statusLabel: string;
  /** Full checklist items from the validator. */
  items: PlanChecklistItem[];
  /** True when customer-facing spatial copy should be softened. */
  confidenceIsWeak: boolean;
}

// ─── HandoffDisplayModel ─────────────────────────────────────────────────────

/**
 * The single view-model object consumed by handoff arrival components.
 *
 * Built once by buildHandoffDisplayModel() from AtlasPropertyImportResult.
 * Components must not derive additional logic from AtlasPropertyV1 — all
 * presentational derivations belong in the selector.
 */
export interface HandoffDisplayModel {
  // ── Header ─────────────────────────────────────────────────────────────────
  /** Primary display title (formatted address or postcode). */
  title: string;
  /** Secondary descriptor (property type + build era, if available). */
  subtitle?: string;
  /** Always "From Atlas Scan" for handoff-originated sessions. */
  sourceLabel: 'From Atlas Scan';
  /** ISO-8601 timestamp of when the session was captured / completed. */
  capturedAt?: string;
  /** Short property reference (UPRN, job ref, or propertyId). */
  reference: string;

  // ── Capture summary ────────────────────────────────────────────────────────
  /** Number of rooms present in the building model. */
  roomCount: number;
  /** Number of system components present in the building model. */
  objectCount: number;
  /** Number of photos in the evidence layer. */
  photoCount: number;
  /** Number of voice notes in the evidence layer. */
  voiceNoteCount: number;
  /** Number of text notes in the evidence layer. */
  noteCount: number;
  /**
   * Number of facts that were extracted from structured voice knowledge or
   * high-confidence sources (high-confidence FieldValues present in the
   * canonical property).
   */
  extractedFactCount: number;

  // ── Knowledge summary ──────────────────────────────────────────────────────
  knowledge: HandoffKnowledgeSummary;

  // ── Readiness / warnings ───────────────────────────────────────────────────
  readiness: HandoffReadinessSummary;

  // ── Spatial review ─────────────────────────────────────────────────────────
  /**
   * Plan-readiness checklist derived from the attached PropertyPlan (if any).
   * Always present — when no plan is available, status is 'incomplete' and
   * items is empty.
   */
  spatialReview: SpatialReviewSummary;
}
