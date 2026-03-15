import { describe, it, expect } from 'vitest';
import { runCondensingRuntimeModule } from '../modules/CondensingRuntimeModule';
import { runCondensingStateModule } from '../modules/CondensingStateModule';
import type { CondensingRuntimeInput } from '../schema/EngineInputV2_3';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Produce a minimal CondensingRuntimeInput with sensible defaults.
 * Uses 85 °C flow by default so adjustments remain visible before the 100 % ceiling.
 *
 * `condensingState` is always derived from the resolved `flowTempC` (either the
 * override value or the default 85 °C), unless an explicit `condensingState` is
 * included in `overrides`.
 */
function makeInput(
  overrides: Partial<CondensingRuntimeInput> = {},
): CondensingRuntimeInput {
  const flowTempC = overrides.flowTempC ?? 85;
  const condensingState =
    overrides.condensingState ??
    runCondensingStateModule({ flowTempC, deltaTc: 20 });
  return {
    condensingState,
    flowTempC,
    condensingModeAvailable: true,
    installationPolicy: 'high_temp_retrofit',
    systemPlanType: 'y_plan',
    dhwTankType: 'standard',
    primaryPipeDiameter: 22,
    heatLossWatts: 8000,
    ...overrides,
    // Always use the correctly-derived condensingState (not whatever spread overrides may contain).
    condensingState,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CondensingRuntimeModule — result shape', () => {
  it('returns all required fields', () => {
    const result = runCondensingRuntimeModule(makeInput());
    expect(result).toHaveProperty('estimatedCondensingRuntimePct');
    expect(result).toHaveProperty('condensingStatusLabel');
    expect(result).toHaveProperty('condensingAssumptions');
    expect(result).toHaveProperty('drivers');
    expect(result).toHaveProperty('positiveWording');
    expect(result).toHaveProperty('negativeWording');
    expect(result).toHaveProperty('notes');
  });

  it('returns exactly 7 drivers', () => {
    const result = runCondensingRuntimeModule(makeInput());
    expect(result.drivers).toHaveLength(7);
  });

  it('includes all seven driver IDs', () => {
    const result = runCondensingRuntimeModule(makeInput());
    const ids = result.drivers.map(d => d.id);
    expect(ids).toContain('current_condensing_state');
    expect(ids).toContain('design_flow_temperature');
    expect(ids).toContain('emitter_suitability');
    expect(ids).toContain('control_type');
    expect(ids).toContain('system_separation_arrangement');
    expect(ids).toContain('dhw_demand_stability');
    expect(ids).toContain('primary_suitability_proxy');
  });

  it('clamps estimatedCondensingRuntimePct to 0–100', () => {
    const result = runCondensingRuntimeModule(makeInput());
    expect(result.estimatedCondensingRuntimePct).toBeGreaterThanOrEqual(0);
    expect(result.estimatedCondensingRuntimePct).toBeLessThanOrEqual(100);
  });
});

