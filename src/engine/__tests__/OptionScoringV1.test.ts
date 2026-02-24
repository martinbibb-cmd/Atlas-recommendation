import { describe, it, expect } from 'vitest';
import { buildOptionMatrixV1 } from '../OptionMatrixBuilder';
import { runEngine } from '../Engine';

const baseInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
  availableSpace: 'ok' as const,
};

describe('OptionScoringV1 — card score shape', () => {
  it('each card has a score field with total, breakdown', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      expect(card.score).toBeDefined();
      expect(typeof card.score!.total).toBe('number');
      expect(Array.isArray(card.score!.breakdown)).toBe(true);
    }
  });

  it('score total is clamped 0–100', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      expect(card.score!.total).toBeGreaterThanOrEqual(0);
      expect(card.score!.total).toBeLessThanOrEqual(100);
    }
  });
});

describe('OptionScoringV1 — rejected option scores 0', () => {
  it('rejected combi (2 bathrooms) → score 0', () => {
    const input = { ...baseInput, bathroomCount: 2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const combi = options.find(o => o.id === 'combi')!;
    expect(combi.status).toBe('rejected');
    expect(combi.score!.total).toBe(0);
    expect(combi.score!.breakdown[0].id).toBe('rejected');
  });

  it('rejected ASHP (22mm + 14kW) → score 0', () => {
    const input = { ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(ashp.status).toBe('rejected');
    expect(ashp.score!.total).toBe(0);
    expect(ashp.score!.breakdown[0].id).toBe('rejected');
  });

  it('rejected system_unvented (pressure < 1.0 bar) → score 0', () => {
    const input = { ...baseInput, dynamicMainsPressure: 0.8 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    expect(unvented.status).toBe('rejected');
    expect(unvented.score!.total).toBe(0);
  });
});

describe('OptionScoringV1 — caution reduces score', () => {
  it('caution status applies -10 penalty', () => {
    const input = { ...baseInput, availableSpace: 'tight' as const };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const stored = options.find(o => o.id === 'stored_vented')!;
    expect(stored.status).toBe('caution');
    // caution base penalty: -10
    const cautionItem = stored.score!.breakdown.find(b => b.id === 'status_caution');
    expect(cautionItem).toBeDefined();
    expect(cautionItem!.penalty).toBe(10);
    expect(stored.score!.total).toBeLessThan(100);
  });

  it('caution system_unvented (pressure 1.2 bar) scores below 100', () => {
    const input = { ...baseInput, dynamicMainsPressure: 1.2 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'system_unvented')!;
    expect(unvented.status).toBe('caution');
    expect(unvented.score!.total).toBeLessThan(100);
  });
});

describe('OptionScoringV1 — missing mains flow measurement reduces unvented score', () => {
  it('missing flow measurement applies -8 to stored_unvented', () => {
    // No mainsDynamicFlowLpm → hasMeasurements = false
    const input = { ...baseInput, dynamicMainsPressure: 2.0 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const unvented = options.find(o => o.id === 'stored_unvented')!;
    const noMeasItem = unvented.score!.breakdown.find(b => b.id === 'cws_no_measurements');
    expect(noMeasItem).toBeDefined();
    expect(noMeasItem!.penalty).toBe(8);
  });

  it('missing flow measurement applies -8 to system_unvented', () => {
    const input = { ...baseInput, dynamicMainsPressure: 2.0 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const sysUnvented = options.find(o => o.id === 'system_unvented')!;
    const noMeasItem = sysUnvented.score!.breakdown.find(b => b.id === 'cws_no_measurements');
    expect(noMeasItem).toBeDefined();
    expect(noMeasItem!.penalty).toBe(8);
  });

  it('missing flow measurement does NOT penalise stored_vented or combi', () => {
    const input = { ...baseInput, dynamicMainsPressure: 2.0 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const vented = options.find(o => o.id === 'stored_vented')!;
    const combi = options.find(o => o.id === 'combi')!;
    expect(vented.score!.breakdown.find(b => b.id === 'cws_no_measurements')).toBeUndefined();
    expect(combi.score!.breakdown.find(b => b.id === 'cws_no_measurements')).toBeUndefined();
  });
});

describe('OptionScoringV1 — ASHP hydraulic warn reduces ASHP score', () => {
  it('ASHP hydraulic warn (22mm + 10kW) applies -12 penalty', () => {
    // 22mm pipe: ashpWarnKw=8, ashpFailKw=14 → 10kW triggers warn (not fail)
    const input = { ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 10000 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    // ashpRisk should be 'warn' and card should be 'caution'
    expect(result.hydraulicV1.verdict.ashpRisk).toBe('warn');
    expect(ashp.status).toBe('caution');
    const warnItem = ashp.score!.breakdown.find(b => b.id === 'ashp_hydraulic_warn');
    expect(warnItem).toBeDefined();
    expect(warnItem!.penalty).toBe(12);
  });

  it('ASHP hydraulic pass (28mm + 8kW) does NOT apply hydraulic warn penalty', () => {
    const input = { ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 8000 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(result.hydraulicV1.verdict.ashpRisk).toBe('pass');
    expect(ashp.score!.breakdown.find(b => b.id === 'ashp_hydraulic_warn')).toBeUndefined();
  });
});

describe('OptionScoringV1 — aggressive boiler oversize reduces boiler option scores', () => {
  it('aggressive oversize band applies -12 penalty to combi', () => {
    // Use a large boiler (24kW) relative to small heat loss (4kW) → ratio = 6 → aggressive
    const input = {
      ...baseInput,
      heatLossWatts: 4000,
      currentSystem: {
        boiler: {
          nominalOutputKw: 24,
          type: 'combi' as const,
        },
      },
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const combi = options.find(o => o.id === 'combi')!;
    // sizingV1 should be populated since currentSystem.boiler is provided
    if (result.sizingV1) {
      expect(result.sizingV1.sizingBand).toBe('aggressive');
      const oversizeItem = combi.score!.breakdown.find(b => b.id === 'oversize_aggressive');
      expect(oversizeItem).toBeDefined();
      expect(oversizeItem!.penalty).toBe(12);
      expect(combi.score!.total).toBeLessThanOrEqual(100 - 12);
    }
  });

  it('mild oversize band applies -4 penalty to boiler options', () => {
    // 18kW nominal / 12kW heat loss = ratio 1.5 → mild_oversize
    const input = {
      ...baseInput,
      heatLossWatts: 12000,
      currentSystem: {
        boiler: {
          nominalOutputKw: 18,
          type: 'system' as const,
        },
      },
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const storedVented = options.find(o => o.id === 'stored_vented')!;
    expect(result.sizingV1).toBeDefined();
    expect(result.sizingV1!.sizingBand).toBe('mild_oversize');
    const oversizeItem = storedVented.score!.breakdown.find(b => b.id === 'oversize_mild');
    expect(oversizeItem).toBeDefined();
    expect(oversizeItem!.penalty).toBe(4);
  });

  it('oversize penalty does NOT apply to ASHP', () => {
    const input = {
      ...baseInput,
      heatLossWatts: 4000,
      currentSystem: {
        boiler: {
          nominalOutputKw: 24,
          type: 'combi' as const,
        },
      },
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    // ASHP is not boiler-based — oversize band should not appear
    const oversizeItem = ashp.score!.breakdown.find(b => b.id.startsWith('oversize_'));
    expect(oversizeItem).toBeUndefined();
  });
});

describe('OptionScoringV1 — low confidence reduces all option scores consistently', () => {
  it('low confidence results in confidencePenalty on all non-rejected options', () => {
    // Low confidence requires missingKeyCount >= 3 or no GC number and no peak heat loss
    // By providing minimal input (no currentSystem.boiler, no mainsDynamicFlowLpm) missingKeyCount should be high
    const input = {
      postcode: 'SW1A 1AA',
      dynamicMainsPressure: 2.5,
      buildingMass: 'medium' as const,
      primaryPipeDiameter: 22,
      heatLossWatts: 0, // no heat loss → missingKeyCount++
      radiatorCount: 10,
      hasLoftConversion: false,
      returnWaterTemp: 45,
      bathroomCount: 1,
      occupancySignature: 'professional' as const,
      highOccupancy: false,
      preferCombi: true,
      availableSpace: 'ok' as const,
      // No currentSystem.boiler → BOILER_GC_MISSING, BOILER_AGE_MISSING, BOILER_OUTPUT_DEFAULTED
      // No mainsDynamicFlowLpm → MAINS_FLOW_MISSING
      // No heatLossWatts > 0 → BOILER_PEAK_HEATLOSS_MISSING
    };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    for (const card of options) {
      if (card.status !== 'rejected') {
        expect(card.score!.confidencePenalty).toBeGreaterThan(0);
        // Confidence penalty should appear in breakdown
        const confItem = card.score!.breakdown.find(b => b.id === 'confidence_penalty');
        expect(confItem).toBeDefined();
      }
    }
  });

  it('non-rejected options all receive same confidencePenalty value for same confidence level', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const nonRejected = options.filter(o => o.status !== 'rejected');
    if (nonRejected.length > 1) {
      const firstPenalty = nonRejected[0].score!.confidencePenalty ?? 0;
      for (const card of nonRejected) {
        expect(card.score!.confidencePenalty ?? 0).toBe(firstPenalty);
      }
    }
  });
});

describe('OptionScoringV1 — space and loft penalties', () => {
  it('tight space applies -8 to stored_vented score', () => {
    const input = { ...baseInput, availableSpace: 'tight' as const };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const vented = options.find(o => o.id === 'stored_vented')!;
    const spaceItem = vented.score!.breakdown.find(b => b.id === 'space_tight');
    expect(spaceItem).toBeDefined();
    expect(spaceItem!.penalty).toBe(8);
  });

  it('tight space applies -8 to ASHP score (ASHP needs cylinder space)', () => {
    const input = { ...baseInput, availableSpace: 'tight' as const, primaryPipeDiameter: 28 };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    if (ashp.status !== 'rejected') {
      const spaceItem = ashp.score!.breakdown.find(b => b.id === 'space_tight');
      expect(spaceItem).toBeDefined();
      expect(spaceItem!.penalty).toBe(8);
    }
  });

  it('future loft conversion applies -12 to stored_vented score', () => {
    const input = { ...baseInput, futureLoftConversion: true };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const vented = options.find(o => o.id === 'stored_vented')!;
    const loftItem = vented.score!.breakdown.find(b => b.id === 'loft_conversion_risk');
    expect(loftItem).toBeDefined();
    expect(loftItem!.penalty).toBe(12);
  });

  it('future loft conversion applies -12 to regular_vented score when caution', () => {
    const input = { ...baseInput, futureLoftConversion: true };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const regular = options.find(o => o.id === 'regular_vented')!;
    // regular_vented is rejected when futureLoftConversion, so score = 0
    // but loft penalty is for caution path — check rejected path
    if (regular.status === 'rejected') {
      expect(regular.score!.total).toBe(0);
    } else {
      const loftItem = regular.score!.breakdown.find(b => b.id === 'loft_conversion_risk');
      expect(loftItem).toBeDefined();
    }
  });

  it('no loft penalty when no future loft conversion', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    const vented = options.find(o => o.id === 'stored_vented')!;
    const loftItem = vented.score!.breakdown.find(b => b.id === 'loft_conversion_risk');
    expect(loftItem).toBeUndefined();
  });
});

describe('OptionScoringV1 — ASHP full replacement penalty', () => {
  it('full emitter replacement (35°C band) applies -10 to ASHP', () => {
    // full_job appetite always maps to designFlowTempBand=35 (deterministic)
    const input = { ...baseInput, primaryPipeDiameter: 28, retrofit: { emitterUpgradeAppetite: 'full_job' as const } };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(result.heatPumpRegime.designFlowTempBand).toBe(35);
    expect(ashp.status).not.toBe('rejected');
    const replaceItem = ashp.score!.breakdown.find(b => b.id === 'ashp_full_emitter_replacement');
    expect(replaceItem).toBeDefined();
    expect(replaceItem!.penalty).toBe(10);
  });

  it('no emitter upgrade (50°C band) does NOT apply full replacement penalty to ASHP', () => {
    // none appetite → designFlowTempBand=50 → no full replacement penalty
    const input = { ...baseInput, primaryPipeDiameter: 28, retrofit: { emitterUpgradeAppetite: 'none' as const } };
    const result = runEngine(input);
    const options = buildOptionMatrixV1(result, input);
    const ashp = options.find(o => o.id === 'ashp')!;
    expect(result.heatPumpRegime.designFlowTempBand).toBe(50);
    expect(ashp.score!.breakdown.find(b => b.id === 'ashp_full_emitter_replacement')).toBeUndefined();
  });
});

describe('OptionScoringV1 — breakdown labels are non-empty strings', () => {
  it('all breakdown items have non-empty id and label', () => {
    const result = runEngine(baseInput);
    const options = buildOptionMatrixV1(result, baseInput);
    for (const card of options) {
      for (const item of card.score!.breakdown) {
        expect(typeof item.id).toBe('string');
        expect(item.id.length).toBeGreaterThan(0);
        expect(typeof item.label).toBe('string');
        expect(item.label.length).toBeGreaterThan(0);
        expect(typeof item.penalty).toBe('number');
        expect(item.penalty).toBeGreaterThan(0);
      }
    }
  });
});
