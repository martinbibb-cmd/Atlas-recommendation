import type { ScenarioSystemType } from '../../contracts/ScenarioResult';
import type {
  EducationalConceptCategoryV1,
  EducationalConceptTaxonomyV1,
  EducationalConceptWelcomePackPriorityV1,
} from './EducationalConceptTaxonomyV1';
import { educationalConceptTaxonomy } from './educationalConceptTaxonomy';

const conceptById = new Map(educationalConceptTaxonomy.map((concept) => [concept.conceptId, concept]));

export function getConceptById(conceptId: string): EducationalConceptTaxonomyV1 | undefined {
  return conceptById.get(conceptId);
}

export function getChildConcepts(parentId: string): EducationalConceptTaxonomyV1[] {
  return educationalConceptTaxonomy.filter((concept) => concept.parentConceptId === parentId);
}

export function getRelatedConcepts(conceptId: string): EducationalConceptTaxonomyV1[] {
  const concept = getConceptById(conceptId);
  if (!concept) {
    return [];
  }

  return concept.relatedConceptIds
    .map((relatedId) => getConceptById(relatedId))
    .filter((related): related is EducationalConceptTaxonomyV1 => Boolean(related));
}

export function getRequiredPriorConcepts(conceptId: string): EducationalConceptTaxonomyV1[] {
  const concept = getConceptById(conceptId);
  if (!concept) {
    return [];
  }

  return concept.requiredPriorConceptIds
    .map((priorId) => getConceptById(priorId))
    .filter((prior): prior is EducationalConceptTaxonomyV1 => Boolean(prior));
}

export function getConceptsByCategory(category: EducationalConceptCategoryV1): EducationalConceptTaxonomyV1[] {
  return educationalConceptTaxonomy.filter((concept) => concept.category === category);
}

export function getConceptsForSystemType(systemType: ScenarioSystemType): EducationalConceptTaxonomyV1[] {
  return educationalConceptTaxonomy.filter(
    (concept) => concept.appliesToSystemTypes.includes('all') || concept.appliesToSystemTypes.includes(systemType),
  );
}

export function getMustPrintConcepts(): EducationalConceptTaxonomyV1[] {
  return educationalConceptTaxonomy.filter((concept) => concept.printPriority === 'must_print');
}

export function getWelcomePackConcepts(priority: EducationalConceptWelcomePackPriorityV1): EducationalConceptTaxonomyV1[] {
  return educationalConceptTaxonomy.filter((concept) => concept.welcomePackPriority === priority);
}