describe('CondensingRuntimeModule — driver 5: system_separation_arrangement', () => {
  it('gives a positive score contribution for s_plan', () => {
    const result = runCondensingRuntimeModule(makeInput({ systemPlanType: 's_plan' }));
    const d5 = result.drivers.find(d => d.id === 'system_separation_arrangement')!;
    expect(d5.influence).toBe('positive');
    expect(d5.scoreContribution).toBeGreaterThan(0);
  });

  it('gives neutral contribution for y_plan', () => {
    const result = runCondensingRuntimeModule(makeInput({ systemPlanType: 'y_plan' }));
    const d5 = result.drivers.find(d => d.id === 'system_separation_arrangement')!;
    expect(d5.influence).toBe('neutral');
    expect(d5.scoreContribution).toBe(0);
  });

  it('gives neutral contribution when systemPlanType is not provided', () => {
    const input = makeInput();
    delete (input as Partial<CondensingRuntimeInput>).systemPlanType;
    const result = runCondensingRuntimeModule(input);
    const d5 = result.drivers.find(d => d.id === 'system_separation_arrangement')!;
    expect(d5.influence).toBe('neutral');
    expect(d5.scoreContribution).toBe(0);
  });

  it('reports "not confirmed" detail (not a silent Y-plan assumption) when systemPlanType is absent', () => {
    const input = makeInput();
    delete (input as Partial<CondensingRuntimeInput>).systemPlanType;
    const result = runCondensingRuntimeModule(input);
    const d5 = result.drivers.find(d => d.id === 'system_separation_arrangement')!;
    expect(d5.detail).toContain('not confirmed');
    expect(d5.detail).not.toContain('assuming');
  });

  it('adds a diagnostic note about unconfirmed plan type when systemPlanType is absent', () => {
    const input = makeInput();
    delete (input as Partial<CondensingRuntimeInput>).systemPlanType;
    const result = runCondensingRuntimeModule(input);
    expect(result.notes.some(n => n.includes('not confirmed'))).toBe(true);
    expect(result.notes.some(n => n.includes('no S-plan benefit'))).toBe(true);
  });

  it('does NOT add a "not confirmed" note when systemPlanType is explicitly set', () => {
    const sPlan = runCondensingRuntimeModule(makeInput({ systemPlanType: 's_plan' }));
    const yPlan = runCondensingRuntimeModule(makeInput({ systemPlanType: 'y_plan' }));
    expect(sPlan.notes.some(n => n.includes('not confirmed'))).toBe(false);
    expect(yPlan.notes.some(n => n.includes('not confirmed'))).toBe(false);
  });

  it('s_plan scores higher runtime than y_plan (same penalised scenario)', () => {
    // Use high-temp retrofit + high-load scenario to stay below 100 % ceiling.
    const base = {
      installationPolicy: 'high_temp_retrofit' as const,
      primaryPipeDiameter: 22,
      heatLossWatts: 15000,
    };
    const sPlan = runCondensingRuntimeModule(makeInput({ ...base, systemPlanType: 's_plan' }));
    const yPlan = runCondensingRuntimeModule(makeInput({ ...base, systemPlanType: 'y_plan' }));
    expect(sPlan.estimatedCondensingRuntimePct).toBeGreaterThan(
      yPlan.estimatedCondensingRuntimePct,
    );
  });

  it('positive s_plan wording appears in positiveWording', () => {
    const result = runCondensingRuntimeModule(makeInput({ systemPlanType: 's_plan' }));
    expect(
      result.positiveWording.some(w =>
        w.toLowerCase().includes('separated') || w.toLowerCase().includes('steadier'),
      ),
    ).toBe(true);
  });
});

describe('CondensingRuntimeModule — driver 7: primary_suitability_proxy', () => {
  it('gives neutral contribution for 22 mm primary at low load (< 10 kW)', () => {
    const result = runCondensingRuntimeModule(
      makeInput({ primaryPipeDiameter: 22, heatLossWatts: 8000 }),
    );
    const d7 = result.drivers.find(d => d.id === 'primary_suitability_proxy')!;
    expect(d7.influence).toBe('neutral');
    expect(d7.scoreContribution).toBe(0);
  });

  it('gives a small negative contribution for 22 mm primary at medium load (≥ 10 kW, < 14 kW)', () => {
    const result = runCondensingRuntimeModule(
      makeInput({ primaryPipeDiameter: 22, heatLossWatts: 12000 }),
    );
    const d7 = result.drivers.find(d => d.id === 'primary_suitability_proxy')!;
    expect(d7.influence).toBe('negative');
    expect(d7.scoreContribution).toBeLessThan(0);
    expect(d7.scoreContribution).toBeGreaterThan(-8);
  });

  it('gives a moderate negative contribution for 22 mm primary at high load (≥ 14 kW)', () => {
    const result = runCondensingRuntimeModule(
      makeInput({ primaryPipeDiameter: 22, heatLossWatts: 15000 }),
    );
    const d7 = result.drivers.find(d => d.id === 'primary_suitability_proxy')!;
    expect(d7.influence).toBe('negative');
    expect(d7.scoreContribution).toBeLessThanOrEqual(-8);
  });

  it('gives a positive contribution for 28 mm primary', () => {
    const result = runCondensingRuntimeModule(
      makeInput({ primaryPipeDiameter: 28, heatLossWatts: 15000 }),
    );
    const d7 = result.drivers.find(d => d.id === 'primary_suitability_proxy')!;
    expect(d7.influence).toBe('positive');
    expect(d7.scoreContribution).toBeGreaterThan(0);
  });

  it('28 mm primary scores higher runtime than 22 mm at high load (same penalised scenario)', () => {
    const base = {
      installationPolicy: 'high_temp_retrofit' as const,
      heatLossWatts: 15000,
    };
    const pipe28 = runCondensingRuntimeModule(makeInput({ ...base, primaryPipeDiameter: 28 }));
    const pipe22 = runCondensingRuntimeModule(makeInput({ ...base, primaryPipeDiameter: 22 }));
    expect(pipe28.estimatedCondensingRuntimePct).toBeGreaterThan(
      pipe22.estimatedCondensingRuntimePct,
    );
  });

  it('negative wording appears when primary limits runtime at higher loads', () => {
    const result = runCondensingRuntimeModule(
      makeInput({ primaryPipeDiameter: 22, heatLossWatts: 15000 }),
    );
    expect(
      result.negativeWording.some(w => w.toLowerCase().includes('primary')),
    ).toBe(true);
  });
});

