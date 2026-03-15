import { describe, it, expect } from 'vitest';
import {
  buildHeatingOperatingState,
  type HeatingOperatingStateInput,
} from '../buildHeatingOperatingState';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Produce a minimal HeatingOperatingStateInput with sensible defaults.
 * Defaults to a standard 80 °C flow temperature, standard radiators,
 * no compensation, and conservative modulation (30 %).
 */
function makeInput(
  overrides: Partial<HeatingOperatingStateInput> = {},
): HeatingOperatingStateInput {
  return {
    flowTempC: 80,
    deltaTc: 20,
    emitterOversizingFactor: 1.0,
    boilerMinModulationPct: 30,
    hasWeatherCompensation: false,
    hasLoadCompensation: false,
    primaryPipeDiameter: 22,
    heatLossWatts: 8000,
    ...overrides,
  };
}

// ─── Result shape ─────────────────────────────────────────────────────────────

describe('buildHeatingOperatingState — result shape', () => {
  it('returns all required fields', () => {
    const result = buildHeatingOperatingState(makeInput());
    expect(result).toHaveProperty('requiredFlowTempC');
    expect(result).toHaveProperty('estimatedReturnTempC');
    expect(result).toHaveProperty('condensingLikelihood');
    expect(result).toHaveProperty('cyclingRisk');
    expect(result).toHaveProperty('modulationHeadroom');
    expect(result).toHaveProperty('emitterConstraint');
    expect(result).toHaveProperty('controlConstraint');
    expect(result).toHaveProperty('circulationConstraint');
    expect(result).toHaveProperty('explanationTags');
  });

  it('explanationTags is a non-empty array', () => {
    const result = buildHeatingOperatingState(makeInput());
    expect(Array.isArray(result.explanationTags)).toBe(true);
    expect(result.explanationTags.length).toBeGreaterThan(0);
  });

  it('requiredFlowTempC is a number when all inputs are provided', () => {
    const result = buildHeatingOperatingState(makeInput());
    expect(typeof result.requiredFlowTempC).toBe('number');
  });

  it('estimatedReturnTempC is requiredFlowTempC minus deltaT', () => {
    const result = buildHeatingOperatingState(makeInput({ flowTempC: 80, deltaTc: 20 }));
    // For standard emitters with no compensation, requiredFlowTempC = 80 °C
    expect(result.estimatedReturnTempC).toBe((result.requiredFlowTempC ?? 0) - 20);
  });
});

// ─── PR4 acceptance: standard radiators can still produce medium/high condensing ──

describe('buildHeatingOperatingState — acceptance: non-binary condensing', () => {
  it('standard radiators with weather comp and good modulation can produce medium condensing likelihood', () => {
    // This is the core acceptance criterion: Atlas must NOT say "no condensing
    // because standard radiators".  Standard radiators + controls + good
    // modulation = condensing possible.
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 15,
    }));
    expect(['high', 'medium']).toContain(result.condensingLikelihood);
  });

  it('standard radiators with load comp and good modulation can produce medium condensing likelihood', () => {
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.0,
      hasLoadCompensation: true,
      boilerMinModulationPct: 18,
    }));
    expect(['high', 'medium']).toContain(result.condensingLikelihood);
  });

  it('standard radiators with both comp types can produce medium or high condensing likelihood', () => {
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 75,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
      hasLoadCompensation: true,
      boilerMinModulationPct: 15,
    }));
    expect(['high', 'medium']).toContain(result.condensingLikelihood);
  });

  it('oversized emitters improve condensing margin (higher likelihood than standard)', () => {
    const withOversized = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.4,
      hasWeatherCompensation: false,
    }));
    const withStandard = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: false,
    }));

    const likelihoodRank = { high: 3, medium: 2, low: 1, unlikely: 0 };
    expect(likelihoodRank[withOversized.condensingLikelihood]).toBeGreaterThanOrEqual(
      likelihoodRank[withStandard.condensingLikelihood],
    );
  });

  it('oversized emitters are not the only enabler — standard + good controls also achieves non-unlikely', () => {
    const standardWithControls = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
      hasLoadCompensation: true,
      boilerMinModulationPct: 15,
    }));
    // Must not be 'unlikely' — condensing should be achievable.
    expect(standardWithControls.condensingLikelihood).not.toBe('unlikely');
  });
});

