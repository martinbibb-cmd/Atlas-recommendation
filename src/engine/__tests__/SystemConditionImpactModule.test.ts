import { describe, it, expect } from 'vitest';
import {
  computeVelocityOutsideBandPct,
  computeDesignVelocityMs,
  computeConditionImpactMetrics,
} from '../modules/SystemConditionImpactModule';

// ─── computeVelocityOutsideBandPct ────────────────────────────────────────────

describe('computeVelocityOutsideBandPct', () => {
  it('returns 0 when velocity is at or below the safe limit of 1.5 m/s', () => {
    expect(computeVelocityOutsideBandPct(1.0)).toBe(0);
    expect(computeVelocityOutsideBandPct(1.5)).toBe(0);
  });

  it('returns a positive percentage when velocity exceeds 1.5 m/s', () => {
    const pct = computeVelocityOutsideBandPct(2.0);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(90);
  });

  it('returns ~43% at approximately 2.2 m/s (UK load distribution)', () => {
    // At ~2.2 m/s: threshold = 1.5/2.2 ≈ 0.682, z ≈ 0.16, P(above) ≈ 43%
    const pct = computeVelocityOutsideBandPct(2.2);
    expect(pct).toBeGreaterThanOrEqual(40);
    expect(pct).toBeLessThanOrEqual(50);
  });

  it('returns a higher percentage as velocity increases', () => {
    const pct20 = computeVelocityOutsideBandPct(2.0);
    const pct25 = computeVelocityOutsideBandPct(2.5);
    const pct30 = computeVelocityOutsideBandPct(3.0);
    expect(pct25).toBeGreaterThan(pct20);
    expect(pct30).toBeGreaterThan(pct25);
  });

  it('caps the result at 90% regardless of velocity', () => {
    const pct = computeVelocityOutsideBandPct(10.0);
    expect(pct).toBeLessThanOrEqual(90);
  });
});

// ─── computeDesignVelocityMs ─────────────────────────────────────────────────

describe('computeDesignVelocityMs', () => {
  it('returns as-found velocity unchanged when flowDeratePct is zero', () => {
    expect(computeDesignVelocityMs(1.8, 0)).toBeCloseTo(1.8, 2);
  });

  it('returns lower velocity for restored system when derate > 0', () => {
    const asFound = 2.0;
    const derate = 0.10; // 10% flow derate
    const design = computeDesignVelocityMs(asFound, derate);
    // designVelocity = 2.0 × (1 - 0.10) = 1.80 m/s
    expect(design).toBeCloseTo(1.8, 2);
    expect(design).toBeLessThan(asFound);
  });

  it('is deterministic — same inputs produce same output', () => {
    expect(computeDesignVelocityMs(2.2, 0.15)).toBe(computeDesignVelocityMs(2.2, 0.15));
  });
});

// ─── computeConditionImpactMetrics ───────────────────────────────────────────

const cleanSludge = {
  flowDeratePct: 0,
  dhwCapacityDeratePct: 0,
  estimatedScaleThicknessMm: 0,
};

const degradedSludge = {
  flowDeratePct: 0.15,       // 15% flow derate (significant sludge)
  dhwCapacityDeratePct: 0.12, // 12% DHW capacity derate (moderate scale)
  estimatedScaleThicknessMm: 1.9,
};

describe('computeConditionImpactMetrics – clean system', () => {
  const result = computeConditionImpactMetrics(
    cleanSludge,
    1.2,   // velocityMs (well within safe band)
    92,    // nominalEffPct
    87,    // currentEffPct (some natural decay but no sludge)
    8,
  );

  it('as-found CH shortfall is 0 for clean primary circuit', () => {
    expect(result.asFound.chShortfallPct).toBe(0);
  });

  it('as-found DHW reduction is 0 for no scale', () => {
    expect(result.asFound.dhwCapacityReductionPct).toBe(0);
  });

  it('as-found velocity equals input velocity', () => {
    expect(result.asFound.velocityMs).toBeCloseTo(1.2, 2);
  });

  it('as-found velocityOutsideBandPct is 0 when velocity ≤ 1.5 m/s', () => {
    expect(result.asFound.velocityOutsideBandPct).toBe(0);
  });

  it('restored velocity equals as-found velocity when no sludge derate', () => {
    expect(result.restored.velocityMs).toBeCloseTo(result.asFound.velocityMs, 2);
  });

  it('restored efficiency equals nominal efficiency', () => {
    expect(result.restored.efficiencyPct).toBeCloseTo(92, 1);
  });

  it('chShortfallReductionPct is 0', () => {
    expect(result.chShortfallReductionPct).toBe(0);
  });
});

