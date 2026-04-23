import { describe, it, expect } from 'vitest';
import { buildLifecycleAssessment } from '../modules/buildLifecycleAssessment';
import type { BuildLifecycleAssessmentInput } from '../modules/buildLifecycleAssessment';
import { buildDecisionFromScenarios } from '../modules/buildDecisionFromScenarios';
import type { ScenarioResult } from '../../contracts/ScenarioResult';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const goodSystemBoiler: ScenarioResult = {
  scenarioId: 'system_unvented',
  system: { type: 'system', summary: 'System boiler with unvented cylinder' },
  performance: {
    hotWater:    'excellent',
    heating:     'very_good',
    efficiency:  'good',
    reliability: 'very_good',
  },
  keyBenefits:     ['Simultaneous hot water across multiple outlets'],
  keyConstraints:  ['Requires space for unvented cylinder'],
  dayToDayOutcomes: ['Instant mains-pressure hot water'],
  requiredWorks:   ['Install unvented cylinder'],
  upgradePaths:    ['Heat pump ready with cylinder upgrade'],
  physicsFlags:    {},
};

const weakCombiScenario: ScenarioResult = {
  scenarioId: 'combi',
  system: { type: 'combi', summary: 'Combi boiler providing on-demand hot water' },
  performance: {
    hotWater:    'poor',
    heating:     'good',
    efficiency:  'good',
    reliability: 'good',
  },
  keyBenefits:     ['No cylinder required'],
  keyConstraints:  ['Simultaneous hot water demand risk'],
  dayToDayOutcomes: ['On-demand hot water for single outlets'],
  requiredWorks:   [],
  upgradePaths:    [],
  physicsFlags:    { combiFlowRisk: true },
};

// ─── Case 1: 25-year regular boiler, moderate water, average maintenance ──────
// Expected: at_risk condition, strong replacement signal

describe('buildLifecycleAssessment — Case 1 (25yr regular, moderate water, average maintenance)', () => {
  const input: BuildLifecycleAssessmentInput = {
    boilerType:       'regular',
    ageYears:         25,
    waterQuality:     'moderate',
    occupancyCount:   3,
    bathroomCount:    1,
    maintenanceLevel: 'average',
  };

  it('produces at_risk condition', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.currentSystem.condition).toBe('at_risk');
  });

  it('summary signals beyond typical lifespan', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.summary).toMatch(/beyond typical lifespan/i);
  });

  it('includes a lifespan-exceeded risk indicator', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.riskIndicators.some(r => /exceeds the typical upper lifespan/i.test(r))).toBe(true);
  });

  it('adjusted range minimum is at least 5 years', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.expectedLifespan.adjustedRangeYears[0]).toBeGreaterThanOrEqual(5);
  });

  it('typical range reflects regular boiler baseline', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.expectedLifespan.typicalRangeYears).toEqual([15, 25]);
  });
});

// ─── Case 2: 8-year combi, hard water, high usage ─────────────────────────────
// Expected: worn early (high scale risk + high usage)

describe('buildLifecycleAssessment — Case 2 (8yr combi, hard water, high usage)', () => {
  const input: BuildLifecycleAssessmentInput = {
    boilerType:       'combi',
    ageYears:         8,
    waterQuality:     'hard',
    occupancyCount:   5,
    bathroomCount:    2,
    maintenanceLevel: 'unknown',
  };

  // Physics trace: hard water + age 8 → scaleRisk 'medium' (age < 10 threshold).
  // Occupancy 5 + 2 bathrooms → usageIntensity 'high'.
  // adjustLifespan([10,15], medium, high, unknown): high usage −1/−2 → [9, 13].
  // deriveCondition(8, [9,13]): 8 < 9×0.6=5.4? No. 8 < 9? Yes → 'average'.
  it('produces average condition (physics-grounded: scale medium, adjusted min=9)', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.currentSystem.condition).toBe('average');
  });

  it('scale risk is medium or high for hard water at age 8', () => {
    const result = buildLifecycleAssessment(input);
    expect(['medium', 'high']).toContain(result.influencingFactors.scaleRisk);
  });

  it('usage intensity is high for 5 occupants and 2 bathrooms', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.influencingFactors.usageIntensity).toBe('high');
  });

  it('adjusted range is reduced vs typical baseline', () => {
    const result = buildLifecycleAssessment(input);
    // At minimum the max should be <= 15 (high usage penalty applied)
    expect(result.expectedLifespan.adjustedRangeYears[1]).toBeLessThan(15);
  });
});

