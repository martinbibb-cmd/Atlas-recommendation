/**
 * insightDerivations.test.ts
 *
 * Unit tests for condition-based insight derivation logic.
 *
 * Key scenarios validated:
 *   - Clean system does NOT produce a blanket flush recommendation
 *   - Poor condition system DOES produce a strong cleaning recommendation
 *   - Quick wins vary based on condition / system / house inputs
 *   - Mitigation signals (magnetic filter, recent clean) reduce condition grade
 *   - deriveSystemConditionGrade returns correct band from signal combinations
 */
import { describe, it, expect } from 'vitest';
import {
  deriveSystemConditionGrade,
  deriveQuickWins,
  derivePresentSystemInsight,
} from '../insightDerivations';
import type { SystemBuilderState } from '../../systemBuilder/systemBuilderTypes';
import { INITIAL_SYSTEM_BUILDER_STATE } from '../../systemBuilder/systemBuilderTypes';
import type { FullSurveyModelV1 } from '../../../../ui/fullSurvey/FullSurveyModelV1';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeSystem(overrides: Partial<SystemBuilderState> = {}): SystemBuilderState {
  return { ...INITIAL_SYSTEM_BUILDER_STATE, ...overrides };
}

function makeInput(overrides: Partial<FullSurveyModelV1> = {}): FullSurveyModelV1 {
  return {
    heatLossWatts: 8000,
    hasMagneticFilter: false,
    ...overrides,
  } as unknown as FullSurveyModelV1;
}

// ─── deriveSystemConditionGrade ───────────────────────────────────────────────

describe('deriveSystemConditionGrade', () => {
  it('returns clean when bleed water is clear and radiators are all even', () => {
    const system = makeSystem({ bleedWaterColour: 'clear', radiatorPerformance: 'all_even' });
    expect(deriveSystemConditionGrade(system)).toBe('clean');
  });

  it('returns moderate when bleed water is slightly discoloured', () => {
    const system = makeSystem({ bleedWaterColour: 'slightly_discoloured' });
    expect(deriveSystemConditionGrade(system)).toBe('moderate');
  });

  it('returns moderate when bleed water is dark', () => {
    const system = makeSystem({ bleedWaterColour: 'dark' });
    expect(deriveSystemConditionGrade(system)).toBe('moderate');
  });

  it('returns moderate when there are some cold spots', () => {
    const system = makeSystem({ radiatorPerformance: 'some_cold_spots' });
    expect(deriveSystemConditionGrade(system)).toBe('moderate');
  });

  it('returns poor when bleed water is sludge', () => {
    const system = makeSystem({ bleedWaterColour: 'sludge' });
    expect(deriveSystemConditionGrade(system)).toBe('poor');
  });

  it('returns poor when many radiators are cold', () => {
    const system = makeSystem({ radiatorPerformance: 'many_cold' });
    expect(deriveSystemConditionGrade(system)).toBe('poor');
  });

  it('returns poor when dark bleed and frequent noise/poor flow combined', () => {
    const system = makeSystem({
      bleedWaterColour: 'dark',
      circulationIssues: 'frequent_noise_or_poor_flow',
    });
    expect(deriveSystemConditionGrade(system)).toBe('poor');
  });

  it('returns moderate (safe default) when all signals are null/unknown', () => {
    const system = makeSystem({ bleedWaterColour: 'unknown' });
    expect(deriveSystemConditionGrade(system)).toBe('moderate');
  });

  it('reduces poor to moderate when magnetic filter is fitted', () => {
    const system = makeSystem({ bleedWaterColour: 'sludge', magneticFilter: 'fitted' });
    expect(deriveSystemConditionGrade(system)).toBe('moderate');
  });

  it('reduces poor to moderate when recently cleaned', () => {
    const system = makeSystem({ bleedWaterColour: 'sludge', cleaningHistory: 'recently_cleaned' });
    expect(deriveSystemConditionGrade(system)).toBe('moderate');
  });

  it('reduces poor to clean with both filter fitted and recently cleaned', () => {
    const system = makeSystem({
      bleedWaterColour: 'sludge',
      magneticFilter: 'fitted',
      cleaningHistory: 'recently_cleaned',
    });
    expect(deriveSystemConditionGrade(system)).toBe('clean');
  });

  it('reduces moderate to clean when magnetic filter is fitted', () => {
    const system = makeSystem({ bleedWaterColour: 'dark', magneticFilter: 'fitted' });
    expect(deriveSystemConditionGrade(system)).toBe('clean');
  });
});

// ─── deriveQuickWins — flush logic ────────────────────────────────────────────

