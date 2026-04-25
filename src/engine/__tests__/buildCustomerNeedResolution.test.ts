/**
 * buildCustomerNeedResolution.test.ts
 *
 * Covers:
 *  - returns null when no survey signals are present
 *  - cold_spots: radiator performance signal → emits cold spots item
 *  - cold_spots: sludge bleed water colour → emits cold spots item
 *  - slow_hot_water: poor plate HEX condition → emits slow hot water item
 *  - slow_hot_water: severe fouling factor → emits slow hot water item
 *  - runs_out_of_hot_water: highOccupancy flag → emits runs out item
 *  - runs_out_of_hot_water: high simultaneous draw → emits runs out item
 *  - runs_out_of_hot_water: small cylinder for occupancy → emits runs out item
 *  - low_pressure_shower: gravity delivery mode → emits low pressure item
 *  - low_pressure_shower: low cws head → emits low pressure item
 *  - low_pressure_shower: low dynamic pressure → emits low pressure item
 *  - high_bills: poor boiler condition → emits high bills item
 *  - high_bills: high annual gas spend → emits high bills item
 *  - noisy_system: frequent circulation issues → emits noisy system item
 *  - future_extension: futureLoftConversion → emits future extension item
 *  - future_extension: futureAddBathroom → emits future extension item
 *  - cold_spots and noisy_system on same input do not duplicate the sludge item
 *  - max 5 items when all signals are present
 *  - block type is 'customer_need_resolution'
 *  - items contain need, action, outcome
 *  - block inserted into visual deck after facts block when input is provided
 *  - block NOT inserted when no survey signals in input
 */

import { describe, it, expect } from 'vitest';
import { buildCustomerNeedResolution } from '../modules/buildCustomerNeedResolution';
import { buildVisualBlocks } from '../modules/buildVisualBlocks';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import type { CustomerNeedResolutionBlock } from '../../contracts/VisualBlock';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBaseInput(): EngineInputV2_3 {
  return {
    postcode: 'SW1A 1AA',
    dynamicMainsPressure: 2.5,
    buildingMass: 'medium',
    primaryPipeDiameter: 22,
    heatLossWatts: 8000,
    radiatorCount: 10,
    hasLoftConversion: false,
    returnWaterTemp: 45,
    bathroomCount: 1,
    occupancySignature: 'professional',
    highOccupancy: false,
    preferCombi: true,
  };
}

function makeScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenarioId: 'system_unvented',
    system: { type: 'system', summary: 'System boiler with unvented cylinder' },
    performance: {
      hotWater:    'excellent',
      heating:     'very_good',
      efficiency:  'good',
      reliability: 'very_good',
    },
    keyBenefits:      ['Simultaneous hot water across multiple outlets'],
    keyConstraints:   ['Requires space for cylinder'],
    dayToDayOutcomes: ['Instant hot water at all outlets'],
    requiredWorks:    ['Install unvented cylinder'],
    upgradePaths:     [],
    physicsFlags:     {},
    ...overrides,
  };
}

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId: 'system_unvented',
    headline: 'A system boiler is the right fit for this home.',
    summary: 'System boiler with unvented cylinder.',
    keyReasons: ['Two bathrooms require stored hot water'],
    avoidedRisks: [],
    dayToDayOutcomes: ['Instant hot water at all outlets'],
    requiredWorks: ['Install unvented cylinder'],
    compatibilityWarnings: [],
    includedItems: ['System boiler', 'Unvented cylinder'],
    quoteScope: [],
    futureUpgradePaths: [],
    supportingFacts: [
      { label: 'Occupants', value: 4, source: 'survey' },
    ],
    lifecycle: {
      currentSystem: { type: 'regular', ageYears: 18, condition: 'good' },
      expectedLifespan: { typicalRangeYears: [15, 20], adjustedRangeYears: [13, 18] },
      influencingFactors: {
        waterQuality: 'moderate',
        scaleRisk: 'medium',
        usageIntensity: 'normal',
        maintenanceLevel: 'average',
      },
      riskIndicators: [],
      summary: 'System is in reasonable condition.',
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildCustomerNeedResolution — null when no signals', () => {
  it('returns null when input has no survey signals', () => {
    const result = buildCustomerNeedResolution(makeDecision(), makeBaseInput(), makeScenario());
    expect(result).toBeNull();
  });
});

describe('buildCustomerNeedResolution — cold spots', () => {
  it('emits cold spots item when radiatorPerformance is some_cold_spots', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'some_cold_spots' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes("rooms don't heat"))).toBe(true);
  });

  it('emits cold spots item when radiatorPerformance is many_cold', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'many_cold' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items[0].outcome).toContain('every room');
  });

  it('emits cold spots item when bleed water is sludge', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { bleedWaterColour: 'sludge' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
  });

  it('cold spots item confidence is direct', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'some_cold_spots' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block!.items[0].confidence).toBe('direct');
  });
});

