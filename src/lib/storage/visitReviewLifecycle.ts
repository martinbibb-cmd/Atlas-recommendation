import {
  DEFAULT_ATLAS_VISIT_JOURNEY_STATE,
  isAtlasVisitJourneyAtLeast,
  isAtlasVisitJourneyState,
  normaliseAtlasVisitJourneyState,
  transitionAtlasVisitJourney,
  type AtlasVisitJourneyEvent,
  type AtlasVisitJourneyState,
} from './atlasVisitJourney';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { CustomerJourneyPackV1 } from '../../library/portal/pdf/buildPortalJourneyPrintModel';

export type VisitReviewLifecycleState = AtlasVisitJourneyState;
export type VisitReviewLifecycleEvent = AtlasVisitJourneyEvent;
export { DEFAULT_ATLAS_VISIT_JOURNEY_STATE, transitionAtlasVisitJourney };

export type GeneratedOutputRendererV1 = 'library_customer_portal' | 'legacy_dev_only';
export const CANONICAL_PORTAL_RENDERER: GeneratedOutputRendererV1 = 'library_customer_portal';

export interface GeneratedOutputArtifactV1<TPayload = unknown> {
  readonly generated: boolean;
  readonly generatedAt?: string;
  readonly url?: string;
  readonly version?: string;
  readonly documentId?: string;
  /** Which renderer this artifact targets. Canonical portal artifacts must use 'library_customer_portal'. */
  readonly renderer?: GeneratedOutputRendererV1;
  readonly schema?: string;
  readonly status?: string;
  readonly payload?: TPayload;
}

export interface GeneratedOutputsV1 {
  readonly portal: GeneratedOutputArtifactV1;
  readonly pdf: GeneratedOutputArtifactV1;
  readonly customerJourneyPack?: GeneratedOutputArtifactV1<CustomerJourneyPackV1>;
  readonly simulatorReview: GeneratedOutputArtifactV1;
  readonly handoff: GeneratedOutputArtifactV1;
}

