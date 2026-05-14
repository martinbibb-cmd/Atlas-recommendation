import { educationalConceptTaxonomy } from '../../taxonomy/educationalConceptTaxonomy';
import { diagramExplanationRegistry } from '../../diagrams/diagramExplanationRegistry';
import { welcomePackArchetypes } from '../../packComposer/archetypes/welcomePackArchetypes';
import type { LibraryCoverageAuditV1, LibraryConceptCoverageV1 } from '../LibraryCoverageAuditV1';
import type {
  LibraryAuthoringBacklogItemV1,
  LibraryAuthoringBacklogPriorityV1,
  LibraryAuthoringBacklogV1,
  LibraryAuthoringGapTypeV1,
} from './LibraryAuthoringBacklogItemV1';

const PRIORITY_ORDER: readonly LibraryAuthoringBacklogPriorityV1[] = ['blocker', 'high', 'medium', 'low'];

const GAP_ACTIONS: Record<LibraryAuthoringGapTypeV1, string> = {
  diagram: 'Author a concept diagram with customer-safe framing and register it in the library.',
  animation: 'Author an animation for this concept and include a reduced-motion-safe fallback.',
  print_card: 'Create a print-equivalent card so this concept is usable in print-first journeys.',
  lived_experience: 'Add lived-experience guidance that describes day-to-day operation in plain language.',
  misconception_reality: 'Add misconception-vs-reality content to prevent avoidable misunderstanding.',
  what_you_may_notice: 'Add a "what you may notice" section with calm real-world expectation framing.',
  journey_routing: 'Add educational routing coverage so this concept is included when relevant journeys trigger.',
  projection_safety: 'Fix projection safety by closing routed customer-facing content gaps before release.',
};

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function conceptIdToSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function buildJourneyIdsByConceptId(): Map<string, Set<string>> {
  const journeyIdsByConceptId = new Map<string, Set<string>>();

  const linkConceptToJourney = (conceptId: string, journeyId: string) => {
    let journeySet = journeyIdsByConceptId.get(conceptId);
    if (journeySet == null) {
      journeySet = new Set<string>();
      journeyIdsByConceptId.set(conceptId, journeySet);
    }
    journeySet.add(journeyId);
  };

  for (const diagram of diagramExplanationRegistry) {
    for (const conceptId of diagram.conceptIds) {
      for (const journeyId of diagram.journeyIds) {
        linkConceptToJourney(conceptId, journeyId);
      }
    }
  }

  for (const archetype of welcomePackArchetypes) {
    if (!archetype.goldenJourneyId) continue;
    const journeyId = archetype.goldenJourneyId;
    const conceptIds = [
      ...archetype.requiredConceptIds,
      ...archetype.recommendedConceptIds,
      ...archetype.optionalConceptIds,
      ...archetype.trustRecoveryConceptIds,
      ...archetype.livingWithSystemConceptIds,
    ];

    for (const conceptId of conceptIds) {
      linkConceptToJourney(conceptId, journeyId);
    }
  }

  return journeyIdsByConceptId;
}

function buildGoldenJourneyConceptSet(journeyIdsByConceptId: Map<string, Set<string>>): Set<string> {
  const goldenJourneyIds = new Set(
    welcomePackArchetypes
      .map((archetype) => archetype.goldenJourneyId)
      .filter((journeyId): journeyId is string => typeof journeyId === 'string' && journeyId.trim().length > 0),
  );

  const goldenConceptIds = new Set<string>();
  for (const [conceptId, journeyIds] of journeyIdsByConceptId.entries()) {
    if ([...journeyIds].some((journeyId) => goldenJourneyIds.has(journeyId))) {
      goldenConceptIds.add(conceptId);
    }
  }

  return goldenConceptIds;
}

function mergePriority(
  left: LibraryAuthoringBacklogPriorityV1,
  right: LibraryAuthoringBacklogPriorityV1,
): LibraryAuthoringBacklogPriorityV1 {
  return PRIORITY_ORDER.indexOf(left) <= PRIORITY_ORDER.indexOf(right) ? left : right;
}

function isCustomerConcept(conceptId: string): boolean {
  const concept = educationalConceptTaxonomy.find((entry) => entry.conceptId === conceptId);
  if (!concept) return false;
  if (concept.defaultAudience === 'engineer') return false;
  return concept.welcomePackPriority !== 'appendix_only';
}

function isTechnicalOrAuditConcept(conceptId: string): boolean {
  const concept = educationalConceptTaxonomy.find((entry) => entry.conceptId === conceptId);
  if (!concept) return false;
  return (
    concept.defaultAudience === 'engineer'
    || concept.defaultDepth === 'technical'
    || concept.welcomePackPriority === 'appendix_only'
  );
}