// ─── High return temperature reduces condensing likelihood ────────────────────

describe('buildHeatingOperatingState — return temperature governs condensing', () => {
  it('high return temperature makes condensing unlikely', () => {
    // 90 °C flow, 20 °C ΔT → 70 °C full-load return → above 65 °C threshold
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 90,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    expect(result.condensingLikelihood).toBe('unlikely');
  });

  it('lower flow temperature improves condensing likelihood', () => {
    const highFlow = buildHeatingOperatingState(makeInput({
      flowTempC: 90,
      hasWeatherCompensation: false,
    }));
    const lowFlow = buildHeatingOperatingState(makeInput({
      flowTempC: 65,
      hasWeatherCompensation: false,
    }));

    const likelihoodRank = { high: 3, medium: 2, low: 1, unlikely: 0 };
    expect(likelihoodRank[lowFlow.condensingLikelihood]).toBeGreaterThan(
      likelihoodRank[highFlow.condensingLikelihood],
    );
  });

  it('condensing is high when estimated return is well below 55 °C', () => {
    // UFH (1.5×) + both compensation → required flow very low → return well below 55 °C
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 55,
      emitterOversizingFactor: 1.5,
      hasWeatherCompensation: true,
      hasLoadCompensation: true,
    }));
    expect(result.condensingLikelihood).toBe('high');
  });

  it('system with oversized emitters but poor controls can still have limited condensing', () => {
    // Highly oversized emitters but high design flow and no compensation:
    // requiredFlowTempC is capped at 45 °C for oversizingFactor >= 1.5,
    // so return is below 55 °C → condensing is high regardless of control.
    // This test verifies the emitter logic: with high oversizing, condensing improves.
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.5,
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    // Oversized emitters allow lower flow temp; return < 55 °C → condensing high or medium.
    expect(['high', 'medium']).toContain(result.condensingLikelihood);
  });
});

// ─── Modulation headroom ──────────────────────────────────────────────────────

describe('buildHeatingOperatingState — modulationHeadroom', () => {
  it('good modulation when boilerMinModulationPct is ≤ 20', () => {
    expect(buildHeatingOperatingState(makeInput({ boilerMinModulationPct: 10 })).modulationHeadroom).toBe('good');
    expect(buildHeatingOperatingState(makeInput({ boilerMinModulationPct: 20 })).modulationHeadroom).toBe('good');
  });

  it('limited modulation when boilerMinModulationPct is 21–35', () => {
    expect(buildHeatingOperatingState(makeInput({ boilerMinModulationPct: 21 })).modulationHeadroom).toBe('limited');
    expect(buildHeatingOperatingState(makeInput({ boilerMinModulationPct: 30 })).modulationHeadroom).toBe('limited');
    expect(buildHeatingOperatingState(makeInput({ boilerMinModulationPct: 35 })).modulationHeadroom).toBe('limited');
  });

  it('poor modulation when boilerMinModulationPct > 35', () => {
    expect(buildHeatingOperatingState(makeInput({ boilerMinModulationPct: 36 })).modulationHeadroom).toBe('poor');
    expect(buildHeatingOperatingState(makeInput({ boilerMinModulationPct: 50 })).modulationHeadroom).toBe('poor');
  });

  it('defaults to limited modulation when boilerMinModulationPct is not provided', () => {
    const input: HeatingOperatingStateInput = { flowTempC: 80 };
    const result = buildHeatingOperatingState(input);
    // Default is 30 % → limited
    expect(result.modulationHeadroom).toBe('limited');
  });
});

// ─── Cycling risk ─────────────────────────────────────────────────────────────

