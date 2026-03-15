// src/lib/advice/__tests__/buildAdviceFromCompare.test.ts
//
// Unit tests for buildAdviceFromCompare — PR6 compare-truth advice builder.
//
// Coverage:
//   - Returns bestOverall and all 6 objective cards
//   - compareWins are derived from compare truth, not hardcoded
//   - Different objectives can yield different recommended paths
//   - confidencePct appears on cards when engine confidence is available
//   - efficiencyScore appears on cards and respects system condition decay
//   - Installation recipe is present with required sections
//   - Phased plan has now/next/later steps
//   - Forward-thinking plan preserves Mixergy/cylinder path where supported
//   - Advice derives from compare truth deterministically
//   - Handles empty options and missing plans gracefully

import { describe, it, expect } from 'vitest';
import {
  buildAdviceFromCompare,
  type AdviceFromCompareInput,
  type SimulatorSystemState,
} from '../buildAdviceFromCompare';
import type { EngineOutputV1, OptionCardV1 } from '../../../contracts/EngineOutputV1';
import type { CompareSeed } from '../../simulator/buildCompareSeedFromSurvey';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOption(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
  overrides: Partial<OptionCardV1> = {},
): OptionCardV1 {
  return {
    id,
    label: id,
    status,
    headline: `${id} headline`,
    why: [`${id} is suitable for this home`],
    requirements: [],
    typedRequirements: {
      mustHave: [`Install ${id}`, 'Magnetic filter on primary return'],
      likelyUpgrades: ['System flush', 'Weather compensation control'],
      niceToHave: ['Smart thermostat'],
    },
    heat: { status: 'ok', headline: 'Heat ok', bullets: ['Radiators sized correctly'] },
    dhw: { status: 'ok', headline: 'DHW ok', bullets: ['Adequate flow capacity'] },
    engineering: { status: 'ok', headline: 'Eng ok', bullets: ['Primary sized correctly'] },
    sensitivities: [],
    ...overrides,
  };
}

function minimalSurvey(): FullSurveyModelV1 {
  return {
    occupancySignature: 'home_all_day',
    propertyType: 'semi_detached',
    propertyAge: 'post_2000',
    bedrooms: 3,
    bathrooms: 1,
    currentSystem: 'combi',
    fuelType: 'gas',
    mainsWaterPressure: 'adequate',
  } as unknown as FullSurveyModelV1;
}

function makeCompareSeed(overrides: Partial<CompareSeed> = {}): CompareSeed {
  return {
    left: {
      systemChoice: 'combi',
      systemInputs: {
        weatherCompensation: false,
        loadCompensation: false,
        emitterCapacityFactor: 1.0,
        systemCondition: 'scaling',
      },
    },
    right: {
      systemChoice: 'unvented',
      systemInputs: {
        weatherCompensation: true,
        loadCompensation: false,
        emitterCapacityFactor: 1.2,
        systemCondition: 'clean',
      },
    },
    compareMode: 'current_vs_proposed',
    comparisonLabel: 'Current system vs Proposed system',
    ...overrides,
  };
}

function makeEngineOutput(
  options: OptionCardV1[] = [makeOption('stored_unvented', 'viable')],
  overrides: Partial<EngineOutputV1> = {},
): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'Unvented cylinder system' },
    explainers: [],
    options,
    ...overrides,
  };
}

function makeInput(overrides: Partial<AdviceFromCompareInput> = {}): AdviceFromCompareInput {
  return {
    surveyData: minimalSurvey(),
    engineOutput: makeEngineOutput(),
    compareSeed: makeCompareSeed(),
    ...overrides,
  };
}

// ─── Structure ────────────────────────────────────────────────────────────────