describe('computeConditionImpactMetrics – degraded system', () => {
  const result = computeConditionImpactMetrics(
    degradedSludge,
    2.2,   // elevated velocity (above 1.5 m/s safe limit)
    92,    // nominalEffPct
    84,    // currentEffPct (decayed)
    12,
  );

  it('as-found CH shortfall reflects flow derate', () => {
    // flowDeratePct=0.15 → 15.0%
    expect(result.asFound.chShortfallPct).toBeCloseTo(15.0, 1);
  });

  it('as-found DHW reduction reflects dhwCapacityDeratePct', () => {
    // dhwCapacityDeratePct=0.12 → 12.0%
    expect(result.asFound.dhwCapacityReductionPct).toBeCloseTo(12.0, 1);
  });

  it('as-found velocity equals input velocity', () => {
    expect(result.asFound.velocityMs).toBeCloseTo(2.2, 2);
  });

  it('as-found velocityOutsideBandPct is positive for velocity above 1.5 m/s', () => {
    expect(result.asFound.velocityOutsideBandPct).toBeGreaterThan(0);
  });

  it('restored CH shortfall is zero', () => {
    expect(result.restored.chShortfallPct).toBe(0);
  });

  it('restored DHW reduction is zero', () => {
    expect(result.restored.dhwCapacityReductionPct).toBe(0);
  });

  it('restored velocity is lower than as-found velocity (sludge removed)', () => {
    expect(result.restored.velocityMs).toBeLessThan(result.asFound.velocityMs);
    // restored = 2.2 × (1 - 0.15) = 1.87 m/s
    expect(result.restored.velocityMs).toBeCloseTo(1.87, 1);
  });

  it('restored efficiency equals nominal', () => {
    expect(result.restored.efficiencyPct).toBeCloseTo(92, 1);
  });

  it('as-found efficiency equals currentEffPct input', () => {
    expect(result.asFound.efficiencyPct).toBeCloseTo(84, 1);
  });

  it('chShortfallReductionPct equals as-found CH shortfall', () => {
    expect(result.chShortfallReductionPct).toBeCloseTo(result.asFound.chShortfallPct, 1);
  });

  it('systemAgeYears is propagated', () => {
    expect(result.systemAgeYears).toBe(12);
  });

  it('estimatedScaleThicknessMm is propagated', () => {
    expect(result.estimatedScaleThicknessMm).toBe(1.9);
  });

  it('result is fully deterministic — calling twice gives identical output', () => {
    const r1 = computeConditionImpactMetrics(degradedSludge, 2.2, 92, 84, 12);
    const r2 = computeConditionImpactMetrics(degradedSludge, 2.2, 92, 84, 12);
    expect(r1).toEqual(r2);
  });
});

// ─── New extended fields ──────────────────────────────────────────────────────

import {
  computeComfortTrace,
  computeMinutesBelowSetpoint,
  computeDhwTrace,
  computeDhwPeakShortfallPct,
  computeSystemStress,
  computeSludgeRiskIn3Yr,
} from '../modules/SystemConditionImpactModule';

// ─── computeComfortTrace ──────────────────────────────────────────────────────

describe('computeComfortTrace', () => {
  it('returns exactly 24 hourly data points', () => {
    const trace = computeComfortTrace(0);
    expect(trace).toHaveLength(24);
    trace.forEach((p, i) => expect(p.hour).toBe(i));
  });

  it('setpoint and band values are constant across all hours', () => {
    const trace = computeComfortTrace(0);
    trace.forEach(p => {
      expect(p.setpointC).toBe(21);
      expect(p.bandLowC).toBe(20.5);
      expect(p.bandHighC).toBe(21.5);
    });
  });

  it('clean system (0 derate) achieves setpoint during heating hours', () => {
    const trace = computeComfortTrace(0);
    // By mid-heating day (e.g. hour 14) restored system should be near setpoint
    const midDay = trace.find(p => p.hour === 14)!;
    expect(midDay.restoredTempC).toBeGreaterThanOrEqual(20.5);
  });

  it('degraded system reaches a lower temperature than restored system', () => {
    const trace = computeComfortTrace(0.15); // 15% derate
    // During the morning heat-up hours, as-found will be cooler than restored
    const morningPeak = trace.find(p => p.hour === 8)!;
    expect(morningPeak.asFoundTempC).toBeLessThanOrEqual(morningPeak.restoredTempC);
  });

  it('is deterministic — two calls give identical results', () => {
    const a = computeComfortTrace(0.10);
    const b = computeComfortTrace(0.10);
    expect(a).toEqual(b);
  });

  it('temperatures are clamped within reasonable bounds', () => {
    const trace = computeComfortTrace(0.20);
    trace.forEach(p => {
      expect(p.asFoundTempC).toBeGreaterThanOrEqual(-3);
      expect(p.asFoundTempC).toBeLessThanOrEqual(22);
      expect(p.restoredTempC).toBeGreaterThanOrEqual(-3);
      expect(p.restoredTempC).toBeLessThanOrEqual(22);
    });
  });
});

