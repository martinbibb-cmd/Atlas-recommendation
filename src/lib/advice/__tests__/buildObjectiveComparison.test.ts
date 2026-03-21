// src/lib/advice/__tests__/buildObjectiveComparison.test.ts
//
// Tests for buildObjectiveComparison — objective priority comparison builder.
//
// Coverage:
//   - Returns correct ObjectiveComparisonView shape for each priority
//   - rankedOptionIds contains only options present in engine output
//   - Viable options are ranked before rejected options
//   - recommendedOptionNote is present when recommended option is in ranked list
//   - chosenOptionNote is absent when no customer divergence
//   - chosenOptionNote is present when customer has diverged
//   - buildAllObjectiveComparisons returns all 6 priority views

import { describe, it, expect } from 'vitest';
import {
  buildObjectiveComparison,
  buildAllObjectiveComparisons,
  OBJECTIVE_PRIORITY_IDS,
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
  optionIds: Array<{ id: EngineOutputV1['options'][number]['id']; status?: 'viable' | 'caution' | 'rejected' }>,
): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'Combi boiler' },
    explainers: [],
    options: optionIds.map(o => makeOption(o.id, o.status ?? 'viable')),
  };
}

function makeState(
  recommendedOptionId: string,
  chosenOptionId?: string,
): RecommendationPresentationState {
  return {
    recommendedOptionId,
    chosenOptionId: chosenOptionId ?? recommendedOptionId,
    chosenByCustomer: chosenOptionId != null && chosenOptionId !== recommendedOptionId,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildObjectiveComparison — shape', () => {
  it('returns a view with the correct objectiveId', () => {
    const output = makeOutput([{ id: 'combi' }]);
    const state  = makeState('combi');
    const view   = buildObjectiveComparison(output, 'running_costs', state);
    expect(view.objectiveId).toBe('running_costs');
  });

  it('returns a non-empty title', () => {
    const output = makeOutput([{ id: 'combi' }]);
    const state  = makeState('combi');
    const view   = buildObjectiveComparison(output, 'hot_water', state);
    expect(view.title.length).toBeGreaterThan(0);
  });

  it('returns a non-empty intro', () => {
    const output = makeOutput([{ id: 'combi' }]);
    const state  = makeState('combi');
    const view   = buildObjectiveComparison(output, 'space_saving', state);
    expect(view.intro.length).toBeGreaterThan(0);
  });
});

describe('buildObjectiveComparison — rankedOptionIds', () => {
  it('only includes option IDs present in engine output', () => {
    // Only combi and ashp in output; others are not present
    const output = makeOutput([{ id: 'combi' }, { id: 'ashp' }]);
    const state  = makeState('combi');
    const view   = buildObjectiveComparison(output, 'running_costs', state);
    expect(view.rankedOptionIds).toEqual(expect.arrayContaining(['combi', 'ashp']));
    expect(view.rankedOptionIds).not.toContain('stored_vented');
    expect(view.rankedOptionIds).not.toContain('stored_unvented');
  });

  it('places viable options before rejected options', () => {
    const output = makeOutput([
      { id: 'combi',    status: 'rejected' },
      { id: 'ashp',     status: 'viable' },
    ]);
    const state = makeState('ashp');
    const view  = buildObjectiveComparison(output, 'running_costs', state);
    const ashpRank  = view.rankedOptionIds.indexOf('ashp');
    const combiRank = view.rankedOptionIds.indexOf('combi');
    expect(ashpRank).toBeLessThan(combiRank);
  });

  it('returns all 6 available options when all are present', () => {
    const output = makeOutput([
      { id: 'combi' },
      { id: 'ashp' },
      { id: 'stored_vented' },
      { id: 'stored_unvented' },
      { id: 'regular_vented' },
      { id: 'system_unvented' },
    ]);
    const state = makeState('combi');
    const view  = buildObjectiveComparison(output, 'simplicity', state);
    expect(view.rankedOptionIds).toHaveLength(6);
  });
});