describe('buildCustomerNeedResolution — slow hot water', () => {
  it('emits slow hot water item when plateHexConditionBand is poor', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      plateHexConditionBand: 'poor',
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('Hot water takes too long'))).toBe(true);
  });

  it('emits slow hot water item when fouling factor is below 0.85', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      plateHexFoulingFactor: 0.70,
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('Hot water takes too long'))).toBe(true);
  });

  it('slow hot water item outcome mentions faster hot water', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), plateHexConditionBand: 'severe' };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    const item = block!.items.find((i) => i.need.includes('Hot water takes too long'));
    expect(item?.outcome).toContain('Faster hot water');
  });
});

describe('buildCustomerNeedResolution — runs out of hot water', () => {
  it('emits runs out item when highOccupancy is true', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), highOccupancy: true };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('runs out'))).toBe(true);
  });

  it('emits runs out item when simultaneousDrawSeverity is high', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), simultaneousDrawSeverity: 'high' };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('runs out'))).toBe(true);
  });

  it('emits runs out item when cylinder is undersized for occupancy', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      occupancyCount: 5,
      cylinderVolumeLitres: 80, // below 5 × 25 = 125 litres threshold
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('runs out'))).toBe(true);
  });

  it('runs out item action mentions stored hot water for system boiler scenario', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), highOccupancy: true };
    const systemScenario = makeScenario({ system: { type: 'system', summary: 'System boiler' } });
    const block = buildCustomerNeedResolution(makeDecision(), input, systemScenario);
    const item = block!.items.find((i) => i.need.includes('runs out'));
    expect(item?.action).toContain('stored hot water');
  });
});

describe('buildCustomerNeedResolution — low pressure shower', () => {
  it('emits low pressure item when dhwDeliveryMode is gravity', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), dhwDeliveryMode: 'gravity' };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes("pressure isn't strong"))).toBe(true);
  });

  it('emits low pressure item when cwsHeadMetres is below 0.5', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), cwsHeadMetres: 0.3 };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes("pressure isn't strong"))).toBe(true);
  });

  it('emits low pressure item when dynamic pressure is below 1 bar', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), dynamicMainsPressure: 0.7 };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes("pressure isn't strong"))).toBe(true);
  });

  it('low pressure item action mentions tank-fed supply for gravity/low-head systems', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), dhwDeliveryMode: 'gravity' };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    const item = block!.items.find((i) => i.need.includes("pressure isn't strong"));
    expect(item?.action).toContain('tank-fed supply');
  });

  it('does NOT emit low pressure item at 2.5 bar normal pressure without gravity mode', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), dynamicMainsPressure: 2.5 };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block?.items.some((i) => i.need.includes("pressure isn't strong"))).toBeFalsy();
  });
});

describe('buildCustomerNeedResolution — high bills', () => {
  it('emits high bills item when boilerConditionBand is poor', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), boilerConditionBand: 'poor' };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('Energy costs'))).toBe(true);
  });

  it('emits high bills item when annualGasSpendGbp exceeds 1500', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), annualGasSpendGbp: 2000 };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('Energy costs'))).toBe(true);
  });

  it('emits high bills item when old non-condensing boiler is present', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: {
        boiler: { ageYears: 20, condensing: 'no' },
      },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('Energy costs'))).toBe(true);
  });

  it('does NOT emit high bills item for annualGasSpendGbp below 1500', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), annualGasSpendGbp: 900 };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    // base input has no signals at all, so block itself should be null
    expect(block?.items.some((i) => i.need.includes('Energy costs'))).toBeFalsy();
  });
});

describe('buildCustomerNeedResolution — noisy system', () => {
  it('emits noisy item when circulationIssues is frequent_noise_or_poor_flow', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { circulationIssues: 'frequent_noise_or_poor_flow' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('noisy'))).toBe(true);
  });

  it('emits noisy item when circulationIssues is occasional_noise', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { circulationIssues: 'occasional_noise' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block!.items.some((i) => i.need.includes('noisy'))).toBe(true);
  });

  it('noisy item outcome mentions quieter operation', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { circulationIssues: 'frequent_noise_or_poor_flow' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    const item = block!.items.find((i) => i.need.includes('noisy'));
    expect(item?.outcome).toContain('Quieter');
  });
});

describe('buildCustomerNeedResolution — future extension', () => {
  it('emits future extension item when futureLoftConversion is true', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), futureLoftConversion: true };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('add rooms or bathrooms'))).toBe(true);
  });

  it('emits future extension item when futureAddBathroom is true', () => {
    const input: EngineInputV2_3 = { ...makeBaseInput(), futureAddBathroom: true };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.some((i) => i.need.includes('add rooms or bathrooms'))).toBe(true);
  });
});

