/**
 * Tests for getRelevantExplainers helpers.
 *
 * Validates:
 *   - getExplainerIdForLimitingFactor maps factors to correct explainer IDs
 *   - getExplainerIdsFromBehaviourCards deduplicates and maps card factors
 *   - Unknown / undefined factors return null
 */

import { describe, it, expect } from 'vitest';
import {
  getExplainerIdForLimitingFactor,
  getExplainerIdsFromBehaviourCards,
} from '../getRelevantExplainers';
import type { PresentationLimitingFactor } from '../../behaviour/buildRealWorldBehaviourCards';

// ─── getExplainerIdForLimitingFactor ─────────────────────────────────────────

describe('getExplainerIdForLimitingFactor', () => {
  it('maps "mains" to shared_mains_flow', () => {
    expect(getExplainerIdForLimitingFactor('mains')).toBe('shared_mains_flow');
  });

  it('maps "instantaneous_output" to multiple_taps', () => {
    expect(getExplainerIdForLimitingFactor('instantaneous_output')).toBe('multiple_taps');
  });

  it('maps "storage" to on_demand_vs_stored', () => {
    expect(getExplainerIdForLimitingFactor('storage')).toBe('on_demand_vs_stored');
  });

  it('maps "distribution" to pressure_vs_flow', () => {
    expect(getExplainerIdForLimitingFactor('distribution')).toBe('pressure_vs_flow');
  });

  it('maps "recovery" to on_demand_vs_stored', () => {
    expect(getExplainerIdForLimitingFactor('recovery')).toBe('on_demand_vs_stored');
  });

  it('returns null for undefined input', () => {
    expect(getExplainerIdForLimitingFactor(undefined)).toBeNull();
  });

  it('returns a non-null value for every defined PresentationLimitingFactor', () => {
    const factors: PresentationLimitingFactor[] = [
      'mains',
      'instantaneous_output',
      'storage',
      'distribution',
      'recovery',
    ];
    for (const factor of factors) {
      expect(
        getExplainerIdForLimitingFactor(factor),
        `Expected non-null for factor "${factor}"`,
      ).not.toBeNull();
    }
  });
});

// ─── getExplainerIdsFromBehaviourCards ───────────────────────────────────────

describe('getExplainerIdsFromBehaviourCards', () => {
  it('returns an empty array for no cards', () => {
    expect(getExplainerIdsFromBehaviourCards([])).toEqual([]);
  });

  it('returns an empty array when no cards have limiting factors', () => {
    const cards = [{ limitingFactor: undefined }, { limitingFactor: undefined }];
    expect(getExplainerIdsFromBehaviourCards(cards)).toEqual([]);
  });

  it('maps a single card with a mains limiting factor', () => {
    const cards = [{ limitingFactor: 'mains' as PresentationLimitingFactor }];
    expect(getExplainerIdsFromBehaviourCards(cards)).toEqual(['shared_mains_flow']);
  });

  it('deduplicates when multiple cards share the same limiting factor', () => {
    const cards = [
      { limitingFactor: 'mains' as PresentationLimitingFactor },
      { limitingFactor: 'mains' as PresentationLimitingFactor },
    ];
    const result = getExplainerIdsFromBehaviourCards(cards);
    expect(result).toHaveLength(1);
    expect(result).toContain('shared_mains_flow');
  });

  it('returns multiple distinct explainer IDs for different limiting factors', () => {
    const cards = [
      { limitingFactor: 'mains' as PresentationLimitingFactor },
      { limitingFactor: 'instantaneous_output' as PresentationLimitingFactor },
    ];
    const result = getExplainerIdsFromBehaviourCards(cards);
    expect(result).toContain('shared_mains_flow');
    expect(result).toContain('multiple_taps');
    expect(result).toHaveLength(2);
  });

  it('ignores cards with undefined limiting factor', () => {
    const cards = [
      { limitingFactor: 'mains' as PresentationLimitingFactor },
      { limitingFactor: undefined },
    ];
    const result = getExplainerIdsFromBehaviourCards(cards);
    expect(result).toHaveLength(1);
    expect(result).toContain('shared_mains_flow');
  });
});
