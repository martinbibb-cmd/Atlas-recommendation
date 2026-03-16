// src/lib/story/__tests__/buildPhysicsStory.test.ts
//
// Tests for the buildPhysicsStory story assembly function.
//
// Coverage:
//   - Returns empty array when no signals are triggered
//   - Detects combi_peak_demand_penalty from bathroom count
//   - Detects combi_peak_demand_penalty from concurrency limiter
//   - Detects combi_peak_demand_penalty from combi caution/rejected status
//   - Detects stored_peak_demand_advantage when stored is viable and combi is not
//   - Detects ashp_flow_requirement_limit from pipe limiter
//   - Detects high_return_temp_condensing_penalty from cycling limiter
//   - Detects thermal_mass_supports_continuous_heat from building mass
//   - Detects water_quality_scale_risk from hard water
//   - Returns max 5 cards
//   - Cards are ordered by priority
//   - Evidence line is null when inputs are absent
//   - Evidence line includes relevant values when inputs are present

import { describe, it, expect } from 'vitest';
import { buildPhysicsStory } from '../buildPhysicsStory';
import type { EngineOutputV1, OptionCardV1, LimiterV1 } from '../../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeOption(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
): OptionCardV1 {
  return {
    id,
    label: id,
    status,
    headline: `${id} headline`,
    why: [],
    requirements: [],
    typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    heat:        { status: 'ok', headline: '', bullets: [] },
    dhw:         { status: 'ok', headline: '', bullets: [] },
    engineering: { status: 'ok', headline: '', bullets: [] },
  };
}

function makeLimiter(id: LimiterV1['id']): LimiterV1 {
  return {
    id,
    title: `${id} title`,
    severity: 'warn',
    observed: { label: 'Observed', value: '22 mm' },
    limit:    { label: 'Limit',    value: '28 mm' },
    impact: { summary: `${id} impact summary` },
    confidence: 'medium',
    sources: [],
    suggestedFixes: [],
  };
}

const BASE_OUTPUT: EngineOutputV1 = {
  eligibility:    [],
  redFlags:       [],
  recommendation: { primary: 'Combi boiler' },
  explainers:     [],
  limiters:       { limiters: [] },
  options:        [],
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('buildPhysicsStory — no signals', () => {
  it('returns empty array when no signals are triggered', () => {
    const cards = buildPhysicsStory(BASE_OUTPUT);
    expect(cards).toEqual([]);
  });

  it('returns empty array with no input and no matching engine data', () => {
    const cards = buildPhysicsStory({
      ...BASE_OUTPUT,
      options: [makeOption('combi', 'viable')],
    });
    expect(cards).toEqual([]);
  });
});

// ── combi_peak_demand_penalty ─────────────────────────────────────────────────

describe('buildPhysicsStory — combi_peak_demand_penalty', () => {
  it('triggers from bathroomCount >= 2', () => {
    const input = { bathroomCount: 2 } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    expect(cards.some(c => c.id === 'combi_peak_demand_penalty')).toBe(true);
  });

  it('triggers from occupancyCount >= 4', () => {
    const input = { occupancyCount: 4 } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    expect(cards.some(c => c.id === 'combi_peak_demand_penalty')).toBe(true);
  });

  it('triggers from combi-concurrency-constraint limiter', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      limiters: { limiters: [makeLimiter('combi-concurrency-constraint')] },
    };
    const cards = buildPhysicsStory(output);
    expect(cards.some(c => c.id === 'combi_peak_demand_penalty')).toBe(true);
  });

  it('triggers when combi option is caution', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      options: [makeOption('combi', 'caution')],
    };
    const cards = buildPhysicsStory(output);
    expect(cards.some(c => c.id === 'combi_peak_demand_penalty')).toBe(true);
  });

  it('does NOT trigger for bathroomCount === 1 and low occupancy', () => {
    const input = { bathroomCount: 1, occupancyCount: 2 } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    expect(cards.some(c => c.id === 'combi_peak_demand_penalty')).toBe(false);
  });
});