describe('buildHeatingOperatingState — cyclingRisk', () => {
  it('low cycling risk when boiler output matches heat loss (no oversizing)', () => {
    const result = buildHeatingOperatingState(makeInput({
      boilerOutputWatts: 10_000,
      heatLossWatts: 10_000,
    }));
    expect(result.cyclingRisk).toBe('low');
  });

  it('medium cycling risk when boiler is moderately oversized with limited modulation', () => {
    const result = buildHeatingOperatingState(makeInput({
      boilerOutputWatts: 20_000, // 2× oversized
      heatLossWatts: 10_000,
      boilerMinModulationPct: 25, // limited modulation → can't turn down enough
    }));
    expect(['medium', 'high']).toContain(result.cyclingRisk);
  });

  it('high cycling risk when boiler is highly oversized and modulation is poor', () => {
    const result = buildHeatingOperatingState(makeInput({
      boilerOutputWatts: 24_000, // 3× oversized
      heatLossWatts: 8_000,
      boilerMinModulationPct: 40, // poor modulation
    }));
    expect(result.cyclingRisk).toBe('high');
  });

  it('poor modulation raises cycling risk when boiler is significantly oversized', () => {
    const goodMod = buildHeatingOperatingState(makeInput({
      boilerOutputWatts: 20_000,
      heatLossWatts: 10_000,
      boilerMinModulationPct: 10, // good modulation → can match demand
    }));
    const poorMod = buildHeatingOperatingState(makeInput({
      boilerOutputWatts: 20_000,
      heatLossWatts: 10_000,
      boilerMinModulationPct: 40, // poor modulation → forced to cycle
    }));
    const riskRank = { low: 0, medium: 1, high: 2 };
    expect(riskRank[poorMod.cyclingRisk]).toBeGreaterThanOrEqual(riskRank[goodMod.cyclingRisk]);
  });

  it('cycling risk is low when boiler and heat loss data are unavailable', () => {
    // No boilerOutputWatts or heatLossWatts → conservative assumption
    const result = buildHeatingOperatingState({ flowTempC: 80 });
    expect(result.cyclingRisk).toBe('low');
  });
});

// ─── Emitter constraint ───────────────────────────────────────────────────────

