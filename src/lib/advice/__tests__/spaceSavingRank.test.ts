/**
 * spaceSavingRank.test.ts
 *
 * Regression tests for the space_saving priority ranking in
 * buildObjectiveComparison.
 *
 * Bug fixed: `regular_vented` was incorrectly ranked 2nd (above unvented
 * systems) in the space_saving priority order. Open-vented / regular systems
 * require both a hot-water cylinder AND a cold-water storage tank in the loft,
 * making them among the worst for space saving — not second best.
 *
 * Expected canonical order (best → worst for space saving):
 *   1. combi           — no cylinder at all
 *   2. stored_unvented — mains-fed cylinder; no loft cold-water tank
 *   3. system_unvented — same as stored_unvented (system boiler variant)
 *   4. stored_vented   — vented cylinder plus loft cold-water tank
 *   5. regular_vented  — regular boiler layout plus vented cylinder plus loft tank
 *   6. ashp            — worst: large thermal store plus outdoor unit
 */

import { describe, it, expect } from 'vitest';
import {
  buildObjectiveComparison,
} from '../buildObjectiveComparison';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { RecommendationPresentationState } from '../../selection/optionSelection';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOption(
  id: EngineOutputV1['options'][number]['id'],
  status: 'viable' | 'caution' | 'rejected' = 'viable',
): EngineOutputV1['options'][number] {
  return {
    id,
    label: id,
    status,
    headline: '',
    why: [],
    requirements: [],
    heat: { status: 'ok', headline: '', bullets: [] },
    dhw:  { status: 'ok', headline: '', bullets: [] },
    engineering: { status: 'ok', headline: '', bullets: [] },
    sensitivities: [],
  };
}

function makeOutput(
  ids: Array<EngineOutputV1['options'][number]['id']>,
): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'Combi boiler' },
    explainers: [],
    options: ids.map(id => makeOption(id)),
  };
}

function makeState(recommendedOptionId: string): RecommendationPresentationState {
  return {
    recommendedOptionId,
    chosenOptionId: recommendedOptionId,
    chosenByCustomer: false,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('space_saving priority ranking — canonical order', () => {
  const output = makeOutput([
    'combi',
    'stored_unvented',
    'system_unvented',
    'stored_vented',
    'regular_vented',
    'ashp',
  ]);
  const state = makeState('combi');
  const view = buildObjectiveComparison(output, 'space_saving', state);
  const ranked = view.rankedOptionIds;

  it('combi ranks first (best for space saving)', () => {
    expect(ranked.indexOf('combi')).toBe(0);
  });

  it('stored_unvented ranks above regular_vented', () => {
    expect(ranked.indexOf('stored_unvented')).toBeLessThan(ranked.indexOf('regular_vented'));
  });

  it('system_unvented ranks above regular_vented', () => {
    expect(ranked.indexOf('system_unvented')).toBeLessThan(ranked.indexOf('regular_vented'));
  });

  it('stored_unvented ranks above stored_vented', () => {
    // Mains-fed cylinder does not need a loft cold-water tank — better for space
    expect(ranked.indexOf('stored_unvented')).toBeLessThan(ranked.indexOf('stored_vented'));
  });

  it('regular_vented does NOT rank above stored_unvented (regression bug fix)', () => {
    // This is the specific regression check: regular_vented was previously 2nd.
    expect(ranked.indexOf('regular_vented')).toBeGreaterThan(ranked.indexOf('stored_unvented'));
  });

  it('ashp ranks last (worst for space saving)', () => {
    expect(ranked.indexOf('ashp')).toBe(ranked.length - 1);
  });

  it('stored_vented ranks above regular_vented', () => {
    expect(ranked.indexOf('stored_vented')).toBeLessThan(ranked.indexOf('regular_vented'));
  });
});

describe('space_saving priority ranking — combi subset', () => {
  it('combi is ranked higher than regular_vented when both are present', () => {
    const output = makeOutput(['combi', 'regular_vented']);
    const view = buildObjectiveComparison(output, 'space_saving', makeState('combi'));
    expect(view.rankedOptionIds.indexOf('combi')).toBeLessThan(
      view.rankedOptionIds.indexOf('regular_vented'),
    );
  });

  it('combi receives a "strong fit" note for space_saving when ranked first', () => {
    const output = makeOutput(['combi', 'regular_vented', 'ashp']);
    const view = buildObjectiveComparison(output, 'space_saving', makeState('combi'));
    expect(view.recommendedOptionNote).toMatch(/strong/i);
  });

  it('regular_vented does not receive a "strong fit" note for space_saving', () => {
    const output = makeOutput(['combi', 'regular_vented', 'ashp']);
    const view = buildObjectiveComparison(output, 'space_saving', makeState('regular_vented'));
    // regular_vented is near the bottom — note should not say "strong fit"
    expect(view.recommendedOptionNote).not.toMatch(/strong/i);
  });
});

describe('space_saving priority ranking — mains-fed wins over gravity', () => {
  it('stored_unvented ranks above stored_vented in an all-stored comparison', () => {
    const output = makeOutput(['stored_unvented', 'system_unvented', 'stored_vented', 'regular_vented']);
    const view = buildObjectiveComparison(output, 'space_saving', makeState('stored_unvented'));
    const ranked = view.rankedOptionIds;
    expect(ranked.indexOf('stored_unvented')).toBeLessThan(ranked.indexOf('stored_vented'));
    expect(ranked.indexOf('stored_unvented')).toBeLessThan(ranked.indexOf('regular_vented'));
  });
});