// ── stored_peak_demand_advantage ──────────────────────────────────────────────

describe('buildPhysicsStory — stored_peak_demand_advantage', () => {
  it('triggers when stored is viable and combi is caution', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      options: [
        makeOption('combi', 'caution'),
        makeOption('stored_unvented', 'viable'),
      ],
    };
    const cards = buildPhysicsStory(output);
    expect(cards.some(c => c.id === 'stored_peak_demand_advantage')).toBe(true);
  });

  it('triggers when stored is viable and combi_peak_demand_penalty is also triggered', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      options: [
        makeOption('combi', 'viable'),
        makeOption('stored_vented', 'viable'),
      ],
    };
    const input = { bathroomCount: 2 } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(output, input);
    expect(cards.some(c => c.id === 'stored_peak_demand_advantage')).toBe(true);
  });

  it('does NOT trigger when no stored option is viable', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      options: [
        makeOption('combi', 'caution'),
        makeOption('stored_unvented', 'caution'),
      ],
    };
    const cards = buildPhysicsStory(output);
    expect(cards.some(c => c.id === 'stored_peak_demand_advantage')).toBe(false);
  });
});

// ── ashp_flow_requirement_limit ───────────────────────────────────────────────

describe('buildPhysicsStory — ashp_flow_requirement_limit', () => {
  it('triggers from primary-pipe-constraint limiter', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      limiters: { limiters: [makeLimiter('primary-pipe-constraint')] },
    };
    const cards = buildPhysicsStory(output);
    expect(cards.some(c => c.id === 'ashp_flow_requirement_limit')).toBe(true);
  });

  it('includes a limiter evidence line when pipe limiter is present', () => {
    const pipeLimiter = makeLimiter('primary-pipe-constraint');
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      limiters: { limiters: [pipeLimiter] },
    };
    const cards = buildPhysicsStory(output);
    const card = cards.find(c => c.id === 'ashp_flow_requirement_limit');
    // Evidence line uses observed/limit values format
    expect(card?.evidenceLine).toContain('22 mm');
    expect(card?.evidenceLine).toContain('28 mm');
  });
});

// ── high_return_temp_condensing_penalty ───────────────────────────────────────

describe('buildPhysicsStory — high_return_temp_condensing_penalty', () => {
  it('triggers from cycling-loss-penalty limiter', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      limiters: { limiters: [makeLimiter('cycling-loss-penalty')] },
    };
    const cards = buildPhysicsStory(output);
    expect(cards.some(c => c.id === 'high_return_temp_condensing_penalty')).toBe(true);
  });

  it('triggers from flow-temp-too-high-for-ashp limiter', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      limiters: { limiters: [makeLimiter('flow-temp-too-high-for-ashp')] },
    };
    const cards = buildPhysicsStory(output);
    expect(cards.some(c => c.id === 'high_return_temp_condensing_penalty')).toBe(true);
  });
});

// ── thermal_mass_supports_continuous_heat ─────────────────────────────────────

describe('buildPhysicsStory — thermal_mass_supports_continuous_heat', () => {
  it('triggers from heavy building mass', () => {
    const input = { buildingMass: 'heavy' } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    expect(cards.some(c => c.id === 'thermal_mass_supports_continuous_heat')).toBe(true);
  });

  it('triggers from steady_home occupancy signature', () => {
    const input = { occupancySignature: 'steady_home' } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    expect(cards.some(c => c.id === 'thermal_mass_supports_continuous_heat')).toBe(true);
  });

  it('does NOT trigger for light building mass with non-steady occupancy', () => {
    const input = {
      buildingMass: 'light',
      occupancySignature: 'shift_worker',
    } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    expect(cards.some(c => c.id === 'thermal_mass_supports_continuous_heat')).toBe(false);
  });
});

// ── water_quality_scale_risk ──────────────────────────────────────────────────