describe('CondensingRuntimeModule — drivers 5 and 7 are independent', () => {
  it('driver 5 score contribution is unaffected by primary pipe diameter', () => {
    const withNarrow = runCondensingRuntimeModule(
      makeInput({ systemPlanType: 's_plan', primaryPipeDiameter: 22, heatLossWatts: 15000 }),
    );
    const withWide = runCondensingRuntimeModule(
      makeInput({ systemPlanType: 's_plan', primaryPipeDiameter: 28, heatLossWatts: 15000 }),
    );
    const d5Narrow = withNarrow.drivers.find(d => d.id === 'system_separation_arrangement')!;
    const d5Wide = withWide.drivers.find(d => d.id === 'system_separation_arrangement')!;
    expect(d5Narrow.scoreContribution).toBe(d5Wide.scoreContribution);
  });

  it('driver 7 score contribution is unaffected by system plan type', () => {
    const withSPlan = runCondensingRuntimeModule(
      makeInput({ systemPlanType: 's_plan', primaryPipeDiameter: 22, heatLossWatts: 15000 }),
    );
    const withYPlan = runCondensingRuntimeModule(
      makeInput({ systemPlanType: 'y_plan', primaryPipeDiameter: 22, heatLossWatts: 15000 }),
    );
    const d7SPlan = withSPlan.drivers.find(d => d.id === 'primary_suitability_proxy')!;
    const d7YPlan = withYPlan.drivers.find(d => d.id === 'primary_suitability_proxy')!;
    expect(d7SPlan.scoreContribution).toBe(d7YPlan.scoreContribution);
  });

  it('combining s_plan and wide primary gives higher runtime than y_plan with narrow primary', () => {
    const worst = runCondensingRuntimeModule(
      makeInput({
        installationPolicy: 'high_temp_retrofit',
        systemPlanType: 'y_plan',
        primaryPipeDiameter: 22,
        heatLossWatts: 15000,
      }),
    );
    const best = runCondensingRuntimeModule(
      makeInput({
        installationPolicy: 'high_temp_retrofit',
        systemPlanType: 's_plan',
        primaryPipeDiameter: 28,
        heatLossWatts: 15000,
      }),
    );
    expect(best.estimatedCondensingRuntimePct).toBeGreaterThan(
      worst.estimatedCondensingRuntimePct,
    );
  });
});

