import { describe, expect, it } from 'vitest';
import { educationalAssetAccessibilityAudits } from '../audits/educationalAssetAccessibilityAudits';

const SEEDED_ASSET_IDS = [
  'WhatIfLab',
  'BoilerCyclingAnimation',
  'FlowRestrictionAnimation',
  'RadiatorUpgradeAnimation',
];

describe('educationalAssetAccessibilityAudits registry', () => {
  it('contains a record for each of the four seeded assets', () => {
    const registeredIds = educationalAssetAccessibilityAudits.map((a) => a.assetId);
    for (const id of SEEDED_ASSET_IDS) {
      expect(registeredIds).toContain(id);
    }
  });

  it('every record has a unique auditId', () => {
    const ids = educationalAssetAccessibilityAudits.map((a) => a.auditId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every record has a non-empty auditedBy field', () => {
    for (const audit of educationalAssetAccessibilityAudits) {
      expect(audit.auditedBy).toBeTruthy();
    }
  });

  it('every record has a non-empty auditedAt field in YYYY-MM-DD format', () => {
    for (const audit of educationalAssetAccessibilityAudits) {
      expect(audit.auditedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('seeded records use status "needs_changes" — none are prematurely passed', () => {
    for (const audit of educationalAssetAccessibilityAudits) {
      if (SEEDED_ASSET_IDS.includes(audit.assetId)) {
        expect(audit.status).toBe('needs_changes');
      }
    }
  });

  it('seeded records have no approvedFor modes — none are approved for production delivery', () => {
    for (const audit of educationalAssetAccessibilityAudits) {
      if (SEEDED_ASSET_IDS.includes(audit.assetId)) {
        expect(audit.approvedFor).toHaveLength(0);
      }
    }
  });

  it('every record has a checks object with all ten required keys', () => {
    const REQUIRED_KEYS = [
      'semanticStructure',
      'keyboardSafe',
      'reducedMotionSafe',
      'staticFallbackAvailable',
      'printEquivalentAvailable',
      'colourNotSoleIndicator',
      'screenReaderSummaryAvailable',
      'cognitiveLoadAcceptable',
      'noDecorativeMotion',
      'noUnsupportedClaims',
    ] as const;

    for (const audit of educationalAssetAccessibilityAudits) {
      for (const key of REQUIRED_KEYS) {
        expect(typeof audit.checks[key]).toBe('boolean');
      }
    }
  });

  it('every record has notes as an array', () => {
    for (const audit of educationalAssetAccessibilityAudits) {
      expect(Array.isArray(audit.notes)).toBe(true);
    }
  });

  it('every record has requiredChanges as an array', () => {
    for (const audit of educationalAssetAccessibilityAudits) {
      expect(Array.isArray(audit.requiredChanges)).toBe(true);
    }
  });

  it('needs_changes records have at least one requiredChange entry', () => {
    const needsChanges = educationalAssetAccessibilityAudits.filter(
      (a) => a.status === 'needs_changes',
    );
    for (const audit of needsChanges) {
      expect(audit.requiredChanges.length).toBeGreaterThan(0);
    }
  });
});
