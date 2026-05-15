import { describe, expect, it } from 'vitest';
import type { LibraryCoverageAuditV1, LibraryConceptCoverageV1 } from '../../LibraryCoverageAuditV1';
import { buildLibraryAuthoringBacklog } from '../buildLibraryAuthoringBacklog';

function conceptCoverage(overrides: Partial<LibraryConceptCoverageV1>): LibraryConceptCoverageV1 {
  return {
    conceptId: 'system_fit_explanation',
    conceptTitle: 'System fit explanation',
    category: 'whole_system',
    hasDiagram: true,
    hasAnimation: true,
    hasPrintCard: true,
    hasLivedExperienceContent: true,
    hasMisconceptionReality: true,
    hasLivingExperiencePattern: true,
    hasExpectationDelta: true,
    hasWhatYouMayNotice: true,
    hasJourneyRouting: true,
    audiencesCovered: ['customer'],
    projectionSafe: true,
    ...overrides,
  };
}

function createCoverageAudit(concepts: readonly LibraryConceptCoverageV1[]): LibraryCoverageAuditV1 {
  return {
    schemaVersion: '1.0',
    generatedAt: '2026-01-01T00:00:00.000Z',
    conceptCoverage: concepts,
    readinessScore: {
      totalConcepts: concepts.length,
      customerReadyCount: concepts.filter((concept) =>
        concept.hasLivedExperienceContent
        && concept.hasWhatYouMayNotice
        && concept.hasMisconceptionReality,
      ).length,
      visuallyReadyCount: concepts.filter((concept) => concept.hasDiagram || concept.hasAnimation).length,
      printReadyCount: concepts.filter((concept) => concept.hasPrintCard).length,
      projectionSafeCount: concepts.filter((concept) => concept.projectionSafe).length,
      customerReadyPct: 0,
      visuallyReadyPct: 0,
      printReadyPct: 0,
      projectionSafePct: 0,
    },
    missingByType: {
      missingDiagram: concepts.filter((concept) => !concept.hasDiagram).map((concept) => concept.conceptId),
      missingAnimation: concepts.filter((concept) => !concept.hasAnimation).map((concept) => concept.conceptId),
      missingPrintCard: concepts.filter((concept) => !concept.hasPrintCard).map((concept) => concept.conceptId),
      missingLivedExperienceContent: concepts.filter((concept) => !concept.hasLivedExperienceContent).map((concept) => concept.conceptId),
      missingMisconceptionReality: concepts.filter((concept) => !concept.hasMisconceptionReality).map((concept) => concept.conceptId),
      missingLivingExperiencePattern: concepts.filter((concept) => !concept.hasLivingExperiencePattern).map((concept) => concept.conceptId),
      missingExpectationDelta: concepts.filter((concept) => !concept.hasExpectationDelta).map((concept) => concept.conceptId),
      missingWhatYouMayNotice: concepts.filter((concept) => !concept.hasWhatYouMayNotice).map((concept) => concept.conceptId),
      missingJourneyRouting: concepts.filter((concept) => !concept.hasJourneyRouting).map((concept) => concept.conceptId),
    },
    conceptsWithNoVisualAssets: concepts
      .filter((concept) => !concept.hasDiagram && !concept.hasAnimation)
      .map((concept) => concept.conceptId),
    conceptsWithNoLivedExperienceContent: concepts
      .filter((concept) => !concept.hasLivedExperienceContent && !concept.hasWhatYouMayNotice)
      .map((concept) => concept.conceptId),
    unroutedConceptIds: concepts.filter((concept) => !concept.hasJourneyRouting).map((concept) => concept.conceptId),
  };
}

describe('buildLibraryAuthoringBacklog', () => {
  it('projection unsafe creates blocker', () => {
    const audit = createCoverageAudit([
      conceptCoverage({
        conceptId: 'system_fit_explanation',
        hasLivedExperienceContent: false,
        hasWhatYouMayNotice: false,
        projectionSafe: false,
      }),
    ]);

    const backlog = buildLibraryAuthoringBacklog(audit);
    const projectionSafety = backlog.backlogItems.find((item) => item.gapType === 'projection_safety');

    expect(projectionSafety?.priority).toBe('blocker');
  });

  it('routed customer content gaps create high/blocker priorities', () => {
    const audit = createCoverageAudit([
      conceptCoverage({
        conceptId: 'system_fit_explanation',
        hasLivedExperienceContent: false,
        hasMisconceptionReality: false,
        hasJourneyRouting: true,
        projectionSafe: false,
      }),
    ]);

    const backlog = buildLibraryAuthoringBacklog(audit);
    const lived = backlog.backlogItems.find((item) => item.gapType === 'lived_experience');
    const misconception = backlog.backlogItems.find((item) => item.gapType === 'misconception_reality');

    expect(lived?.priority).toBe('blocker');
    expect(misconception?.priority).toBe('high');
  });

  it('golden journey visual gaps create high', () => {
    const audit = createCoverageAudit([
      conceptCoverage({
        conceptId: 'emitter_sizing',
        hasDiagram: false,
      }),
    ]);

    const backlog = buildLibraryAuthoringBacklog(audit);
    const diagramGap = backlog.backlogItems.find((item) => item.conceptId === 'emitter_sizing' && item.gapType === 'diagram');

    expect(diagramGap?.priority).toBe('high');
  });

  it('technical unrouted concepts create low', () => {
    const audit = createCoverageAudit([
      conceptCoverage({
        conceptId: 'HYD-03',
        hasJourneyRouting: false,
      }),
    ]);

    const backlog = buildLibraryAuthoringBacklog(audit);
    const unrouted = backlog.backlogItems.find((item) => item.conceptId === 'HYD-03' && item.gapType === 'journey_routing');

    expect(unrouted?.priority).toBe('low');
  });

  it('deduplicates per concept and gap type', () => {
    const duplicatedConcept = conceptCoverage({
      conceptId: 'system_fit_explanation',
      hasDiagram: false,
    });
    const audit = createCoverageAudit([duplicatedConcept, duplicatedConcept]);

    const backlog = buildLibraryAuthoringBacklog(audit);
    const diagramItems = backlog.backlogItems.filter(
      (item) => item.conceptId === 'system_fit_explanation' && item.gapType === 'diagram',
    );

    expect(diagramItems).toHaveLength(1);
  });
});