describe('CondensingRuntimeModule — driver 6: dhw_demand_stability', () => {
  it('mixergy gives a positive score contribution', () => {
    const result = runCondensingRuntimeModule(makeInput({ dhwTankType: 'mixergy' }));
    const d6 = result.drivers.find(d => d.id === 'dhw_demand_stability')!;
    expect(d6.influence).toBe('positive');
    expect(d6.scoreContribution).toBeGreaterThan(0);
  });

  it('standard tank gives neutral contribution', () => {
    const result = runCondensingRuntimeModule(makeInput({ dhwTankType: 'standard' }));
    const d6 = result.drivers.find(d => d.id === 'dhw_demand_stability')!;
    expect(d6.influence).toBe('neutral');
    expect(d6.scoreContribution).toBe(0);
  });

  it('mixergy scores higher runtime than standard (same penalised scenario)', () => {
    const base = {
      installationPolicy: 'high_temp_retrofit' as const,
      primaryPipeDiameter: 22,
      heatLossWatts: 15000,
    };
    const mixergy = runCondensingRuntimeModule(makeInput({ ...base, dhwTankType: 'mixergy' }));
    const standard = runCondensingRuntimeModule(makeInput({ ...base, dhwTankType: 'standard' }));
    expect(mixergy.estimatedCondensingRuntimePct).toBeGreaterThan(
      standard.estimatedCondensingRuntimePct,
    );
  });
});

describe('CondensingRuntimeModule — base score from CondensingStateModule', () => {
  it('lower flow temperature gives higher estimatedCondensingRuntimePct (all else equal)', () => {
    const lowFlow = runCondensingRuntimeModule(
      makeInput({ flowTempC: 75, heatLossWatts: 15000, installationPolicy: 'high_temp_retrofit' }),
    );
    const highFlow = runCondensingRuntimeModule(
      makeInput({ flowTempC: 90, heatLossWatts: 15000, installationPolicy: 'high_temp_retrofit' }),
    );
    expect(lowFlow.estimatedCondensingRuntimePct).toBeGreaterThan(
      highFlow.estimatedCondensingRuntimePct,
    );
  });

  it('non_condensing high-temp retrofit system gives a low runtime estimate', () => {
    const result = runCondensingRuntimeModule(
      makeInput({
        flowTempC: 90,
        condensingModeAvailable: false,
        installationPolicy: 'high_temp_retrofit',
        primaryPipeDiameter: 22,
        heatLossWatts: 15000,
      }),
    );
    // base ~79 %, emitter -10, control -8, primary -8 = ~53 %
    expect(result.estimatedCondensingRuntimePct).toBeLessThan(60);
  });
});

describe('CondensingRuntimeModule — diagnostic notes', () => {
  it('notes mention that drivers 5 and 7 are independent levers', () => {
    const result = runCondensingRuntimeModule(makeInput());
    expect(
      result.notes.some(n => n.includes('independent')),
    ).toBe(true);
  });

  it('notes include the physics base fraction', () => {
    const result = runCondensingRuntimeModule(makeInput());
    expect(
      result.notes.some(n => n.includes('Physics base')),
    ).toBe(true);
  });
});


describe('CondensingRuntimeModule — regression: skipped survey step', () => {
  /**
   * Regression test: when the Full Survey hydraulic step is skipped (or the
   * user never explicitly selects Y-plan / S-plan), systemPlanType arrives as
   * undefined at the engine.  The engine must handle this honestly rather than
   * silently assuming a Y-plan baseline.
   */
  it('skipped-step path: absent systemPlanType produces neutral driver with honest caveat', () => {
    const input = makeInput();
    delete (input as Partial<CondensingRuntimeInput>).systemPlanType;

    const result = runCondensingRuntimeModule(input);
    const d5 = result.drivers.find(d => d.id === 'system_separation_arrangement')!;

    // Engine must NOT silently claim Y-plan.
    expect(d5.detail).not.toContain('assuming');
    // Must report the field as unconfirmed.
    expect(d5.detail).toContain('not confirmed');
    // Score must stay neutral — no unearned penalty, no unearned benefit.
    expect(d5.influence).toBe('neutral');
    expect(d5.scoreContribution).toBe(0);
    // Diagnostic notes must flag the missing field.
    expect(result.notes.some(n => n.includes('not confirmed'))).toBe(true);
  });

  it('skipped-step path: absent systemPlanType does not score higher than explicit s_plan', () => {
    const inputMissing = makeInput();
    delete (inputMissing as Partial<CondensingRuntimeInput>).systemPlanType;
    const missing = runCondensingRuntimeModule(inputMissing);
    const sPlan = runCondensingRuntimeModule(makeInput({ systemPlanType: 's_plan' }));

    expect(sPlan.estimatedCondensingRuntimePct).toBeGreaterThan(
      missing.estimatedCondensingRuntimePct,
    );
  });

  it('skipped-step path: absent systemPlanType scores the same as explicit y_plan (same neutral baseline)', () => {
    const inputMissing = makeInput();
    delete (inputMissing as Partial<CondensingRuntimeInput>).systemPlanType;
    const missing = runCondensingRuntimeModule(inputMissing);
    const yPlan = runCondensingRuntimeModule(makeInput({ systemPlanType: 'y_plan' }));

    // Score must be equal — both are neutral baselines.
    expect(missing.estimatedCondensingRuntimePct).toBe(yPlan.estimatedCondensingRuntimePct);
  });
});


