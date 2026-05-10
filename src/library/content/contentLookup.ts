import type { EducationalContentV1 } from './EducationalContentV1';
import { educationalContentRegistry } from './educationalContentRegistry';

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

export function getContentByConceptId(conceptId: string): EducationalContentV1 | undefined {
  return educationalContentRegistry.find((entry) => entry.conceptId === conceptId);
}

export function getContentByContentId(contentId: string): EducationalContentV1 | undefined {
  return educationalContentRegistry.find((entry) => entry.contentId === contentId);
}

export function getContentForConcepts(conceptIds: string[]): EducationalContentV1[] {
  return uniqueInOrder(conceptIds)
    .map((conceptId) => getContentByConceptId(conceptId))
    .filter((entry): entry is EducationalContentV1 => Boolean(entry));
}

export function getPrintableContentForConcepts(conceptIds: string[]): EducationalContentV1[] {
  return getContentForConcepts(conceptIds).filter((entry) => entry.printSummary.trim().length > 0);
}

export function getContentMissingPrintSummary(): EducationalContentV1[] {
  return educationalContentRegistry.filter((entry) => entry.printSummary.trim().length === 0);
}

export function getContentMissingAnalogyOptions(): EducationalContentV1[] {
  return educationalContentRegistry.filter((entry) => entry.analogyOptions.length === 0);
}

export function getContentMissingDangerousOversimplification(): EducationalContentV1[] {
  return educationalContentRegistry.filter((entry) => entry.dangerousOversimplification.trim().length === 0);
}
