import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1,
  buildDebugProjectionTimelineV1,
  buildDhwRecoveryMetricsV1,
  buildHydraulicConfidenceReportV1,
  buildLegoTechnixExplainabilityReportV1,
  runLegoTechnixScenarioV1,
} from '..';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildScenarioForTemplate(templateId?: string) {
  const template = templateId
    ? LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1.find((entry) => entry.id === templateId)
    : LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0];

  if (!template) {
    throw new Error('Missing canonical template.');
  }

  const scenarioResult = runLegoTechnixScenarioV1({
    graph: template.graph,
    initialState: clone(template.initialState),
    ...template.scenario,
    durationSeconds: Math.min(900, Math.max(template.scenario.durationSeconds, 300)),
  });
  const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);
  const hydraulicConfidenceReport = buildHydraulicConfidenceReportV1(template.graph, {
    ...scenarioResult,
    dhwRecoveryMetrics,
  });
  const explainabilityReport = buildLegoTechnixExplainabilityReportV1({
    graph: template.graph,
    scenarioResult,
    dhwRecoveryMetrics,
    hydraulicConfidenceReport,
  });

  return {
    template,
    scenarioResult,
    hydraulicConfidenceReport,
    explainabilityReport,
  };
}

describe('LegoTechnix debug projection surface', () => {
  it('projection builder does not mutate runtime state', () => {
    const { template, scenarioResult, hydraulicConfidenceReport, explainabilityReport } = buildScenarioForTemplate();
    const scenarioBefore = clone(scenarioResult);
    const graphBefore = clone(template.graph);

    buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });

    expect(scenarioResult).toEqual(scenarioBefore);
    expect(template.graph).toEqual(graphBefore);
  });

  it('projection edges reflect active-path runtime state', () => {
    const { template, scenarioResult, hydraulicConfidenceReport, explainabilityReport } = buildScenarioForTemplate();
    const timeline = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });

    const activeConnectionIdsByPathId = new Map(
      (template.graph.activeCircuitPaths ?? []).map((path) => [
        path.id,
        [...path.forwardConnectionIds, ...(path.returnConnectionIds ?? [])],
      ]),
    );

    for (const [index, frame] of timeline.frames.entries()) {
      const sample = scenarioResult.timelineSamples[index];
      const expectedActiveConnectionIds = new Set(
        sample.activeBranches.flatMap((branch) => activeConnectionIdsByPathId.get(branch.pathId) ?? []),
      );
      for (const edge of frame.edges) {
        expect(edge.active).toBe(expectedActiveConnectionIds.has(edge.connectionId));
      }
    }
  });

  it('thermal overlays consume runtime temperatures only', () => {
    const { template, scenarioResult, hydraulicConfidenceReport, explainabilityReport } = buildScenarioForTemplate();

    const timelineWithReports = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });
    const timelineWithoutReports = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      templateId: template.id,
    });

    expect(
      timelineWithReports.frames.map((frame) => frame.overlays.find((overlay) => overlay.overlayId === 'thermal')),
    ).toEqual(
      timelineWithoutReports.frames.map((frame) => frame.overlays.find((overlay) => overlay.overlayId === 'thermal')),
    );
  });

  it('confidence overlays consume hydraulic confidence report only', () => {
    const { template, scenarioResult, hydraulicConfidenceReport, explainabilityReport } = buildScenarioForTemplate();

    const withConfidenceReport = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });
    const withoutConfidenceReport = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      explainabilityReport,
      templateId: template.id,
    });

    const mutatedExplainability = clone(explainabilityReport);
    mutatedExplainability.causalNotes = [];
    const withMutatedExplainability = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport: mutatedExplainability,
      templateId: template.id,
    });

    expect(withConfidenceReport.frames[0]?.overlays.find((overlay) => overlay.overlayId === 'confidence')?.entries.length).toBeGreaterThan(0);
    expect(withoutConfidenceReport.frames[0]?.overlays.find((overlay) => overlay.overlayId === 'confidence')?.entries.length).toBe(0);
    expect(
      withConfidenceReport.frames.map((frame) => frame.overlays.find((overlay) => overlay.overlayId === 'confidence')),
    ).toEqual(
      withMutatedExplainability.frames.map((frame) => frame.overlays.find((overlay) => overlay.overlayId === 'confidence')),
    );
  });

  it('explainability overlays consume causal notes only', () => {
    const { template, scenarioResult, hydraulicConfidenceReport, explainabilityReport } = buildScenarioForTemplate();

    const withExplainability = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });
    const withoutExplainability = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      templateId: template.id,
    });

    expect(withExplainability.frames[0]?.overlays.find((overlay) => overlay.overlayId === 'explainability')?.entries.length).toBeGreaterThan(0);
    expect(withoutExplainability.frames[0]?.overlays.find((overlay) => overlay.overlayId === 'explainability')?.entries.length).toBe(0);
  });

  it('timeline frames are deterministic', () => {
    const { template, scenarioResult, hydraulicConfidenceReport, explainabilityReport } = buildScenarioForTemplate();

    const first = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });
    const second = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });

    expect(first).toEqual(second);
  });

  it('canonical templates project successfully', () => {
    for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
      const { scenarioResult, hydraulicConfidenceReport, explainabilityReport } = buildScenarioForTemplate(template.id);
      const timeline = buildDebugProjectionTimelineV1({
        graph: template.graph,
        scenarioResult,
        hydraulicConfidenceReport,
        explainabilityReport,
        templateId: template.id,
      });

      expect(timeline.frameCount).toBeGreaterThan(0);
      expect(timeline.frames[0]?.nodes.length).toBe(template.graph.components.length);
      expect(timeline.frames[0]?.edges.length).toBe(template.graph.connections.length);
    }
  });

  it('inactive paths remain visible but inactive', () => {
    const { template, scenarioResult, hydraulicConfidenceReport, explainabilityReport } = buildScenarioForTemplate();
    const timeline = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });

    expect(timeline.frames.every((frame) => frame.edges.length === template.graph.connections.length)).toBe(true);
    expect(timeline.frames.some((frame) => frame.edges.some((edge) => edge.active === false))).toBe(true);
  });

  it('renderer contains no recommendation logic', () => {
    const rendererPath = path.resolve(
      __dirname,
      '../debug/LegoTechnixDebugProjectionPage.tsx',
    );
    const rendererSource = fs.readFileSync(rendererPath, 'utf8');

    expect(rendererSource).not.toMatch(/recommend/i);
    expect(rendererSource).not.toMatch(/runEngine|buildDecisionFromScenarios|toEngineInput/);
  });

  it('projection contracts remain serializable', () => {
    const { template, scenarioResult, hydraulicConfidenceReport, explainabilityReport } = buildScenarioForTemplate();
    const timeline = buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });

    const serialized = JSON.stringify(timeline);
    const parsed = JSON.parse(serialized) as typeof timeline;

    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.frameCount).toBe(timeline.frameCount);
    expect(parsed.frames[0]?.nodes[0]?.componentId).toBe(timeline.frames[0]?.nodes[0]?.componentId);
  });
});