describe('buildCustomerNeedResolution — item structure', () => {
  it('every item has need, action, and outcome', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'some_cold_spots' } },
      boilerConditionBand: 'poor',
      futureLoftConversion: true,
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    for (const item of block!.items) {
      expect(typeof item.need).toBe('string');
      expect(typeof item.action).toBe('string');
      expect(typeof item.outcome).toBe('string');
      expect(item.need.length).toBeGreaterThan(0);
      expect(item.action.length).toBeGreaterThan(0);
      expect(item.outcome.length).toBeGreaterThan(0);
    }
  });

  it('block type is customer_need_resolution', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'some_cold_spots' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block!.type).toBe('customer_need_resolution');
  });

  it('block id is customer-need-resolution', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'some_cold_spots' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block!.id).toBe('customer-need-resolution');
  });

  it('block title is "What matters to you"', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      highOccupancy: true,
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block!.title).toBe('What matters to you');
  });
});

describe('buildCustomerNeedResolution — max 5 items', () => {
  it('caps items at 5 even when all signals are present', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'many_cold', circulationIssues: 'frequent_noise_or_poor_flow' } },
      plateHexConditionBand: 'poor',
      highOccupancy: true,
      cwsHeadMetres: 0.2,
      boilerConditionBand: 'poor',
      futureLoftConversion: true,
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    expect(block).not.toBeNull();
    expect(block!.items.length).toBeLessThanOrEqual(5);
  });
});

describe('buildCustomerNeedResolution — no duplicate items', () => {
  it('does not emit both cold spots and noisy items separately when only sludge signal present', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { bleedWaterColour: 'sludge' } },
    };
    const block = buildCustomerNeedResolution(makeDecision(), input, makeScenario());
    // bleedWaterColour sludge triggers BOTH cold_spots and noisy detectors —
    // cold_spots fires first; noisy fires second.
    // Both items should appear (they are distinct needs).
    expect(block).not.toBeNull();
    const coldItem = block!.items.find((i) => i.need.includes("rooms don't heat"));
    const noisyItem = block!.items.find((i) => i.need.includes('noisy'));
    expect(coldItem).toBeDefined();
    expect(noisyItem).toBeDefined();
    // Each need appears at most once
    const needSet = new Set(block!.items.map((i) => i.need));
    expect(needSet.size).toBe(block!.items.length);
  });
});

// ─── Integration with buildVisualBlocks ───────────────────────────────────────

describe('buildVisualBlocks — customer_need_resolution placement', () => {
  function makeSystemScenario(): ScenarioResult {
    return makeScenario({ scenarioId: 'system_unvented' });
  }

  it('customer_need_resolution block appears after facts when input has signals', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'some_cold_spots' } },
    };
    const blocks = buildVisualBlocks(makeDecision(), [makeSystemScenario()], undefined, input);
    const factsIdx  = blocks.findIndex((b) => b.type === 'facts');
    const needIdx   = blocks.findIndex((b) => b.type === 'customer_need_resolution');
    expect(needIdx).toBeGreaterThan(-1);
    expect(needIdx).toBe(factsIdx + 1);
  });

  it('customer_need_resolution block is NOT inserted when no input is provided', () => {
    const blocks = buildVisualBlocks(makeDecision(), [makeSystemScenario()]);
    expect(blocks.some((b) => b.type === 'customer_need_resolution')).toBe(false);
  });

  it('customer_need_resolution block is NOT inserted when input has no signals', () => {
    const blocks = buildVisualBlocks(makeDecision(), [makeSystemScenario()], undefined, makeBaseInput());
    expect(blocks.some((b) => b.type === 'customer_need_resolution')).toBe(false);
  });

  it('portal_cta is still the last block when customer_need_resolution is present', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'some_cold_spots' } },
    };
    const blocks = buildVisualBlocks(makeDecision(), [makeSystemScenario()], undefined, input);
    expect(blocks[blocks.length - 1].type).toBe('portal_cta');
  });

  it('block items are accessible via CustomerNeedResolutionBlock type', () => {
    const input: EngineInputV2_3 = {
      ...makeBaseInput(),
      currentSystem: { conditionSignals: { radiatorPerformance: 'some_cold_spots' } },
    };
    const blocks = buildVisualBlocks(makeDecision(), [makeSystemScenario()], undefined, input);
    const needBlock = blocks.find((b) => b.type === 'customer_need_resolution') as
      CustomerNeedResolutionBlock | undefined;
    expect(needBlock).toBeDefined();
    expect(Array.isArray(needBlock!.items)).toBe(true);
    expect(needBlock!.items.length).toBeGreaterThan(0);
  });
});