function createEmptyOutputArtifact<TPayload = unknown>(): GeneratedOutputArtifactV1<TPayload> {
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
    customerJourneyPack: createEmptyOutputArtifact(),
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
    customerJourneyPack: outputs.customerJourneyPack ?? base.customerJourneyPack,
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

export interface VisitEnvelopeIdentityProjectionV1 {
  readonly visitId?: string;
  readonly visitReference?: string;
}

export interface VisitEnvelopeSelectedScenarioProjectionV1 {
  readonly scenarioId?: string;
}

export interface VisitEnvelopeTopologyProjectionV1 {
  readonly topologyId?: string;
}

export interface VisitEnvelopeReadinessProjectionV1 {
  readonly identity?: VisitEnvelopeIdentityProjectionV1;
  readonly surveySnapshot?: unknown;
  /** Legacy alias consumed by older callers; prefer surveySnapshot. */
  readonly survey?: unknown;
  readonly engineInputSnapshot?: unknown;
  readonly recommendationResult?: unknown;
  /** Legacy alias consumed by older callers; prefer recommendationResult. */
  readonly recommendation?: unknown;
  readonly selectedScenario?: VisitEnvelopeSelectedScenarioProjectionV1;
  /** Legacy alias consumed by older callers; prefer selectedScenario.scenarioId. */
  readonly selectedScenarioId?: string;
  readonly topology?: VisitEnvelopeTopologyProjectionV1;
  readonly customerSummary?: unknown;
  readonly generatedOutputs?: Partial<GeneratedOutputsV1>;
}

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

export interface BuildVisitEnvelopeReadinessProjectionInputV1 {
  readonly visitId: string;
  readonly visitReference?: string;
  readonly surveySnapshot?: unknown;
  /** Legacy alias consumed by older callers; prefer surveySnapshot. */
  readonly survey?: unknown;
  readonly engineInputSnapshot?: unknown;
  readonly acceptedScenario?: ScenarioResult;
  /** Explicit selected scenario override; decision.recommendedScenarioId is used as fallback. */
  readonly selectedScenarioId?: string;
  readonly decision?: AtlasDecisionV1;
  readonly customerSummary?: unknown;
  readonly engineOutput?: EngineOutputV1;
  readonly recommendationResult?: unknown;
  /** Legacy alias consumed by older callers; prefer recommendationResult. */
  readonly recommendation?: unknown;
  readonly generatedOutputs?: Partial<GeneratedOutputsV1>;
}

function resolveVisitEnvelopeTopologyFromScenario(
  acceptedScenario: ScenarioResult | undefined,
  fallbackScenarioId: string | undefined,
  engineOutput: EngineOutputV1 | undefined,
): VisitEnvelopeReadinessProjectionV1['topology'] | undefined {
  const topologyByScenarioId: Record<string, string> = {
    combi: 'combi',
    system: 'sealed_system_unvented',
    system_unvented: 'sealed_system_unvented',
    regular: 'open_vented',
    open_vented: 'open_vented',
    ashp: 'heat_pump',
    heat_pump: 'heat_pump',
    mixergy: 'mixergy',
    system_mixergy: 'mixergy',
    thermal_store: 'thermal_store',
  };
  const selectedScenarioId = acceptedScenario?.scenarioId ?? fallbackScenarioId;
  if (selectedScenarioId != null) {
    const normalized = selectedScenarioId.toLowerCase();
    const mapped = topologyByScenarioId[normalized];
    if (mapped != null) return { topologyId: mapped };
  }
  const scenarioType = acceptedScenario?.system.type;
  if (scenarioType === 'combi') return { topologyId: 'combi' };
  if (scenarioType === 'system') return { topologyId: 'sealed_system_unvented' };
  if (scenarioType === 'regular') return { topologyId: 'open_vented' };
  if (scenarioType === 'ashp') return { topologyId: 'heat_pump' };
  const recommendationPrimary = engineOutput?.recommendation?.primary?.toLowerCase();
  if (recommendationPrimary === 'combi') return { topologyId: 'combi' };
  if (recommendationPrimary === 'system') return { topologyId: 'sealed_system_unvented' };
  if (recommendationPrimary === 'regular') return { topologyId: 'open_vented' };
  if (recommendationPrimary === 'ashp') return { topologyId: 'heat_pump' };
  return undefined;
}

export function buildVisitEnvelopeReadinessProjection(
  input: BuildVisitEnvelopeReadinessProjectionInputV1 | undefined,
): VisitEnvelopeReadinessProjectionV1 | undefined {
  if (input == null) return undefined;
  const selectedScenarioId =
    input.acceptedScenario?.scenarioId
    ?? input.selectedScenarioId
    ?? input.decision?.recommendedScenarioId;
  const recommendationPayload =
    input.recommendationResult
    ?? input.recommendation
    ?? input.decision
    ?? input.customerSummary
    ?? input.engineOutput;
  return {
    identity: {
      visitId: input.visitId,
      visitReference: input.visitReference,
    },
    surveySnapshot: input.surveySnapshot ?? input.survey,
    survey: input.survey ?? input.surveySnapshot,
    engineInputSnapshot: input.engineInputSnapshot,
    recommendationResult: recommendationPayload,
    recommendation: recommendationPayload,
    selectedScenario: hasText(selectedScenarioId) ? { scenarioId: selectedScenarioId } : undefined,
    selectedScenarioId,
    topology: resolveVisitEnvelopeTopologyFromScenario(
      input.acceptedScenario,
      selectedScenarioId,
      input.engineOutput,
    ),
    customerSummary: input.customerSummary,
    generatedOutputs: normaliseGeneratedOutputs(input.generatedOutputs),
  };
}

export function isLegacyVisitReadinessMode(
  envelope: VisitEnvelopeReadinessProjectionV1 | undefined,
  journeyState: VisitReviewLifecycleState | undefined,
): boolean {
  return envelope == null && journeyState == null;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValue(value: unknown): boolean {
  return value != null;
}

export function isVisitEnvelopeProposalReady(
  envelope: VisitEnvelopeReadinessProjectionV1 | undefined,
): boolean {
  if (envelope == null) return false;
  const hasVisitIdentity = hasText(envelope.identity?.visitId);
  const hasSurveySnapshot = hasValue(envelope.surveySnapshot) || hasValue(envelope.survey);
  const hasEngineInputSnapshot = hasValue(envelope.engineInputSnapshot);
  const hasRecommendationResult = hasValue(envelope.recommendationResult) || hasValue(envelope.recommendation);
  const hasSelectedScenario =
    hasText(envelope.selectedScenario?.scenarioId) || hasText(envelope.selectedScenarioId);
  const hasTopologyPayload = hasText(envelope.topology?.topologyId);
  const hasCustomerSummary = hasValue(envelope.customerSummary);
  const hasGeneratedOutputRefsStatus = hasValue(envelope.generatedOutputs);
  return (
    hasVisitIdentity
    && hasSurveySnapshot
    && hasEngineInputSnapshot
    && hasRecommendationResult
    && hasSelectedScenario
    && hasTopologyPayload
    && hasCustomerSummary
    && hasGeneratedOutputRefsStatus
  );
}

export function isVisitEnvelopeDeliveryReady(
  envelope: VisitEnvelopeReadinessProjectionV1 | undefined,
  generatedOutputs: Partial<GeneratedOutputsV1> | undefined,
): boolean {
  if (!isVisitEnvelopeProposalReady(envelope)) return false;
  const outputs = normaliseGeneratedOutputs(generatedOutputs);
  return outputs.portal.generated || outputs.pdf.generated || outputs.handoff.generated || outputs.simulatorReview.generated;
}

/**
 * Projects visit workflow readiness from three canonical inputs:
 * - `envelope`: visit truth payloads (recommendation/topology/pdf payload),
 * - `generatedOutputs`: produced artifact registry,
 * - `journeyState`: lifecycle position in the state machine.
 *
 * Precedence:
 * - If `envelope` is provided, recommendation truth is derived strictly from
 *   proposal-ready envelope payloads, never from journey state.
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
  const hasRecommendationPayload = envelope?.recommendationResult != null || envelope?.recommendation != null;
  const hasTopologyPayload = hasText(envelope?.topology?.topologyId);
  const hasEnvelopeRecommendationTruth = isVisitEnvelopeProposalReady(envelope);
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
  const deliveryReady = isVisitEnvelopeDeliveryReady(envelope, outputs);
  return {
    recommendationReady,
    hasRecommendationPayload,
    hasTopologyPayload,
    presentationSurfacesUnlocked,
    deliverySurfacesUnlocked,
    portalOutputAvailable: outputs.portal.generated,
    supportingPdfOutputAvailable: outputs.pdf.generated,
    handoffOutputAvailable: deliverySurfacesUnlocked && deliveryReady && outputs.handoff.generated,
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
