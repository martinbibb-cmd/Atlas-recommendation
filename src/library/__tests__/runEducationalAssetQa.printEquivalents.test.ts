import { describe, expect, it } from 'vitest';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalComponentRegistry } from '../registry/educationalComponentRegistry';
import { runEducationalAssetQa } from '../registry/qa/runEducationalAssetQa';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';

const CORE_ANIMATION_ASSET_IDS = new Set([
  'WhatIfLab',
  'BoilerCyclingAnimation',
  'FlowRestrictionAnimation',
  'RadiatorUpgradeAnimation',
]);

describe('runEducationalAssetQa print-equivalent coverage', () => {
  it('does not emit missing_print_equivalent warnings for the four known assets', () => {
    const findings = runEducationalAssetQa(
      educationalAssetRegistry,
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );

    const flaggedAssetIds = findings
      .filter((finding) => finding.ruleId === 'missing_print_equivalent')
      .map((finding) => finding.assetId);

    for (const assetId of flaggedAssetIds) {
      expect(CORE_ANIMATION_ASSET_IDS.has(assetId)).toBe(false);
    }
  });
});
