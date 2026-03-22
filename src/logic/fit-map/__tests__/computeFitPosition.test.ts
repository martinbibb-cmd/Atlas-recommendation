/**
 * computeFitPosition.test.ts
 *
 * Validates the axis scoring and nearest-system classification logic in
 * computeFitPosition.  Mirrors the style of engine unit tests (Vitest,
 * no external deps).
 */

import { describe, it, expect } from 'vitest';
import { computeFitPosition } from '../computeFitPosition';
import type { FitInputs } from '../computeFitPosition';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_INPUTS: FitInputs = {
  peakConcurrentOutlets:  1,
  mainsDynamicPressureBar: 1.5,
  primaryPipeSizeMm:      22,
  thermalInertia:         'low',
  occupancy:              'professional',
};

// ─── X axis (demand) ─────────────────────────────────────────────────────────

describe('computeFitPosition — X axis (demand)', () => {
  it('returns x=0 for a minimal single-outlet professional household', () => {
    const { x } = computeFitPosition(BASE_INPUTS);
    expect(x).toBe(0);
  });

  it('adds 0.4 when peakConcurrentOutlets >= 2', () => {
    const { x } = computeFitPosition({ ...BASE_INPUTS, peakConcurrentOutlets: 2 });
    expect(x).toBe(0.4);
  });

  it('adds 0.3 when occupancy is steady', () => {
    const { x } = computeFitPosition({ ...BASE_INPUTS, occupancy: 'steady' });
    expect(x).toBe(0.3);
  });

  it('adds 0.2 when mainsDynamicPressureBar < 1.2', () => {
    const { x } = computeFitPosition({ ...BASE_INPUTS, mainsDynamicPressureBar: 0.8 });
    expect(x).toBe(0.2);
  });

  it('caps x at the maximum achievable value (0.9) when all demand factors are present', () => {
    const { x } = computeFitPosition({
      ...BASE_INPUTS,
      peakConcurrentOutlets: 3,
      occupancy: 'steady',
      mainsDynamicPressureBar: 0.5,
    });
    // Max demand: 0.4 (outlets) + 0.3 (steady) + 0.2 (low pressure) = 0.9
    expect(x).toBeCloseTo(0.9);
  });
});

// ─── Y axis (low-temp suitability) ────────────────────────────────────────────

describe('computeFitPosition — Y axis (low-temp suitability)', () => {
  it('returns y=0 for a minimal professional household with small pipe', () => {
    const { y } = computeFitPosition(BASE_INPUTS);
    expect(y).toBe(0);
  });

  it('adds 0.4 when thermalInertia is high', () => {
    const { y } = computeFitPosition({ ...BASE_INPUTS, thermalInertia: 'high' });
    expect(y).toBe(0.4);
  });

  it('adds 0.4 when primaryPipeSizeMm >= 28', () => {
    const { y } = computeFitPosition({ ...BASE_INPUTS, primaryPipeSizeMm: 28 });
    expect(y).toBe(0.4);
  });

  it('adds 0.2 when occupancy is steady', () => {
    const { y } = computeFitPosition({ ...BASE_INPUTS, occupancy: 'steady' });
    expect(y).toBe(0.2);
  });

  it('clamps y at 1.0 when all low-temp factors are present', () => {
    const { y } = computeFitPosition({
      ...BASE_INPUTS,
      thermalInertia: 'high',
      primaryPipeSizeMm: 35,
      occupancy: 'steady',
    });
    expect(y).toBe(1);
  });
});

// ─── Nearest system classification ────────────────────────────────────────────

describe('computeFitPosition — nearestSystem', () => {
  it('classifies a low-demand, low-inertia household as combi', () => {
    const { nearestSystem } = computeFitPosition(BASE_INPUTS);
    expect(nearestSystem).toBe('combi');
  });

  it('classifies a high-demand household (x > 0.5, y <= 0.6) as system', () => {
    const { nearestSystem } = computeFitPosition({
      ...BASE_INPUTS,
      peakConcurrentOutlets: 2,   // +0.4
      occupancy: 'steady',        // +0.3 → x=0.7
    });
    expect(nearestSystem).toBe('system');
  });

  it('classifies a high-inertia, large-pipe household (y > 0.6) as heat_pump', () => {
    const { nearestSystem } = computeFitPosition({
      ...BASE_INPUTS,
      thermalInertia: 'high',     // +0.4
      primaryPipeSizeMm: 28,      // +0.4 → y=0.8
    });
    expect(nearestSystem).toBe('heat_pump');
  });

  it('y > 0.6 takes priority over x > 0.5 and returns heat_pump', () => {
    const { nearestSystem } = computeFitPosition({
      ...BASE_INPUTS,
      peakConcurrentOutlets: 2,   // drives x > 0.5
      occupancy: 'steady',        // drives both x and y
      thermalInertia: 'high',     // drives y > 0.6
      primaryPipeSizeMm: 28,
    });
    expect(nearestSystem).toBe('heat_pump');
  });
});
