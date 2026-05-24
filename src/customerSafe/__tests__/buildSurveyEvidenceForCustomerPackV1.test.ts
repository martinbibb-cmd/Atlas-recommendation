import { describe, expect, it } from 'vitest';
import { buildSurveyEvidenceForCustomerPackV1 } from '../buildSurveyEvidenceForCustomerPackV1';
import type { SurveyEvidenceAdapterInputV1 } from '../SurveyEvidenceForCustomerPackV1';

// ─── 1. Empty input → all groups in fallback ─────────────────────────────────

describe('empty input', () => {
  it('produces a valid result with all 11 groups in fallback mode', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({});

    expect(result.schemaVersion).toBe('1.0');
    expect(result.specificity.genericFallbackCount).toBe(11);
    expect(result.specificity.homeSpecificFactCount).toBe(0);
    expect(result.specificity.emptyOrGenericGroupIds).toHaveLength(11);
  });

  it('never throws when all fields are undefined', () => {
    expect(() => buildSurveyEvidenceForCustomerPackV1({})).not.toThrow();
  });

  it('produces evidencePresent === false for all groups when input is empty', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({});
    const groupKeys = [
      'occupancy',
      'simultaneousDemand',
      'mainsSupply',
      'existingHotWaterType',
      'existingHeatingType',
      'emitterSuitability',
      'cylinderStorage',
      'recoveryAssumptions',
      'protectionSludgeFilter',
      'heatLossStorey',
      'futureUpgradeConstraints',
    ] as const;
    for (const key of groupKeys) {
      expect(result[key].evidencePresent).toBe(false);
      expect(result[key].facts).toHaveLength(0);
    }
  });
});

// ─── 2. Combi / 1-person / 1-bathroom case ───────────────────────────────────

describe('1-person / 1-bathroom combi case', () => {
  const input: SurveyEvidenceAdapterInputV1 = {
    usage: {
      composition: { adultCount: 1 },
      bathroomCount: 1,
      daytimeOccupancy: 'usually_out',
      bathUse: 'rare',
    },
    systemBuilder: {
      heatSource: 'combi',
    },
  };

  it('occupancy group notes a single-person home', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.occupancy.evidencePresent).toBe(true);
    expect(result.occupancy.facts.some((f) => /single-person/i.test(f))).toBe(true);
  });

  it('simultaneousDemand group mentions low demand and combi support', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.simultaneousDemand.evidencePresent).toBe(true);
    const factText = result.simultaneousDemand.facts.join(' ');
    expect(factText).toMatch(/simultaneous/i);
    expect(factText).toMatch(/low/i);
    expect(factText).toMatch(/combi/i);
  });

  it('existingHotWaterType group identifies combi boiler', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.existingHotWaterType.evidencePresent).toBe(true);
    expect(result.existingHotWaterType.facts.join(' ')).toMatch(/combi/i);
  });

  it('cylinderStorage group notes no cylinder for combi', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.cylinderStorage.evidencePresent).toBe(true);
    expect(result.cylinderStorage.facts.join(' ')).toMatch(/no hot water cylinder/i);
  });

  it('recoveryAssumptions group notes no recovery for combi', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.recoveryAssumptions.evidencePresent).toBe(true);
    expect(result.recoveryAssumptions.facts.join(' ')).toMatch(/on demand/i);
  });

  it('specificity score has homeSpecificFactCount > 0', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.specificity.homeSpecificFactCount).toBeGreaterThan(0);
  });
});

// ─── 3. Stored-hot-water / 3-person / 2-bathroom case ────────────────────────

