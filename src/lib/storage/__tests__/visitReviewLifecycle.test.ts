import { describe, it, expect } from 'vitest';
import {
  CANONICAL_PORTAL_RENDERER,
  buildVisitEnvelopeReadinessProjection,
  buildGeneratedOutputDependencyProjection,
  buildGeneratedPortalArtifact,
  createEmptyGeneratedOutputs,
  isArtifactStaleForActiveSnapshot,
  isVisitEnvelopeDeliveryReady,
  isVisitEnvelopeProposalReady,
  projectVisitReadiness,
  type VisitEnvelopeReadinessProjectionV1,
  withGeneratedPortalOutput,
} from '../visitReviewLifecycle';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';

function buildProposalReadyEnvelope(
  overrides: Partial<VisitEnvelopeReadinessProjectionV1> = {},
): VisitEnvelopeReadinessProjectionV1 {
  return {
    identity: { visitId: 'visit_1' },
    surveySnapshot: { postcode: 'SW1A 1AA' },
    engineInputSnapshot: { postcode: 'SW1A 1AA' },
    recommendationResult: { primary: 'combi' },
    recommendation: { primary: 'combi' },
    selectedScenario: { scenarioId: 'combi' },
    selectedScenarioId: 'combi',
    topology: { topologyId: 'combi' },
    customerSummary: { headline: 'Combi replacement' },
    generatedOutputs: createEmptyGeneratedOutputs(),
    ...overrides,
  };
}

function buildScenario(
  scenarioId: string,
  type: ScenarioResult['system']['type'] = 'combi',
): ScenarioResult {
  return {
    scenarioId,
    system: { type, summary: 'Summary' },
    performance: {
      hotWater: 'good',
      heating: 'good',
      efficiency: 'good',
      reliability: 'good',
    },
    keyBenefits: [],
    keyConstraints: [],
    dayToDayOutcomes: [],
    requiredWorks: [],
    upgradePaths: [],
    physicsFlags: {},
  };
}

