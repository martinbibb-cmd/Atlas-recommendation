import { describe, expect, it } from 'vitest';
import { buildLibraryCoverageAudit } from '../buildLibraryCoverageAudit';
import { educationalConceptTaxonomy } from '../../taxonomy/educationalConceptTaxonomy';
import type { LibraryConceptCoverageV1 } from '../LibraryCoverageAuditV1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function conceptById(
  coverage: readonly LibraryConceptCoverageV1[],
  conceptId: string,
): LibraryConceptCoverageV1 | undefined {
  return coverage.find((c) => c.conceptId === conceptId);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildLibraryCoverageAudit', () => {
  it('returns a valid audit with schemaVersion 1.0', () => {
    const audit = buildLibraryCoverageAudit();
    expect(audit.schemaVersion).toBe('1.0');
    expect(typeof audit.generatedAt).toBe('string');
  });

  it('includes every concept from the taxonomy', () => {
    const audit = buildLibraryCoverageAudit();
    const auditIds = new Set(audit.conceptCoverage.map((c) => c.conceptId));
    for (const concept of educationalConceptTaxonomy) {
      expect(auditIds.has(concept.conceptId)).toBe(true);
    }
  });

  it('readinessScore totalConcepts matches conceptCoverage length', () => {
    const audit = buildLibraryCoverageAudit();
    expect(audit.readinessScore.totalConcepts).toBe(audit.conceptCoverage.length);
  });

  it('projectionSafeCount matches count of projectionSafe concepts', () => {
    const audit = buildLibraryCoverageAudit();
    const expected = audit.conceptCoverage.filter((c) => c.projectionSafe).length;
    expect(audit.readinessScore.projectionSafeCount).toBe(expected);
  });

  it('percentage values are between 0 and 100', () => {
    const audit = buildLibraryCoverageAudit();
    const { readinessScore } = audit;
    expect(readinessScore.customerReadyPct).toBeGreaterThanOrEqual(0);
    expect(readinessScore.customerReadyPct).toBeLessThanOrEqual(100);
    expect(readinessScore.visuallyReadyPct).toBeGreaterThanOrEqual(0);
    expect(readinessScore.visuallyReadyPct).toBeLessThanOrEqual(100);
    expect(readinessScore.printReadyPct).toBeGreaterThanOrEqual(0);
    expect(readinessScore.printReadyPct).toBeLessThanOrEqual(100);
    expect(readinessScore.projectionSafePct).toBeGreaterThanOrEqual(0);
    expect(readinessScore.projectionSafePct).toBeLessThanOrEqual(100);
  });

  it('a concept with no diagram is flagged as missingDiagram', () => {
    const audit = buildLibraryCoverageAudit();
    const missingDiagramSet = new Set(audit.missingByType.missingDiagram);
    const noDiagramConcepts = audit.conceptCoverage.filter((c) => !c.hasDiagram);
    for (const concept of noDiagramConcepts) {
      expect(missingDiagramSet.has(concept.conceptId)).toBe(true);
    }
  });

  it('a concept with no lived-experience content is flagged correctly', () => {
    const audit = buildLibraryCoverageAudit();
    const missingLivedSet = new Set(audit.missingByType.missingLivedExperienceContent);
    const noLivedConcepts = audit.conceptCoverage.filter((c) => !c.hasLivedExperienceContent);
    for (const concept of noLivedConcepts) {
      expect(missingLivedSet.has(concept.conceptId)).toBe(true);
    }
  });

  it('unroutedConceptIds only contains concepts with hasJourneyRouting=false', () => {
    const audit = buildLibraryCoverageAudit();
    const unroutedSet = new Set(audit.unroutedConceptIds);
    const routedInCoverage = audit.conceptCoverage.filter((c) => c.hasJourneyRouting);
    for (const concept of routedInCoverage) {
      expect(unroutedSet.has(concept.conceptId)).toBe(false);
    }
  });

  it('conceptsWithNoVisualAssets only contains concepts with no diagram and no animation', () => {
    const audit = buildLibraryCoverageAudit();
    const noVisualSet = new Set(audit.conceptsWithNoVisualAssets);
    for (const id of noVisualSet) {
      const concept = conceptById(audit.conceptCoverage, id);
      expect(concept?.hasDiagram).toBe(false);
      expect(concept?.hasAnimation).toBe(false);
    }
  });

  it('conceptsWithNoLivedExperienceContent only contains concepts with no livingWith and no whatYouMayNotice', () => {
    const audit = buildLibraryCoverageAudit();
    const noLivedSet = new Set(audit.conceptsWithNoLivedExperienceContent);
    for (const id of noLivedSet) {
      const concept = conceptById(audit.conceptCoverage, id);
      expect(concept?.hasLivedExperienceContent).toBe(false);
      expect(concept?.hasWhatYouMayNotice).toBe(false);
    }
  });

  it('projectionSafe requires hasJourneyRouting AND at least one of hasLivedExperienceContent/hasWhatYouMayNotice', () => {
    const audit = buildLibraryCoverageAudit();
    for (const concept of audit.conceptCoverage) {
      if (concept.projectionSafe) {
        expect(concept.hasJourneyRouting).toBe(true);
        expect(concept.hasLivedExperienceContent || concept.hasWhatYouMayNotice).toBe(true);
      }
    }
  });

  it('tracks LivingExperiencePattern coverage by concept', () => {
    const audit = buildLibraryCoverageAudit();
    const systemFit = conceptById(audit.conceptCoverage, 'system_fit_explanation');
    expect(systemFit?.hasLivingExperiencePattern).toBe(true);
    expect(audit.missingByType.missingLivingExperiencePattern).not.toContain('system_fit_explanation');
  });

  it('missingByType.missingDiagram is consistent with hasDiagram on each concept', () => {
    const audit = buildLibraryCoverageAudit();
    const missingSet = new Set(audit.missingByType.missingDiagram);
    for (const concept of audit.conceptCoverage) {
      if (!concept.hasDiagram) {
        expect(missingSet.has(concept.conceptId)).toBe(true);
      } else {
        expect(missingSet.has(concept.conceptId)).toBe(false);
      }
    }
  });

  it('missingByType.missingJourneyRouting is consistent with hasJourneyRouting', () => {
    const audit = buildLibraryCoverageAudit();
    const missingSet = new Set(audit.missingByType.missingJourneyRouting);
    for (const concept of audit.conceptCoverage) {
      if (!concept.hasJourneyRouting) {
        expect(missingSet.has(concept.conceptId)).toBe(true);
      } else {
        expect(missingSet.has(concept.conceptId)).toBe(false);
      }
    }
  });
});