describe('buildPhysicsStory — water_quality_scale_risk', () => {
  it('triggers from hard water', () => {
    const input = { waterHardnessCategory: 'hard' } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    expect(cards.some(c => c.id === 'water_quality_scale_risk')).toBe(true);
  });

  it('triggers from very_hard water', () => {
    const input = { waterHardnessCategory: 'very_hard' } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    expect(cards.some(c => c.id === 'water_quality_scale_risk')).toBe(true);
  });

  it('does NOT trigger for soft water', () => {
    const input = { waterHardnessCategory: 'soft' } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    expect(cards.some(c => c.id === 'water_quality_scale_risk')).toBe(false);
  });

  it('evidence line includes hard water label', () => {
    const input = { waterHardnessCategory: 'hard' } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    const card = cards.find(c => c.id === 'water_quality_scale_risk');
    expect(card?.evidenceLine).toBe('Water hardness: hard water');
  });
});

// ── Card structure ────────────────────────────────────────────────────────────

describe('buildPhysicsStory — card structure', () => {
  it('each card has a stable id, title, and summary', () => {
    const input = { bathroomCount: 2 } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    for (const card of cards) {
      expect(typeof card.id).toBe('string');
      expect(typeof card.title).toBe('string');
      expect(typeof card.summary).toBe('string');
      expect(card.title.length).toBeGreaterThan(0);
    }
  });

  it('positions are sequential starting at 1', () => {
    const input = {
      bathroomCount: 3,
      waterHardnessCategory: 'hard',
    } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    cards.forEach((card, i) => {
      expect(card.position).toBe(i + 1);
    });
  });

  it('returns at most 5 cards even with many signals triggered', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      limiters: {
        limiters: [
          makeLimiter('primary-pipe-constraint'),
          makeLimiter('cycling-loss-penalty'),
        ],
      },
      options: [
        makeOption('combi', 'caution'),
        makeOption('stored_unvented', 'viable'),
      ],
    };
    const input = {
      bathroomCount: 3,
      buildingMass: 'heavy',
      waterHardnessCategory: 'hard',
    } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(output, input);
    expect(cards.length).toBeLessThanOrEqual(5);
  });

  it('cards are ordered by priority (ascending)', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      limiters: {
        limiters: [makeLimiter('primary-pipe-constraint')],
      },
    };
    const input = {
      bathroomCount: 2,
      waterHardnessCategory: 'hard',
    } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(output, input);
    // The card with lowest priority number should come first
    // combi_peak_demand_penalty (priority 1) should precede water_quality_scale_risk (priority 6)
    const combiIdx = cards.findIndex(c => c.id === 'combi_peak_demand_penalty');
    const waterIdx = cards.findIndex(c => c.id === 'water_quality_scale_risk');
    if (combiIdx !== -1 && waterIdx !== -1) {
      expect(combiIdx).toBeLessThan(waterIdx);
    }
  });
});

// ── Evidence lines ────────────────────────────────────────────────────────────

describe('buildPhysicsStory — evidence lines', () => {
  it('combi_peak_demand_penalty evidence includes bathroom count', () => {
    const input = { bathroomCount: 2, occupancyCount: 4 } as Partial<EngineInputV2_3>;
    const cards = buildPhysicsStory(BASE_OUTPUT, input);
    const card = cards.find(c => c.id === 'combi_peak_demand_penalty');
    expect(card?.evidenceLine).toContain('2 bathrooms');
    expect(card?.evidenceLine).toContain('4 occupants');
  });

  it('combi_peak_demand_penalty evidence is null when no relevant inputs', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      options: [makeOption('combi', 'caution')],
    };
    const cards = buildPhysicsStory(output);
    const card = cards.find(c => c.id === 'combi_peak_demand_penalty');
    expect(card?.evidenceLine).toBeNull();
  });

  it('stored_peak_demand_advantage evidence labels the viable stored option', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      options: [
        makeOption('combi', 'caution'),
        makeOption('stored_unvented', 'viable'),
      ],
    };
    const cards = buildPhysicsStory(output);
    const card = cards.find(c => c.id === 'stored_peak_demand_advantage');
    expect(card?.evidenceLine).toContain('viable');
  });
});