// ─── PR: multi-factor emitter suitability — spectrum tests ───────────────────

describe('CondensingRuntimeModule — driver 3: multi-factor emitter spectrum', () => {
  it('condensing possible on standard radiator system with weather comp and good modulation', () => {
    // Standard emitters (condensingModeAvailable=false) BUT weather compensation and
    // wide modulation range mean the boiler can fire at low rates on mild days.
    // → emitter_suitability should be neutral (0), not negative.
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 15,
    }));
    const d3 = result.drivers.find(d => d.id === 'emitter_suitability')!;
    expect(d3.influence).toBe('neutral');
    expect(d3.scoreContribution).toBe(0);
    expect(d3.detail.toLowerCase()).toContain('condensing possible');
  });

  it('condensing possible on standard radiator system with load comp and good modulation', () => {
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasLoadCompensation: true,
      boilerMinModulationPct: 20,
    }));
    const d3 = result.drivers.find(d => d.id === 'emitter_suitability')!;
    expect(d3.influence).toBe('neutral');
    expect(d3.scoreContribution).toBe(0);
  });

  it('condensing possible on standard radiators with both weather and load comp', () => {
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: true,
      hasLoadCompensation: true,
      boilerMinModulationPct: 18,
    }));
    const d3 = result.drivers.find(d => d.id === 'emitter_suitability')!;
    expect(d3.influence).toBe('neutral');
    expect(d3.scoreContribution).toBe(0);
    // Detail should mention both compensation types
    expect(d3.detail.toLowerCase()).toMatch(/weather and load/);
  });

  it('standard emitters with compensation but limited modulation give neutral negative contribution', () => {
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 35, // limited modulation
    }));
    const d3 = result.drivers.find(d => d.id === 'emitter_suitability')!;
    expect(d3.influence).toBe('neutral');
    expect(d3.scoreContribution).toBeLessThan(0);
    expect(d3.scoreContribution).toBeGreaterThan(-10); // less harsh than old binary gate
    expect(d3.detail.toLowerCase()).toContain('modulation');
  });

  it('standard emitters with no compensation give a moderate negative contribution', () => {
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    const d3 = result.drivers.find(d => d.id === 'emitter_suitability')!;
    expect(d3.influence).toBe('negative');
    // Penalty is less than the old -10 binary gate (-7 under new logic)
    expect(d3.scoreContribution).toBeGreaterThan(-10);
    expect(d3.scoreContribution).toBeLessThan(0);
  });

  it('oversized emitters (≥ 1.3×) give a strong positive contribution', () => {
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false, // not set, but oversizing factor overrides
      emitterOversizingFactor: 1.3,
    }));
    const d3 = result.drivers.find(d => d.id === 'emitter_suitability')!;
    expect(d3.influence).toBe('positive');
    expect(d3.scoreContribution).toBe(5);
    expect(d3.detail.toLowerCase()).toContain('oversized');
  });

  it('moderately oversized emitters (1.1×–1.29×) give a smaller positive contribution', () => {
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      emitterOversizingFactor: 1.15,
    }));
    const d3 = result.drivers.find(d => d.id === 'emitter_suitability')!;
    expect(d3.influence).toBe('positive');
    expect(d3.scoreContribution).toBe(3);
    expect(d3.scoreContribution).toBeLessThan(5); // less than fully oversized
  });

  it('highly oversized emitters (≥ 1.5×) give descriptive detail about UFH-level performance', () => {
    const result = runCondensingRuntimeModule(makeInput({
      emitterOversizingFactor: 1.8, // UFH level
    }));
    const d3 = result.drivers.find(d => d.id === 'emitter_suitability')!;
    expect(d3.influence).toBe('positive');
    expect(d3.scoreContribution).toBe(5);
    expect(d3.detail.toLowerCase()).toMatch(/underfloor|highly oversized/);
  });

  it('oversized emitters improve condensing but standard emitters with good controls are also viable', () => {
    // Standard emitters + good controls can also achieve meaningful condensing.
    // Oversized emitters give higher score, but standard + controls is not negative.
    const withOversized = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: true,
      emitterOversizingFactor: 1.3,
      hasWeatherCompensation: false,
    }));
    const standardWithControls = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
      hasLoadCompensation: true,
      boilerMinModulationPct: 15,
    }));

    // Oversized emitters give higher runtime estimate overall.
    expect(withOversized.estimatedCondensingRuntimePct).toBeGreaterThan(
      standardWithControls.estimatedCondensingRuntimePct,
    );

    // But standard emitters + good controls are NOT negative — condensing is achievable.
    const d3Standard = standardWithControls.drivers.find(d => d.id === 'emitter_suitability')!;
    expect(d3Standard.influence).not.toBe('negative');

    // And the status label confirms condensing is possible (not blocked).
    expect(standardWithControls.condensingStatusLabel).not.toBe('condensing_limited_high_return');
  });

  it('standard emitters with good controls produce a higher runtime than standard emitters with no controls', () => {
    const withControls = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: true,
      hasLoadCompensation: true,
      boilerMinModulationPct: 15,
    }));
    const withoutControls = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    expect(withControls.estimatedCondensingRuntimePct).toBeGreaterThan(
      withoutControls.estimatedCondensingRuntimePct,
    );
  });

  it('neutral emitter driver (standard + controls) appears in positiveWording', () => {
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 15,
    }));
    expect(
      result.positiveWording.some(w => w.toLowerCase().includes('standard emitters')),
    ).toBe(true);
  });
});

