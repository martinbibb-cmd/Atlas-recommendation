import { describe, expect, it } from 'vitest';
import { buildLibraryCoverageAudit } from '../coverage/buildLibraryCoverageAudit';
import { buildLibraryAuthoringBacklog } from '../coverage/backlog/buildLibraryAuthoringBacklog';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import { runEducationalContentQa } from '../content/qa/runEducationalContentQa';
import { getConceptById } from '../taxonomy/conceptGraph';
import { getContentByConceptId } from '../content';

/**
 * The 8 concept IDs authored in Authoring Backlog Batch 1.
 *
 * These are the highest-priority routed customer-facing concepts that were
 * missing lived-experience copy, what-you-may-notice framing, and
 * misconception/reality content. All are required by active routing rules
 * covering the four golden portal journeys.
 */
const BATCH_1_CONCEPT_IDS = [
  'system_fit_explanation',
  'system_work_explainer',
  'scope_clarity',
  'emitter_sizing',
  'flow_temperature',
  'flow_restriction',
  'pipework_constraint',
  'weather_compensation',
] as const;

describe('Authoring Backlog Batch 1 — High-Value Customer Concepts', () => {
  describe('taxonomy coverage', () => {
    it.each(BATCH_1_CONCEPT_IDS)(
      'concept "%s" is present in the taxonomy',
      (conceptId) => {
        expect(getConceptById(conceptId)).toBeDefined();
      },
    );
  });

  describe('content registry coverage', () => {
    it.each(BATCH_1_CONCEPT_IDS)(
      'concept "%s" has an authored content entry',
      (conceptId) => {
        const content = getContentByConceptId(conceptId);
        expect(content).toBeDefined();
      },
    );
  });

  describe('content QA — no errors', () => {
    it.each(BATCH_1_CONCEPT_IDS)(
      'content for "%s" passes QA with no errors',
      (conceptId) => {
        const content = getContentByConceptId(conceptId);
        if (!content) {
          throw new Error(`No content found for ${conceptId}`);
        }

        const findings = runEducationalContentQa([content]);
        const errors = findings.filter((f) => f.severity === 'error');
        expect(errors).toHaveLength(0);
      },
    );
  });

  describe('factual / no-analogy mode', () => {
    it.each(BATCH_1_CONCEPT_IDS)(
      'content for "%s" has a factual (family: none) analogy option',
      (conceptId) => {
        const content = getContentByConceptId(conceptId);
        if (!content) {
          throw new Error(`No content found for ${conceptId}`);
        }

        const hasFactualOption = content.analogyOptions.some((opt) => opt.family === 'none');
        expect(hasFactualOption).toBe(true);
      },
    );
  });

  describe('storyboard copy quality — print and portal', () => {
    it('all batch 1 content entries have non-empty printSummary within 140 chars', () => {
      for (const conceptId of BATCH_1_CONCEPT_IDS) {
        const content = getContentByConceptId(conceptId);
        expect(content, `missing content for ${conceptId}`).toBeDefined();
        expect(content!.printSummary.trim().length).toBeGreaterThan(0);
        expect(content!.printSummary.length).toBeLessThanOrEqual(140);
      }
    });

    it('all batch 1 content entries have customerExplanation with standard what-you-may-notice format', () => {
      for (const conceptId of BATCH_1_CONCEPT_IDS) {
        const content = getContentByConceptId(conceptId);
        expect(content, `missing content for ${conceptId}`).toBeDefined();
        expect(content!.customerExplanation).toMatch(/What you may notice:/);
        expect(content!.customerExplanation).toMatch(/What this means:/);
      }
    });

    it('all batch 1 content entries have non-empty plainEnglishSummary and title', () => {
      for (const conceptId of BATCH_1_CONCEPT_IDS) {
        const content = getContentByConceptId(conceptId);
        expect(content, `missing content for ${conceptId}`).toBeDefined();
        expect(content!.plainEnglishSummary.trim().length).toBeGreaterThan(0);
        expect(content!.title.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('coverage audit — batch 1 concepts become customer-ready', () => {
    it('all batch 1 concepts have hasWhatYouMayNotice = true after authoring', () => {
      const audit = buildLibraryCoverageAudit();
      for (const conceptId of BATCH_1_CONCEPT_IDS) {
        const coverage = audit.conceptCoverage.find((c) => c.conceptId === conceptId);
        expect(coverage, `no coverage entry for ${conceptId}`).toBeDefined();
        expect(coverage!.hasWhatYouMayNotice).toBe(true);
      }
    });

    it('all batch 1 concepts have hasMisconceptionReality = true after authoring', () => {
      const audit = buildLibraryCoverageAudit();
      for (const conceptId of BATCH_1_CONCEPT_IDS) {
        const coverage = audit.conceptCoverage.find((c) => c.conceptId === conceptId);
        expect(coverage, `no coverage entry for ${conceptId}`).toBeDefined();
        expect(coverage!.hasMisconceptionReality).toBe(true);
      }
    });

    it('all batch 1 concepts have hasLivedExperienceContent = true after authoring', () => {
      const audit = buildLibraryCoverageAudit();
      for (const conceptId of BATCH_1_CONCEPT_IDS) {
        const coverage = audit.conceptCoverage.find((c) => c.conceptId === conceptId);
        expect(coverage, `no coverage entry for ${conceptId}`).toBeDefined();
        expect(coverage!.hasLivedExperienceContent).toBe(true);
      }
    });

    it('customerReadyCount includes all batch 1 concepts that have journey routing', () => {
      const audit = buildLibraryCoverageAudit();
      const routedBatch1 = BATCH_1_CONCEPT_IDS.filter((conceptId) => {
        const coverage = audit.conceptCoverage.find((c) => c.conceptId === conceptId);
        return coverage?.hasJourneyRouting ?? false;
      });

      // Every routed batch 1 concept should now be projection-safe
      for (const conceptId of routedBatch1) {
        const coverage = audit.conceptCoverage.find((c) => c.conceptId === conceptId);
        expect(coverage!.projectionSafe).toBe(true);
      }
    });
  });

  describe('authoring backlog — batch 1 concepts no longer carry blocker lived-experience gaps', () => {
    it('no batch 1 concept has an open lived_experience or what_you_may_notice blocker in the backlog', () => {
      const audit = buildLibraryCoverageAudit();
      const backlog = buildLibraryAuthoringBacklog(audit);

      const openBlockers = backlog.backlogItems.filter(
        (item) =>
          BATCH_1_CONCEPT_IDS.includes(item.conceptId as typeof BATCH_1_CONCEPT_IDS[number])
          && (item.gapType === 'lived_experience' || item.gapType === 'what_you_may_notice')
          && item.priority === 'blocker'
          && item.status === 'open',
      );

      expect(openBlockers).toHaveLength(0);
    });

    it('no batch 1 concept has an open misconception_reality gap at high or blocker priority', () => {
      const audit = buildLibraryCoverageAudit();
      const backlog = buildLibraryAuthoringBacklog(audit);

      const openHighMisconception = backlog.backlogItems.filter(
        (item) =>
          BATCH_1_CONCEPT_IDS.includes(item.conceptId as typeof BATCH_1_CONCEPT_IDS[number])
          && item.gapType === 'misconception_reality'
          && (item.priority === 'blocker' || item.priority === 'high')
          && item.status === 'open',
      );

      expect(openHighMisconception).toHaveLength(0);
    });
  });

  describe('content registry integrity', () => {
    it('no duplicate conceptIds exist in the registry for batch 1 concepts', () => {
      for (const conceptId of BATCH_1_CONCEPT_IDS) {
        const entries = educationalContentRegistry.filter((e) => e.conceptId === conceptId);
        expect(entries, `duplicate content for ${conceptId}`).toHaveLength(1);
      }
    });

    it('all batch 1 contentIds are unique across the full registry', () => {
      const batch1ContentIds = BATCH_1_CONCEPT_IDS
        .map((conceptId) => getContentByConceptId(conceptId)?.contentId)
        .filter((id): id is string => typeof id === 'string');

      const allIds = educationalContentRegistry.map((e) => e.contentId);
      const idCounts = new Map<string, number>();
      for (const id of allIds) {
        idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
      }

      for (const contentId of batch1ContentIds) {
        expect(idCounts.get(contentId)).toBe(1);
      }
    });
  });
});
