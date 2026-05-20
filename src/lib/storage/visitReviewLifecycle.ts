import {
  DEFAULT_ATLAS_VISIT_JOURNEY_STATE,
  isAtlasVisitJourneyAtLeast,
  isAtlasVisitJourneyState,
  normaliseAtlasVisitJourneyState,
  transitionAtlasVisitJourney,
  type AtlasVisitJourneyEvent,
  type AtlasVisitJourneyState,
} from './atlasVisitJourney';
import type { VisitEnvelopeV1 } from '../../contracts/VisitEnvelopeV1';

export type VisitReviewLifecycleState = AtlasVisitJourneyState;
export type VisitReviewLifecycleEvent = AtlasVisitJourneyEvent;
export { DEFAULT_ATLAS_VISIT_JOURNEY_STATE, transitionAtlasVisitJourney };

export type GeneratedOutputRendererV1 = 'library_customer_portal' | 'legacy_dev_only';
export const CANONICAL_PORTAL_RENDERER: GeneratedOutputRendererV1 = 'library_customer_portal';

export interface GeneratedOutputArtifactV1 {
  readonly generated: boolean;
  readonly generatedAt?: string;
  readonly url?: string;
  readonly version?: string;
  readonly documentId?: string;
  /** Which renderer this artifact targets. Canonical portal artifacts must use 'library_customer_portal'. */
  readonly renderer?: GeneratedOutputRendererV1;
}

export interface GeneratedOutputsV1 {
  readonly portal: GeneratedOutputArtifactV1;
  readonly pdf: GeneratedOutputArtifactV1;
  readonly simulatorReview: GeneratedOutputArtifactV1;
  readonly handoff: GeneratedOutputArtifactV1;
}

function createEmptyOutputArtifact(): GeneratedOutputArtifactV1 {
  return { generated: false };
}

export function buildGeneratedPortalArtifact(input: {
  readonly generatedAt: string;
  readonly url: string;
  readonly version?: string;
}): GeneratedOutputArtifactV1 {
  return {
    generated: true,
    generatedAt: input.generatedAt,
    url: input.url,
    version: input.version ?? '1.0',
    renderer: CANONICAL_PORTAL_RENDERER,
  };
}

export function createEmptyGeneratedOutputs(): GeneratedOutputsV1 {
  return {
    portal: createEmptyOutputArtifact(),
    pdf: createEmptyOutputArtifact(),
    simulatorReview: createEmptyOutputArtifact(),
    handoff: createEmptyOutputArtifact(),
  };
}

export function normaliseGeneratedOutputs(
  outputs: Partial<GeneratedOutputsV1> | undefined,
): GeneratedOutputsV1 {
  const base = createEmptyGeneratedOutputs();
  if (outputs == null) return base;
  return {
    portal: outputs.portal ?? base.portal,
    pdf: outputs.pdf ?? base.pdf,
    simulatorReview: outputs.simulatorReview ?? base.simulatorReview,
    handoff: outputs.handoff ?? base.handoff,
  };
}

export function withGeneratedPortalOutput(
  outputs: Partial<GeneratedOutputsV1> | undefined,
  portal: {
    readonly generatedAt: string;
    readonly url: string;
    readonly version?: string;
  },
): GeneratedOutputsV1 {
  return {
    ...normaliseGeneratedOutputs(outputs),
    portal: buildGeneratedPortalArtifact(portal),
  };
}

export function isLifecycleState(value: unknown): value is VisitReviewLifecycleState {
  return isAtlasVisitJourneyState(value);
}

export function normaliseVisitReviewLifecycleState(
  value: unknown,
): VisitReviewLifecycleState | undefined {
  return normaliseAtlasVisitJourneyState(value);
}

export function isLifecycleAtLeast(
  lifecycleState: VisitReviewLifecycleState,
  threshold: VisitReviewLifecycleState,
): boolean {
  return isAtlasVisitJourneyAtLeast(lifecycleState, threshold);
}

export type VisitEnvelopeReadinessProjectionV1 = Pick<VisitEnvelopeV1, 'recommendation' | 'topology'>;

