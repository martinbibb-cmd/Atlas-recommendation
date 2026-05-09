import { describe, expect, it } from 'vitest';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalRoutingRules } from '../routing/educationalRoutingRules';
import { getConceptById } from '../taxonomy/conceptGraph';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';

describe('educationalConceptTaxonomy', () => {
  it('has unique concept IDs', () => {
    const conceptIds = educationalConceptTaxonomy.map((concept) => concept.conceptId);
    expect(new Set(conceptIds).size).toBe(conceptIds.length);
  });

  it('ensures required prior concepts exist', () => {
    for (const concept of educationalConceptTaxonomy) {
      for (const priorConceptId of concept.requiredPriorConceptIds) {
        expect(getConceptById(priorConceptId)).toBeDefined();
      }
    }
  });

  it('ensures related concepts exist', () => {
    for (const concept of educationalConceptTaxonomy) {
      for (const relatedConceptId of concept.relatedConceptIds) {
        expect(getConceptById(relatedConceptId)).toBeDefined();
      }
    }
  });

  it('covers all registered asset concept IDs', () => {
    const missingConceptIds = educationalAssetRegistry
      .flatMap((asset) => asset.conceptIds)
      .filter((conceptId, index, all) => all.indexOf(conceptId) === index)
      .filter((conceptId) => !getConceptById(conceptId));

    expect(missingConceptIds).toEqual([]);
  });

  it('covers all routing rule required concept IDs', () => {
    const missingConceptIds = educationalRoutingRules
      .flatMap((rule) => rule.requiredConceptIds)
      .filter((conceptId, index, all) => all.indexOf(conceptId) === index)
      .filter((conceptId) => !getConceptById(conceptId));

    expect(missingConceptIds).toEqual([]);
  });

  it('includes confidence levels for all concepts', () => {
    for (const concept of educationalConceptTaxonomy) {
      expect(concept.confidenceLevel).toBeTruthy();
    }
  });
});