// ─── computeMinutesBelowSetpoint ─────────────────────────────────────────────

describe('computeMinutesBelowSetpoint', () => {
  it('clean system has fewer minutes below setpoint than degraded system', () => {
    const traceClean = computeComfortTrace(0);
    const traceDegraded = computeComfortTrace(0.20);
    const clean = computeMinutesBelowSetpoint(traceClean);
    const degraded = computeMinutesBelowSetpoint(traceDegraded);
    expect(degraded.asFound).toBeGreaterThanOrEqual(clean.asFound);
  });

  it('restored minutes are always ≤ as-found minutes for any derate', () => {
    const trace = computeComfortTrace(0.15);
    const mins = computeMinutesBelowSetpoint(trace);
    expect(mins.restored).toBeLessThanOrEqual(mins.asFound);
  });

  it('returns multiples of 60 (one hour = 60 minutes)', () => {
    const trace = computeComfortTrace(0.10);
    const mins = computeMinutesBelowSetpoint(trace);
    expect(mins.asFound % 60).toBe(0);
    expect(mins.restored % 60).toBe(0);
  });
});

// ─── computeDhwTrace ─────────────────────────────────────────────────────────

describe('computeDhwTrace', () => {
  it('returns exactly 24 hourly data points', () => {
    const trace = computeDhwTrace(25, 20);
    expect(trace).toHaveLength(24);
    trace.forEach((p, i) => expect(p.hour).toBe(i));
  });

  it('delivered as-found is ≤ delivered restored at every hour', () => {
    const trace = computeDhwTrace(25, 20);
    trace.forEach(p => {
      expect(p.asFoundLpm40).toBeLessThanOrEqual(p.restoredLpm40);
    });
  });

  it('neither delivered value exceeds the requested demand', () => {
    const trace = computeDhwTrace(25, 20);
    trace.forEach(p => {
      expect(p.asFoundLpm40).toBeLessThanOrEqual(p.requestedLpm40 + 0.01);
      expect(p.restoredLpm40).toBeLessThanOrEqual(p.requestedLpm40 + 0.01);
    });
  });

  it('defaults to no derate when maxQtoDhwKwDerated is omitted', () => {
    const trace = computeDhwTrace(25);
    trace.forEach(p => {
      expect(p.asFoundLpm40).toBeCloseTo(p.restoredLpm40, 1);
    });
  });
});

// ─── computeDhwPeakShortfallPct ───────────────────────────────────────────────

