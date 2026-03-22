/**
 * deriveProfileFromHouseholdComposition.test.ts
 *
 * Tests for the household composition → demographic profile derivation layer.
 *
 * Covers:
 *   1. occupancyCount sums all age bands correctly
 *   2. Age-band priority: teenagers > young children > adults only
 *   3. Daytime pattern → daytimeOccupancyHint mapping
 *   4. Bath frequency derivation including young-child bath boost
 *   5. Simultaneous use severity derivation
 *   6. Full end-to-end examples for common household types
 *   7. Edge cases: single adult, empty nest, minimum occupancy
 */
import { describe, it, expect } from 'vitest';
import {
  deriveProfileFromHouseholdComposition,
} from '../deriveProfileFromHouseholdComposition';
import type {
  DaytimeOccupancyPattern,
  BathUsePattern,
} from '../deriveProfileFromHouseholdComposition';
import type { HouseholdComposition } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_COMPOSITION: HouseholdComposition = {
  adultCount: 0,
  childCount0to4: 0,
  childCount5to10: 0,
  childCount11to17: 0,
  youngAdultCount18to25AtHome: 0,
};

function compose(overrides: Partial<HouseholdComposition> = {}): HouseholdComposition {
  return { ...EMPTY_COMPOSITION, ...overrides };
}

// ─── 1. occupancyCount ────────────────────────────────────────────────────────

describe('occupancyCount derivation', () => {
  it('sums all age bands', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount5to10: 1, childCount11to17: 1 }),
      'usually_out',
      'sometimes',
    );
    expect(result.occupancyCount).toBe(4);
  });

  it('includes youngAdultCount18to25AtHome in total', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, youngAdultCount18to25AtHome: 1 }),
      'usually_out',
      'rare',
    );
    expect(result.occupancyCount).toBe(3);
  });

  it('enforces minimum occupancy of 1 even for adultCount=0', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 0 }),
      'usually_out',
      'rare',
    );
    expect(result.occupancyCount).toBeGreaterThanOrEqual(1);
  });

  it('correctly sums all five bands', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({
        adultCount: 1,
        childCount0to4: 1,
        childCount5to10: 1,
        childCount11to17: 1,
        youngAdultCount18to25AtHome: 1,
      }),
      'usually_home',
      'frequent',
    );
    expect(result.occupancyCount).toBe(5);
  });
});

// ─── 2. Preset derivation priority ───────────────────────────────────────────

describe('derivedPresetId — age-band priority', () => {
  it('teenagers (11–17) → family_teenagers regardless of other bands', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount11to17: 1, childCount5to10: 1 }),
      'usually_out',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('family_teenagers');
  });

  it('young children (5–10) with no teenagers → family_young_children', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount5to10: 2 }),
      'usually_out',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('family_young_children');
  });

  it('toddlers (0–4) with no older children → family_young_children', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount0to4: 1 }),
      'usually_out',
      'rare',
    );
    expect(result.derivedPresetId).toBe('family_young_children');
  });

  it('two adults, usually home, no children → retired_couple', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2 }),
      'usually_home',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('retired_couple');
  });

  it('two adults, usually out, no children → working_couple', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2 }),
      'usually_out',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('working_couple');
  });

  it('two adults, irregular schedule → shift_worker', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2 }),
      'irregular',
      'rare',
    );
    expect(result.derivedPresetId).toBe('shift_worker');
  });

  it('three or more adult-like occupants → multigenerational', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 3 }),
      'usually_out',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('multigenerational');
  });

  it('two adults + young adult at home → multigenerational', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, youngAdultCount18to25AtHome: 1 }),
      'usually_out',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('multigenerational');
  });

  it('single adult, usually home → home_worker', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1 }),
      'usually_home',
      'rare',
    );
    expect(result.derivedPresetId).toBe('home_worker');
  });

  it('single adult, irregular schedule → shift_worker', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1 }),
      'irregular',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('shift_worker');
  });

  it('single adult, usually out → single_working_adult', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1 }),
      'usually_out',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('single_working_adult');
  });

  it('adults only, frequent baths → bath_heavy', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2 }),
      'usually_out',
      'frequent',
    );
    expect(result.derivedPresetId).toBe('bath_heavy');
  });

  it('bath_heavy does NOT apply when children are present', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount5to10: 1 }),
      'usually_out',
      'frequent',
    );
    // children take priority over bath-heavy
    expect(result.derivedPresetId).toBe('family_young_children');
  });
});

// ─── 3. Daytime occupancy hint ────────────────────────────────────────────────

describe('daytimeOccupancyHint mapping', () => {
  it('usually_out → absent', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1 }),
      'usually_out',
      'rare',
    );
    expect(result.daytimeOccupancyHint).toBe('absent');
  });

  it('usually_home → full', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1 }),
      'usually_home',
      'rare',
    );
    expect(result.daytimeOccupancyHint).toBe('full');
  });

  it('irregular → partial', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1 }),
      'irregular',
      'rare',
    );
    expect(result.daytimeOccupancyHint).toBe('partial');
  });
});

// ─── 4. Bath frequency per week ───────────────────────────────────────────────