export interface VisitReadinessProjectionV1 {
  readonly recommendationReady: boolean;
  readonly hasRecommendationPayload: boolean;
  readonly hasTopologyPayload: boolean;
  readonly presentationSurfacesUnlocked: boolean;
  readonly deliverySurfacesUnlocked: boolean;
  readonly portalOutputAvailable: boolean;
  readonly supportingPdfOutputAvailable: boolean;
  readonly handoffOutputAvailable: boolean;
  readonly exportOutputAvailable: boolean;
}

export function isLegacyVisitReadinessMode(
  envelope: VisitEnvelopeReadinessProjectionV1 | undefined,
  journeyState: VisitReviewLifecycleState | undefined,
): boolean {
  return envelope == null && journeyState == null;
}

/**
 * Projects visit workflow readiness from three canonical inputs:
 * - `envelope`: visit truth payloads (recommendation/topology/pdf payload),
 * - `generatedOutputs`: produced artifact registry,
 * - `journeyState`: lifecycle position in the state machine.
 *
 * Precedence:
 * - If `envelope` is provided, recommendation truth is derived strictly from
 *   envelope payloads (recommendation + topology), never from journey state.
 * - Artifact availability is always derived from `generatedOutputs`.
 * - Journey state controls progression unlocks (presentation/delivery/export),
 *   but does not invent missing envelope payload truth.
 */
export function projectVisitReadiness(
  envelope: VisitEnvelopeReadinessProjectionV1 | undefined,
  generatedOutputs: Partial<GeneratedOutputsV1> | undefined,
  journeyState: VisitReviewLifecycleState | undefined,
): VisitReadinessProjectionV1 {
  const outputs = normaliseGeneratedOutputs(generatedOutputs);
  const hasRecommendationPayload = envelope?.recommendation != null;
  const hasTopologyPayload = envelope?.topology != null;
  const hasEnvelopeRecommendationTruth = hasRecommendationPayload && hasTopologyPayload;
  const hasRecommendationByJourney =
    journeyState != null && isLifecycleAtLeast(journeyState, 'recommendation_ready');
  // Envelope payload truth is canonical when present; journey state alone must not
  // assert recommendation/topology truth in that mode.
  const recommendationReady = envelope != null
    ? hasEnvelopeRecommendationTruth
    : hasRecommendationByJourney;
  const presentationSurfacesUnlocked = recommendationReady && (
    journeyState == null
      || isLifecycleAtLeast(journeyState, 'recommendation_ready')
  );
  const deliverySurfacesUnlocked = recommendationReady && (
    journeyState != null
      && isLifecycleAtLeast(journeyState, 'presentation_ready')
  );
  return {
    recommendationReady,
    hasRecommendationPayload,
    hasTopologyPayload,
    presentationSurfacesUnlocked,
    deliverySurfacesUnlocked,
    portalOutputAvailable: outputs.portal.generated,
    supportingPdfOutputAvailable: outputs.pdf.generated,
    handoffOutputAvailable: deliverySurfacesUnlocked && outputs.handoff.generated,
    exportOutputAvailable: journeyState != null && isLifecycleAtLeast(journeyState, 'exported'),
  };
}

export function deriveLifecycleStateFromSnapshot(input: {
  readonly recommendationReady: boolean;
  readonly generatedOutputs?: Partial<GeneratedOutputsV1>;
}): VisitReviewLifecycleState {
  const outputs = normaliseGeneratedOutputs(input.generatedOutputs);
  if (outputs.handoff.generated) return 'handoff_ready';
  if (outputs.simulatorReview.generated || outputs.portal.generated || outputs.pdf.generated) {
    return 'presentation_ready';
  }
  if (input.recommendationReady) return 'recommendation_ready';
  return 'survey_in_progress';
}

export function isRecommendationReadyForLifecycle(input: {
  readonly decision?: unknown;
  readonly customerSummary?: unknown;
  readonly acceptedScenarioId?: string;
  readonly engineRecommendationPrimary?: string;
}): boolean {
  return (
    input.decision != null ||
    input.customerSummary != null ||
    input.acceptedScenarioId != null ||
    input.engineRecommendationPrimary != null
  );
}