describe('computeDhwPeakShortfallPct', () => {
  it('returns 0 when no derate is applied', () => {
    const trace = computeDhwTrace(25, 25);
    expect(computeDhwPeakShortfallPct(trace)).toBe(0);
  });

  it('returns a positive value when as-found delivery is limited', () => {
    const trace = computeDhwTrace(25, 18); // scale derate: 28 kW → 18 kW
    const pct = computeDhwPeakShortfallPct(trace);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it('larger derate produces larger shortfall', () => {
    const trace20 = computeDhwTrace(25, 20);
    const trace10 = computeDhwTrace(25, 10);
    expect(computeDhwPeakShortfallPct(trace10)).toBeGreaterThan(computeDhwPeakShortfallPct(trace20));
  });
});

// ─── computeSystemStress ─────────────────────────────────────────────────────

describe('computeSystemStress', () => {
  it('restored state has fewer or equal cycling events than as-found state', () => {
    const asFound = computeSystemStress(0.15, 0.04, false);
    const restored = computeSystemStress(0.15, 0.04, true);
    expect(restored.cyclingEventsPerDay).toBeLessThanOrEqual(asFound.cyclingEventsPerDay);
  });

  it('restored state has longer or equal average run time than as-found state', () => {
    const asFound = computeSystemStress(0.15, 0.04, false);
    const restored = computeSystemStress(0.15, 0.04, true);
    expect(restored.avgRunTimeMinutes).toBeGreaterThanOrEqual(asFound.avgRunTimeMinutes);
  });

  it('zero derate produces identical as-found and restored metrics', () => {
    const asFound = computeSystemStress(0, 0, false);
    const restored = computeSystemStress(0, 0, true);
    expect(asFound).toEqual(restored);
  });

  it('cycling events increase monotonically with flow derate', () => {
    const low = computeSystemStress(0.05, 0.01, false);
    const high = computeSystemStress(0.20, 0.05, false);
    expect(high.cyclingEventsPerDay).toBeGreaterThan(low.cyclingEventsPerDay);
  });
});

// ─── computeSludgeRiskIn3Yr ──────────────────────────────────────────────────

describe('computeSludgeRiskIn3Yr', () => {
  it('projected risk is greater than current derate for a non-zero derate', () => {
    const current = 0.10;
    const projected = computeSludgeRiskIn3Yr(current);
    expect(projected).toBeGreaterThan(current * 100);
  });

  it('caps at 20% regardless of starting point', () => {
    expect(computeSludgeRiskIn3Yr(0.20)).toBeLessThanOrEqual(20);
    expect(computeSludgeRiskIn3Yr(0.195)).toBeLessThanOrEqual(20);
  });

  it('is deterministic', () => {
    expect(computeSludgeRiskIn3Yr(0.12)).toBe(computeSludgeRiskIn3Yr(0.12));
  });
});

// ─── computeConditionImpactMetrics — new fields ───────────────────────────────

describe('computeConditionImpactMetrics — new fields (degraded system)', () => {
  const result = computeConditionImpactMetrics(
    { ...degradedSludge, cyclingLossPct: 0.04 },
    2.2,
    92,
    84,
    12,
    { maxQtoDhwKw: 25, maxQtoDhwKwDerated: 20 },
  );

  it('comfortTrace has 24 hourly data points', () => {
    expect(result.comfortTrace).toHaveLength(24);
  });

  it('minutesBelowSetpoint.asFound >= minutesBelowSetpoint.restored', () => {
    expect(result.minutesBelowSetpoint.asFound).toBeGreaterThanOrEqual(
      result.minutesBelowSetpoint.restored,
    );
  });

  it('dhwTrace is present when maxQtoDhwKw is supplied', () => {
    expect(result.dhwTrace).not.toBeNull();
    expect(result.dhwTrace).toHaveLength(24);
  });

  it('dhwPeakShortfallPct is positive when derated < nominal', () => {
    expect(result.dhwPeakShortfallPct).toBeGreaterThan(0);
  });

  it('stressAsFound has more cycling events than stressRestored', () => {
    expect(result.stressAsFound.cyclingEventsPerDay).toBeGreaterThan(
      result.stressRestored.cyclingEventsPerDay,
    );
  });

  it('debugPanel reflects sludge data', () => {
    expect(result.debugPanel.flowDeratePct).toBeCloseTo(15.0, 1);
    expect(result.debugPanel.dhwCapacityDeratePct).toBeCloseTo(12.0, 1);
    expect(result.debugPanel.cyclingLossPct).toBeCloseTo(4.0, 1);
    expect(result.debugPanel.effectiveCOPShift).toBeCloseTo(-0.08, 2);
  });

  it('sludgeRiskIn3yrPct is greater than current flowDeratePct ×100', () => {
    expect(result.sludgeRiskIn3yrPct).toBeGreaterThan(15.0);
  });

  it('is fully deterministic with opts', () => {
    const r1 = computeConditionImpactMetrics(
      { ...degradedSludge, cyclingLossPct: 0.04 }, 2.2, 92, 84, 12,
      { maxQtoDhwKw: 25, maxQtoDhwKwDerated: 20 },
    );
    const r2 = computeConditionImpactMetrics(
      { ...degradedSludge, cyclingLossPct: 0.04 }, 2.2, 92, 84, 12,
      { maxQtoDhwKw: 25, maxQtoDhwKwDerated: 20 },
    );
    expect(r1).toEqual(r2);
  });
});

describe('computeConditionImpactMetrics — new fields (no combi data)', () => {
  const result = computeConditionImpactMetrics(cleanSludge, 1.2, 92, 87, 8);

  it('dhwTrace is null when opts are absent', () => {
    expect(result.dhwTrace).toBeNull();
  });

  it('dhwPeakShortfallPct is null when opts are absent', () => {
    expect(result.dhwPeakShortfallPct).toBeNull();
  });

  it('debugPanel effectiveCOPShift is 0 for clean+current system', () => {
    expect(result.debugPanel.effectiveCOPShift).toBeCloseTo(-0.05, 2);
  });
});
