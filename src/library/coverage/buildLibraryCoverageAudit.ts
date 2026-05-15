import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import { educationalRoutingRules } from '../routing/educationalRoutingRules';
import { diagramExplanationRegistry } from '../diagrams/diagramExplanationRegistry';
import type {
  LibraryCoverageAuditV1,
  LibraryConceptCoverageV1,
  LibraryCoverageReadinessScoreV1,
  LibraryCoverageMissingByTypeV1,
} from './LibraryCoverageAuditV1';

// ─── Pre-computed lookup tables ───────────────────────────────────────────────

/** concept IDs covered by at least one diagram-type asset OR diagramExplanationRegistry entry */
function buildDiagramConceptIds(): Set<string> {
  const ids = new Set<string>();
  for (const entry of diagramExplanationRegistry) {
    for (const id of entry.conceptIds) {
      ids.add(id);
    }
  }
  for (const asset of educationalAssetRegistry) {
    if (asset.assetType === 'diagram') {
      for (const id of asset.conceptIds) {
        ids.add(id);
      }
    }
  }
  return ids;
}

/** concept IDs covered by at least one animation asset */
function buildAnimationConceptIds(): Set<string> {
  const ids = new Set<string>();
  for (const asset of educationalAssetRegistry) {
    if (asset.assetType === 'animation') {
      for (const id of asset.conceptIds) {
        ids.add(id);
      }
    }
  }
  return ids;
}

/** concept IDs covered by at least one print-equivalent asset */
function buildPrintCardConceptIds(): Set<string> {
  const ids = new Set<string>();
  for (const asset of educationalAssetRegistry) {
    if (asset.hasPrintEquivalent) {
      for (const id of asset.conceptIds) {
        ids.add(id);
      }
    }
  }
  return ids;
}

/** concept IDs referenced by at least one routing rule */
function buildRoutedConceptIds(): Set<string> {
  const ids = new Set<string>();
  for (const rule of educationalRoutingRules) {
    for (const id of rule.requiredConceptIds) {
      ids.add(id);
    }
  }
  return ids;
}

/** audiences per concept, from educationalAssetRegistry */
function buildAudiencesByConceptId(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const asset of educationalAssetRegistry) {
    for (const conceptId of asset.conceptIds) {
      let set = map.get(conceptId);
      if (set == null) {
        set = new Set<string>();
        map.set(conceptId, set);
      }
      set.add(asset.audience);
    }
  }
  return map;
}

// ─── Content lookup helpers ───────────────────────────────────────────────────

function buildContentByConceptId() {
  const map = new Map(
    educationalContentRegistry.map((entry) => [entry.conceptId, entry]),
  );
  return map;
}

// ─── Per-pct helper ───────────────────────────────────────────────────────────

function toPct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * buildLibraryCoverageAudit
 *
 * Walks every concept in educationalConceptTaxonomy and cross-references:
 *   - educationalAssetRegistry (diagrams, animations, print-equivalents, audiences)
 *   - diagramExplanationRegistry (SVG-rendered first-class diagrams)
 *   - educationalContentRegistry (lived-experience content, misconceptions, what-you-may-notice)
 *   - educationalRoutingRules (journey routing coverage)
 *
 * Returns a LibraryCoverageAuditV1 with per-concept coverage records, aggregate
 * readiness scores, missing-coverage lists, and unrouted concept IDs.
 */
