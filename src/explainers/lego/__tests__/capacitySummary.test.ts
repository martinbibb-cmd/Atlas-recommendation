/**
 * Tests for capacitySummary — verifies demand/supply/pipe/thermal caps,
 * bottleneck identification and warning generation.
 */

import { describe, it, expect } from 'vitest';
import { computeCapacitySummary } from '../animation/capacitySummary';
import type { LabControls } from '../animation/types';

const BASE: LabControls = {
  coldInletC: 10,
  dhwSetpointC: 50,
  combiDhwKw: 30,
  mainsDynamicFlowLpm: 18,
  pipeDiameterMm: 22,
  outlets: 1,
  demandPerOutletLpm: 8,
};

describe('computeCapacitySummary — basic values', () => {
  it('calculates demand as outlets × demandPerOutlet', () => {
    const s = computeCapacitySummary({ ...BASE, outlets: 2, demandPerOutletLpm: 6 });
    expect(s.demandTotalLpm).toBe(12);
  });

  it('supplyCapLpm mirrors mainsDynamicFlowLpm', () => {
    const s = computeCapacitySummary({ ...BASE, mainsDynamicFlowLpm: 14 });
    expect(s.supplyCapLpm).toBe(14);
  });

  it('pipeCapLpm is 15 for 15 mm pipe', () => {
    const s = computeCapacitySummary({ ...BASE, pipeDiameterMm: 15 });
    expect(s.pipeCapLpm).toBe(15);
  });

  it('pipeCapLpm is 30 for 22 mm pipe', () => {
    const s = computeCapacitySummary({ ...BASE, pipeDiameterMm: 22 });
    expect(s.pipeCapLpm).toBe(30);
  });

  it('thermalCapLpm is computed from kW and ΔT', () => {
    // 30 kW / (0.06977 × 40 °C) ≈ 10.748 L/min
    const s = computeCapacitySummary({ ...BASE, combiDhwKw: 30 });
    expect(s.thermalCapLpm).toBeCloseTo(10.748, 1);
  });
});

describe('computeCapacitySummary — hydraulicFlowLpm', () => {
  it('is capped by the minimum of demand, supply, pipe', () => {
    const s = computeCapacitySummary({
      ...BASE,
      mainsDynamicFlowLpm: 10,
      pipeDiameterMm: 22,  // cap = 30
      demandPerOutletLpm: 20, outlets: 1, // demand = 20
    });
    // min(20, 10, 30) = 10
    expect(s.hydraulicFlowLpm).toBe(10);
  });
});

describe('computeCapacitySummary — limitingComponent', () => {
  it('identifies Supply as bottleneck when mains flow is lowest', () => {
    const s = computeCapacitySummary({
      ...BASE,
      mainsDynamicFlowLpm: 5,   // supply = 5  ← lowest
      pipeDiameterMm: 22,       // pipe   = 30
      combiDhwKw: 40,           // thermal ≈ 14.3 L/min
    });
    expect(s.limitingComponent).toBe('Supply');
  });

  it('identifies Pipe as bottleneck when pipe diameter is the limit', () => {
    const s = computeCapacitySummary({
      ...BASE,
      coldInletC: 15,           // ΔT = 35 → thermal ≈ 16.4 L/min at 40 kW
      mainsDynamicFlowLpm: 25,  // supply = 25
      pipeDiameterMm: 15,       // pipe = 15  ← lowest
      combiDhwKw: 40,           // thermal ≈ 16.4 L/min
    });
    expect(s.limitingComponent).toBe('Pipe');
  });

  it('identifies Thermal as bottleneck when kW is the limit', () => {
    const s = computeCapacitySummary({
      ...BASE,
      mainsDynamicFlowLpm: 25,  // supply = 25
      pipeDiameterMm: 22,       // pipe   = 30
      combiDhwKw: 24,           // thermal = 24/(0.06977×40) ≈ 8.6 ← lowest
    });
    expect(s.limitingComponent).toBe('Thermal');
  });
});

describe('computeCapacitySummary — warnings', () => {
  it('emits no warnings when demand is comfortably below all caps', () => {
    const s = computeCapacitySummary({
      ...BASE,
      outlets: 1,
      demandPerOutletLpm: 5,   // demand = 5, well below all caps
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
    });
    expect(s.warnings).toHaveLength(0);
  });

  it('emits thermal warning when demand exceeds thermal cap', () => {
    const s = computeCapacitySummary({
      ...BASE,
      outlets: 2,
      demandPerOutletLpm: 8,   // demand = 16 > thermal ≈ 10.7
      mainsDynamicFlowLpm: 25,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
    });
    expect(s.warnings.some(w => w.includes('thermal capacity'))).toBe(true);
  });

  it('emits supply warning when demand exceeds supply cap', () => {
    const s = computeCapacitySummary({
      ...BASE,
      outlets: 3,
      demandPerOutletLpm: 8,   // demand = 24 > supply = 20
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 40,
    });
    expect(s.warnings.some(w => w.includes('supply capacity'))).toBe(true);
  });

  it('can emit multiple warnings simultaneously', () => {
    // demand = 3 × 10 = 30; supply = 12; pipe = 15; thermal ≈ 10.7
    const s = computeCapacitySummary({
      ...BASE,
      outlets: 3,
      demandPerOutletLpm: 10,
      mainsDynamicFlowLpm: 12,
      pipeDiameterMm: 15,
      combiDhwKw: 30,
    });
    expect(s.warnings.length).toBeGreaterThanOrEqual(3);
  });
});