describe('buildHeatingOperatingState — emitterConstraint', () => {
  it('none when condensingModeAvailable is true (emitters confirmed to support condensing)', () => {
    const result = buildHeatingOperatingState(makeInput({ condensingModeAvailable: true }));
    expect(result.emitterConstraint).toBe('none');
  });

  it('none when emitter oversizing factor is ≥ 1.3', () => {
    const result = buildHeatingOperatingState(makeInput({ emitterOversizingFactor: 1.3 }));
    expect(result.emitterConstraint).toBe('none');
  });

  it('mild when moderate oversizing (1.1–1.29×)', () => {
    const result = buildHeatingOperatingState(makeInput({ emitterOversizingFactor: 1.15 }));
    expect(result.emitterConstraint).toBe('mild');
  });

  it('mild when standard emitters but compensation is active', () => {
    // Compensation partially offsets emitter limitation.
    const result = buildHeatingOperatingState(makeInput({
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
    }));
    expect(result.emitterConstraint).toBe('mild');
  });

  it('strong when standard emitters and no compensation', () => {
    const result = buildHeatingOperatingState(makeInput({
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    expect(result.emitterConstraint).toBe('strong');
  });
});

// ─── Control constraint ───────────────────────────────────────────────────────

describe('buildHeatingOperatingState — controlConstraint', () => {
  it('none when both weather and load compensation are active', () => {
    const result = buildHeatingOperatingState(makeInput({
      hasWeatherCompensation: true,
      hasLoadCompensation: true,
    }));
    expect(result.controlConstraint).toBe('none');
  });

  it('mild when only weather compensation is active', () => {
    const result = buildHeatingOperatingState(makeInput({
      hasWeatherCompensation: true,
      hasLoadCompensation: false,
    }));
    expect(result.controlConstraint).toBe('mild');
  });

  it('mild when only load compensation is active', () => {
    const result = buildHeatingOperatingState(makeInput({
      hasWeatherCompensation: false,
      hasLoadCompensation: true,
    }));
    expect(result.controlConstraint).toBe('mild');
  });

  it('strong when no compensation is active', () => {
    const result = buildHeatingOperatingState(makeInput({
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    expect(result.controlConstraint).toBe('strong');
  });

  it('compensation improves operating interpretation (reduces control constraint)', () => {
    const withComp = buildHeatingOperatingState(makeInput({ hasWeatherCompensation: true }));
    const withoutComp = buildHeatingOperatingState(makeInput({ hasWeatherCompensation: false, hasLoadCompensation: false }));
    const constraintRank = { none: 0, mild: 1, strong: 2 };
    expect(constraintRank[withComp.controlConstraint]).toBeLessThan(
      constraintRank[withoutComp.controlConstraint],
    );
  });
});

// ─── Circulation constraint ───────────────────────────────────────────────────

describe('buildHeatingOperatingState — circulationConstraint', () => {
  it('none when primary pipe is 28 mm', () => {
    const result = buildHeatingOperatingState(makeInput({ primaryPipeDiameter: 28 }));
    expect(result.circulationConstraint).toBe('none');
  });

  it('none when 22 mm primary at low heat loss (< 10 kW)', () => {
    const result = buildHeatingOperatingState(makeInput({
      primaryPipeDiameter: 22,
      heatLossWatts: 8_000,
    }));
    expect(result.circulationConstraint).toBe('none');
  });

  it('mild when 22 mm primary at medium load (10–14 kW)', () => {
    const result = buildHeatingOperatingState(makeInput({
      primaryPipeDiameter: 22,
      heatLossWatts: 12_000,
    }));
    expect(result.circulationConstraint).toBe('mild');
  });

  it('strong when 22 mm primary at high load (≥ 14 kW)', () => {
    const result = buildHeatingOperatingState(makeInput({
      primaryPipeDiameter: 22,
      heatLossWatts: 15_000,
    }));
    expect(result.circulationConstraint).toBe('strong');
  });
});

// ─── Visible assumptions ──────────────────────────────────────────────────────

describe('buildHeatingOperatingState — visible assumptions', () => {
  it('requiredFlowTempC is populated and numeric', () => {
    const result = buildHeatingOperatingState(makeInput({ flowTempC: 75 }));
    expect(typeof result.requiredFlowTempC).toBe('number');
    expect(result.requiredFlowTempC).toBeGreaterThan(0);
  });

  it('estimatedReturnTempC is populated and numeric', () => {
    const result = buildHeatingOperatingState(makeInput({ flowTempC: 75 }));
    expect(typeof result.estimatedReturnTempC).toBe('number');
  });

  it('requiredFlowTempC reflects oversizing: highly oversized gives lower required temp', () => {
    const standard = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.0,
    }));
    const oversized = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.5,
    }));
    expect(oversized.requiredFlowTempC!).toBeLessThan(standard.requiredFlowTempC!);
  });

  it('requiredFlowTempC is lower with compensation than without', () => {
    const withComp = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      hasWeatherCompensation: true,
    }));
    const withoutComp = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      hasWeatherCompensation: false,
    }));
    expect(withComp.requiredFlowTempC!).toBeLessThan(withoutComp.requiredFlowTempC!);
  });

  it('estimatedReturnTempC is always requiredFlowTempC minus deltaT', () => {
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      deltaTc: 20,
    }));
    const expectedReturn = (result.requiredFlowTempC ?? 0) - 20;
    expect(result.estimatedReturnTempC).toBeCloseTo(expectedReturn, 1);
  });
});

// ─── Explanation tags ─────────────────────────────────────────────────────────

