import { describe, it, expect } from 'vitest';
import { runMaintenanceROI } from '../modules/MaintenanceROI';
import type { MaintenanceROIInput } from '../schema/EngineInputV2_3';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const hardWaterNoProtection: MaintenanceROIInput = {
  hasMagneticFilter: false,
  cacO3LevelMgL: 300,       // very_hard – above 200 ppm threshold
  hasSoftener: false,
  annualGasSpendGbp: 1200,
  isHighSilica: true,
};

const softWaterProtected: MaintenanceROIInput = {
  hasMagneticFilter: true,
  cacO3LevelMgL: 50,        // soft – below 200 ppm threshold
  hasSoftener: false,
  annualGasSpendGbp: 1200,
};

// ─── 1. Sludge penalty ────────────────────────────────────────────────────────

describe('MaintenanceROI – sludge penalty', () => {
  it('applies 7% sludge penalty when no magnetic filter is fitted', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.sludgePenaltyGbpPerYear).toBeCloseTo(1200 * 0.07, 2);
  });

  it('sludge penalty is 0 when a magnetic filter is fitted', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, hasMagneticFilter: true });
    expect(result.sludgePenaltyGbpPerYear).toBe(0);
  });

  it('emits a sludge note when no filter is fitted', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.notes.some(n => n.includes('Sludge Penalty'))).toBe(true);
  });

  it('emits a magnetic filter cleared note when filter is fitted', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, hasMagneticFilter: true });
    expect(result.notes.some(n => n.includes('sludge tax cleared'))).toBe(true);
  });
});

// ─── 2. Scaling penalty ───────────────────────────────────────────────────────

describe('MaintenanceROI – scaling penalty', () => {
  it('applies 11% scaling penalty when CaCO₃ > 200 ppm and no softener', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.scalingPenaltyGbpPerYear).toBeCloseTo(1200 * 0.11, 2);
  });

  it('scaling penalty is 0 when a softener is fitted, even in hard water', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, hasSoftener: true });
    expect(result.scalingPenaltyGbpPerYear).toBe(0);
  });

  it('scaling penalty is 0 when CaCO₃ is at or below 200 ppm', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, cacO3LevelMgL: 200 });
    expect(result.scalingPenaltyGbpPerYear).toBe(0);
  });

  it('scaling penalty applies at 201 ppm without softener', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, cacO3LevelMgL: 201 });
    expect(result.scalingPenaltyGbpPerYear).toBeGreaterThan(0);
  });

  it('emits a scaling note for hard water without softener', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.notes.some(n => n.includes('Scaling Penalty'))).toBe(true);
  });

  it('mentions high silicates in the note for isHighSilica postcodes', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, isHighSilica: true });
    expect(result.notes.some(n => n.includes('silicates'))).toBe(true);
  });

  it('does not mention silicates when isHighSilica is false', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, isHighSilica: false });
    // The scaling penalty note should not mention silicates
    const scalingNote = result.notes.find(n => n.includes('Scaling Penalty'));
    expect(scalingNote).toBeDefined();
    expect(scalingNote).not.toContain('silicates');
  });
});

// ─── 3. Total cost of inaction ────────────────────────────────────────────────

describe('MaintenanceROI – total cost of inaction', () => {
  it('total is sludge + scaling when both penalties apply', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.totalAnnualCostGbp).toBeCloseTo(
      result.sludgePenaltyGbpPerYear + result.scalingPenaltyGbpPerYear,
      2
    );
  });

  it('total is 0 when no penalties apply (soft water + magnetic filter)', () => {
    const result = runMaintenanceROI(softWaterProtected);
    expect(result.totalAnnualCostGbp).toBe(0);
  });

  it('total cost is higher without any protection than with full protection', () => {
    const unprotected = runMaintenanceROI(hardWaterNoProtection);
    const protected_ = runMaintenanceROI({
      ...hardWaterNoProtection,
      hasMagneticFilter: true,
      hasSoftener: true,
    });
    expect(unprotected.totalAnnualCostGbp).toBeGreaterThan(protected_.totalAnnualCostGbp);
  });
});

// ─── 4. Flush payback ─────────────────────────────────────────────────────────

describe('MaintenanceROI – flush payback', () => {
  it('calculates flushPaybackYears when there is a non-zero cost', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.flushPaybackYears).not.toBeNull();
    expect(result.flushPaybackYears!).toBeGreaterThan(0);
  });

  it('flushPaybackYears is null when total cost is 0', () => {
    const result = runMaintenanceROI(softWaterProtected);
    expect(result.flushPaybackYears).toBeNull();
  });

  it('flush payback is £500 / annualCost', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    const expected = parseFloat((500 / result.totalAnnualCostGbp).toFixed(1));
    expect(result.flushPaybackYears).toBe(expected);
  });
});

// ─── 5. Sell message ──────────────────────────────────────────────────────────

describe('MaintenanceROI – sell message', () => {
  it('includes "pay for itself" language when there is a cost', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.message).toContain('pay for itself');
  });

  it('includes "high silicates" in the message for high-silica postcodes', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, isHighSilica: true });
    expect(result.message).toContain('high silicates');
  });

  it('uses generic "water quality" language for non-silica postcodes', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, isHighSilica: false });
    expect(result.message).toContain('water quality');
  });

  it('emits a no-penalty message when system is fully protected', () => {
    const result = runMaintenanceROI(softWaterProtected);
    expect(result.message).toContain('efficiently');
  });

  it('notes array is non-empty for any valid input', () => {
    expect(runMaintenanceROI(hardWaterNoProtection).notes.length).toBeGreaterThan(0);
    expect(runMaintenanceROI(softWaterProtected).notes.length).toBeGreaterThan(0);
  });
});

// ─── 6. Sluggish Radiator effect ──────────────────────────────────────────────

describe('MaintenanceROI – sluggish radiator effect', () => {
  it('sluggishRadiatorActive is true when no magnetic filter is fitted', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.sluggishRadiatorActive).toBe(true);
  });

  it('sluggishRadiatorActive is false when a magnetic filter is fitted', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, hasMagneticFilter: true });
    expect(result.sluggishRadiatorActive).toBe(false);
  });

  it('radiatorHeatOutputReductionPct is 47 when sluggish radiator is active', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.radiatorHeatOutputReductionPct).toBe(47);
  });

  it('radiatorHeatOutputReductionPct is 0 when magnetic filter is fitted', () => {
    const result = runMaintenanceROI({ ...hardWaterNoProtection, hasMagneticFilter: true });
    expect(result.radiatorHeatOutputReductionPct).toBe(0);
  });

  it('sludge note mentions Sluggish Radiator effect when active', () => {
    const result = runMaintenanceROI(hardWaterNoProtection);
    expect(result.notes.some(n => n.includes('Sluggish Radiator'))).toBe(true);
  });
});
