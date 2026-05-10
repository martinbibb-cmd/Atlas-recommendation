import { diagramExplanationRegistry, type DiagramExplanationEntry } from './diagramExplanationRegistry';
import { welcomePackArchetypes } from '../packComposer/archetypes/welcomePackArchetypes';
import type { WelcomePackPlanV1 } from '../packComposer/WelcomePackComposerV1';

/**
 * Returns all diagrams that cover at least one of the given concept IDs.
 * Deduplicates entries so each diagram appears at most once.
 */
export function getDiagramsForConcepts(conceptIds: string[]): DiagramExplanationEntry[] {
  const conceptSet = new Set(conceptIds);
  const seen = new Set<string>();
  const result: DiagramExplanationEntry[] = [];
  for (const entry of diagramExplanationRegistry) {
    if (seen.has(entry.diagramId)) {
      continue;
    }
    if (entry.conceptIds.some((id) => conceptSet.has(id))) {
      seen.add(entry.diagramId);
      result.push(entry);
    }
  }
  return result;
}

/**
 * Returns all diagrams relevant to the given archetype's concept set
 * (required + recommended + optional concept IDs).
 * Returns an empty array if the archetype ID is not recognised.
 */
export function getDiagramsForArchetype(archetypeId: string): DiagramExplanationEntry[] {
  const archetype = welcomePackArchetypes.find((a) => a.archetypeId === archetypeId);
  if (!archetype) {
    return [];
  }
  const allConceptIds = [
    ...archetype.requiredConceptIds,
    ...archetype.recommendedConceptIds,
    ...archetype.optionalConceptIds,
  ];
  return getDiagramsForConcepts(allConceptIds);
}

/**
 * Returns all diagrams relevant to the given welcome-pack plan, based on
 * the plan's selected concept IDs.
 */
export function getDiagramsForWelcomePackPlan(plan: WelcomePackPlanV1): DiagramExplanationEntry[] {
  return getDiagramsForConcepts(plan.selectedConceptIds);
}

/**
 * Returns the concept IDs from the given list that have no diagram coverage
 * in the registry (i.e. no diagram references them).
 */
export function getMissingDiagramCoverageForConcepts(conceptIds: string[]): string[] {
  const coveredConceptIds = new Set<string>(
    diagramExplanationRegistry.flatMap((entry) => entry.conceptIds),
  );
  return conceptIds.filter((id) => !coveredConceptIds.has(id));
}
