import { describe, it, expect } from 'vitest';
import { runThermalInertiaModule } from '../modules/ThermalInertiaModule';
import type { ThermalInertiaInput } from '../schema/EngineInputV2_3';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const solidBrickProfessional: ThermalInertiaInput = {
  fabricType: 'solid_brick_1930s',
  occupancyProfile: 'professional',
  initialTempC: 20,
  outdoorTempC: 5,
};

const lightweightProfessional: ThermalInertiaInput = {
  fabricType: 'lightweight_new',
  occupancyProfile: 'professional',
  initialTempC: 20,
  outdoorTempC: 5,
};

// ─── 1. Thermal time constant (τ) ────────────────────────────────────────────

describe('ThermalInertiaModule – thermal time constant', () => {
  it('solid_brick_1930s has τ = 55 hours', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    expect(result.tauHours).toBe(55);
  });

  it('lightweight_new has τ = 15 hours', () => {
    const result = runThermalInertiaModule(lightweightProfessional);
    expect(result.tauHours).toBe(15);
  });
});

// ─── 2. Exponential decay formula ─────────────────────────────────────────────

describe('ThermalInertiaModule – exponential decay', () => {
  it('solid brick: finalTempC matches T_out + (T_in - T_out) * exp(-10/55)', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    // T(10) = 5 + (20 - 5) * exp(-10/55)
    const expected = 5 + 15 * Math.exp(-10 / 55);
    expect(result.finalTempC).toBeCloseTo(expected, 0);
  });

  it('lightweight new build: finalTempC matches T_out + (T_in - T_out) * exp(-10/15)', () => {
    const result = runThermalInertiaModule(lightweightProfessional);
    // T(10) = 5 + (20 - 5) * exp(-10/15)
    const expected = 5 + 15 * Math.exp(-10 / 15);
    expect(result.finalTempC).toBeCloseTo(expected, 0);
  });

  it('trace[0].tempC equals the initial temperature', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    expect(result.trace[0].tempC).toBeCloseTo(solidBrickProfessional.initialTempC, 0);
  });

  it('trace temperatures are monotonically decreasing when outdoor < initial', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    for (let i = 1; i < result.trace.length; i++) {
      expect(result.trace[i].tempC).toBeLessThanOrEqual(result.trace[i - 1].tempC);
    }
  });

  it('finalTempC approaches outdoorTempC as unheatedHours increases', () => {
    const longDecay = runThermalInertiaModule({
      ...lightweightProfessional,
      unheatedHours: 200,
    });
    // After 200 hours with τ=15, temp should be very close to outdoorTempC (5°C)
    expect(longDecay.finalTempC).toBeCloseTo(5, 0);
  });
});

// ─── 3. Professional (Away All Day) profile ───────────────────────────────────

describe('ThermalInertiaModule – Professional profile', () => {
  it('default unheated window is 10 hours for Professional profile', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    // trace runs from hour 0 to hour 10 inclusive → 11 data points
    expect(result.trace.length).toBe(11);
  });

  it('default unheated window is 2 hours for Home All Day profile', () => {
    const result = runThermalInertiaModule({ ...solidBrickProfessional, occupancyProfile: 'home_all_day' });
    // trace runs from hour 0 to hour 2 inclusive → 3 data points
    expect(result.trace.length).toBe(3);
  });

  it('solid brick: temperature stays above 17°C after 10h away (retains heat)', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    expect(result.finalTempC).toBeGreaterThan(17);
  });

  it('lightweight new build: temperature drops significantly after 10h away', () => {
    const result = runThermalInertiaModule(lightweightProfessional);
    // With τ=15 and 10h window, should drop noticeably vs solid brick
    const solidResult = runThermalInertiaModule(solidBrickProfessional);
    expect(result.finalTempC).toBeLessThan(solidResult.finalTempC);
  });

  it('lightweight new build drops to ~14°C (≤16°C) on a cold day (5°C outdoor)', () => {
    // As per the POC demo requirement: lightweight flat drops to ~14°C by 4 PM
    const result = runThermalInertiaModule(lightweightProfessional);
    expect(result.finalTempC).toBeLessThanOrEqual(16);
  });
});

// ─── 4. Custom unheated window ───────────────────────────────────────────────

describe('ThermalInertiaModule – custom unheated window', () => {
  it('respects a custom unheatedHours value', () => {
    const result = runThermalInertiaModule({ ...solidBrickProfessional, unheatedHours: 5 });
    // trace runs 0..5 = 6 data points
    expect(result.trace.length).toBe(6);
    const expected = 5 + 15 * Math.exp(-5 / 55);
    expect(result.finalTempC).toBeCloseTo(expected, 0);
  });
});

// ─── 5. totalDropC ───────────────────────────────────────────────────────────

describe('ThermalInertiaModule – totalDropC', () => {
  it('totalDropC equals initialTempC minus finalTempC', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    expect(result.totalDropC).toBeCloseTo(
      solidBrickProfessional.initialTempC - result.finalTempC,
      1,
    );
  });

  it('solid brick has smaller totalDropC than lightweight for same conditions', () => {
    const solidResult = runThermalInertiaModule(solidBrickProfessional);
    const lightResult = runThermalInertiaModule(lightweightProfessional);
    expect(solidResult.totalDropC).toBeLessThan(lightResult.totalDropC);
  });
});

// ─── 6. Narrative ────────────────────────────────────────────────────────────

describe('ThermalInertiaModule – narrative', () => {
  it('solid brick narrative mentions "retains" or "retains heat"', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    expect(result.narrative).toMatch(/retain/i);
  });

  it('lightweight narrative mentions temperature drop', () => {
    const result = runThermalInertiaModule(lightweightProfessional);
    expect(result.narrative).toMatch(/drop/i);
  });

  it('narrative includes the Professional profile label', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    expect(result.narrative).toContain('Professional');
  });
});

// ─── 7. Notes ────────────────────────────────────────────────────────────────

describe('ThermalInertiaModule – notes', () => {
  it('notes include the τ value', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    expect(result.notes.some(n => n.includes('τ = 55'))).toBe(true);
  });

  it('notes include a comfort alert for lightweight flat dropping below 16°C', () => {
    const result = runThermalInertiaModule(lightweightProfessional);
    expect(result.notes.some(n => n.includes('Comfort alert') || n.includes('16°C'))).toBe(true);
  });

  it('no comfort alert for solid brick (stays above 16°C)', () => {
    const result = runThermalInertiaModule(solidBrickProfessional);
    expect(result.notes.every(n => !n.includes('Comfort alert'))).toBe(true);
  });
});