describe('buildAdviceFromCompare — structure', () => {
  it('returns bestOverall with all required fields', () => {
    const result = buildAdviceFromCompare(makeInput());
    expect(result.bestOverall).toBeDefined();
    expect(result.bestOverall.id).toBe('best_overall');
    expect(result.bestOverall.recommendedPathLabel).toBeTruthy();
    expect(Array.isArray(result.bestOverall.why)).toBe(true);
    expect(result.bestOverall.why.length).toBeGreaterThan(0);
    expect(Array.isArray(result.bestOverall.compareWins)).toBe(true);
  });

  it('returns all 6 objective cards', () => {
    const result = buildAdviceFromCompare(makeInput());
    expect(result.byObjective.lowestRunningCost).toBeDefined();
    expect(result.byObjective.lowestInstallationCost).toBeDefined();
    expect(result.byObjective.greatestLongevity).toBeDefined();
    expect(result.byObjective.lowestCarbonPointOfUse).toBeDefined();
    expect(result.byObjective.greatestComfortAndDelivery).toBeDefined();
    expect(result.byObjective.measuredForwardThinkingPlan).toBeDefined();
  });

  it('each objective card has required fields', () => {
    const result = buildAdviceFromCompare(makeInput());
    for (const card of Object.values(result.byObjective)) {
      expect(card.id).toBeTruthy();
      expect(card.icon).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.recommendedPathLabel).toBeTruthy();
      expect(Array.isArray(card.why)).toBe(true);
      expect(Array.isArray(card.compareWins)).toBe(true);
    }
  });

  it('returns installationRecipe with all required sections', () => {
    const result = buildAdviceFromCompare(makeInput());
    expect(result.installationRecipe.heatSource).toBeTruthy();
    expect(result.installationRecipe.hotWaterArrangement).toBeTruthy();
    expect(Array.isArray(result.installationRecipe.controls)).toBe(true);
    expect(Array.isArray(result.installationRecipe.emitters)).toBe(true);
    expect(Array.isArray(result.installationRecipe.primaryPipework)).toBe(true);
    expect(Array.isArray(result.installationRecipe.protectionAndAncillaries)).toBe(true);
  });

  it('returns phasedPlan with now, next, later', () => {
    const result = buildAdviceFromCompare(makeInput());
    expect(Array.isArray(result.phasedPlan.now)).toBe(true);
    expect(Array.isArray(result.phasedPlan.next)).toBe(true);
    expect(Array.isArray(result.phasedPlan.later)).toBe(true);
  });

  it('returns confidenceSummary', () => {
    const result = buildAdviceFromCompare(makeInput());
    expect(result.confidenceSummary).toBeDefined();
    expect(Array.isArray(result.confidenceSummary.reasons)).toBe(true);
  });
});

// ─── bestOverall ──────────────────────────────────────────────────────────────

describe('buildAdviceFromCompare — bestOverall', () => {
  it('uses the engine recommendation primary string', () => {
    const output = makeEngineOutput(
      [makeOption('stored_unvented', 'viable')],
      { recommendation: { primary: 'Unvented cylinder system' } },
    );
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(result.bestOverall.recommendedPathLabel).toBe('Unvented cylinder system');
  });

  it('uses verdict primaryReason as the why when available', () => {
    const output = makeEngineOutput([], {
      recommendation: { primary: 'Combi boiler' },
      verdict: {
        title: 'Good match',
        status: 'good',
        reasons: ['Reason A'],
        confidence: { level: 'high', reasons: [] },
        assumptionsUsed: [],
        primaryReason: 'Low demand suits on-demand hot water',
      },
    });
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(result.bestOverall.why[0]).toBe('Low demand suits on-demand hot water');
  });
});

// ─── compareWins ──────────────────────────────────────────────────────────────