describe('bathFrequencyPerWeek derivation', () => {
  it('rare + no children → 0', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2 }),
      'usually_out',
      'rare',
    );
    expect(result.bathFrequencyPerWeek).toBe(0);
  });

  it('sometimes + no children → 3', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2 }),
      'usually_out',
      'sometimes',
    );
    expect(result.bathFrequencyPerWeek).toBe(3);
  });

  it('frequent + no children → 7', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2 }),
      'usually_out',
      'frequent',
    );
    expect(result.bathFrequencyPerWeek).toBe(7);
  });

  it('one toddler (0–4) boosts bath frequency to at least 1 even when bathUse=rare', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount0to4: 1 }),
      'usually_out',
      'rare',
    );
    expect(result.bathFrequencyPerWeek).toBeGreaterThanOrEqual(1);
  });

  it('two toddlers (0–4) boost bath frequency to at least 2', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount0to4: 2 }),
      'usually_out',
      'rare',
    );
    expect(result.bathFrequencyPerWeek).toBeGreaterThanOrEqual(2);
  });

  it('bath frequency is capped at 14 (twice daily max)', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount0to4: 7 }),
      'usually_out',
      'frequent',
    );
    expect(result.bathFrequencyPerWeek).toBeLessThanOrEqual(14);
  });
});

// ─── 5. Simultaneous use severity ─────────────────────────────────────────────

describe('simultaneousUseSeverity derivation', () => {
  it('single adult → low', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1 }),
      'usually_out',
      'rare',
    );
    expect(result.simultaneousUseSeverity).toBe('low');
  });

  it('two adults + one teenager → medium (1 high-demand + 3 total)', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount11to17: 1 }),
      'usually_out',
      'rare',
    );
    expect(result.simultaneousUseSeverity).toBe('medium');
  });

  it('two teenagers → high (2 high-demand)', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount11to17: 2 }),
      'usually_out',
      'rare',
    );
    expect(result.simultaneousUseSeverity).toBe('high');
  });

  it('4+ occupants with no teenagers → high', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 4 }),
      'usually_out',
      'sometimes',
    );
    expect(result.simultaneousUseSeverity).toBe('high');
  });

  it('one young adult at home → medium', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1, youngAdultCount18to25AtHome: 1 }),
      'usually_out',
      'rare',
    );
    expect(result.simultaneousUseSeverity).toBe('medium');
  });

  it('two young adults at home → high', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1, youngAdultCount18to25AtHome: 2 }),
      'usually_out',
      'rare',
    );
    expect(result.simultaneousUseSeverity).toBe('high');
  });
});

// ─── 6. Full end-to-end examples ──────────────────────────────────────────────

describe('end-to-end household profile derivation examples', () => {
  it('2 adults + 1 toddler + 1 child 5–10, out during day → family_young_children', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount0to4: 1, childCount5to10: 1 }),
      'usually_out',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('family_young_children');
    expect(result.occupancyCount).toBe(4);
    expect(result.daytimeOccupancyHint).toBe('absent');
    expect(result.bathFrequencyPerWeek).toBeGreaterThanOrEqual(1); // toddler boost
  });

  it('2 adults + 2 teenagers, out during day → family_teenagers with high simultaneous', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, childCount11to17: 2 }),
      'usually_out',
      'rare',
    );
    expect(result.derivedPresetId).toBe('family_teenagers');
    expect(result.occupancyCount).toBe(4);
    expect(result.simultaneousUseSeverity).toBe('high');
  });

  it('retired couple (2 adults usually home, occasional baths) → retired_couple', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2 }),
      'usually_home',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('retired_couple');
    expect(result.daytimeOccupancyHint).toBe('full');
    expect(result.simultaneousUseSeverity).toBe('low');
  });

  it('single working adult, out during day → single_working_adult', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 1 }),
      'usually_out',
      'rare',
    );
    expect(result.derivedPresetId).toBe('single_working_adult');
    expect(result.occupancyCount).toBe(1);
    expect(result.simultaneousUseSeverity).toBe('low');
  });

  it('multigenerational: 2 adults + adult child at home → multigenerational', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 2, youngAdultCount18to25AtHome: 1 }),
      'irregular',
      'sometimes',
    );
    expect(result.derivedPresetId).toBe('multigenerational');
    expect(result.occupancyCount).toBe(3);
  });
});

// ─── 7. Edge cases ────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('all-zero composition (adultCount=0) produces occupancyCount ≥ 1', () => {
    const result = deriveProfileFromHouseholdComposition(
      EMPTY_COMPOSITION,
      'usually_out',
      'rare',
    );
    expect(result.occupancyCount).toBeGreaterThanOrEqual(1);
  });

  it('adultCount=0 but children present — occupancyCount counts children', () => {
    const result = deriveProfileFromHouseholdComposition(
      compose({ adultCount: 0, childCount5to10: 2 }),
      'usually_home',
      'rare',
    );
    // Math.max(1, 0) + 2 = 3
    expect(result.occupancyCount).toBe(3);
  });
});

// ─── 8. All DaytimeOccupancyPattern values are handled ───────────────────────

describe('all DaytimeOccupancyPattern values produce valid output', () => {
  const patterns: DaytimeOccupancyPattern[] = ['usually_out', 'usually_home', 'irregular'];
  const bathOptions: BathUsePattern[] = ['rare', 'sometimes', 'frequent'];
  const base = compose({ adultCount: 2 });

  for (const pattern of patterns) {
    for (const bath of bathOptions) {
      it(`pattern=${pattern} bathUse=${bath} → valid derivedPresetId`, () => {
        const result = deriveProfileFromHouseholdComposition(base, pattern, bath);
        expect(typeof result.derivedPresetId).toBe('string');
        expect(result.derivedPresetId.length).toBeGreaterThan(0);
        expect(typeof result.occupancyCount).toBe('number');
        expect(result.occupancyCount).toBeGreaterThanOrEqual(1);
      });
    }
  }
});