describe('visitReviewLifecycle', () => {
  it('buildGeneratedPortalArtifact uses the canonical customer portal renderer', () => {
    const artifact = buildGeneratedPortalArtifact({
      generatedAt: '2026-05-17T10:00:00.000Z',
      url: 'https://atlas.test/portal/demo?token=signed-token',
    });

    expect(artifact.generated).toBe(true);
    expect(artifact.renderer).toBe(CANONICAL_PORTAL_RENDERER);
    expect(artifact.renderer).not.toBe('legacy_dev_only');
  });

  it('withGeneratedPortalOutput preserves existing outputs while marking the portal generated', () => {
    const outputs = withGeneratedPortalOutput(
      {
        ...createEmptyGeneratedOutputs(),
        pdf: {
          generated: true,
          generatedAt: '2026-05-17T10:00:00.000Z',
          documentId: 'pdf-123',
          version: '1.0',
        },
      },
      {
        generatedAt: '2026-05-17T11:00:00.000Z',
        url: 'https://atlas.test/portal/demo?token=signed-token',
      },
    );

    expect(outputs.portal.generated).toBe(true);
    expect(outputs.portal.renderer).toBe(CANONICAL_PORTAL_RENDERER);
    expect(outputs.portal.url).toContain('/portal/demo?token=');
    expect(outputs.pdf.generated).toBe(true);
    expect(outputs.pdf.documentId).toBe('pdf-123');
  });

  it('presentation_ready without portal output keeps portal generation required', () => {
    const projection = projectVisitReadiness(
      buildProposalReadyEnvelope(),
      createEmptyGeneratedOutputs(),
      'presentation_ready',
    );

    expect(projection.presentationSurfacesUnlocked).toBe(true);
    expect(projection.portalOutputAvailable).toBe(false);
  });

  it('recommendation_ready does not unlock delivery surfaces', () => {
    const projection = projectVisitReadiness(
      buildProposalReadyEnvelope(),
      createEmptyGeneratedOutputs(),
      'recommendation_ready',
    );

    expect(projection.deliverySurfacesUnlocked).toBe(false);
    expect(projection.exportOutputAvailable).toBe(false);
  });

  it('legacy-normalised presentation_ready preserves generated output semantics', () => {
    const projection = projectVisitReadiness(
      buildProposalReadyEnvelope(),
      {
        ...createEmptyGeneratedOutputs(),
        portal: { generated: true },
        pdf: { generated: true },
      },
      'presentation_ready',
    );

    expect(projection.portalOutputAvailable).toBe(true);
    expect(projection.supportingPdfOutputAvailable).toBe(true);
  });

  it('journey state cannot override missing envelope recommendation/topology payloads', () => {
    const missingRecommendationProjection = projectVisitReadiness(
      buildProposalReadyEnvelope({ recommendationResult: undefined, recommendation: undefined }),
      createEmptyGeneratedOutputs(),
      'presentation_ready',
    );
    const missingTopologyProjection = projectVisitReadiness(
      buildProposalReadyEnvelope({ topology: undefined }),
      createEmptyGeneratedOutputs(),
      'presentation_ready',
    );

    expect(missingRecommendationProjection.recommendationReady).toBe(false);
    expect(missingRecommendationProjection.presentationSurfacesUnlocked).toBe(false);
    expect(missingTopologyProjection.recommendationReady).toBe(false);
    expect(missingTopologyProjection.presentationSurfacesUnlocked).toBe(false);
  });

  it('isVisitEnvelopeProposalReady returns false for incomplete envelopes', () => {
    expect(isVisitEnvelopeProposalReady(undefined)).toBe(false);
    expect(isVisitEnvelopeProposalReady(buildProposalReadyEnvelope({ identity: undefined }))).toBe(false);
    expect(isVisitEnvelopeProposalReady(buildProposalReadyEnvelope({ surveySnapshot: undefined, survey: undefined }))).toBe(false);
    expect(isVisitEnvelopeProposalReady(buildProposalReadyEnvelope({ engineInputSnapshot: undefined }))).toBe(false);
    expect(isVisitEnvelopeProposalReady(buildProposalReadyEnvelope({ recommendationResult: undefined, recommendation: undefined }))).toBe(false);
    expect(isVisitEnvelopeProposalReady(buildProposalReadyEnvelope({ selectedScenario: undefined, selectedScenarioId: undefined }))).toBe(false);
    expect(isVisitEnvelopeProposalReady(buildProposalReadyEnvelope({ topology: undefined }))).toBe(false);
    expect(isVisitEnvelopeProposalReady(buildProposalReadyEnvelope({ customerSummary: undefined }))).toBe(false);
    expect(isVisitEnvelopeProposalReady(buildProposalReadyEnvelope({ generatedOutputs: undefined }))).toBe(false);
  });

  it('isVisitEnvelopeDeliveryReady requires proposal truth plus generated artifacts', () => {
    const proposalReady = buildProposalReadyEnvelope();
    expect(isVisitEnvelopeDeliveryReady(proposalReady, createEmptyGeneratedOutputs())).toBe(false);
    expect(
      isVisitEnvelopeDeliveryReady(proposalReady, {
        ...createEmptyGeneratedOutputs(),
        portal: { generated: true },
      }),
    ).toBe(true);
    expect(isVisitEnvelopeDeliveryReady(buildProposalReadyEnvelope({ topology: undefined }), {
      ...createEmptyGeneratedOutputs(),
      portal: { generated: true },
    })).toBe(false);
  });

  it('buildVisitEnvelopeReadinessProjection resolves selected scenario from accepted scenario first', () => {
    const envelope = buildVisitEnvelopeReadinessProjection({
      visitId: 'visit_1',
      acceptedScenario: buildScenario('system_unvented', 'system'),
      selectedScenarioId: 'combi',
      generatedOutputs: createEmptyGeneratedOutputs(),
    });

    expect(envelope?.selectedScenario?.scenarioId).toBe('system_unvented');
    expect(envelope?.selectedScenarioId).toBe('system_unvented');
  });

  it('buildVisitEnvelopeReadinessProjection maps topology from selected scenario', () => {
    const envelope = buildVisitEnvelopeReadinessProjection({
      visitId: 'visit_1',
      acceptedScenario: buildScenario('system_unvented', 'system'),
      generatedOutputs: createEmptyGeneratedOutputs(),
    });

    expect(envelope?.topology?.topologyId).toBe('sealed_system_unvented');
  });

  it('buildVisitEnvelopeReadinessProjection missing topology fails proposal readiness', () => {
    const envelope = buildVisitEnvelopeReadinessProjection({
      visitId: 'visit_1',
      surveySnapshot: { postcode: 'SW1A 1AA' },
      engineInputSnapshot: { postcode: 'SW1A 1AA' },
      selectedScenarioId: 'unknown_scenario',
      recommendationResult: { primary: 'unknown' },
      customerSummary: { headline: 'Unknown option' },
      generatedOutputs: createEmptyGeneratedOutputs(),
    });

    expect(envelope?.topology).toBeUndefined();
    expect(isVisitEnvelopeProposalReady(envelope)).toBe(false);
  });

  it('buildVisitEnvelopeReadinessProjection preserves generated output refs', () => {
    const envelope = buildVisitEnvelopeReadinessProjection({
      visitId: 'visit_1',
      generatedOutputs: {
        ...createEmptyGeneratedOutputs(),
        portal: {
          generated: true,
          generatedAt: '2026-05-20T10:00:00.000Z',
          url: 'https://atlas.test/portal/demo?token=abc',
          version: '1.0',
          renderer: CANONICAL_PORTAL_RENDERER,
        },
      },
    });

    expect(envelope?.generatedOutputs?.portal.generated).toBe(true);
    expect(envelope?.generatedOutputs?.portal.url).toContain('/portal/demo?token=');
  });

  it('buildVisitEnvelopeReadinessProjection keeps legacy recommendation shape compatible', () => {
    const legacyRecommendation = { primary: 'combi' };
    const envelope = buildVisitEnvelopeReadinessProjection({
      visitId: 'visit_1',
      surveySnapshot: { postcode: 'SW1A 1AA' },
      engineInputSnapshot: { postcode: 'SW1A 1AA' },
      recommendation: legacyRecommendation,
      selectedScenarioId: 'combi',
      customerSummary: { headline: 'Combi replacement' },
      generatedOutputs: createEmptyGeneratedOutputs(),
    });

    expect(envelope?.recommendationResult).toEqual(legacyRecommendation);
    expect(envelope?.recommendation).toEqual(legacyRecommendation);
    expect(isVisitEnvelopeProposalReady(envelope)).toBe(true);
  });

  it('detects stale generated artifacts when snapshot ids diverge', () => {
    expect(isArtifactStaleForActiveSnapshot(
      { generated: true, snapshotId: 'snapshot-old' },
      'snapshot-new',
    )).toBe(true);
    expect(isArtifactStaleForActiveSnapshot(
      { generated: true, snapshotId: 'snapshot-active' },
      'snapshot-active',
    )).toBe(false);
  });

  it('buildGeneratedOutputDependencyProjection flags stale dependencies', () => {
    const projection = buildGeneratedOutputDependencyProjection({
      ...createEmptyGeneratedOutputs(),
      portal: { generated: true, snapshotId: 'snapshot-1' },
      simulatorReview: { generated: true, snapshotId: 'snapshot-2' },
    }, 'snapshot-2');
    const portal = projection.find((entry) => entry.artifact === 'portal');
    const simulator = projection.find((entry) => entry.artifact === 'simulatorReview');
    expect(portal?.stale).toBe(true);
    expect(simulator?.stale).toBe(false);
  });
});