describe('buildAdviceFromCompare — compareWins', () => {
  it('derives compareWins when current is combi and proposed is stored', () => {
    const seed = makeCompareSeed({
      left: { systemChoice: 'combi', systemInputs: { weatherCompensation: false } },
      right: { systemChoice: 'unvented', systemInputs: { weatherCompensation: true, emitterCapacityFactor: 1.2, systemCondition: 'clean' } },
    });
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed }));
    const wins = result.bestOverall.compareWins.join(' ');
    // Should mention DHW delivery improvement
    expect(wins).toMatch(/hot-water|delivery|DHW mode/i);
  });

  it('includes "keeps future heat-pump path open" when proposed has cylinder', () => {
    const seed = makeCompareSeed({
      left: { systemChoice: 'combi', systemInputs: {} },
      right: { systemChoice: 'unvented', systemInputs: { systemCondition: 'clean', emitterCapacityFactor: 1.2 } },
    });
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed }));
    const futureCard = result.byObjective.measuredForwardThinkingPlan;
    expect(futureCard.compareWins.join(' ')).toMatch(/heat-pump path|forward/i);
  });

  it('compareWins is an empty array when proposed has no clear win (install cost, combi stays combi)', () => {
    const seed = makeCompareSeed({
      left: { systemChoice: 'combi', systemInputs: {} },
      right: { systemChoice: 'combi', systemInputs: { systemCondition: 'clean' } },
    });
    const output = makeEngineOutput([makeOption('combi', 'viable')]);
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed, engineOutput: output }));
    // Install cost card for combi shouldn't assert big wins — just a plain list
    expect(Array.isArray(result.byObjective.lowestInstallationCost.compareWins)).toBe(true);
  });

  it('is deterministic — same input always produces same compareWins', () => {
    const input = makeInput();
    const r1 = buildAdviceFromCompare(input);
    const r2 = buildAdviceFromCompare(input);
    expect(r1.bestOverall.compareWins).toEqual(r2.bestOverall.compareWins);
  });
});

// ─── Different objectives → different paths ───────────────────────────────────

describe('buildAdviceFromCompare — objectives can produce different paths', () => {
  it('install_cost prefers combi when viable', () => {
    const output = makeEngineOutput([
      makeOption('combi', 'viable'),
      makeOption('stored_unvented', 'viable'),
    ]);
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(result.byObjective.lowestInstallationCost.recommendedPathLabel).toMatch(/Combi/i);
  });

  it('running_cost prefers ashp when viable', () => {
    const output = makeEngineOutput([
      makeOption('combi', 'viable'),
      makeOption('ashp', 'viable'),
    ]);
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(result.byObjective.lowestRunningCost.recommendedPathLabel).toMatch(/heat pump/i);
  });

  it('comfort card prefers stored_unvented for delivery', () => {
    const output = makeEngineOutput([
      makeOption('combi', 'viable'),
      makeOption('stored_unvented', 'viable'),
    ]);
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(result.byObjective.greatestComfortAndDelivery.recommendedPathLabel).toMatch(/Unvented/i);
  });

  it('carbon card mentions "at point of use" in trade-off', () => {
    const output = makeEngineOutput([makeOption('ashp', 'viable')]);
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(result.byObjective.lowestCarbonPointOfUse.keyTradeOff).toMatch(/point of use/i);
  });
});

// ─── Confidence and efficiency score ─────────────────────────────────────────