export function buildLibraryCoverageAudit(): LibraryCoverageAuditV1 {
  const diagramConceptIds = buildDiagramConceptIds();
  const animationConceptIds = buildAnimationConceptIds();
  const printCardConceptIds = buildPrintCardConceptIds();
  const routedConceptIds = buildRoutedConceptIds();
  const audiencesByConceptId = buildAudiencesByConceptId();
  const contentByConceptId = buildContentByConceptId();

  const conceptCoverage: LibraryConceptCoverageV1[] = educationalConceptTaxonomy.map((concept) => {
    const content = contentByConceptId.get(concept.conceptId);
    const hasDiagram = diagramConceptIds.has(concept.conceptId);
    const hasAnimation = animationConceptIds.has(concept.conceptId);
    const hasPrintCard = printCardConceptIds.has(concept.conceptId);
    const hasLivedExperienceContent =
      content != null &&
      typeof content.livingWithSystemGuidance === 'string' &&
      content.livingWithSystemGuidance.trim().length > 0;
    const hasMisconceptionReality =
      content != null &&
      typeof content.commonMisunderstanding === 'string' &&
      content.commonMisunderstanding.trim().length > 0;
    const hasLivingExperiencePattern =
      content?.livingExperiencePattern != null &&
      typeof content.livingExperiencePattern.whatYouMayNotice === 'string' &&
      content.livingExperiencePattern.whatYouMayNotice.trim().length > 0 &&
      typeof content.livingExperiencePattern.whatThisMeans === 'string' &&
      content.livingExperiencePattern.whatThisMeans.trim().length > 0 &&
      typeof content.livingExperiencePattern.printSummary === 'string' &&
      content.livingExperiencePattern.printSummary.trim().length > 0;
    const hasExpectationDelta =
      content?.livingExperiencePattern != null &&
      typeof content.livingExperiencePattern.whatChanges === 'string' &&
      content.livingExperiencePattern.whatChanges.trim().length > 0 &&
      typeof content.livingExperiencePattern.whatStaysFamiliar === 'string' &&
      content.livingExperiencePattern.whatStaysFamiliar.trim().length > 0;
    const hasWhatYouMayNotice =
      content != null &&
      typeof content.customerExplanation === 'string' &&
      content.customerExplanation.toLowerCase().includes('what you may notice');
    const hasJourneyRouting = routedConceptIds.has(concept.conceptId);
    const audiencesSet = audiencesByConceptId.get(concept.conceptId);
    const audiencesCovered: string[] = audiencesSet != null ? [...audiencesSet] : [];
    const projectionSafe =
      hasJourneyRouting && (hasLivedExperienceContent || hasWhatYouMayNotice);

    return {
      conceptId: concept.conceptId,
      conceptTitle: concept.title,
      category: concept.category,
      hasDiagram,
      hasAnimation,
      hasPrintCard,
      hasLivedExperienceContent,
      hasMisconceptionReality,
      hasLivingExperiencePattern,
      hasExpectationDelta,
      hasWhatYouMayNotice,
      hasJourneyRouting,
      audiencesCovered,
      projectionSafe,
    };
  });

  // ── Readiness scoring ──────────────────────────────────────────────────────

  const total = conceptCoverage.length;
  const customerReadyCount = conceptCoverage.filter(
    (c) => c.hasLivedExperienceContent && c.hasWhatYouMayNotice && c.hasMisconceptionReality,
  ).length;
  const visuallyReadyCount = conceptCoverage.filter((c) => c.hasDiagram || c.hasAnimation).length;
  const printReadyCount = conceptCoverage.filter((c) => c.hasPrintCard).length;
  const projectionSafeCount = conceptCoverage.filter((c) => c.projectionSafe).length;

  const readinessScore: LibraryCoverageReadinessScoreV1 = {
    totalConcepts: total,
    customerReadyCount,
    visuallyReadyCount,
    printReadyCount,
    projectionSafeCount,
    customerReadyPct: toPct(customerReadyCount, total),
    visuallyReadyPct: toPct(visuallyReadyCount, total),
    printReadyPct: toPct(printReadyCount, total),
    projectionSafePct: toPct(projectionSafeCount, total),
  };

  // ── Missing by type ────────────────────────────────────────────────────────

  const missingByType: LibraryCoverageMissingByTypeV1 = {
    missingDiagram: conceptCoverage.filter((c) => !c.hasDiagram).map((c) => c.conceptId),
    missingAnimation: conceptCoverage.filter((c) => !c.hasAnimation).map((c) => c.conceptId),
    missingPrintCard: conceptCoverage.filter((c) => !c.hasPrintCard).map((c) => c.conceptId),
    missingLivedExperienceContent: conceptCoverage
      .filter((c) => !c.hasLivedExperienceContent)
      .map((c) => c.conceptId),
    missingMisconceptionReality: conceptCoverage
      .filter((c) => !c.hasMisconceptionReality)
      .map((c) => c.conceptId),
    missingLivingExperiencePattern: conceptCoverage
      .filter((c) => !c.hasLivingExperiencePattern)
      .map((c) => c.conceptId),
    missingExpectationDelta: conceptCoverage
      .filter((c) => !c.hasExpectationDelta)
      .map((c) => c.conceptId),
    missingWhatYouMayNotice: conceptCoverage
      .filter((c) => !c.hasWhatYouMayNotice)
      .map((c) => c.conceptId),
    missingJourneyRouting: conceptCoverage
      .filter((c) => !c.hasJourneyRouting)
      .map((c) => c.conceptId),
  };

  // ── Convenience roll-ups ───────────────────────────────────────────────────

  const conceptsWithNoVisualAssets = conceptCoverage
    .filter((c) => !c.hasDiagram && !c.hasAnimation)
    .map((c) => c.conceptId);

  const conceptsWithNoLivedExperienceContent = conceptCoverage
    .filter((c) => !c.hasLivedExperienceContent && !c.hasWhatYouMayNotice)
    .map((c) => c.conceptId);

  const unroutedConceptIds = conceptCoverage
    .filter((c) => !c.hasJourneyRouting)
    .map((c) => c.conceptId);

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    conceptCoverage,
    readinessScore,
    missingByType,
    conceptsWithNoVisualAssets,
    conceptsWithNoLivedExperienceContent,
    unroutedConceptIds,
  };
}