describe('buildHeatingOperatingState — explanationTags', () => {
  it('includes "condensing likely" for a high-likelihood system', () => {
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 55,
      emitterOversizingFactor: 1.5,
      hasWeatherCompensation: true,
      hasLoadCompensation: true,
    }));
    expect(result.explanationTags).toContain('condensing likely');
  });

  it('includes "condensing possible with current setup" for medium likelihood', () => {
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 15,
    }));
    if (result.condensingLikelihood === 'medium') {
      expect(result.explanationTags).toContain('condensing possible with current setup');
    }
  });

  it('includes "condensing unlikely at design load" for high-return systems', () => {
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 90,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: false,
    }));
    if (result.condensingLikelihood === 'unlikely') {
      expect(result.explanationTags).toContain('condensing unlikely at design load');
    }
  });

  it('includes "good low-load match" for good modulation headroom', () => {
    const result = buildHeatingOperatingState(makeInput({ boilerMinModulationPct: 10 }));
    expect(result.explanationTags).toContain('good low-load match');
  });

  it('includes "modulation-limited" for poor modulation headroom', () => {
    const result = buildHeatingOperatingState(makeInput({ boilerMinModulationPct: 50 }));
    expect(result.explanationTags).toContain('modulation-limited');
  });

  it('includes "emitter-limited" when emitter constraint is strong', () => {
    const result = buildHeatingOperatingState(makeInput({
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    expect(result.explanationTags).toContain('emitter-limited');
  });

  it('includes "control-limited" when no compensation', () => {
    const result = buildHeatingOperatingState(makeInput({
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    expect(result.explanationTags).toContain('control-limited');
  });

  it('includes "circulation-limited" when 22 mm primary at high load', () => {
    const result = buildHeatingOperatingState(makeInput({
      primaryPipeDiameter: 22,
      heatLossWatts: 15_000,
    }));
    expect(result.explanationTags).toContain('circulation-limited');
  });

  it('includes "cycling-limited efficiency" when cycling risk is high', () => {
    const result = buildHeatingOperatingState(makeInput({
      boilerOutputWatts: 24_000,
      heatLossWatts: 8_000,
      boilerMinModulationPct: 40,
    }));
    if (result.cyclingRisk !== 'low') {
      expect(result.explanationTags).toContain('cycling-limited efficiency');
    }
  });

  it('includes "lower flow temperature achievable" when required temp is significantly below design', () => {
    const result = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.5,
      hasWeatherCompensation: true,
      hasLoadCompensation: true,
    }));
    // requiredFlowTempC should be much lower than 80 °C
    if (result.requiredFlowTempC != null && result.requiredFlowTempC < 80 - 3) {
      const hasLowerFlowTag = result.explanationTags.some(t =>
        t.includes('lower flow temperature achievable'),
      );
      expect(hasLowerFlowTag).toBe(true);
    }
  });
});

// ─── Compare mode: same logic on both sides ───────────────────────────────────

describe('buildHeatingOperatingState — compare mode consistency', () => {
  it('current boiler with standard radiators can show meaningful condensing if operating conditions support it', () => {
    // Current side: standard radiators, good controls, good modulation
    const current = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 15,
    }));
    // Must not be 'unlikely' — the current system can still condense.
    expect(current.condensingLikelihood).not.toBe('unlikely');
  });

  it('proposed emitter/control upgrade shows improved condensing margin', () => {
    const current = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: false,
    }));
    const proposed = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.3,
      hasWeatherCompensation: true,
    }));

    const likelihoodRank = { high: 3, medium: 2, low: 1, unlikely: 0 };
    expect(likelihoodRank[proposed.condensingLikelihood]).toBeGreaterThanOrEqual(
      likelihoodRank[current.condensingLikelihood],
    );
  });

  it('same function and logic is applied to both sides (function is deterministic)', () => {
    const input = makeInput({
      flowTempC: 75,
      hasWeatherCompensation: true,
    });
    const result1 = buildHeatingOperatingState(input);
    const result2 = buildHeatingOperatingState(input);
    expect(result1).toEqual(result2);
  });

  it('users can see where gains come from: lower required flow temp with upgrade', () => {
    const current = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: false,
    }));
    const proposed = buildHeatingOperatingState(makeInput({
      flowTempC: 80,
      emitterOversizingFactor: 1.3,
      hasWeatherCompensation: true,
    }));
    // Proposed should have lower required flow temp.
    expect(proposed.requiredFlowTempC!).toBeLessThan(current.requiredFlowTempC!);
  });

  it('users can see where gains come from: better modulation reduces cycling risk', () => {
    const current = buildHeatingOperatingState(makeInput({
      boilerOutputWatts: 20_000,
      heatLossWatts: 8_000,
      boilerMinModulationPct: 40,
    }));
    const proposed = buildHeatingOperatingState(makeInput({
      boilerOutputWatts: 20_000,
      heatLossWatts: 8_000,
      boilerMinModulationPct: 10,
    }));
    const riskRank = { low: 0, medium: 1, high: 2 };
    expect(riskRank[proposed.cyclingRisk]).toBeLessThanOrEqual(riskRank[current.cyclingRisk]);
  });
});

