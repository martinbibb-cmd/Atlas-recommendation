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
