/**
 * portalDisplay.types.ts
 *
 * PR9 — Portal-facing display model types.
 *
 * Components should consume PortalDisplayModel — not raw report payloads.
 * Schema interpretation belongs in selectors/buildPortalDisplayModel.ts.
 */

import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { RecommendationPresentationState } from '../../../lib/selection/optionSelection';

// ─── Evidence summary ─────────────────────────────────────────────────────────

/**
 * Aggregated counts of captured evidence attached to the property.
 * Sourced from atlasProperty.evidence on canonical payloads.
 */
export interface PortalEvidenceSummary {
  photoCount: number;
  voiceNoteCount: number;
  textNoteCount: number;
  extractedFactCount: number;
}

// ─── Knowledge summary ────────────────────────────────────────────────────────

/**
 * Status of each knowledge domain captured during the visit.
 * Sourced from atlasProperty.household / currentSystem / sessionKnowledge.
 */
export type KnowledgeStatus = 'confirmed' | 'review' | 'missing';

export interface PortalKnowledgeSummary {
  household: KnowledgeStatus;
  usage: KnowledgeStatus;
  currentSystem: KnowledgeStatus;
  priorities: KnowledgeStatus;
  constraints: KnowledgeStatus;
}

// ─── Portal display model ─────────────────────────────────────────────────────

/**
 * The portal-facing display model derived from a report payload.
 *
 * Components should read from this model — never from raw payload shapes.
 * Build it with buildPortalDisplayModel() in selectors/buildPortalDisplayModel.ts.
 */
export interface PortalDisplayModel {
  /** Customer-visible title for the property / recommendation. */
  propertyTitle: string;

  /** True when engine output is present and a recommendation can be shown. */
  recommendationReady: boolean;

  /** Option id Atlas recommends (from presentationState or engine output). */
  recommendedOptionId?: string;

  /** Option id the customer has expressed a preference for, if set. */
  chosenOptionId?: string;

  /** Full engine output — required for simulator launch and comparison cards. */
  engineOutput: EngineOutputV1;

  /**
   * Presentation-layer selection state.
   * null when the payload has no presentationState block.
   */
  presentationState?: RecommendationPresentationState | null;

  /**
   * Evidence counts sourced from atlasProperty.evidence.
   * Absent when only a legacy payload is available.
   */
  evidenceSummary?: PortalEvidenceSummary;

  /**
   * Knowledge-domain completeness sourced from canonical property fields.
   * Absent when only a legacy payload is available.
   */
  knowledgeSummary?: PortalKnowledgeSummary;
}
