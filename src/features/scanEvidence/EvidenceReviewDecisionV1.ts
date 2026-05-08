/**
 * EvidenceReviewDecisionV1.ts
 *
 * Model types for engineer review decisions on captured scan evidence.
 *
 * Design rules:
 *   - Review decisions are an overlay on captured evidence — they never mutate
 *     the underlying SessionCaptureV2.
 *   - Confirmation does not alter Atlas engine recommendation logic.
 *   - Rejected evidence is retained as audit evidence in engineer mode.
 *   - Only confirmed evidence is eligible for customer-facing proof output.
 *   - Storage is visit-scoped (keyed by visitId) so decisions persist with
 *     the job rather than the scan session.
 */

// ─── Evidence item kinds ──────────────────────────────────────────────────────

/**
 * Category of evidence item that can receive a review decision.
 *
 *   object_pin     — A pinned equipment or fixture object in the scan.
 *   photo          — A photo captured during the session.
 *   ghost_appliance — A ghost/inferred appliance placement from the scan graph.
 *   measurement    — A captured measurement (length, height, area, etc.).
 *   room_geometry  — A room geometry warning or anomaly flag.
 */
export type EvidenceItemKind =
  | 'object_pin'
  | 'photo'
  | 'ghost_appliance'
  | 'measurement'
  | 'room_geometry';

// ─── Review status ────────────────────────────────────────────────────────────

/**
 * The status assigned by the engineer when reviewing an evidence item.
 *
 *   confirmed    — Engineer has verified this item; safe for customer output.
 *   rejected     — Engineer has dismissed this item; hidden from customer output
 *                  but retained as audit evidence in engineer mode.
 *   needs_review — Explicitly flagged for further review; shown in engineer mode
 *                  with a warning badge; excluded from customer output.
 */
export type EvidenceReviewStatus = 'confirmed' | 'rejected' | 'needs_review';

// ─── Decision record ──────────────────────────────────────────────────────────

/**
 * A single review decision made by the engineer for one evidence item.
 */
export interface EvidenceReviewDecisionV1 {
  /** Stable identifier of the evidence item (e.g. pinId, photoId). */
  itemId: string;
  /** Category of the evidence item. */
  kind: EvidenceItemKind;
  /** The engineer's review decision. */
  status: EvidenceReviewStatus;
  /** Optional engineer note explaining the decision. */
  engineerNote?: string;
  /** ISO-8601 timestamp when the decision was recorded. */
  decidedAt: string;
}

// ─── Review map ───────────────────────────────────────────────────────────────

/**
 * All review decisions for a single visit, keyed by evidence item ID.
 */
export type EvidenceReviewMap = Record<string, EvidenceReviewDecisionV1>;