describe('deriveQuickWins — system clean recommendations', () => {
  it('does NOT produce a flush recommendation for a clean system', () => {
    const system = makeSystem({
      bleedWaterColour: 'clear',
      radiatorPerformance: 'all_even',
      circulationIssues: 'none',
    });
    const wins = deriveQuickWins(system, makeInput());
    const flushWin = wins.find(w => w.id === 'flush');
    expect(flushWin).toBeUndefined();
  });

  it('does NOT produce a blanket power-flush for an old open-vented system with no condition signals', () => {
    const system = makeSystem({
      heatSource: 'regular',
      heatingSystemType: 'open_vented',
      boilerAgeYears: 15,
    });
    const wins = deriveQuickWins(system, makeInput());
    const flushWin = wins.find(w => w.id === 'flush');
    if (flushWin) {
      expect(flushWin.title).not.toContain('Power flush');
    }
  });

  it('produces a strong cleaning recommendation for a poor condition system', () => {
    const system = makeSystem({
      bleedWaterColour: 'sludge',
      radiatorPerformance: 'many_cold',
    });
    const wins = deriveQuickWins(system, makeInput());
    const flushWin = wins.find(w => w.id === 'flush');
    expect(flushWin).toBeDefined();
    expect(flushWin?.title).toBe('System clean and flush');
    expect(flushWin?.reason).toContain('sludge');
  });

  it('produces a moderate cleaning recommendation for a moderate condition system', () => {
    const system = makeSystem({
      bleedWaterColour: 'dark',
      radiatorPerformance: 'some_cold_spots',
    });
    const wins = deriveQuickWins(system, makeInput());
    const flushWin = wins.find(w => w.id === 'flush');
    expect(flushWin).toBeDefined();
    expect(flushWin?.title).toBe('Chemical system clean');
  });

  it('does not recommend system flush when poor condition is mitigated by recent clean + filter', () => {
    const system = makeSystem({
      bleedWaterColour: 'sludge',
      magneticFilter: 'fitted',
      cleaningHistory: 'recently_cleaned',
    });
    const wins = deriveQuickWins(system, makeInput());
    const flushWin = wins.find(w => w.id === 'flush');
    expect(flushWin).toBeUndefined();
  });
});

// ─── deriveQuickWins — magnetic filter logic ──────────────────────────────────

describe('deriveQuickWins — magnetic filter', () => {
  it('recommends magnetic filter when not fitted', () => {
    const system = makeSystem({ magneticFilter: 'not_fitted' });
    const wins = deriveQuickWins(system, makeInput());
    expect(wins.find(w => w.id === 'magnetic_filter')).toBeDefined();
  });

  it('does NOT recommend magnetic filter when already fitted', () => {
    const system = makeSystem({ magneticFilter: 'fitted' });
    const wins = deriveQuickWins(system, makeInput());
    expect(wins.find(w => w.id === 'magnetic_filter')).toBeUndefined();
  });

  it('recommends magnetic filter when status is null (unknown)', () => {
    const system = makeSystem({ magneticFilter: null });
    const wins = deriveQuickWins(system, makeInput());
    expect(wins.find(w => w.id === 'magnetic_filter')).toBeDefined();
  });
});

// ─── deriveQuickWins — insulation quick wins ─────────────────────────────────

describe('deriveQuickWins — insulation quick wins', () => {
  it('recommends loft insulation when roof insulation is poor', () => {
    const system = makeSystem();
    const input = makeInput({ building: { fabric: { roofInsulation: 'poor' } } } as unknown as Partial<FullSurveyModelV1>);
    const wins = deriveQuickWins(system, input);
    const loftWin = wins.find(w => w.id === 'loft_insulation');
    expect(loftWin).toBeDefined();
    expect(loftWin?.reason).toContain('faster gains');
  });

  it('recommends cavity insulation when wall type is cavity_unfilled', () => {
    const system = makeSystem();
    const input = makeInput({ building: { fabric: { wallType: 'cavity_unfilled' } } } as unknown as Partial<FullSurveyModelV1>);
    const wins = deriveQuickWins(system, input);
    expect(wins.find(w => w.id === 'cavity_insulation')).toBeDefined();
  });
});

// ─── derivePresentSystemInsight — condition signals integration ───────────────

describe('derivePresentSystemInsight — condition signals', () => {
  it('derives condition "good" from clean condition signals', () => {
    const system = makeSystem({ bleedWaterColour: 'clear', radiatorPerformance: 'all_even' });
    const insight = derivePresentSystemInsight(system);
    expect(insight.condition).toBe('good');
  });

  it('derives condition "poor" from sludge signal', () => {
    const system = makeSystem({ bleedWaterColour: 'sludge' });
    const insight = derivePresentSystemInsight(system);
    expect(insight.condition).toBe('poor');
  });

  it('falls back to age/service heuristic when no condition signals captured', () => {
    const system = makeSystem({ boilerAgeYears: 3, serviceHistory: 'regular' });
    const insight = derivePresentSystemInsight(system);
    expect(insight.condition).toBe('good');
  });

  it('returns unknown when no condition signals and no age/service data', () => {
    const system = makeSystem();
    const insight = derivePresentSystemInsight(system);
    expect(insight.condition).toBe('unknown');
  });
});