// ─── PR: condensingStatusLabel ───────────────────────────────────────────────

describe('CondensingRuntimeModule — condensingStatusLabel', () => {
  it('condensing_likely when zone is condensing and runtime is high', () => {
    // flowTempC=70 → return=50 < 55 → zone='condensing'; good conditions → high runtime
    const result = runCondensingRuntimeModule(makeInput({
      flowTempC: 70,
      condensingModeAvailable: true,
    }));
    expect(result.condensingStatusLabel).toBe('condensing_likely');
  });

  it('condensing_limited_high_return when full-load return is above 65 °C', () => {
    // flowTempC=90 → fullLoadReturnC=70 > 65 → high-return barrier
    const result = runCondensingRuntimeModule(makeInput({
      flowTempC: 90,
      condensingModeAvailable: false,
      hasWeatherCompensation: false,
    }));
    expect(result.condensingStatusLabel).toBe('condensing_limited_high_return');
  });

  it('controls_improvement_possible when standard emitters and no compensation', () => {
    // flowTempC=85 → fullLoadReturnC=65 (borderline but not > 65)
    // Standard emitters, no compensation → controls upgrade would help
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    expect(result.condensingStatusLabel).toBe('controls_improvement_possible');
  });

  it('modulation_limited when standard emitters + compensation but limited modulation', () => {
    // flowTempC=85 → fullLoadReturnC=65 (not > 65)
    // Standard emitters + weather comp but modulation > 20%
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 35, // limited modulation
    }));
    expect(result.condensingStatusLabel).toBe('modulation_limited');
  });

  it('condensing_possible when standard emitters with weather comp and good modulation', () => {
    // flowTempC=85 → fullLoadReturnC=65 (not > 65)
    // Standard emitters + good controls + good modulation
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      emitterOversizingFactor: 1.0,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 15,
    }));
    expect(result.condensingStatusLabel).toBe('condensing_possible');
  });

  it('condensingStatusLabel is included in diagnostic notes', () => {
    const result = runCondensingRuntimeModule(makeInput());
    expect(result.notes.some(n => n.includes('Condensing status:'))).toBe(true);
  });
});

// ─── PR: condensingAssumptions — visible flow/return temps ───────────────────

