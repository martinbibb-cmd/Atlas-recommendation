import { describe, it, expect } from 'vitest';
import { runSpecEdgeModule } from '../modules/SpecEdgeModule';
import type { SpecEdgeInput } from '../schema/EngineInputV2_3';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const fullJobInput: SpecEdgeInput = {
  installationPolicy: 'full_job',
  heatLossWatts: 8000,
  unitModulationFloorKw: 3,
  waterHardnessCategory: 'hard',
  hasSoftener: false,
  hasMagneticFilter: false,
  annualGasSpendGbp: 1200,
};

const highTempInput: SpecEdgeInput = {
  installationPolicy: 'high_temp_retrofit',
  heatLossWatts: 8000,
  unitModulationFloorKw: 3,
  waterHardnessCategory: 'hard',
  hasSoftener: false,
  hasMagneticFilter: false,
  annualGasSpendGbp: 1200,
};

// ─── 1. Installation strategy ─────────────────────────────────────────────────

describe('SpecEdgeModule – installation strategy', () => {
  it('full_job produces a lower design flow temperature than high_temp_retrofit', () => {
    const fullJob = runSpecEdgeModule(fullJobInput);
    const highTemp = runSpecEdgeModule(highTempInput);
    expect(fullJob.designFlowTempC).toBeLessThan(highTemp.designFlowTempC);
  });

  it('full_job flow temperature is in the 35–40 °C band', () => {
    const result = runSpecEdgeModule(fullJobInput);
    expect(result.designFlowTempC).toBeGreaterThanOrEqual(35);
    expect(result.designFlowTempC).toBeLessThanOrEqual(40);
  });

  it('high_temp_retrofit flow temperature is 50 °C', () => {
    const result = runSpecEdgeModule(highTempInput);
    expect(result.designFlowTempC).toBe(50);
  });

  it('full_job SPF range is within 3.8–4.4', () => {
    const result = runSpecEdgeModule(fullJobInput);
    expect(result.spfRange[0]).toBeGreaterThanOrEqual(3.8);
    expect(result.spfRange[1]).toBeLessThanOrEqual(4.4);
  });

  it('high_temp_retrofit SPF range is within 2.9–3.1', () => {
    const result = runSpecEdgeModule(highTempInput);
    expect(result.spfRange[0]).toBeGreaterThanOrEqual(2.9);
    expect(result.spfRange[1]).toBeLessThanOrEqual(3.1);
  });

  it('full_job produces a higher SPF midpoint than high_temp_retrofit', () => {
    const fullJob = runSpecEdgeModule(fullJobInput);
    const highTemp = runSpecEdgeModule(highTempInput);
    expect(fullJob.spfMidpoint).toBeGreaterThan(highTemp.spfMidpoint);
  });
});

// ─── 2. Metallurgy matrix ─────────────────────────────────────────────────────

describe('SpecEdgeModule – metallurgy matrix', () => {
  it('recommends al_si and activates the WB softener edge when hasSoftener is true', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, hasSoftener: true });
    expect(result.recommendedMetallurgy).toBe('al_si');
    expect(result.wbSoftenerEdgeActive).toBe(true);
  });

  it('populates softenerCompatibilityFlag when softener edge is active', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, hasSoftener: true });
    expect(result.softenerCompatibilityFlag).toBeDefined();
    expect(result.softenerCompatibilityFlag).toContain('Worcester Bosch');
  });

  it('softenerCompatibilityFlag is undefined when no softener is present', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, hasSoftener: false });
    expect(result.softenerCompatibilityFlag).toBeUndefined();
  });

  it('recommends stainless_steel for soft water without a softener', () => {
    const result = runSpecEdgeModule({
      ...highTempInput,
      waterHardnessCategory: 'soft',
      hasSoftener: false,
    });
    expect(result.recommendedMetallurgy).toBe('stainless_steel');
    expect(result.wbSoftenerEdgeActive).toBe(false);
  });

  it('recommends al_si for hard water without a softener', () => {
    const result = runSpecEdgeModule(fullJobInput);
    expect(result.recommendedMetallurgy).toBe('al_si');
    expect(result.wbSoftenerEdgeActive).toBe(false);
  });

  it('respects an explicit al_si metallurgy preference', () => {
    const result = runSpecEdgeModule({
      ...highTempInput,
      waterHardnessCategory: 'soft',
      preferredMetallurgy: 'al_si',
    });
    expect(result.recommendedMetallurgy).toBe('al_si');
  });

  it('emits a softener conflict warning when stainless_steel is explicitly chosen with a softener', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      hasSoftener: true,
      preferredMetallurgy: 'stainless_steel',
    });
    expect(result.notes.some(n => n.includes('Softener Conflict'))).toBe(true);
  });
});

