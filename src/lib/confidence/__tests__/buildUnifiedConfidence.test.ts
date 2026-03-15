// src/lib/confidence/__tests__/buildUnifiedConfidence.test.ts
//
// Unit tests for buildUnifiedConfidence — PR9 canonical confidence builder.
//
// Coverage:
//   - Deterministic output from the same input
//   - Type and range guards on all output fields
//   - Hard-constraint scenarios increase physics confidence
//   - Assumption-heavy scenarios reduce physics confidence
//   - Close option scores reduce decision confidence
//   - Measured evidence increases data confidence
//   - Missing evidence reduces data confidence
//   - nextBestChecks surface actionable items for missing/inferred fields
//   - Level thresholds (≥75 high, ≥50 medium, <50 low)
//   - Weighted formula: dataPct×0.5 + physicsPct×0.3 + decisionPct×0.2

import { describe, it, expect } from 'vitest';
import {
  buildUnifiedConfidence,
  type UnifiedConfidence,
} from '../buildUnifiedConfidence';
import type { EngineOutputV1, EvidenceItemV1, LimiterV1 } from '../../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function minimalOutput(overrides: Partial<EngineOutputV1> = {}): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'Unvented cylinder system' },
    explainers: [],
    ...overrides,
  };
}

function measuredEvidence(id: string, label: string): EvidenceItemV1 {
  return {
    id,
    fieldPath: id,
    label,
    value: 'test',
    source: 'manual',
    confidence: 'high',
    affectsOptionIds: ['combi'],
  };
}

function inferredEvidence(id: string, label: string): EvidenceItemV1 {
  return {
    id,
    fieldPath: id,
    label,
    value: 'test',
    source: 'assumed',
    confidence: 'medium',
    affectsOptionIds: ['combi'],
  };
}

function placeholderEvidence(id: string, label: string): EvidenceItemV1 {
  return {
    id,
    fieldPath: id,
    label,
    value: 'unknown',
    source: 'placeholder',
    confidence: 'low',
    affectsOptionIds: ['combi'],
  };
}

function makeOption(
  id: EngineOutputV1['options'] extends Array<infer T> ? T['id'] : never,
  score: number,
): NonNullable<EngineOutputV1['options']>[0] {
  return {
    id,
    label: id,
    status: 'viable',
    headline: `${id} headline`,
    why: [`${id} why`],
    requirements: [],
    typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    heat: { status: 'ok', headline: 'Heat ok', bullets: [] },
    dhw: { status: 'ok', headline: 'DHW ok', bullets: [] },
    engineering: { status: 'ok', headline: 'Engineering ok', bullets: [] },
    sensitivities: [],
    score: {
      total: score,
      breakdown: [],
    },
  };
}

function makeHardLimiter(
  id: LimiterV1['id'],
  sourceKind: 'measured' | 'assumed',
  severity: LimiterV1['severity'] = 'fail',
): LimiterV1 {
  return {
    id,
    title: `${id} limiter`,
    severity,
    observed: { label: 'observed', value: 10, unit: 'kW' },
    limit: { label: 'limit', value: 5, unit: 'kW' },
    impact: { summary: 'Constraint active' },
    confidence: 'high',
    sources: [{ kind: sourceKind }],
    suggestedFixes: [],
  };
}

function minimalEngineInput(overrides: Partial<EngineInputV2_3> = {}): EngineInputV2_3 {
  return {
    postcode: 'SW1A 1AA',
    dynamicMainsPressure: 2.0,
    bathroomCount: 1,
    buildingMass: 'medium',
    primaryPipeDiameter: 22,
    heatLossWatts: 8000,
    radiatorCount: 8,
    hasLoftConversion: false,
    returnWaterTemp: 55,
    occupancySignature: 'home_all_day',
    highOccupancy: false,
    preferCombi: false,
    ...overrides,
  };
}

// ─── Type and range guards ────────────────────────────────────────────────────