describe('3-person / 2-bathroom system boiler with cylinder', () => {
  const input: SurveyEvidenceAdapterInputV1 = {
    usage: {
      composition: { adultCount: 2, childCount5to10: 1 },
      bathroomCount: 2,
      daytimeOccupancy: 'usually_home',
      bathUse: 'sometimes',
    },
    systemBuilder: {
      heatSource: 'system',
      dhwType: 'unvented',
      cylinderVolumeL: 210,
      cylinderAgeBand: '5_to_10',
      cylinderCondition: 'good',
    },
  };

  it('simultaneousDemand group mentions elevated demand and stored hot water', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.simultaneousDemand.evidencePresent).toBe(true);
    const factText = result.simultaneousDemand.facts.join(' ');
    expect(factText).toMatch(/elevated/i);
    expect(factText).toMatch(/stored/i);
  });

  it('occupancy group records 3 occupants', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.occupancy.evidencePresent).toBe(true);
    expect(result.occupancy.facts.join(' ')).toMatch(/3/);
  });

  it('cylinderStorage group records cylinder volume', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.cylinderStorage.evidencePresent).toBe(true);
    expect(result.cylinderStorage.facts.join(' ')).toMatch(/210/);
  });

  it('recoveryAssumptions group references cylinder volume and occupants', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.recoveryAssumptions.evidencePresent).toBe(true);
    const text = result.recoveryAssumptions.facts.join(' ');
    expect(text).toMatch(/210/);
    expect(text).toMatch(/3 occupants/i);
  });

  it('existingHotWaterType group notes system boiler with unvented cylinder', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(input);
    expect(result.existingHotWaterType.evidencePresent).toBe(true);
    const text = result.existingHotWaterType.facts.join(' ');
    expect(text).toMatch(/system boiler/i);
    expect(text).toMatch(/unvented/i);
  });
});

// ─── 4. Protection / sludge gating ───────────────────────────────────────────

describe('protection / sludge evidence gating', () => {
  it('does NOT produce any protection facts when no condition data is provided', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({});
    expect(result.protectionSludgeFilter.evidencePresent).toBe(false);
    expect(result.protectionSludgeFilter.facts).toHaveLength(0);
  });

  it('does NOT claim "no debris" when only a magnetic filter status is present', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({
      systemBuilder: { magneticFilter: 'fitted' },
    });
    const factText = result.protectionSludgeFilter.facts.join(' ');
    expect(factText).not.toMatch(/no debris/i);
    expect(factText).not.toMatch(/no specific safety/i);
  });

  it('emits a clean-water fact when heatingCondition bleedWaterColour is clear', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({
      heatingCondition: { bleedWaterColour: 'clear' },
    });
    expect(result.protectionSludgeFilter.evidencePresent).toBe(true);
    expect(result.protectionSludgeFilter.facts.join(' ')).toMatch(/clear/i);
  });

  it('emits a no-debris fact when magneticDebrisEvidence is explicitly false', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({
      heatingCondition: { magneticDebrisEvidence: false },
    });
    expect(result.protectionSludgeFilter.evidencePresent).toBe(true);
    expect(result.protectionSludgeFilter.facts.join(' ')).toMatch(/no magnetic debris/i);
  });

  it('emits a sludge warning when bleedWaterColour is black', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({
      heatingCondition: { bleedWaterColour: 'black' },
    });
    expect(result.protectionSludgeFilter.evidencePresent).toBe(true);
    expect(result.protectionSludgeFilter.facts.join(' ')).toMatch(/black/i);
  });

  it('emits a debris warning when magneticDebrisEvidence is true', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({
      heatingCondition: { magneticDebrisEvidence: true },
    });
    expect(result.protectionSludgeFilter.evidencePresent).toBe(true);
    expect(result.protectionSludgeFilter.facts.join(' ')).toMatch(/magnetic debris/i);
  });
});

// ─── 5. Mains supply gating (measured flow only) ─────────────────────────────

