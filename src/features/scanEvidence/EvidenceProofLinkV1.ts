/**
 * EvidenceProofLinkV1.ts
 *
 * Types linking proposal / recommendation sections to captured evidence.
 *
 * Design rules:
 *   - Evidence supports existing engine decisions — it never drives them.
 *   - Proof links are read-only annotations; they cannot override the
 *     recommendation produced by the Atlas engine.
 *   - Unresolved references must only appear in engineer mode.
 *   - Customer-safe mode shows reviewed/confirmed support only.
 *   - A section with zero confirmed capture refs shows nothing (no empty
 *     "Evidence used" blocks in customer mode).
 */

// ─── Proposal sections ────────────────────────────────────────────────────────

/**
 * The proposal / recommendation section to which evidence is linked.
 *
 *   boiler      — Heat source selection (combi / system / regular / heat pump).
 *   cylinder    — Hot-water cylinder or thermal store.
 *   flue        — Flue route, clearances, and terminal location.
 *   radiators   — Room emitters, heat loss context, and surface observations.
 *   general     — Cross-cutting evidence that applies to the overall recommendation.
 */
export type ProposalSection = 'boiler' | 'cylinder' | 'flue' | 'radiators' | 'general';

// ─── Capture reference ────────────────────────────────────────────────────────

/**
 * A reference to a single capture point that provides supporting evidence.
 *
 * `storyboardCardKey` is the `StoryboardCardDefinition.key` value inside
 * `CapturedEvidencePanel` (e.g. 'key-objects', 'measurements', 'ghost-appliances').
 * When present, the deep-link should open that storyboard card directly.
 *
 * `isResolved` reflects the reviewer's decision:
 *   - true  → confirmed by engineer review; safe to show in customer mode.
 *   - false → needs review; shown in engineer mode only, flagged as pending.
 */
export interface EvidenceCaptureRef {
  /** Stable capture-point identifier (matches CapturedEvidencePanel). */
  capturePointId: string;
  /** The storyboard card key to open when the link is clicked. */
  storyboardCardKey: 'key-objects' | 'measurements' | 'ghost-appliances' | 'what-scanned' | 'open-review';
  /** Human-readable description of what this evidence shows. */
  label: string;
  /** False when this capture point is still flagged for engineer review. */
  isResolved: boolean;
}

// ─── Proof link ───────────────────────────────────────────────────────────────

/**
 * A single evidence proof link binding a proposal section to one or more
 * capture-point references.
 *
 * `reviewStatus` is the aggregate status of all capture refs in this link:
 *   confirmed    — all refs are resolved; safe for customer display.
 *   needs_review — at least one ref is unresolved; engineer-mode only.
 *   unresolved   — no refs have been reviewed yet; engineer-mode only.
 */
export interface EvidenceProofLinkV1 {
  /** The proposal section this evidence supports. */
  section: ProposalSection;
  /** Capture-point references that constitute the evidence. */
  captureRefs: EvidenceCaptureRef[];
  /** Aggregate review status across all captureRefs. */
  reviewStatus: 'confirmed' | 'needs_review' | 'unresolved';
}