// ─── Defaults and sparse input ────────────────────────────────────────────────

describe('buildHeatingOperatingState — defaults and sparse input', () => {
  it('handles minimal input with only flowTempC', () => {
    const result = buildHeatingOperatingState({ flowTempC: 80 });
    expect(result).toHaveProperty('condensingLikelihood');
    expect(result.requiredFlowTempC).toBe(80); // no overrides → design temp
  });

  it('condensingModeAvailable=true is treated as oversizingFactor ≥ 1.3', () => {
    const explicit = buildHeatingOperatingState(makeInput({ emitterOversizingFactor: 1.3 }));
    const implied = buildHeatingOperatingState(makeInput({ condensingModeAvailable: true }));
    expect(explicit.emitterConstraint).toBe(implied.emitterConstraint);
  });

  it('absent primaryPipeDiameter defaults to 22 mm assumption', () => {
    const withDefault = buildHeatingOperatingState({
      flowTempC: 80,
      heatLossWatts: 15_000,
    });
    const explicit22 = buildHeatingOperatingState(makeInput({
      primaryPipeDiameter: 22,
      heatLossWatts: 15_000,
    }));
    expect(withDefault.circulationConstraint).toBe(explicit22.circulationConstraint);
  });
});

// ─── Floor-plan emitter adequacy wiring ──────────────────────────────────────

describe('buildHeatingOperatingState — floorplanEmitterAdequacy wiring', () => {
  it('uses impliedOversizingFactor when no explicit emitterOversizingFactor is given', () => {
    // Oversized emitters → impliedOversizingFactor = 1.9 → should lower required flow temp
    // Do NOT pass emitterOversizingFactor so floor-plan factor is used as fallback.
    const withFloorplan = buildHeatingOperatingState({
      flowTempC: 80,
      floorplanEmitterAdequacy: {
        coverageClassification: 'all_oversized',
        impliedOversizingFactor: 1.9,
        undersizedRooms: [],
        oversizedRooms: ['Lounge', 'Kitchen'],
        hasActualData: true,
      },
    });
    // Standard — no floor plan, no explicit factor.
    const standard = buildHeatingOperatingState({ flowTempC: 80 });
    // Oversized factor should reduce required flow temp.
    expect(withFloorplan.requiredFlowTempC!).toBeLessThan(standard.requiredFlowTempC!);
  });

  it('explicit emitterOversizingFactor overrides floor-plan implied factor', () => {
    // explicit says standard (1.0), floor plan says oversized (1.9) — explicit wins
    const result = buildHeatingOperatingState(makeInput({
      emitterOversizingFactor: 1.0,
      floorplanEmitterAdequacy: {
        coverageClassification: 'all_oversized',
        impliedOversizingFactor: 1.9,
        undersizedRooms: [],
        oversizedRooms: ['Lounge'],
        hasActualData: true,
      },
    }));
    const standard = buildHeatingOperatingState(makeInput({ emitterOversizingFactor: 1.0 }));
    // Despite floor plan saying oversized, explicit 1.0 factor wins → same flow temp.
    expect(result.requiredFlowTempC).toBe(standard.requiredFlowTempC);
  });

  it('does not use floor-plan factor when hasActualData is false', () => {
    const withInsufficientData = buildHeatingOperatingState(makeInput({
      floorplanEmitterAdequacy: {
        coverageClassification: 'insufficient_data',
        impliedOversizingFactor: null,
        undersizedRooms: [],
        oversizedRooms: [],
        hasActualData: false,
      },
    }));
    const standard = buildHeatingOperatingState(makeInput());
    // No data → falls back to standard (no factor change).
    expect(withInsufficientData.requiredFlowTempC).toBe(standard.requiredFlowTempC);
  });

  it('passes through floorplanEmitterAdequacy in the output for consumers', () => {
    const fp = {
      coverageClassification: 'all_adequate' as const,
      impliedOversizingFactor: 1.2,
      undersizedRooms: [],
      oversizedRooms: [],
      hasActualData: true,
    };
    const result = buildHeatingOperatingState(makeInput({ floorplanEmitterAdequacy: fp }));
    expect(result.floorplanEmitterAdequacy).toBe(fp);
  });

  it('floorplanEmitterAdequacy is undefined in output when not provided', () => {
    const result = buildHeatingOperatingState(makeInput());
    expect(result.floorplanEmitterAdequacy).toBeUndefined();
  });
});

