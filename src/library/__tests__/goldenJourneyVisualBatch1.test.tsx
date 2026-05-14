import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { buildLibraryCoverageAudit } from '../coverage/buildLibraryCoverageAudit';
import { buildLibraryAuthoringBacklog } from '../coverage/backlog/buildLibraryAuthoringBacklog';
import { getDiagramsForConcepts } from '../diagrams/diagramLookup';
import { DiagramRenderer } from '../diagrams/DiagramRenderer';

const VISUAL_BATCH_1_CONCEPT_IDS = [
  'system_fit_explanation',
  'system_work_explainer',
  'flow_temperature',
  'emitter_sizing',
  'flow_restriction',
  'pipework_constraint',
  'weather_compensation',
] as const;

const VISUAL_BATCH_1_DIAGRAM_IDS = [
  'system_fit_decision_map',
  'stored_hot_water_recovery_timeline',
  'warm_radiator_emitter_sizing',
  'flow_restriction_bottleneck',
  'weather_compensation_curve',
] as const;

describe('Visual Backlog Batch 1 — Core Customer Diagrams', () => {
  it('selected concepts are visually-ready in coverage audit', () => {
    const audit = buildLibraryCoverageAudit();
    for (const conceptId of VISUAL_BATCH_1_CONCEPT_IDS) {
      const coverage = audit.conceptCoverage.find((entry) => entry.conceptId === conceptId);
      expect(coverage, `missing coverage for ${conceptId}`).toBeDefined();
      expect(coverage!.hasDiagram || coverage!.hasAnimation).toBe(true);
    }
  });

  it('selected concepts have first-class diagram coverage', () => {
    const audit = buildLibraryCoverageAudit();
    for (const conceptId of VISUAL_BATCH_1_CONCEPT_IDS) {
      const coverage = audit.conceptCoverage.find((entry) => entry.conceptId === conceptId);
      expect(coverage, `missing coverage for ${conceptId}`).toBeDefined();
      expect(coverage!.hasDiagram).toBe(true);
    }
  });

  it('new diagrams map to the expected concepts', () => {
    const mapped = getDiagramsForConcepts([...VISUAL_BATCH_1_CONCEPT_IDS]);
    const mappedIds = mapped.map((entry) => entry.diagramId);
    for (const diagramId of VISUAL_BATCH_1_DIAGRAM_IDS) {
      expect(mappedIds).toContain(diagramId);
    }
  });

  it('new diagrams support printSafe and reducedMotion props through DiagramRenderer', () => {
    for (const diagramId of VISUAL_BATCH_1_DIAGRAM_IDS) {
      const { container } = render(
        <DiagramRenderer diagramId={diagramId} printSafe reducedMotion />,
      );
      expect(container.querySelector(`[data-testid="diagram-renderer-${diagramId}"]`)).toBeInTheDocument();
      expect(container.querySelector('[data-motion="reduce"]')).toBeInTheDocument();
      expect(container.querySelector('[data-print-safe="true"]')).toBeInTheDocument();
    }
  });

  it('selected concepts remain customer-projection-safe in coverage audit', () => {
    const audit = buildLibraryCoverageAudit();
    for (const conceptId of VISUAL_BATCH_1_CONCEPT_IDS) {
      const coverage = audit.conceptCoverage.find((entry) => entry.conceptId === conceptId);
      expect(coverage, `missing coverage for ${conceptId}`).toBeDefined();
      expect(coverage!.projectionSafe).toBe(true);
    }
  });

  it('visual diagram backlog for selected concepts is closed', () => {
    const audit = buildLibraryCoverageAudit();
    const backlog = buildLibraryAuthoringBacklog(audit);
    const openDiagramGaps = backlog.backlogItems.filter(
      (item) =>
        VISUAL_BATCH_1_CONCEPT_IDS.includes(item.conceptId as typeof VISUAL_BATCH_1_CONCEPT_IDS[number])
        && item.gapType === 'diagram'
        && item.status === 'open',
    );
    expect(openDiagramGaps).toHaveLength(0);
  });
});