// ─── 3. Longevity Bonus ("Motorway Cruise") ───────────────────────────────────

describe('SpecEdgeModule – Longevity Bonus (Motorway Cruise)', () => {
  it('grants longevityBonusActive when heat loss closely matches modulation floor', () => {
    // 3000 W = 3 kW, modulation floor = 3 kW → within ±15%
    const result = runSpecEdgeModule({
      ...fullJobInput,
      heatLossWatts: 3000,
      unitModulationFloorKw: 3,
    });
    expect(result.longevityBonusActive).toBe(true);
  });

  it('longevityBonusActive is false when heat loss greatly exceeds modulation floor', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      heatLossWatts: 10000, // 10 kW vs 3 kW floor
      unitModulationFloorKw: 3,
    });
    expect(result.longevityBonusActive).toBe(false);
  });

  it('longevityBonusActive is false when heat loss is far below modulation floor', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      heatLossWatts: 500, // 0.5 kW vs 5 kW floor
      unitModulationFloorKw: 5,
    });
    expect(result.longevityBonusActive).toBe(false);
  });

  it('longevityBonusActive is true at the exact modulation floor value', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      heatLossWatts: 5000,
      unitModulationFloorKw: 5,
    });
    expect(result.longevityBonusActive).toBe(true);
  });

  it('longevityBonusActive emits a Longevity Bonus note when active', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      heatLossWatts: 3000,
      unitModulationFloorKw: 3,
    });
    expect(result.notes.some(n => n.includes('Longevity Bonus'))).toBe(true);
  });
});

// ─── 4. Maintenance ROI Visualizer ───────────────────────────────────────────