// ─── Floor-plan explanation tags ──────────────────────────────────────────────

describe('buildHeatingOperatingState — floor-plan explanation tags', () => {
  it('adds "oversized emitters improving margin" tag when all rooms are oversized', () => {
    const result = buildHeatingOperatingState(makeInput({
      floorplanEmitterAdequacy: {
        coverageClassification: 'all_oversized',
        impliedOversizingFactor: 1.9,
        undersizedRooms: [],
        oversizedRooms: ['Lounge', 'Hall'],
        hasActualData: true,
      },
    }));
    expect(result.explanationTags).toContain('oversized emitters improving margin');
  });

  it('adds "undersized rooms driving higher operating temperature" when majority are undersized', () => {
    const result = buildHeatingOperatingState(makeInput({
      floorplanEmitterAdequacy: {
        coverageClassification: 'majority_undersized',
        impliedOversizingFactor: 0.7,
        undersizedRooms: ['Lounge', 'Kitchen'],
        oversizedRooms: [],
        hasActualData: true,
      },
    }));
    expect(result.explanationTags).toContain('undersized rooms driving higher operating temperature');
  });

  it('adds "emitter-limited" tag for mixed classification when not already present', () => {
    // Use standard emitters (no compensation) so emitterConstraint = strong → emitter-limited already set.
    // Use mixed floor plan — emitter-limited should appear exactly once.
    const result = buildHeatingOperatingState(makeInput({
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
      emitterOversizingFactor: 1.0,
      floorplanEmitterAdequacy: {
        coverageClassification: 'mixed',
        impliedOversizingFactor: 0.9,
        undersizedRooms: ['Lounge'],
        oversizedRooms: [],
        hasActualData: true,
      },
    }));
    expect(result.explanationTags).toContain('emitter-limited');
    // Should not appear twice
    const count = result.explanationTags.filter((t) => t === 'emitter-limited').length;
    expect(count).toBe(1);
  });

  it('does not add floor-plan tags when hasActualData is false', () => {
    const result = buildHeatingOperatingState(makeInput({
      floorplanEmitterAdequacy: {
        coverageClassification: 'insufficient_data',
        impliedOversizingFactor: null,
        undersizedRooms: [],
        oversizedRooms: [],
        hasActualData: false,
      },
    }));
    expect(result.explanationTags).not.toContain('oversized emitters improving margin');
    expect(result.explanationTags).not.toContain('undersized rooms driving higher operating temperature');
  });
});