function buildAffectedAudiences(conceptId: string, coverage: LibraryConceptCoverageV1): string[] {
  const concept = educationalConceptTaxonomy.find((entry) => entry.conceptId === conceptId);
  const audiences = uniqueValues([
    ...coverage.audiencesCovered,
    concept?.defaultAudience ?? '',
    isCustomerConcept(conceptId) ? 'customer' : '',
  ].filter((value) => value.trim().length > 0));

  return audiences.length > 0 ? audiences : ['all'];
}

function toGapTypes(coverage: LibraryConceptCoverageV1): LibraryAuthoringGapTypeV1[] {
  const gapTypes: LibraryAuthoringGapTypeV1[] = [];
  if (!coverage.hasDiagram) gapTypes.push('diagram');
  if (!coverage.hasAnimation) gapTypes.push('animation');
  if (!coverage.hasPrintCard) gapTypes.push('print_card');
  if (!coverage.hasLivedExperienceContent) gapTypes.push('lived_experience');
  if (!coverage.hasMisconceptionReality) gapTypes.push('misconception_reality');
  if (!coverage.hasWhatYouMayNotice) gapTypes.push('what_you_may_notice');
  if (!coverage.hasJourneyRouting) gapTypes.push('journey_routing');
  if (!coverage.projectionSafe) gapTypes.push('projection_safety');
  return gapTypes;
}

function resolvePriority(input: {
  gapType: LibraryAuthoringGapTypeV1;
  coverage: LibraryConceptCoverageV1;
  isGoldenJourneyConcept: boolean;
}): LibraryAuthoringBacklogPriorityV1 {
  const { gapType, coverage, isGoldenJourneyConcept } = input;

  if (gapType === 'projection_safety') return 'blocker';

  if (
    coverage.hasJourneyRouting
    && (gapType === 'lived_experience' || gapType === 'what_you_may_notice')
  ) {
    return 'blocker';
  }

  if (coverage.hasJourneyRouting && gapType === 'misconception_reality') {
    return 'high';
  }

  if (isGoldenJourneyConcept && (gapType === 'diagram' || gapType === 'animation')) {
    return 'high';
  }

  if (gapType === 'print_card' && isCustomerConcept(coverage.conceptId)) {
    return 'medium';
  }

  if (!coverage.hasJourneyRouting && isTechnicalOrAuditConcept(coverage.conceptId)) {
    return 'low';
  }

  return 'medium';
}

function buildBacklogItem(
  coverage: LibraryConceptCoverageV1,
  gapType: LibraryAuthoringGapTypeV1,
  journeyIdsByConceptId: Map<string, Set<string>>,
  goldenJourneyConceptIds: Set<string>,
): LibraryAuthoringBacklogItemV1 {
  const priority = resolvePriority({
    gapType,
    coverage,
    isGoldenJourneyConcept: goldenJourneyConceptIds.has(coverage.conceptId),
  });

  const journeyIds = [...(journeyIdsByConceptId.get(coverage.conceptId) ?? new Set<string>())].sort();

  return {
    backlogItemId: `library-authoring:${conceptIdToSlug(coverage.conceptId)}:${gapType}`,
    conceptId: coverage.conceptId,
    title: `${coverage.conceptTitle} — ${gapType.replace(/_/g, ' ')}`,
    gapType,
    priority,
    suggestedAction: GAP_ACTIONS[gapType],
    affectedAudiences: buildAffectedAudiences(coverage.conceptId, coverage),
    relatedJourneyIds: journeyIds,
    status: 'open',
  };
}

export function buildLibraryAuthoringBacklog(
  coverageAudit: LibraryCoverageAuditV1,
): LibraryAuthoringBacklogV1 {
  const journeyIdsByConceptId = buildJourneyIdsByConceptId();
  const goldenJourneyConceptIds = buildGoldenJourneyConceptSet(journeyIdsByConceptId);
  const backlogItemsByKey = new Map<string, LibraryAuthoringBacklogItemV1>();

  for (const coverage of coverageAudit.conceptCoverage) {
    for (const gapType of toGapTypes(coverage)) {
      const backlogItem = buildBacklogItem(
        coverage,
        gapType,
        journeyIdsByConceptId,
        goldenJourneyConceptIds,
      );
      const dedupeKey = `${backlogItem.conceptId}:${backlogItem.gapType}`;
      const existing = backlogItemsByKey.get(dedupeKey);

      if (!existing) {
        backlogItemsByKey.set(dedupeKey, backlogItem);
        continue;
      }

      backlogItemsByKey.set(dedupeKey, {
        ...existing,
        priority: mergePriority(existing.priority, backlogItem.priority),
        affectedAudiences: uniqueValues([
          ...existing.affectedAudiences,
          ...backlogItem.affectedAudiences,
        ]),
        relatedJourneyIds: uniqueValues([
          ...existing.relatedJourneyIds,
          ...backlogItem.relatedJourneyIds,
        ]).sort(),
      });
    }
  }

  return {
    sourceCoverageAudit: {
      schemaVersion: coverageAudit.schemaVersion,
      generatedAt: coverageAudit.generatedAt,
    },
    backlogItems: [...backlogItemsByKey.values()],
  };
}