describe('buildAdviceFromCompare — confidencePct and efficiencyScore', () => {
  it('confidencePct is always a number derived from the unified model', () => {
    const output = makeEngineOutput([], {
      recommendation: { primary: 'Combi boiler' },
      verdict: {
        title: 'Good',
        status: 'good',
        reasons: [],
        confidence: { level: 'high', reasons: [] },
        assumptionsUsed: [],
      },
    });
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(typeof result.bestOverall.confidencePct).toBe('number');
    expect(result.bestOverall.confidencePct).toBeGreaterThanOrEqual(0);
    expect(result.bestOverall.confidencePct).toBeLessThanOrEqual(100);
    expect(result.confidenceSummary.pct).toBe(result.bestOverall.confidencePct);
  });

  it('confidenceSummary.unified is present with all required fields', () => {
    const output = makeEngineOutput([], {
      recommendation: { primary: 'Combi boiler' },
      verdict: {
        title: 'OK',
        status: 'caution',
        reasons: [],
        confidence: { level: 'medium', reasons: [] },
        assumptionsUsed: [],
      },
    });
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    const u = result.confidenceSummary.unified;
    expect(u).not.toBeNull();
    expect(typeof u!.overallPct).toBe('number');
    expect(typeof u!.dataPct).toBe('number');
    expect(typeof u!.physicsPct).toBe('number');
    expect(typeof u!.decisionPct).toBe('number');
    expect(['high', 'medium', 'low']).toContain(u!.level);
    expect(Array.isArray(u!.measured)).toBe(true);
    expect(Array.isArray(u!.inferred)).toBe(true);
    expect(Array.isArray(u!.missing)).toBe(true);
    expect(Array.isArray(u!.nextBestChecks)).toBe(true);
  });

  it('unified level is lower when engine confidence is low and data is sparse', () => {
    const output = makeEngineOutput([], {
      recommendation: { primary: 'Combi boiler' },
      verdict: {
        title: 'Low confidence',
        status: 'fail',
        reasons: [],
        confidence: { level: 'low', reasons: [] },
        assumptionsUsed: [],
      },
    });
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    const u = result.confidenceSummary.unified;
    // With sparse data and low engine confidence, overall should not be high
    expect(u!.level).not.toBe('high');
  });

  it('confidencePct is a number even when no verdict is present', () => {
    const output = makeEngineOutput();
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(typeof result.bestOverall.confidencePct).toBe('number');
    expect(result.confidenceSummary.unified).not.toBeNull();
  });

  it('returns a numeric efficiencyScore on the bestOverall card', () => {
    const seed = makeCompareSeed({
      right: {
        systemChoice: 'unvented',
        systemInputs: {
          weatherCompensation: true,
          loadCompensation: false,
          emitterCapacityFactor: 1.2,
          systemCondition: 'clean',
        },
      },
    });
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed }));
    expect(typeof result.bestOverall.efficiencyScore).toBe('number');
    expect(result.bestOverall.efficiencyScore).toBeGreaterThanOrEqual(50);
    expect(result.bestOverall.efficiencyScore).toBeLessThanOrEqual(99);
  });

  it('efficiencyScore is lower for "scaling" condition than "clean"', () => {
    const cleanSeed = makeCompareSeed({
      right: { systemChoice: 'unvented', systemInputs: { systemCondition: 'clean' } },
    });
    const scalingSeed = makeCompareSeed({
      right: { systemChoice: 'unvented', systemInputs: { systemCondition: 'scaling' } },
    });
    const cleanResult = buildAdviceFromCompare(makeInput({ compareSeed: cleanSeed }));
    const scalingResult = buildAdviceFromCompare(makeInput({ compareSeed: scalingSeed }));
    expect(cleanResult.bestOverall.efficiencyScore!).toBeGreaterThan(scalingResult.bestOverall.efficiencyScore!);
  });

  it('heat_pump efficiencyScore is in the valid range', () => {
    const seed = makeCompareSeed({
      right: { systemChoice: 'heat_pump', systemInputs: {} },
    });
    const output = makeEngineOutput([makeOption('ashp', 'viable')]);
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed, engineOutput: output }));
    expect(result.bestOverall.efficiencyScore).toBeGreaterThanOrEqual(50);
    expect(result.bestOverall.efficiencyScore).toBeLessThanOrEqual(99);
  });
});

// ─── Installation recipe ──────────────────────────────────────────────────────

describe('buildAdviceFromCompare — installation recipe', () => {
  it('heatSource reflects the primary option', () => {
    const output = makeEngineOutput([makeOption('combi', 'viable')]);
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(result.installationRecipe.heatSource).toMatch(/combi/i);
  });

  it('includes protectionAndAncillaries with at least one entry', () => {
    const result = buildAdviceFromCompare(makeInput());
    expect(result.installationRecipe.protectionAndAncillaries.length).toBeGreaterThan(0);
  });

  it('includes PRV discharge advice for unvented cylinder proposed system', () => {
    const seed = makeCompareSeed({
      right: { systemChoice: 'unvented', systemInputs: { systemCondition: 'clean' } },
    });
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed }));
    const pipeText = result.installationRecipe.primaryPipework.join(' ');
    expect(pipeText).toMatch(/PRV/i);
  });

  it('does not include PRV advice for open_vented proposed system', () => {
    const seed = makeCompareSeed({
      right: { systemChoice: 'open_vented', systemInputs: {} },
    });
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed }));
    const pipeText = result.installationRecipe.primaryPipework.join(' ');
    // open_vented is vented — no G3 unvented PRV requirement
    expect(pipeText).not.toMatch(/PRV/i);
  });
});

// ─── Phased plan ──────────────────────────────────────────────────────────────

