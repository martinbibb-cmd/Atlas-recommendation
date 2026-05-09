import { describe, expect, it } from 'vitest';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalRoutingRules } from '../routing/educationalRoutingRules';
import {
  getAssetsWithoutKnownConcepts,
  getConceptsWithoutAssets,
  getConceptsWithoutRoutingRules,
  getConceptsWithMissingPriorConcepts,
  getRoutingRulesWithoutKnownConcepts,
} from '../taxonomy/conceptCoverageAudit';

describe('conceptCoverageAudit', () => {
  it('flags concepts without assets', () => {
    const withoutAssets = getConceptsWithoutAssets(educationalAssetRegistry);

    expect(withoutAssets.length).toBeGreaterThan(0);
    expect(withoutAssets).toContain('HYD-02');
  });

  it('reports no unknown concept IDs in registered assets', () => {
    expect(getAssetsWithoutKnownConcepts(educationalAssetRegistry)).toEqual([]);
  });

  it('reports no unknown concept IDs in routing rules', () => {
    expect(getRoutingRulesWithoutKnownConcepts(educationalRoutingRules)).toEqual([]);
  });

  it('reports no missing prior concept references in taxonomy', () => {
    expect(getConceptsWithMissingPriorConcepts()).toEqual([]);
  });

  it('returns concepts without routing rule coverage', () => {
    const withoutRules = getConceptsWithoutRoutingRules(educationalRoutingRules);

    expect(withoutRules.length).toBeGreaterThan(0);
    expect(withoutRules).toContain('HYD-02');
  });
});