// ─── Case 3: 12-year system boiler, good maintenance ─────────────────────────
// Expected: average condition, softer recommendation tone

describe('buildLifecycleAssessment — Case 3 (12yr system, good maintenance)', () => {
  const input: BuildLifecycleAssessmentInput = {
    boilerType:       'system',
    ageYears:         12,
    waterQuality:     'soft',
    occupancyCount:   2,
    bathroomCount:    1,
    maintenanceLevel: 'good',
  };

  // Physics trace: soft water → scale low; 2 occ / 1 bath → usage low; good maintenance.
  // adjustLifespan([12,18], low, low, good): +2 max for good maintenance → [12, 20].
  // deriveCondition(12, [12,20]): 12 < 12×0.6=7.2? No. 12 < 12? No. 12 < 20? Yes → 'worn'.
  it('produces worn condition (physics-grounded: age equals adjusted min)', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.currentSystem.condition).toBe('worn');
  });

  it('summary does not mention immediate failure risk', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.summary).not.toMatch(/beyond typical lifespan/i);
    expect(result.summary).not.toMatch(/elevated risk of failure/i);
  });

  it('adjusted max extends beyond typical baseline due to good maintenance', () => {
    const result = buildLifecycleAssessment(input);
    // good maintenance gives +2 on max
    expect(result.expectedLifespan.adjustedRangeYears[1]).toBeGreaterThan(18);
  });

  it('scale risk is low for soft water', () => {
    const result = buildLifecycleAssessment(input);
    expect(result.influencingFactors.scaleRisk).toBe('low');
  });
});

// ─── Unknown age → condition 'unknown' ───────────────────────────────────────

describe('buildLifecycleAssessment — unknown age', () => {
  it('condition is unknown when ageYears is 0', () => {
    const result = buildLifecycleAssessment({
      boilerType: 'combi',
      ageYears:   0,
    });
    expect(result.currentSystem.condition).toBe('unknown');
  });

  it('summary reflects unknown condition', () => {
    const result = buildLifecycleAssessment({
      boilerType: 'combi',
      ageYears:   0,
    });
    expect(result.summary).toMatch(/age unknown/i);
  });
});

// ─── buildDecisionFromScenarios ───────────────────────────────────────────────

describe('buildDecisionFromScenarios', () => {
  it('selects the highest-scoring scenario', () => {
    const decision = buildDecisionFromScenarios({
      scenarios:    [weakCombiScenario, goodSystemBoiler],
      boilerType:   'regular',
      ageYears:     25,
      waterQuality: 'moderate',
    });
    expect(decision.recommendedScenarioId).toBe('system_unvented');
  });

  it('injects lifecycle urgency reason when condition is at_risk', () => {
    const decision = buildDecisionFromScenarios({
      scenarios:    [goodSystemBoiler],
      boilerType:   'regular',
      ageYears:     25,
      waterQuality: 'moderate',
    });
    const lifecycleReason = decision.keyReasons.some(r =>
      /beyond typical lifespan/i.test(r),
    );
    expect(lifecycleReason).toBe(true);
  });

  it('lifecycle summary is present in the decision', () => {
    const decision = buildDecisionFromScenarios({
      scenarios:  [goodSystemBoiler],
      boilerType: 'regular',
      ageYears:   25,
    });
    expect(decision.lifecycle.summary).toBeTruthy();
  });

  it('supportingFacts includes system age', () => {
    const decision = buildDecisionFromScenarios({
      scenarios:  [goodSystemBoiler],
      boilerType: 'regular',
      ageYears:   25,
    });
    const ageFact = decision.supportingFacts.find(f => f.label === 'System age');
    expect(ageFact).toBeDefined();
    expect(ageFact?.value).toBe('25 years');
  });

  it('throws when scenarios array is empty', () => {
    expect(() =>
      buildDecisionFromScenarios({
        scenarios:  [],
        boilerType: 'combi',
        ageYears:   5,
      }),
    ).toThrow('scenarios array must not be empty');
  });

  it('combiFlowRisk physicsFlag generates a compatibility warning', () => {
    const decision = buildDecisionFromScenarios({
      scenarios:  [weakCombiScenario],
      boilerType: 'combi',
      ageYears:   8,
    });
    const hasWarning = decision.compatibilityWarnings.some(w =>
      /simultaneous hot-water demand/i.test(w),
    );
    expect(hasWarning).toBe(true);
  });
});