describe('buildObjectiveComparison — recommendedOptionNote', () => {
  it('is present when the recommended option is in the ranked list', () => {
    const output = makeOutput([{ id: 'combi' }, { id: 'ashp' }]);
    const state  = makeState('combi');
    const view   = buildObjectiveComparison(output, 'space_saving', state);
    expect(view.recommendedOptionNote).toBeDefined();
    expect(typeof view.recommendedOptionNote).toBe('string');
  });

  it('is undefined when the recommended option is not in the engine output', () => {
    const output = makeOutput([{ id: 'combi' }]);
    // Recommend an option that does not exist in the output
    const state = makeState('nonexistent_option_id');
    const view  = buildObjectiveComparison(output, 'simplicity', state);
    expect(view.recommendedOptionNote).toBeUndefined();
  });

  it('gives a "strong fit" note when the recommended option ranks first', () => {
    // For space_saving, combi is ranked first
    const output = makeOutput([
      { id: 'combi' },
      { id: 'ashp' },
      { id: 'stored_vented' },
    ]);
    const state = makeState('combi');
    const view  = buildObjectiveComparison(output, 'space_saving', state);
    expect(view.recommendedOptionNote).toMatch(/strong/i);
  });
});

describe('buildObjectiveComparison — chosenOptionNote', () => {
  it('is absent when the customer has not diverged', () => {
    const output = makeOutput([{ id: 'combi' }, { id: 'ashp' }]);
    const state  = makeState('combi'); // no divergence
    const view   = buildObjectiveComparison(output, 'running_costs', state);
    expect(view.chosenOptionNote).toBeUndefined();
  });

  it('is present when the customer has chosen a different option', () => {
    const output = makeOutput([{ id: 'combi' }, { id: 'ashp' }]);
    const state  = makeState('combi', 'ashp'); // divergent: recommended combi, chosen ashp
    const view   = buildObjectiveComparison(output, 'running_costs', state);
    expect(view.chosenOptionNote).toBeDefined();
    expect(typeof view.chosenOptionNote).toBe('string');
  });

  it('is undefined when the chosen option is not in the engine output', () => {
    const output = makeOutput([{ id: 'combi' }]);
    const state  = makeState('combi', 'nonexistent_id');
    const view   = buildObjectiveComparison(output, 'space_saving', state);
    expect(view.chosenOptionNote).toBeUndefined();
  });
});

describe('buildAllObjectiveComparisons', () => {
  it('returns a map with all 6 priority IDs', () => {
    const output = makeOutput([{ id: 'combi' }, { id: 'ashp' }]);
    const state  = makeState('combi');
    const map    = buildAllObjectiveComparisons(output, state);
    for (const id of OBJECTIVE_PRIORITY_IDS) {
      expect(map.has(id)).toBe(true);
    }
  });

  it('each view has correct objectiveId', () => {
    const output = makeOutput([{ id: 'combi' }]);
    const state  = makeState('combi');
    const map    = buildAllObjectiveComparisons(output, state);
    for (const id of OBJECTIVE_PRIORITY_IDS) {
      expect(map.get(id)!.objectiveId).toBe(id);
    }
  });

  it('OBJECTIVE_PRIORITY_IDS contains exactly 6 entries', () => {
    expect(OBJECTIVE_PRIORITY_IDS).toHaveLength(6);
  });

  it('includes running_costs, hot_water, space_saving, simplicity, future_flexibility, lower_disruption', () => {
    expect(OBJECTIVE_PRIORITY_IDS).toContain('running_costs');
    expect(OBJECTIVE_PRIORITY_IDS).toContain('hot_water');
    expect(OBJECTIVE_PRIORITY_IDS).toContain('space_saving');
    expect(OBJECTIVE_PRIORITY_IDS).toContain('simplicity');
    expect(OBJECTIVE_PRIORITY_IDS).toContain('future_flexibility');
    expect(OBJECTIVE_PRIORITY_IDS).toContain('lower_disruption');
  });
});