describe('SpecEdgeModule – maintenance ROI visualizer', () => {
  it('applies magnetite sludge tax when no magnetic filter is fitted', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, hasMagneticFilter: false });
    expect(result.magnetiteSludgeTaxPct).toBeGreaterThan(0);
    expect(result.radiatorHeatOutputReductionPct).toBe(47);
  });

  it('magnetite sludge tax is zero when a magnetic filter is fitted', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, hasMagneticFilter: true });
    expect(result.magnetiteSludgeTaxPct).toBe(0);
    expect(result.radiatorHeatOutputReductionPct).toBe(0);
  });

  it('applies DHW scaling tax in hard water', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'hard',
    });
    expect(result.dhwScalingTaxPct).toBeGreaterThan(0);
  });

  it('applies DHW scaling tax in very_hard water', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'very_hard',
    });
    expect(result.dhwScalingTaxPct).toBeGreaterThan(0);
  });

  it('DHW scaling tax is zero for soft water', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'soft',
    });
    expect(result.dhwScalingTaxPct).toBe(0);
  });

  it('DHW scaling tax is zero for moderate water', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'moderate',
    });
    expect(result.dhwScalingTaxPct).toBe(0);
  });

  it('DHW scaling tax is zero when a softener is fitted, even in hard water', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'hard',
      hasSoftener: true,
    });
    expect(result.dhwScalingTaxPct).toBe(0);
  });

  it('DHW scaling tax is zero when a softener is fitted in very_hard water', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'very_hard',
      hasSoftener: true,
    });
    expect(result.dhwScalingTaxPct).toBe(0);
  });

  it('annualCostOfInactionGbp excludes DHW scaling component when softener is fitted', () => {
    const withSoftener = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'hard',
      hasSoftener: true,
    });
    const withoutSoftener = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'hard',
      hasSoftener: false,
    });
    expect(withSoftener.annualCostOfInactionGbp).toBeLessThan(withoutSoftener.annualCostOfInactionGbp);
  });

  it('emits a softener-cleared DHW note for hard water when softener is fitted', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'hard',
      hasSoftener: true,
    });
    expect(result.notes.some(n => n.includes('Water softener') && n.includes('DHW scaling tax cleared'))).toBe(true);
  });

  it('calculates annualCostOfInactionGbp > 0 when annualGasSpendGbp is provided', () => {
    const result = runSpecEdgeModule(fullJobInput); // hard water, no filter, £1200/yr
    expect(result.annualCostOfInactionGbp).toBeGreaterThan(0);
  });

  it('annualCostOfInactionGbp is 0 when no gas spend is provided', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, annualGasSpendGbp: undefined });
    expect(result.annualCostOfInactionGbp).toBe(0);
    expect(result.flushPaybackYears).toBeNull();
  });

  it('calculates flushPaybackYears when there is a non-zero cost of inaction', () => {
    const result = runSpecEdgeModule(fullJobInput);
    expect(result.flushPaybackYears).not.toBeNull();
    expect(result.flushPaybackYears!).toBeGreaterThan(0);
  });

  it('emits a "Magnetite Sludge Tax" note when no magnetic filter is fitted', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, hasMagneticFilter: false });
    expect(result.notes.some(n => n.includes('Magnetite Sludge Tax'))).toBe(true);
  });

  it('emits a "DHW Scaling Tax" note for hard water areas', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, waterHardnessCategory: 'hard' });
    expect(result.notes.some(n => n.includes('DHW Scaling Tax'))).toBe(true);
  });

  it('mentions silicate heat transfer resistance for very_hard water', () => {
    const result = runSpecEdgeModule({
      ...fullJobInput,
      waterHardnessCategory: 'very_hard',
    });
    expect(result.notes.some(n => n.includes('silicate'))).toBe(true);
  });

  it('emits a cost of inaction note with flush payback when gas spend is provided', () => {
    const result = runSpecEdgeModule(fullJobInput);
    expect(result.notes.some(n => n.includes('Annualised Cost of Inaction'))).toBe(true);
  });
});

// ─── 5. Mixergy saving ────────────────────────────────────────────────────────

describe('SpecEdgeModule – Mixergy saving', () => {
  it('sets mixergyGasSavingPct to 21 when dhwTankType is mixergy', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, dhwTankType: 'mixergy' });
    expect(result.mixergyGasSavingPct).toBe(21);
  });

  it('sets mixergyFootprintReductionPct to 30 when dhwTankType is mixergy', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, dhwTankType: 'mixergy' });
    expect(result.mixergyFootprintReductionPct).toBe(30);
  });

  it('mixergyGasSavingPct is undefined when dhwTankType is standard', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, dhwTankType: 'standard' });
    expect(result.mixergyGasSavingPct).toBeUndefined();
  });

  it('mixergyGasSavingPct is undefined when dhwTankType is not set', () => {
    const result = runSpecEdgeModule(fullJobInput);
    expect(result.mixergyGasSavingPct).toBeUndefined();
  });

  it('emits a Mixergy stratification note when dhwTankType is mixergy', () => {
    const result = runSpecEdgeModule({ ...fullJobInput, dhwTankType: 'mixergy' });
    expect(result.notes.some(n => n.includes('Mixergy Stratification'))).toBe(true);
  });
});

// ─── 6. General ───────────────────────────────────────────────────────────────

describe('SpecEdgeModule – general', () => {
  it('notes array is non-empty for any valid input', () => {
    expect(runSpecEdgeModule(fullJobInput).notes.length).toBeGreaterThan(0);
    expect(runSpecEdgeModule(highTempInput).notes.length).toBeGreaterThan(0);
  });
});