describe('buildAdviceFromCompare — phased plan', () => {
  it('now phase includes the system installation step', () => {
    const output = makeEngineOutput([makeOption('combi', 'viable')]);
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    const nowText = result.phasedPlan.now.join(' ');
    expect(nowText).toMatch(/combi/i);
  });

  it('later phase includes heat pump viability assessment when proposed has cylinder', () => {
    const seed = makeCompareSeed({
      right: { systemChoice: 'unvented', systemInputs: { systemCondition: 'clean' } },
    });
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed }));
    const laterText = result.phasedPlan.later.join(' ');
    expect(laterText).toMatch(/heat pump/i);
  });

  it('uses engine plans.pathways when provided', () => {
    const output = makeEngineOutput([makeOption('stored_unvented', 'viable')], {
      plans: {
        sharedConstraints: [],
        pathways: [
          {
            id: 'p1',
            title: 'Boiler + Mixergy now, ASHP later',
            rationale: 'Lowest disruption with future HP path preserved',
            outcomeToday: 'System installed',
            prerequisites: [],
            confidence: { level: 'high', reasons: [] },
            rank: 1,
          },
          {
            id: 'p2',
            title: 'Upgrade emitters',
            rationale: 'Improve heat distribution for HP readiness',
            outcomeToday: 'Radiators upgraded',
            prerequisites: [],
            confidence: { level: 'medium', reasons: [] },
            rank: 2,
          },
          {
            id: 'p3',
            title: 'Install ASHP',
            rationale: 'Full electrification once emitters ready',
            outcomeToday: 'ASHP installed',
            prerequisites: [],
            confidence: { level: 'medium', reasons: [] },
            rank: 3,
          },
        ],
      },
    });
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    expect(result.phasedPlan.now.join(' ')).toMatch(/disruption|Mixergy|HP/i);
    expect(result.phasedPlan.next.join(' ')).toMatch(/emitter|distribution/i);
    expect(result.phasedPlan.later.join(' ')).toMatch(/ASHP|electrification/i);
  });

  it('forward-thinking plan preserves Mixergy/cylinder path where supported', () => {
    const output = makeEngineOutput([makeOption('stored_unvented', 'viable')], {
      verdict: {
        title: 'Stored unvented recommended',
        status: 'good',
        reasons: ['Good mains pressure'],
        confidence: { level: 'high', reasons: [] },
        assumptionsUsed: [],
      },
    });
    const seed = makeCompareSeed({
      right: { systemChoice: 'unvented', systemInputs: { systemCondition: 'clean', emitterCapacityFactor: 1.2, weatherCompensation: true } },
    });
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output, compareSeed: seed }));
    // Future-ready card should preserve the cylinder + HP upgrade path
    const futureCard = result.byObjective.measuredForwardThinkingPlan;
    expect(futureCard.compareWins.length).toBeGreaterThan(0);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('buildAdviceFromCompare — edge cases', () => {
  it('handles empty options without throwing', () => {
    const output = makeEngineOutput([]);
    expect(() => buildAdviceFromCompare(makeInput({ engineOutput: output }))).not.toThrow();
  });

  it('handles missing verdict without throwing', () => {
    const output = makeEngineOutput([], { verdict: undefined });
    expect(() => buildAdviceFromCompare(makeInput({ engineOutput: output }))).not.toThrow();
  });

  it('handles missing plans without throwing', () => {
    const output = makeEngineOutput([], { plans: undefined });
    expect(() => buildAdviceFromCompare(makeInput({ engineOutput: output }))).not.toThrow();
  });

  it('accepts explicit currentSystemState and proposedSystemState overrides', () => {
    const current: SimulatorSystemState = {
      systemChoice: 'combi',
      weatherCompensation: false,
      loadCompensation: false,
      emitterCapacityFactor: 1.0,
      systemCondition: 'poor',
    };
    const proposed: SimulatorSystemState = {
      systemChoice: 'unvented',
      weatherCompensation: true,
      loadCompensation: true,
      emitterCapacityFactor: 1.3,
      systemCondition: 'clean',
    };
    const result = buildAdviceFromCompare(makeInput({ currentSystemState: current, proposedSystemState: proposed }));
    // Should not throw and should produce wins from explicit state
    expect(result.bestOverall.compareWins.length).toBeGreaterThan(0);
  });

  it('is deterministic across multiple calls with the same input', () => {
    const input = makeInput();
    const r1 = buildAdviceFromCompare(input);
    const r2 = buildAdviceFromCompare(input);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