describe('buildUnifiedConfidence — type and range guards', () => {
  it('returns all required fields', () => {
    const result = buildUnifiedConfidence(minimalOutput());
    const keys: (keyof UnifiedConfidence)[] = [
      'overallPct', 'level', 'dataPct', 'physicsPct', 'decisionPct',
      'measured', 'inferred', 'missing', 'nextBestChecks',
    ];
    for (const key of keys) {
      expect(result).toHaveProperty(key);
    }
  });

  it('overallPct is between 0 and 100 inclusive', () => {
    const result = buildUnifiedConfidence(minimalOutput());
    expect(result.overallPct).toBeGreaterThanOrEqual(0);
    expect(result.overallPct).toBeLessThanOrEqual(100);
  });

  it('dataPct is between 0 and 100 inclusive', () => {
    const result = buildUnifiedConfidence(minimalOutput());
    expect(result.dataPct).toBeGreaterThanOrEqual(0);
    expect(result.dataPct).toBeLessThanOrEqual(100);
  });

  it('physicsPct is between 40 and 95 inclusive', () => {
    const result = buildUnifiedConfidence(minimalOutput());
    expect(result.physicsPct).toBeGreaterThanOrEqual(40);
    expect(result.physicsPct).toBeLessThanOrEqual(95);
  });

  it('decisionPct is between 50 and 90 inclusive', () => {
    const output = minimalOutput({
      options: [makeOption('combi', 70), makeOption('stored_unvented', 68)],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.decisionPct).toBeGreaterThanOrEqual(50);
    expect(result.decisionPct).toBeLessThanOrEqual(90);
  });

  it('level is one of high | medium | low', () => {
    const result = buildUnifiedConfidence(minimalOutput());
    expect(['high', 'medium', 'low']).toContain(result.level);
  });

  it('measured, inferred, missing, nextBestChecks are arrays of strings', () => {
    const result = buildUnifiedConfidence(minimalOutput());
    expect(Array.isArray(result.measured)).toBe(true);
    expect(Array.isArray(result.inferred)).toBe(true);
    expect(Array.isArray(result.missing)).toBe(true);
    expect(Array.isArray(result.nextBestChecks)).toBe(true);
    for (const item of [...result.measured, ...result.inferred, ...result.missing]) {
      expect(typeof item).toBe('string');
    }
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('buildUnifiedConfidence — determinism', () => {
  it('produces identical output for the same input (no Math.random)', () => {
    const output = minimalOutput({
      evidence: [measuredEvidence('ev-heat-loss', 'Design heat loss')],
    });
    const r1 = buildUnifiedConfidence(output);
    const r2 = buildUnifiedConfidence(output);
    expect(r1).toEqual(r2);
  });

  it('produces identical output across multiple calls', () => {
    const output = minimalOutput({
      options: [makeOption('combi', 80), makeOption('stored_unvented', 65)],
      evidence: [
        measuredEvidence('ev-heat-loss', 'Heat loss'),
        measuredEvidence('ev-primary-pipe', 'Primary pipe'),
      ],
    });
    const results = Array.from({ length: 5 }, () => buildUnifiedConfidence(output));
    for (const r of results) {
      expect(r.overallPct).toBe(results[0].overallPct);
      expect(r.level).toBe(results[0].level);
    }
  });
});

// ─── Data confidence ──────────────────────────────────────────────────────────

describe('buildUnifiedConfidence — data confidence', () => {
  it('dataPct is higher with all critical fields measured', () => {
    const allMeasured = minimalOutput({
      evidence: [
        measuredEvidence('ev-heat-loss', 'Design heat loss'),
        measuredEvidence('ev-mains-pressure-dynamic', 'Mains pressure'),
        measuredEvidence('ev-primary-pipe', 'Primary pipe'),
        measuredEvidence('ev-combi-simultaneity', 'Bathrooms'),
        measuredEvidence('ev-available-space', 'Available space'),
        measuredEvidence('ev-mains-flow', 'Mains flow'),
        measuredEvidence('ev-cylinder-volume', 'Cylinder volume'),
      ],
    });
    const allInferred = minimalOutput({
      evidence: [
        inferredEvidence('ev-heat-loss', 'Design heat loss'),
        inferredEvidence('ev-mains-pressure-dynamic', 'Mains pressure'),
        inferredEvidence('ev-primary-pipe', 'Primary pipe'),
        inferredEvidence('ev-combi-simultaneity', 'Bathrooms'),
        inferredEvidence('ev-available-space', 'Available space'),
        inferredEvidence('ev-mains-flow', 'Mains flow'),
        inferredEvidence('ev-cylinder-volume', 'Cylinder volume'),
      ],
    });
    const measured = buildUnifiedConfidence(allMeasured);
    const inferred = buildUnifiedConfidence(allInferred);
    expect(measured.dataPct).toBeGreaterThan(inferred.dataPct);
  });

  it('all measured fields → dataPct near 100', () => {
    const output = minimalOutput({
      evidence: [
        measuredEvidence('ev-heat-loss', 'Design heat loss'),
        measuredEvidence('ev-mains-pressure-dynamic', 'Mains pressure'),
        measuredEvidence('ev-primary-pipe', 'Primary pipe'),
        measuredEvidence('ev-combi-simultaneity', 'Bathrooms'),
        measuredEvidence('ev-available-space', 'Available space'),
        measuredEvidence('ev-mains-flow', 'Mains flow'),
        measuredEvidence('ev-cylinder-volume', 'Cylinder volume'),
      ],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.dataPct).toBe(100);
  });

  it('all placeholder fields → dataPct near 0', () => {
    const output = minimalOutput({
      evidence: [
        placeholderEvidence('ev-heat-loss', 'Design heat loss'),
        placeholderEvidence('ev-mains-pressure-dynamic', 'Mains pressure'),
        placeholderEvidence('ev-primary-pipe', 'Primary pipe'),
        placeholderEvidence('ev-combi-simultaneity', 'Bathrooms'),
        placeholderEvidence('ev-available-space', 'Available space'),
        placeholderEvidence('ev-mains-flow', 'Mains flow'),
        placeholderEvidence('ev-cylinder-volume', 'Cylinder volume'),
      ],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.dataPct).toBe(0);
  });

  it('measured fields appear in measured[], not inferred[] or missing[]', () => {
    const output = minimalOutput({
      evidence: [measuredEvidence('ev-heat-loss', 'Design heat loss')],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.measured).toContain('Design heat loss');
    expect(result.inferred).not.toContain('Design heat loss');
    expect(result.missing).not.toContain('Design heat loss');
  });

  it('assumed evidence appears in inferred[], not measured[]', () => {
    const output = minimalOutput({
      evidence: [inferredEvidence('ev-primary-pipe', 'Primary pipe size')],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.inferred).toContain('Primary pipe size');
    expect(result.measured).not.toContain('Primary pipe size');
  });

  it('placeholder evidence appears in missing[], not inferred[]', () => {
    const output = minimalOutput({
      evidence: [placeholderEvidence('ev-available-space', 'Available cylinder space')],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.missing).toContain('Available cylinder space');
    expect(result.inferred).not.toContain('Available cylinder space');
  });

  it('nextBestChecks are provided for missing fields', () => {
    const output = minimalOutput({
      evidence: [placeholderEvidence('ev-heat-loss', 'Design heat loss')],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.nextBestChecks.length).toBeGreaterThan(0);
    expect(result.nextBestChecks[0]).toContain('heat loss');
  });

  it('nextBestChecks respect max 3 items', () => {
    const output = minimalOutput({
      evidence: [
        placeholderEvidence('ev-heat-loss', 'Heat loss'),
        placeholderEvidence('ev-mains-pressure-dynamic', 'Mains pressure'),
        placeholderEvidence('ev-primary-pipe', 'Primary pipe'),
        placeholderEvidence('ev-available-space', 'Available space'),
        placeholderEvidence('ev-combi-simultaneity', 'Bathrooms'),
      ],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.nextBestChecks.length).toBeLessThanOrEqual(3);
  });
});

// ─── Data confidence via engine input ────────────────────────────────────────

describe('buildUnifiedConfidence — data confidence via engine input', () => {
  it('mainsDynamicFlowLpmKnown=true adds mains flow to measured', () => {
    const output = minimalOutput();
    const input = minimalEngineInput({ mainsDynamicFlowLpmKnown: true, mainsDynamicFlowLpm: 15 });
    const result = buildUnifiedConfidence(output, input);
    expect(result.measured).toContain('Mains flow rate');
  });

  it('mainsDynamicFlowLpm without known flag adds to inferred', () => {
    const output = minimalOutput();
    const input = minimalEngineInput({ mainsDynamicFlowLpm: 12 });
    const result = buildUnifiedConfidence(output, input);
    expect(result.inferred).toContain('Mains flow rate');
    expect(result.measured).not.toContain('Mains flow rate');
  });

  it('no mainsDynamicFlowLpm adds to missing', () => {
    const output = minimalOutput();
    const input = minimalEngineInput({ mainsDynamicFlowLpm: undefined });
    const result = buildUnifiedConfidence(output, input);
    expect(result.missing).toContain('Mains flow rate');
  });

  it('cylinderVolumeLitres known adds cylinder volume to measured', () => {
    const output = minimalOutput();
    const input = minimalEngineInput({ cylinderVolumeLitres: 150 });
    const result = buildUnifiedConfidence(output, input);
    expect(result.measured).toContain('Current cylinder type / volume');
  });

  it('currentCylinderPresent=false adds cylinder volume to measured (known-absent)', () => {
    const output = minimalOutput();
    const input = minimalEngineInput({ currentCylinderPresent: false });
    const result = buildUnifiedConfidence(output, input);
    expect(result.measured).toContain('Current cylinder type / volume');
  });
});

// ─── Physics confidence ───────────────────────────────────────────────────────

describe('buildUnifiedConfidence — physics confidence', () => {
  it('hard constraint with measured source increases physicsPct above base', () => {
    const withLimiter = minimalOutput({
      limiters: {
        limiters: [
          makeHardLimiter('combi-concurrency-constraint', 'measured', 'fail'),
        ],
      },
    });
    const withoutLimiter = minimalOutput();
    const withResult    = buildUnifiedConfidence(withLimiter);
    const withoutResult = buildUnifiedConfidence(withoutLimiter);
    expect(withResult.physicsPct).toBeGreaterThan(withoutResult.physicsPct);
  });

  it('hard constraint with assumed source decreases physicsPct below base', () => {
    const withAssumedLimiter = minimalOutput({
      limiters: {
        limiters: [
          makeHardLimiter('mains-flow-constraint', 'assumed', 'fail'),
        ],
      },
    });
    const noLimiter = minimalOutput();
    const withResult   = buildUnifiedConfidence(withAssumedLimiter);
    const noResult     = buildUnifiedConfidence(noLimiter);
    expect(withResult.physicsPct).toBeLessThan(noResult.physicsPct);
  });

  it('multiple warn assumptions reduce physicsPct', () => {
    const withAssumptions = minimalOutput({
      verdict: {
        title: 'Caution',
        status: 'caution',
        reasons: [],
        confidence: { level: 'medium', reasons: [] },
        assumptionsUsed: [
          {
            id: 'default_dhw_schedule' as never,
            title: 'Default DHW schedule',
            detail: 'Using default schedule',
            affects: ['recommendation'],
            severity: 'warn',
          },
          {
            id: 'inferred_emitter_output' as never,
            title: 'Inferred emitter output',
            detail: 'Emitter output not verified',
            affects: ['recommendation'],
            severity: 'warn',
          },
        ],
      },
    });
    const noAssumptions = minimalOutput();
    const withResult  = buildUnifiedConfidence(withAssumptions);
    const noResult    = buildUnifiedConfidence(noAssumptions);
    expect(withResult.physicsPct).toBeLessThan(noResult.physicsPct);
  });

  it('assumed heat-loss evidence penalises physicsPct', () => {
    const withAssumedHeatLoss = minimalOutput({
      evidence: [inferredEvidence('ev-heat-loss', 'Design heat loss')],
    });
    const withMeasuredHeatLoss = minimalOutput({
      evidence: [measuredEvidence('ev-heat-loss', 'Design heat loss')],
    });
    const assumed  = buildUnifiedConfidence(withAssumedHeatLoss);
    const measured = buildUnifiedConfidence(withMeasuredHeatLoss);
    expect(assumed.physicsPct).toBeLessThanOrEqual(measured.physicsPct);
  });
});

// ─── Decision confidence ──────────────────────────────────────────────────────

describe('buildUnifiedConfidence — decision confidence', () => {
  it('large gap between top 2 options → high decisionPct', () => {
    const output = minimalOutput({
      options: [makeOption('stored_unvented', 85), makeOption('combi', 60)],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.decisionPct).toBe(90);
  });

  it('small gap between top 2 options → low decisionPct', () => {
    const output = minimalOutput({
      options: [makeOption('stored_unvented', 82), makeOption('combi', 80)],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.decisionPct).toBe(50);
  });

  it('moderate gap → medium decisionPct', () => {
    const output = minimalOutput({
      options: [makeOption('stored_unvented', 82), makeOption('combi', 72)],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.decisionPct).toBe(70);
  });

  it('single viable option → high decisionPct', () => {
    const output = minimalOutput({
      options: [makeOption('stored_unvented', 80)],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.decisionPct).toBe(88);
  });

  it('no option scores → falls back to engine confidence level', () => {
    const highConfOutput = minimalOutput({
      verdict: {
        title: 'High confidence',
        status: 'good',
        reasons: [],
        confidence: { level: 'high', reasons: [] },
        assumptionsUsed: [],
      },
    });
    const lowConfOutput = minimalOutput({
      verdict: {
        title: 'Low confidence',
        status: 'fail',
        reasons: [],
        confidence: { level: 'low', reasons: [] },
        assumptionsUsed: [],
      },
    });
    const highResult = buildUnifiedConfidence(highConfOutput);
    const lowResult  = buildUnifiedConfidence(lowConfOutput);
    expect(highResult.decisionPct).toBeGreaterThan(lowResult.decisionPct);
  });
});

// ─── Weighted formula and level thresholds ────────────────────────────────────

describe('buildUnifiedConfidence — weighted formula and level thresholds', () => {
  it('overallPct = dataPct×0.5 + physicsPct×0.3 + decisionPct×0.2', () => {
    // All measured evidence → dataPct = 100
    // No limiters/assumptions → physicsPct = 70 (base)
    // Large gap in options → decisionPct = 90
    const output = minimalOutput({
      evidence: [
        measuredEvidence('ev-heat-loss', 'Heat loss'),
        measuredEvidence('ev-mains-pressure-dynamic', 'Mains pressure'),
        measuredEvidence('ev-primary-pipe', 'Primary pipe'),
        measuredEvidence('ev-combi-simultaneity', 'Bathrooms'),
        measuredEvidence('ev-available-space', 'Available space'),
        measuredEvidence('ev-mains-flow', 'Mains flow'),
        measuredEvidence('ev-cylinder-volume', 'Cylinder volume'),
      ],
      options: [makeOption('stored_unvented', 85), makeOption('combi', 60)],
    });
    const result = buildUnifiedConfidence(output);
    const expected = Math.round(100 * 0.5 + 70 * 0.3 + 90 * 0.2);
    expect(result.overallPct).toBe(expected); // 50 + 21 + 18 = 89
  });

  it('level = "high" when overallPct >= 75', () => {
    // All measured + large gap → should be high
    const output = minimalOutput({
      evidence: [
        measuredEvidence('ev-heat-loss', 'Heat loss'),
        measuredEvidence('ev-mains-pressure-dynamic', 'Mains pressure'),
        measuredEvidence('ev-primary-pipe', 'Primary pipe'),
        measuredEvidence('ev-combi-simultaneity', 'Bathrooms'),
        measuredEvidence('ev-available-space', 'Available space'),
        measuredEvidence('ev-mains-flow', 'Mains flow'),
        measuredEvidence('ev-cylinder-volume', 'Cylinder volume'),
      ],
      options: [makeOption('stored_unvented', 85), makeOption('combi', 60)],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.level).toBe('high');
  });

  it('level = "medium" for typical mid-range scenario', () => {
    // Half the fields measured, no hard constraints, close options → medium
    const output = minimalOutput({
      evidence: [
        measuredEvidence('ev-heat-loss', 'Heat loss'),
        inferredEvidence('ev-mains-pressure-dynamic', 'Mains pressure'),
        inferredEvidence('ev-primary-pipe', 'Primary pipe'),
        placeholderEvidence('ev-available-space', 'Available space'),
      ],
      options: [makeOption('stored_unvented', 75), makeOption('combi', 70)],
    });
    const result = buildUnifiedConfidence(output);
    expect(result.overallPct).toBeGreaterThanOrEqual(50);
    expect(result.overallPct).toBeLessThan(75);
    expect(result.level).toBe('medium');
  });
});