describe('CondensingRuntimeModule — condensingAssumptions', () => {
  it('assumedFlowTempC matches the input flowTempC', () => {
    const result = runCondensingRuntimeModule(makeInput({ flowTempC: 75 }));
    expect(result.condensingAssumptions.assumedFlowTempC).toBe(75);
  });

  it('assumedReturnTempC matches the CondensingStateModule full-load return', () => {
    // flowTempC=75, deltaTc=20 → fullLoadReturnC=55
    const result = runCondensingRuntimeModule(makeInput({ flowTempC: 75 }));
    expect(result.condensingAssumptions.assumedReturnTempC).toBe(55);
  });

  it('flowTempSource is "derived" (temperature derived from system design)', () => {
    const result = runCondensingRuntimeModule(makeInput({ flowTempC: 80 }));
    expect(result.condensingAssumptions.flowTempSource).toBe('derived');
  });

  it('returnTempSource is "derived" when not measured', () => {
    const result = runCondensingRuntimeModule(makeInput({ flowTempC: 80 }));
    expect(result.condensingAssumptions.returnTempSource).toBe('derived');
  });

  it('returnTempSource is "user_input" when one-pipe cascade provides a measured return', () => {
    // Provide a measured return temperature via CondensingStateModule
    const condensingState = runCondensingStateModule({ flowTempC: 90, returnTempC: 48 });
    const result = runCondensingRuntimeModule(makeInput({ flowTempC: 90, condensingState }));
    expect(result.condensingAssumptions.returnTempSource).toBe('user_input');
    expect(result.condensingAssumptions.assumedReturnTempC).toBe(48);
  });

  it('condensingAssumptions are included in diagnostic notes', () => {
    const result = runCondensingRuntimeModule(makeInput({ flowTempC: 75 }));
    expect(result.notes.some(n => n.includes('Assumed flow temperature: 75 °C'))).toBe(true);
    expect(result.notes.some(n => n.includes('Assumed return temperature: 55 °C'))).toBe(true);
  });

  it('condensingAssumptions are visible for all flow temperature scenarios', () => {
    [37, 50, 70, 75, 80, 85, 90].forEach(flowTempC => {
      const result = runCondensingRuntimeModule(makeInput({ flowTempC }));
      expect(result.condensingAssumptions.assumedFlowTempC).toBe(flowTempC);
      expect(result.condensingAssumptions.assumedReturnTempC).toBeGreaterThan(0);
      expect(result.condensingAssumptions.flowTempSource).toBeDefined();
      expect(result.condensingAssumptions.returnTempSource).toBeDefined();
    });
  });
});

// ─── PR: improved controls lower required operating temperature ───────────────

describe('CondensingRuntimeModule — improved controls lower required temperature', () => {
  it('adding load compensation improves condensing runtime over no compensation', () => {
    const withLoadComp = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasLoadCompensation: true,
      boilerMinModulationPct: 25,
    }));
    const noComp = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasLoadCompensation: false,
      hasWeatherCompensation: false,
    }));
    expect(withLoadComp.estimatedCondensingRuntimePct).toBeGreaterThan(
      noComp.estimatedCondensingRuntimePct,
    );
  });

  it('adding weather compensation improves condensing runtime over no compensation', () => {
    const withWeatherComp = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 25,
    }));
    const noComp = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: false,
      hasLoadCompensation: false,
    }));
    expect(withWeatherComp.estimatedCondensingRuntimePct).toBeGreaterThan(
      noComp.estimatedCondensingRuntimePct,
    );
  });

  it('improved modulation range (15 %) gives higher runtime than poor modulation (35 %)', () => {
    const goodMod = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 15,
    }));
    const poorMod = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: true,
      boilerMinModulationPct: 35,
    }));
    expect(goodMod.estimatedCondensingRuntimePct).toBeGreaterThan(
      poorMod.estimatedCondensingRuntimePct,
    );
  });

  it('condensingStatusLabel is not controls_improvement_possible when compensation is active', () => {
    const result = runCondensingRuntimeModule(makeInput({
      condensingModeAvailable: false,
      hasWeatherCompensation: true,
    }));
    expect(result.condensingStatusLabel).not.toBe('controls_improvement_possible');
  });
});
