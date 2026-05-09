import { describe, expect, it } from 'vitest';
import {
  getAllEducationalAssets,
  getMotionAssets,
  getPrintableAssets,
} from '../audit/listEducationalAssets';

describe('educationalAssetRegistry', () => {
  it('registry returns assets', () => {
    const assets = getAllEducationalAssets();
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.some((asset) => asset.id === 'WhatIfLab')).toBe(true);
  });

  it('reduced-motion assets are detectable', () => {
    const motionAssets = getMotionAssets();
    expect(motionAssets.length).toBeGreaterThan(0);
    expect(motionAssets.some((asset) => asset.supportsReducedMotion)).toBe(true);
  });

  it('print assets are detectable', () => {
    const printableAssets = getPrintableAssets();
    expect(printableAssets.length).toBeGreaterThan(0);
    expect(printableAssets.every((asset) => asset.hasPrintEquivalent)).toBe(true);
  });
});
