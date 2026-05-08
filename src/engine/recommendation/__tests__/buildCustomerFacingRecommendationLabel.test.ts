/**
 * buildCustomerFacingRecommendationLabel.test.ts
 *
 * Verifies:
 *   - Base labels per ApplianceFamily contain no technical subtype leakage.
 *   - Mixergy override resolves correctly for system and regular families.
 *   - Vented fallback override resolves correctly.
 *   - "unvented cylinder" is never present in any customer label.
 *   - All produced labels use only atlas-terminology.md terms.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCustomerFacingRecommendationLabel,
} from '../buildCustomerFacingRecommendationLabel';
import type { ApplianceFamily } from '../../topology/SystemTopology';

const ALL_FAMILIES: ApplianceFamily[] = ['combi', 'system', 'heat_pump', 'regular', 'open_vented'];

// ─── Base labels (no dhwSubtype) ──────────────────────────────────────────────

describe('buildCustomerFacingRecommendationLabel — base labels', () => {
  it('returns a non-empty string for every ApplianceFamily', () => {
    for (const family of ALL_FAMILIES) {
      const label = buildCustomerFacingRecommendationLabel(family);
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('never contains "unvented cylinder" in any base label', () => {
    for (const family of ALL_FAMILIES) {
      const label = buildCustomerFacingRecommendationLabel(family);
      expect(label.toLowerCase()).not.toContain('unvented cylinder');
    }
  });

  it('never contains prohibited terms (ΔT, L/min, throughput-limited, dynamic under load)', () => {
    for (const family of ALL_FAMILIES) {
      const label = buildCustomerFacingRecommendationLabel(family);
      expect(label).not.toContain('ΔT');
      expect(label.toLowerCase()).not.toContain('l/min');
      expect(label.toLowerCase()).not.toContain('throughput-limited');
      expect(label.toLowerCase()).not.toContain('dynamic under load');
    }
  });

  it('system base label uses behavioural stored-hot-water phrasing', () => {
    const label = buildCustomerFacingRecommendationLabel('system');
    expect(label).toContain('stored hot water');
  });

  it('combi base label references on-demand hot water', () => {
    const label = buildCustomerFacingRecommendationLabel('combi');
    expect(label.toLowerCase()).toContain('on-demand hot water');
  });

  it('open_vented base label uses tank-fed hot water per atlas-terminology.md', () => {
    const label = buildCustomerFacingRecommendationLabel('open_vented');
    expect(label.toLowerCase()).toContain('tank-fed hot water');
  });
});

// ─── Mixergy override ─────────────────────────────────────────────────────────

describe('buildCustomerFacingRecommendationLabel — mixergy override', () => {
  it('resolves to system boiler with pressure-tolerant phrasing for system family', () => {
    const label = buildCustomerFacingRecommendationLabel('system', 'mixergy');
    expect(label).toBe('System boiler with pressure-tolerant stored hot water');
  });

  it('resolves to regular boiler with pressure-tolerant phrasing for regular family', () => {
    const label = buildCustomerFacingRecommendationLabel('regular', 'mixergy');
    expect(label).toBe('Regular boiler with pressure-tolerant stored hot water');
  });

  it('mixergy label never contains "unvented cylinder"', () => {
    for (const family of ['system', 'regular'] as ApplianceFamily[]) {
      const label = buildCustomerFacingRecommendationLabel(family, 'mixergy');
      expect(label.toLowerCase()).not.toContain('unvented cylinder');
    }
  });

  it('mixergy label uses pressure-tolerant phrasing', () => {
    const label = buildCustomerFacingRecommendationLabel('system', 'mixergy');
    expect(label.toLowerCase()).toContain('pressure-tolerant');
  });
});

// ─── Vented fallback override ─────────────────────────────────────────────────

describe('buildCustomerFacingRecommendationLabel — vented_fallback override', () => {
  it('resolves to "Stored hot water system" for system family with vented_fallback', () => {
    const label = buildCustomerFacingRecommendationLabel('system', 'vented_fallback');
    expect(label).toBe('Stored hot water system');
  });

  it('resolves to "Stored hot water system" for regular family with vented_fallback', () => {
    const label = buildCustomerFacingRecommendationLabel('regular', 'vented_fallback');
    expect(label).toBe('Stored hot water system');
  });

  it('vented_fallback label does not mention unvented or Mixergy', () => {
    const label = buildCustomerFacingRecommendationLabel('system', 'vented_fallback');
    expect(label.toLowerCase()).not.toContain('unvented');
    expect(label.toLowerCase()).not.toContain('mixergy');
  });
});

// ─── Regular-unvented override ───────────────────────────────────────────────

describe('buildCustomerFacingRecommendationLabel — regular_unvented override', () => {
  it('resolves to "Regular boiler with unvented cylinder" for system family', () => {
    const label = buildCustomerFacingRecommendationLabel('system', 'regular_unvented');
    expect(label).toBe('Regular boiler with unvented cylinder');
  });

  it('regular_unvented label contains "Regular boiler" (not "System boiler")', () => {
    const label = buildCustomerFacingRecommendationLabel('system', 'regular_unvented');
    expect(label.toLowerCase()).toContain('regular boiler');
    expect(label.toLowerCase()).not.toContain('system boiler');
  });

  it('regular_unvented label contains "unvented"', () => {
    const label = buildCustomerFacingRecommendationLabel('system', 'regular_unvented');
    expect(label.toLowerCase()).toContain('unvented');
  });

  it('regular_unvented label does not contain tank-fed or gravity-fed phrasing', () => {
    const label = buildCustomerFacingRecommendationLabel('system', 'regular_unvented');
    expect(label.toLowerCase()).not.toContain('tank-fed');
    expect(label.toLowerCase()).not.toContain('gravity');
  });
});

// ─── Priority check: undefined dhwSubtype falls through to base label ─────────

describe('buildCustomerFacingRecommendationLabel — priority', () => {
  it('undefined dhwSubtype falls through to base label', () => {
    const label = buildCustomerFacingRecommendationLabel('system', undefined);
    expect(label).toBe('System boiler with stored hot water');
  });
});
