import { describe, expect, it } from 'vitest';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import {
  getAssetsMissingRegisteredPrintEquivalent,
  getPrintEquivalentForAsset,
  getPrintEquivalentsForAssets,
} from '../printEquivalents/getPrintEquivalentForAsset';

const CORE_ANIMATION_ASSET_IDS = [
  'WhatIfLab',
  'BoilerCyclingAnimation',
  'FlowRestrictionAnimation',
  'RadiatorUpgradeAnimation',
] as const;

describe('printEquivalentRegistry', () => {
  it('registers static print equivalents for the four core warned animation assets', () => {
    const equivalents = getPrintEquivalentsForAssets([...CORE_ANIMATION_ASSET_IDS]);
    expect(equivalents).toHaveLength(4);
    expect(equivalents.map((item) => item.assetId)).toEqual(expect.arrayContaining(CORE_ANIMATION_ASSET_IDS));
  });

  it('keeps print-equivalent conceptIds aligned with the source asset conceptIds', () => {
    for (const assetId of CORE_ANIMATION_ASSET_IDS) {
      const asset = educationalAssetRegistry.find((entry) => entry.id === assetId);
      const equivalent = getPrintEquivalentForAsset(assetId);
      expect(asset).toBeDefined();
      expect(equivalent).toBeDefined();
      expect(equivalent?.conceptIds).toEqual(asset?.conceptIds);
    }
  });

  it('reports no missing registered print equivalents for current registry assets', () => {
    expect(getAssetsMissingRegisteredPrintEquivalent(educationalAssetRegistry)).toEqual([]);
  });
});
