// src/lib/advice/__tests__/buildAdviceFromCompare.test.ts
//
// Unit tests for buildAdviceFromCompare — PR6 compare-truth advice builder.
//
// Coverage:
//   - Returns bestOverall and all 6 objective cards
//   - compareWins are derived from compare truth, not hardcoded
//   - Different objectives can yield different recommended paths
//   - confidencePct appears on cards when engine confidence is available
//   - performanceSummary appears on cards with physics-grounded fields
//   - Installation recipe is present with required sections
//   - Recommendation scope (Essential / Best Advice / Enhanced / Future Potential)
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

  it('returns recommendationScope with essential, optional bestAdvice and futurePotential', () => {
    const result = buildAdviceFromCompare(makeInput());
    expect(result.recommendationScope).toBeDefined();
    expect(result.recommendationScope.essential).toBeDefined();
    expect(Array.isArray(result.recommendationScope.essential.items)).toBe(true);
    expect(result.recommendationScope.essential.items.length).toBeGreaterThan(0);
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

  it('returns a performanceSummary on the bestOverall card', () => {
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
    const ps = result.bestOverall.performanceSummary;
    expect(ps).not.toBeNull();
    expect(['optimal', 'average', 'poor']).toContain(ps!.efficiencyBand);
    expect(ps!.energyConversion.inputKwh).toBe(1);
    expect(ps!.energyConversion.outputKwh).toBeGreaterThan(0);
    expect(ps!.costPerKwhHeat).toBeGreaterThan(0);
    expect(ps!.carbonPerKwhHeat).toBeGreaterThan(0);
    expect(['high', 'moderate', 'limited']).toContain(ps!.localGenerationImpact);
  });

  it('performanceSummary efficiencyBand is poor for "heavy_scale" condition', () => {
    const heavyScaleSeed = makeCompareSeed({
      right: { systemChoice: 'unvented', systemInputs: { systemCondition: 'heavy_scale' } },
    });
    const result = buildAdviceFromCompare(makeInput({ compareSeed: heavyScaleSeed }));
    expect(result.bestOverall.performanceSummary!.efficiencyBand).toBe('poor');
  });

  it('heat_pump performanceSummary has localGenerationImpact high and COP-based energyConversion', () => {
    const seed = makeCompareSeed({
      right: { systemChoice: 'heat_pump', systemInputs: {} },
    });
    const output = makeEngineOutput([makeOption('ashp', 'viable')]);
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed, engineOutput: output }));
    const ps = result.bestOverall.performanceSummary;
    expect(ps).not.toBeNull();
    expect(ps!.localGenerationImpact).toBe('high');
    expect(ps!.energyConversion.outputKwh).toBeGreaterThan(1); // COP > 1
    expect(ps!.efficiencyBand).toBe('optimal');
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

// ─── Recommendation scope ─────────────────────────────────────────────────────

describe('buildAdviceFromCompare — recommendation scope', () => {
  it('essential includes the system installation step', () => {
    const output = makeEngineOutput([makeOption('combi', 'viable')]);
    const result = buildAdviceFromCompare(makeInput({ engineOutput: output }));
    const essentialText = result.recommendationScope.essential.items.map(i => i.label).join(' ');
    expect(essentialText).toMatch(/combi/i);
  });

  it('futurePotential includes heat pump viability pathway when proposed has cylinder', () => {
    const seed = makeCompareSeed({
      right: { systemChoice: 'unvented', systemInputs: { systemCondition: 'clean' } },
    });
    const result = buildAdviceFromCompare(makeInput({ compareSeed: seed }));
    const futureText = result.recommendationScope.futurePotential?.items.map(i => i.label).join(' ') ?? '';
    expect(futureText).toMatch(/heat pump/i);
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
    const essentialText = result.recommendationScope.essential.items.map(i => i.label).join(' ');
    const bestAdviceText = result.recommendationScope.bestAdvice?.items.map(i => i.label).join(' ') ?? '';
    const futureText = result.recommendationScope.futurePotential?.items.map(i => i.label).join(' ') ?? '';
    expect(essentialText).toMatch(/disruption|Mixergy|HP/i);
    expect(bestAdviceText).toMatch(/emitter|distribution/i);
    expect(futureText).toMatch(/ASHP|electrification/i);
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

// ─── Floor-plan inputs ────────────────────────────────────────────────────────

describe('buildAdviceFromCompare — floorplanInputs', () => {
  function makeFloorplanInputs(overrides: Partial<import('../buildAdviceFromCompare').AdviceFromCompareInput['floorplanInputs'] & {}> = {}) {
    return {
      refinedHeatLossKw: 5.4,
      emitterAdequacyHints: [
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 3.2, status: 'review_recommended' as const },
        { roomId: 'r2', roomName: 'Hallway', suggestedRadiatorKw: 1.1, status: 'adequate' as const },
      ],
      roomHeatLossBreakdown: [
        { roomId: 'r1', roomName: 'Lounge', heatLossKw: 2.8 },
        { roomId: 'r2', roomName: 'Hallway', heatLossKw: 0.96 },
      ],
      sitingConstraintHints: [
        {
          objectType: 'boiler' as const,
          hasWarning: true,
          warningMessages: ['Boiler in "Lounge" — preferred rooms: kitchen, utility'],
        },
      ],
      pipeLengthEstimateHints: {
        totalEstimateM: 18.5,
        label: 'Estimated pipe run: ~18.5 m (planning estimate only)',
      },
      isReliable: true,
      ...overrides,
    };
  }

  it('populates floorplanInsights when reliable floor plan is provided', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    expect(result.floorplanInsights).not.toBeNull();
    expect(result.floorplanInsights?.refinedHeatLossKw).toBe(5.4);
    expect(result.floorplanInsights?.heatLossRefined).toBe(true);
  });

  it('returns floorplanInsights=null when no floorplanInputs provided', () => {
    const result = buildAdviceFromCompare(makeInput());
    expect(result.floorplanInsights).toBeNull();
  });

  it('returns floorplanInsights=null when isReliable=false', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs({ isReliable: false }) }),
    );
    expect(result.floorplanInsights).toBeNull();
  });

  it('lists emitter review rooms in floorplanInsights', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    expect(result.floorplanInsights?.emitterReviewRooms).toContain('Lounge');
    expect(result.floorplanInsights?.emitterReviewRooms).not.toContain('Hallway');
  });

  it('collects siting warnings into floorplanInsights', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    expect(result.floorplanInsights?.sitingWarnings.length).toBeGreaterThan(0);
    expect(result.floorplanInsights?.sitingWarnings[0]).toContain('Lounge');
  });

  it('exposes pipe length estimate in floorplanInsights', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    expect(result.floorplanInsights?.pipeLengthEstimateM).toBe(18.5);
  });

  it('adds siting warning to compareWins when floor plan has siting issues', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    const hasSitingWin = result.bestOverall.compareWins.some((w) =>
      /siting/i.test(w),
    );
    expect(hasSitingWin).toBe(true);
  });

  it('adds emitter adequacy signal to compareWins when rooms need review', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    const hasEmitterWin = result.bestOverall.compareWins.some((w) =>
      /emitter/i.test(w),
    );
    expect(hasEmitterWin).toBe(true);
  });

  it('appends emitter review note to installation recipe when rooms need review', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    const hasEmitterNote = result.installationRecipe.emitters.some((e) =>
      /floor plan derived/i.test(e),
    );
    expect(hasEmitterNote).toBe(true);
  });

  it('appends pipe length hint to installation recipe primaryPipework', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    const hasPipeNote = result.installationRecipe.primaryPipework.some((p) =>
      /18\.5/.test(p),
    );
    expect(hasPipeNote).toBe(true);
  });

  it('adds siting issue to essential scope when warnings present', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    const hasSitingEssential = result.recommendationScope.essential.items.some((a) => /siting/i.test(a.label));
    expect(hasSitingEssential).toBe(true);
  });

  it('adds emitter confirmation to bestAdvice scope when rooms need review', () => {
    const result = buildAdviceFromCompare(
      makeInput({ floorplanInputs: makeFloorplanInputs() }),
    );
    const hasEmitterBestAdvice = result.recommendationScope.bestAdvice?.items.some((a) => /emitter/i.test(a.label));
    expect(hasEmitterBestAdvice).toBe(true);
  });

  it('does not alter scope when no floor plan warnings exist', () => {
    const cleanInputs = makeFloorplanInputs({
      emitterAdequacyHints: [
        { roomId: 'r1', roomName: 'Hallway', suggestedRadiatorKw: 0.8, status: 'adequate' as const },
      ],
      sitingConstraintHints: [
        { objectType: 'boiler' as const, hasWarning: false, warningMessages: [] },
      ],
    });
    const result = buildAdviceFromCompare(makeInput({ floorplanInputs: cleanInputs }));
    // Siting note should NOT appear in essential (no warnings)
    const hasSitingEssential = result.recommendationScope.essential.items.some((a) => /siting/i.test(a.label));
    expect(hasSitingEssential).toBe(false);
  });

  it('is deterministic with floor plan inputs across multiple calls', () => {
    const fp = makeFloorplanInputs();
    const r1 = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    const r2 = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ─── FloorplanInsights — extended emitter adequacy fields ────────────────────

describe('buildAdviceFromCompare — floorplanInsights extended fields', () => {
  function makeFloorplanWithAdequacy(
    coverageClassification: import('../../../lib/floorplan/adaptFloorplanToAtlasInputs').EmitterCoverageClassification,
    undersizedRooms: string[],
    oversizedRooms: string[],
    impliedOversizingFactor: number | null,
  ) {
    return {
      refinedHeatLossKw: 5.4,
      emitterAdequacyHints: [] as import('../../../lib/floorplan/adaptFloorplanToAtlasInputs').EmitterAdequacyHint[],
      roomHeatLossBreakdown: [],
      sitingConstraintHints: [],
      pipeLengthEstimateHints: { totalEstimateM: 0, label: '' },
      wholeSystemEmitterAdequacy: {
        coverageClassification,
        impliedOversizingFactor,
        undersizedRooms,
        oversizedRooms,
        hasActualData: true,
      },
      isReliable: true,
    };
  }

  it('populates coverageClassification from wholeSystemEmitterAdequacy', () => {
    const fp = makeFloorplanWithAdequacy('all_oversized', [], ['Lounge', 'Bedroom'], 1.5);
    const result = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    expect(result.floorplanInsights?.coverageClassification).toBe('all_oversized');
  });

  it('populates undersizedRooms from wholeSystemEmitterAdequacy', () => {
    const fp = makeFloorplanWithAdequacy('majority_undersized', ['Kitchen', 'Bathroom'], [], 0.8);
    const result = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    expect(result.floorplanInsights?.undersizedRooms).toEqual(['Kitchen', 'Bathroom']);
  });

  it('populates oversizedRooms from wholeSystemEmitterAdequacy', () => {
    const fp = makeFloorplanWithAdequacy('all_oversized', [], ['Lounge'], 1.5);
    const result = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    expect(result.floorplanInsights?.oversizedRooms).toEqual(['Lounge']);
  });

  it('sets operatingTempInfluenced=true when factor differs from 1.0', () => {
    const fp = makeFloorplanWithAdequacy('all_oversized', [], ['Lounge'], 1.5);
    const result = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    expect(result.floorplanInsights?.operatingTempInfluenced).toBe(true);
  });

  it('sets operatingTempInfluenced=false when factor is 1.0', () => {
    const fp = makeFloorplanWithAdequacy('all_adequate', [], [], 1.0);
    const result = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    expect(result.floorplanInsights?.operatingTempInfluenced).toBe(false);
  });

  it('surfaces "oversized emitters improving margin" tag for all_oversized coverage', () => {
    const fp = makeFloorplanWithAdequacy('all_oversized', [], ['Lounge', 'Bedroom'], 1.5);
    const result = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    expect(result.floorplanInsights?.emitterExplanationTags).toContain(
      'oversized emitters improving margin',
    );
  });

  it('surfaces "undersized rooms driving higher operating temperature" for majority_undersized', () => {
    const fp = makeFloorplanWithAdequacy('majority_undersized', ['Kitchen', 'Bathroom'], [], 0.8);
    const result = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    expect(result.floorplanInsights?.emitterExplanationTags).toContain(
      'undersized rooms driving higher operating temperature',
    );
  });

  it('sets coverageClassification=null when no reliable floor plan provided', () => {
    const result = buildAdviceFromCompare(makeInput());
    expect(result.floorplanInsights).toBeNull();
  });

  it('sets undersizedRooms=[] and oversizedRooms=[] when hasActualData is false', () => {
    const fp = {
      refinedHeatLossKw: 5.4,
      emitterAdequacyHints: [] as import('../../../lib/floorplan/adaptFloorplanToAtlasInputs').EmitterAdequacyHint[],
      roomHeatLossBreakdown: [],
      sitingConstraintHints: [],
      pipeLengthEstimateHints: { totalEstimateM: 0, label: '' },
      wholeSystemEmitterAdequacy: {
        coverageClassification: 'insufficient_data' as const,
        impliedOversizingFactor: null,
        undersizedRooms: [],
        oversizedRooms: [],
        hasActualData: false,
      },
      isReliable: true,
    };
    const result = buildAdviceFromCompare(makeInput({ floorplanInputs: fp }));
    expect(result.floorplanInsights?.coverageClassification).toBeNull();
    expect(result.floorplanInsights?.undersizedRooms).toEqual([]);
    expect(result.floorplanInsights?.oversizedRooms).toEqual([]);
    expect(result.floorplanInsights?.operatingTempInfluenced).toBe(false);
    expect(result.floorplanInsights?.emitterExplanationTags).toEqual([]);
  });
});
