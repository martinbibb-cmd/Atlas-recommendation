import { describe, it, expect } from 'vitest';
import { runCondensingRuntimeModule } from '../modules/CondensingRuntimeModule';
import { runCondensingStateModule } from '../modules/CondensingStateModule';
import type { CondensingRuntimeInput } from '../schema/EngineInputV2_3';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Produce a minimal CondensingRuntimeInput with sensible defaults.
 * Uses 85 °C flow by default so adjustments remain visible before the 100 % ceiling.
 * Overrides are applied on top.
 */
function makeInput(
  overrides: Partial<CondensingRuntimeInput> = {},
): CondensingRuntimeInput {
  const flowTempC = overrides.flowTempC ?? 85;
  const condensingState = runCondensingStateModule({ flowTempC, deltaTc: 20 });
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
    // Re-derive condensingState if flowTempC changed via overrides but condensingState wasn't also overridden.
    ...(overrides.flowTempC != null && overrides.condensingState == null
      ? { condensingState: runCondensingStateModule({ flowTempC: overrides.flowTempC, deltaTc: 20 }) }
      : {}),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CondensingRuntimeModule — result shape', () => {
  it('returns all required fields', () => {
    const result = runCondensingRuntimeModule(makeInput());
    expect(result).toHaveProperty('estimatedCondensingRuntimePct');
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

