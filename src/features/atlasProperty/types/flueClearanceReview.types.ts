/**
 * flueClearanceReview.types.ts
 *
 * Engineer-facing review model for external flue clearance evidence.
 *
 * This review is separate from the raw capture evidence (ExternalClearanceSceneV1).
 * It records the engineer's judgement about a clearance scene — not an
 * automatically-calculated compliance result.
 *
 * Rules:
 * - No pass/fail wording in this model.
 * - No calculated compliance — only engineer judgement.
 * - Customer outputs are summary-only unless customerDetailEnabled is true.
 * - Default status is needs_review when a scene exists.
 * - Review is stored separately from capture evidence.
 */

// ─── Review status ────────────────────────────────────────────────────────────

/**
 * Engineer's review status for an external flue clearance scene.
 *
 * - not_reviewed:  Engineer has not yet looked at this scene.
 * - needs_review:  Default when flue evidence exists; review is required.
 * - acceptable:    Engineer judges clearance to be acceptable.
 * - concern:       Engineer has noted a concern that requires follow-up.
 * - blocked:       Engineer judges the clearance is insufficient to proceed.
 */
export type FlueClearanceReviewStatus =
  | 'not_reviewed'
  | 'needs_review'
  | 'acceptable'
  | 'concern'
  | 'blocked';

// ─── Review record ────────────────────────────────────────────────────────────

/**
 * Engineer review record for a single external flue clearance scene.
 *
 * Linked to ExternalClearanceSceneV1 by sceneId.
 * Stored separately — never mutates the capture evidence.
 */
export interface FlueClearanceReviewV1 {
  /** ID of the ExternalClearanceSceneV1 this review belongs to. */
  sceneId: string;

  /** Engineer's review judgement. Defaults to needs_review when a scene exists. */
  status: FlueClearanceReviewStatus;

  /** Free-text notes from the engineer regarding this scene. */
  notes?: string;

  /**
   * User ID of the engineer who performed the review.
   * Absent when the review has not yet been submitted.
   */
  reviewedByUserId?: string;

  /**
   * ISO-8601 timestamp when the review was last updated.
   * Absent when the review has not yet been submitted.
   */
  reviewedAt?: string;

  /**
   * When true, the full review detail (status label, notes) may be shown
   * in customer-facing outputs. When false (default), only a summary is
   * included in customer outputs.
   */
  customerDetailEnabled: boolean;
}