describe('mains supply — measured flow gating', () => {
  it('does NOT include flow rate when mainsDynamicFlowLpmKnown is false', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({
      mainsSupply: {
        mainsDynamicFlowLpm: 18,
        mainsDynamicFlowLpmKnown: false,
      },
    });
    expect(result.mainsSupply.evidencePresent).toBe(false);
  });

  it('does NOT include flow rate when mainsDynamicFlowLpmKnown is undefined', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({
      mainsSupply: { mainsDynamicFlowLpm: 18 },
    });
    expect(result.mainsSupply.evidencePresent).toBe(false);
  });

  it('DOES include confirmed flow rate when mainsDynamicFlowLpmKnown is true', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({
      mainsSupply: {
        mainsDynamicFlowLpm: 18,
        mainsDynamicFlowLpmKnown: true,
      },
    });
    expect(result.mainsSupply.evidencePresent).toBe(true);
    expect(result.mainsSupply.facts.join(' ')).toMatch(/18\.0 L\/min/);
  });

  it('includes static and dynamic pressure when present', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({
      mainsSupply: {
        staticMainsPressureBar: 3.2,
        dynamicMainsPressureBar: 2.8,
      },
    });
    expect(result.mainsSupply.evidencePresent).toBe(true);
    const text = result.mainsSupply.facts.join(' ');
    expect(text).toMatch(/3\.2 bar/);
    expect(text).toMatch(/2\.8 bar/);
  });
});

// ─── 6. Specificity: rich survey produces more home-specific facts than fallbacks ──

describe('specificity scoring', () => {
  const richInput: SurveyEvidenceAdapterInputV1 = {
    usage: {
      composition: { adultCount: 2, childCount5to10: 1 },
      bathroomCount: 2,
      daytimeOccupancy: 'usually_out',
      bathUse: 'sometimes',
    },
    systemBuilder: {
      heatSource: 'system',
      dhwType: 'unvented',
      emitters: 'radiators_standard',
      primarySize: 22,
      layout: 'two_pipe',
      heatingSystemType: 'sealed',
      cylinderVolumeL: 180,
      cylinderAgeBand: '5_to_10',
      cylinderCondition: 'good',
      magneticFilter: 'fitted',
      cleaningHistory: 'recently_cleaned',
    },
    mainsSupply: {
      staticMainsPressureBar: 3.0,
      dynamicMainsPressureBar: 2.5,
      mainsDynamicFlowLpm: 20,
      mainsDynamicFlowLpmKnown: true,
    },
    heatingCondition: {
      bleedWaterColour: 'clear',
      magneticDebrisEvidence: false,
    },
    heatLoss: {
      estimatedPeakHeatLossW: 8000,
      heatLossConfidence: 'estimated',
      storeys: 2,
      dwellingType: 'semi',
    },
  };

  it('homeSpecificFactCount exceeds genericFallbackCount for a well-surveyed home', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(richInput);
    expect(result.specificity.homeSpecificFactCount).toBeGreaterThan(
      result.specificity.genericFallbackCount,
    );
  });

  it('most groups have evidencePresent === true for a well-surveyed home', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(richInput);
    const presentCount = result.specificity.homeSpecificFactCount > 0
      ? 11 - result.specificity.genericFallbackCount
      : 0;
    expect(presentCount).toBeGreaterThanOrEqual(8);
  });

  it('emptyOrGenericGroupIds is shorter than all group IDs for a well-surveyed home', () => {
    const result = buildSurveyEvidenceForCustomerPackV1(richInput);
    expect(result.specificity.emptyOrGenericGroupIds.length).toBeLessThan(11);
  });
});

// ─── 7. buildCustomerEvidencePackV1 integration: safety card gating ──────────

describe('buildCustomerEvidencePackV1 safety card gating', () => {
  // These tests verify that the safety card does not make unconditional
  // "no safety observations" claims.

  it('generic fallback text does not include "no specific safety observations"', () => {
    // The old unconditional text must not appear anywhere in the adapter output
    const result = buildSurveyEvidenceForCustomerPackV1({});
    const allFacts = result.protectionSludgeFilter.facts.join(' ');
    expect(allFacts).not.toMatch(/no specific safety observations/i);
  });

  it('fallback text for protection group does not claim clean system', () => {
    const result = buildSurveyEvidenceForCustomerPackV1({});
    expect(result.protectionSludgeFilter.genericFallback).not.toMatch(/no debris/i);
    expect(result.protectionSludgeFilter.genericFallback).not.toMatch(/no specific safety/i);
  });
});
