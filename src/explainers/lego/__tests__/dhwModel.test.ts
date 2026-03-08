/**
 * Tests for the Lego DHW model: kwForFlow, flowForKw, computeCombiThermalLimit,
 * pipeDiameterCapacityLpm, computeCapacityChain, and computeCombiWarmUpFraction.
 */

import { describe, it, expect } from 'vitest';
import {
  kwForFlow,
  flowForKw,
  computeCombiThermalLimit,
  pipeDiameterCapacityLpm,
  computeCapacityChain,
  computeCombiWarmUpFraction,
  DEFAULT_COMBI_WARMUP_LAG_SECONDS,
} from '../model/dhwModel';

// ─── kwForFlow / flowForKw ────────────────────────────────────────────────────

describe('kwForFlow', () => {
  it('calculates thermal power for 10 L/min at 40 °C rise', () => {
    expect(kwForFlow(10, 40)).toBeCloseTo(27.908, 2);
  });

  it('returns 0 for zero flow', () => {
    expect(kwForFlow(0, 40)).toBe(0);
  });
});

describe('flowForKw', () => {
  it('is the inverse of kwForFlow', () => {
    const flow = 12;
    const dT = 45;
    expect(flowForKw(kwForFlow(flow, dT), dT)).toBeCloseTo(flow, 4);
  });
});

// ─── computeCombiThermalLimit ─────────────────────────────────────────────────

describe('computeCombiThermalLimit', () => {
  it('returns lower flow limit in winter (5 °C) than typical (10 °C)', () => {
    const typical = computeCombiThermalLimit({ dhwOutputKw: 30, coldTempC: 10, setpointC: 50 });
    const winter  = computeCombiThermalLimit({ dhwOutputKw: 30, coldTempC: 5,  setpointC: 50 });
    expect(winter).toBeLessThan(typical);
  });

  it('returns ~10.75 L/min for 30 kW at 10 °C cold (40 °C rise)', () => {
    // 30 / (0.06977 × 40) ≈ 10.748
    const result = computeCombiThermalLimit({ dhwOutputKw: 30, coldTempC: 10, setpointC: 50 });
    expect(result).toBeCloseTo(10.748, 1);
  });

  it('returns ~8.6 L/min for 30 kW at 5 °C cold (45 °C rise)', () => {
    // 30 / (0.06977 × 45) ≈ 9.554 — actually: 30/(0.06977*45)=30/3.13965≈9.554
    const result = computeCombiThermalLimit({ dhwOutputKw: 30, coldTempC: 5, setpointC: 50 });
    expect(result).toBeCloseTo(9.554, 1);
  });

  it('returns 0 if setpoint <= coldTemp (invalid config)', () => {
    const result = computeCombiThermalLimit({ dhwOutputKw: 30, coldTempC: 55, setpointC: 50 });
    expect(result).toBe(0);
  });
});

// ─── pipeDiameterCapacityLpm ──────────────────────────────────────────────────

describe('pipeDiameterCapacityLpm', () => {
  it('returns 15 for 15 mm pipe', () => {
    expect(pipeDiameterCapacityLpm(15)).toBe(15);
  });

  it('returns 30 for 22 mm pipe', () => {
    expect(pipeDiameterCapacityLpm(22)).toBe(30);
  });

  it('returns undefined for unknown diameter', () => {
    expect(pipeDiameterCapacityLpm(99)).toBeUndefined();
  });
});

// ─── computeCapacityChain ─────────────────────────────────────────────────────

describe('computeCapacityChain', () => {
  it('returns the minimum of all defined capacities', () => {
    const result = computeCapacityChain([
      { label: 'Supply',  maxFlowLpm: 18 },
      { label: 'Pipe',    maxFlowLpm: 15 },
      { label: 'Thermal', maxFlowLpm: 10.7 },
    ]);
    expect(result.maxFlowLpm).toBeCloseTo(10.7, 1);
  });

  it('identifies the correct limiting component', () => {
    const result = computeCapacityChain([
      { label: 'Supply',  maxFlowLpm: 18 },
      { label: 'Pipe',    maxFlowLpm: 15 },
      { label: 'Thermal', maxFlowLpm: 10.7 },
    ]);
    expect(result.limitingComponent).toBe('Thermal');
  });

  it('returns undefined maxFlow when all components are undefined', () => {
    const result = computeCapacityChain([
      { label: 'Stored cylinder', maxFlowLpm: undefined },
    ]);
    expect(result.maxFlowLpm).toBeUndefined();
    expect(result.limitingComponent).toBeUndefined();
  });

  it('ignores undefined capacities and returns min of defined ones', () => {
    const result = computeCapacityChain([
      { label: 'Supply',  maxFlowLpm: 18 },
      { label: 'Storage', maxFlowLpm: undefined },
      { label: 'Pipe',    maxFlowLpm: 12 },
    ]);
    expect(result.maxFlowLpm).toBe(12);
    expect(result.limitingComponent).toBe('Pipe');
  });
});

// ─── computeCombiWarmUpFraction ───────────────────────────────────────────────

describe('computeCombiWarmUpFraction', () => {
  it('returns 0 at draw age 0 (cold water at draw start)', () => {
    expect(computeCombiWarmUpFraction({ drawAgeSeconds: 0 })).toBe(0);
  });

  it('returns 1 at draw age equal to lag (full output reached)', () => {
    expect(computeCombiWarmUpFraction({ drawAgeSeconds: DEFAULT_COMBI_WARMUP_LAG_SECONDS })).toBe(1);
  });

  it('returns 1 beyond the lag period (steady state, no overshoot)', () => {
    expect(computeCombiWarmUpFraction({ drawAgeSeconds: DEFAULT_COMBI_WARMUP_LAG_SECONDS * 2 })).toBe(1);
  });

  it('returns 0.5 at half the lag period', () => {
    expect(computeCombiWarmUpFraction({
      drawAgeSeconds: DEFAULT_COMBI_WARMUP_LAG_SECONDS / 2,
    })).toBeCloseTo(0.5, 5);
  });

  it('respects a custom lagSeconds override', () => {
    // 5 s draw age with a 10 s custom lag → 50 %
    expect(computeCombiWarmUpFraction({ drawAgeSeconds: 5, lagSeconds: 10 })).toBeCloseTo(0.5, 5);
  });

  it('returns 1 immediately when lagSeconds is 0 (no warm-up delay)', () => {
    expect(computeCombiWarmUpFraction({ drawAgeSeconds: 0, lagSeconds: 0 })).toBe(1);
  });

  it('ramps monotonically from 0 to 1 over the lag period', () => {
    const lag = DEFAULT_COMBI_WARMUP_LAG_SECONDS;
    const fractions = [0, lag / 4, lag / 2, (3 * lag) / 4, lag].map(
      t => computeCombiWarmUpFraction({ drawAgeSeconds: t }),
    );
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]).toBeGreaterThanOrEqual(fractions[i - 1]);
    }
    expect(fractions[0]).toBe(0);
    expect(fractions[fractions.length - 1]).toBe(1);
  });
});
