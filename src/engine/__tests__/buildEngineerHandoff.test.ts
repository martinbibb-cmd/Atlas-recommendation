/**
 * buildEngineerHandoff.test.ts
 *
 * PR7 — Unit tests for buildEngineerHandoff.
 * PR13 — Updated for QuoteScopeItem[] includedScope.
 *
 * Coverage:
 *   - Throws when recommendedScenarioId is not found in scenarios[].
 *   - Job summary projects scenarioId, system label, and summary correctly.
 *   - includedScope derives from quoteScope when present (QuoteScopeItem[]).
 *   - includedScope falls back to includedItems string list when quoteScope is empty.
 *   - requiredWorks pass through from AtlasDecisionV1.
 *   - existingSystem uses lifecycle data when engineInput is absent.
 *   - existingSystem uses engineInput data when present (takes precedence).
 *   - measuredFacts includes supportingFacts from AtlasDecisionV1.
 *   - measuredFacts includes additional engineInput facts without duplication.
 *   - installNotes derive from physicsFlags.
 *   - installNotes derive from DHW architecture.
 *   - installNotes derive from lifecycle condition.
 *   - futurePath passes through from AtlasDecisionV1.futureUpgradePaths.
 *   - evidence is empty (placeholder until floor plan / photo truth is fed in).
 */

import { describe, it, expect } from 'vitest';
import { buildEngineerHandoff } from '../modules/buildEngineerHandoff';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { EngineInputV2_3Contract } from '../../../contracts/EngineInputV2_3';
import type { QuoteScopeItem } from '../../../contracts/QuoteScope';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId:  'system_unvented',
    headline:               'A system boiler is the right fit for this home.',
    summary:                'System boiler with unvented cylinder.',
    keyReasons:             ['Mains-fed supply suits household size'],
    avoidedRisks:           [],
    dayToDayOutcomes:       [],
    requiredWorks:          ['Install system boiler'],
    compatibilityWarnings:  [],
    includedItems:          ['210L Mixergy cylinder', 'System boiler'],
    quoteScope:             [],
    futureUpgradePaths:     ['Heat pump pathway via low-temperature emitter spec'],
    supportingFacts: [
      { label: 'System age',   value: '8 years', source: 'survey' },
      { label: 'Boiler type',  value: 'combi',   source: 'survey' },
    ],
    lifecycle: {
      currentSystem: {
        type:      'combi',
        ageYears:  8,
        condition: 'good',
      },
      expectedLifespan: {
        typicalRangeYears:  [12, 15],
        adjustedRangeYears: [11, 14],
      },
      influencingFactors: {
        waterQuality:     'moderate',
        scaleRisk:        'low',
        usageIntensity:   'medium',
        maintenanceLevel: 'average',
      },
      riskIndicators: [],
      summary: 'System in good condition.',
    },
    ...overrides,
  };
}

function makeScenario(
  overrides: Partial<ScenarioResult> = {},
): ScenarioResult {
  return {
    scenarioId: 'system_unvented',
    system: {
      type:    'system',
      summary: 'System boiler with unvented cylinder provides reliable mains-fed supply',
    },
    performance: {
      hotWater:    'excellent',
      heating:     'very_good',
      efficiency:  'good',
      reliability: 'excellent',
    },
    keyBenefits:     ['Reliable mains-fed supply'],
    keyConstraints:  [],
    dayToDayOutcomes: [],
    requiredWorks:   ['Install system boiler', 'G3 commissioning'],
    upgradePaths:    ['Heat pump pathway'],
    physicsFlags: {
      hydraulicLimit:    false,
      combiFlowRisk:     false,
      highTempRequired:  false,
      pressureConstraint: false,
    },
    ...overrides,
  };
}

function makeEngineInput(overrides: Partial<EngineInputV2_3Contract> = {}): EngineInputV2_3Contract {
  return {
    infrastructure: { primaryPipeSizeMm: 22 },
    property:       { peakHeatLossKw: 8.5 },
    occupancy:      { signature: 'steady', peakConcurrentOutlets: 2 },
    dhw:            { architecture: 'stored_standard' },
    services: {
      mainsStaticPressureBar:   3.2,
      mainsDynamicPressureBar:  2.8,
      mainsDynamicFlowLpm:      18,
    },
    currentSystem: {
      boiler: {
        type:           'combi',
        ageYears:       8,
        nominalOutputKw: 28,
      },
    },
    ...overrides,
  };
}

// ─── Error handling ───────────────────────────────────────────────────────────

describe('buildEngineerHandoff — error handling', () => {
  it('throws when recommendedScenarioId is not in scenarios[]', () => {
    const decision = makeDecision({ recommendedScenarioId: 'nonexistent' });
    const scenarios = [makeScenario()];
    expect(() => buildEngineerHandoff(decision, scenarios)).toThrow(
      /recommended scenario "nonexistent" not found/,
    );
  });
});

// ─── Job summary ──────────────────────────────────────────────────────────────

describe('buildEngineerHandoff — job summary', () => {
  it('sets recommendedScenarioId from decision', () => {
    const decision  = makeDecision();
    const scenarios = [makeScenario()];
    const result    = buildEngineerHandoff(decision, scenarios);
    expect(result.jobSummary.recommendedScenarioId).toBe('system_unvented');
  });

  it('maps system type to a human-readable label', () => {
    const decision  = makeDecision();
    const scenarios = [makeScenario()];
    const result    = buildEngineerHandoff(decision, scenarios);
    expect(result.jobSummary.recommendedSystemLabel).toBe('System boiler');
  });

  it('sets summary from the recommended scenario system summary', () => {
    const decision  = makeDecision();
    const scenarios = [makeScenario()];
    const result    = buildEngineerHandoff(decision, scenarios);
    expect(result.jobSummary.summary).toBe(
      'System boiler with unvented cylinder provides reliable mains-fed supply',
    );
  });

  it('maps combi system type to the correct label', () => {
    const decision  = makeDecision({ recommendedScenarioId: 'combi' });
    const scenarios = [makeScenario({ scenarioId: 'combi', system: { type: 'combi', summary: 'Combi summary' } })];
    const result    = buildEngineerHandoff(decision, scenarios);
    expect(result.jobSummary.recommendedSystemLabel).toBe('Combi boiler');
  });

  it('maps ashp system type to the correct label', () => {
    const decision  = makeDecision({ recommendedScenarioId: 'ashp' });
    const scenarios = [makeScenario({ scenarioId: 'ashp', system: { type: 'ashp', summary: 'HP summary' } })];
    const result    = buildEngineerHandoff(decision, scenarios);
    expect(result.jobSummary.recommendedSystemLabel).toBe('Air source heat pump');
  });
});

// ─── Scope pass-through ───────────────────────────────────────────────────────

describe('buildEngineerHandoff — scope pass-through', () => {
  it('includedScope falls back to includedItems when quoteScope is empty', () => {
    const decision  = makeDecision({ includedItems: ['210L Mixergy cylinder', 'System boiler'], quoteScope: [] });
    const result    = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.includedScope.map(i => i.label)).toEqual(['210L Mixergy cylinder', 'System boiler']);
  });

  it('includedScope uses quoteScope included items when quoteScope is non-empty', () => {
    const scopeItems: QuoteScopeItem[] = [
      { id: 's1', label: '210L Mixergy cylinder', category: 'hot_water', status: 'included' },
      { id: 's2', label: 'System boiler',         category: 'heat_source', status: 'included' },
    ];
    const decision = makeDecision({ quoteScope: scopeItems });
    const result   = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.includedScope).toEqual(scopeItems);
  });

  it('includedScope excludes optional/future items from quoteScope', () => {
    const scopeItems: QuoteScopeItem[] = [
      { id: 's1', label: 'System boiler',   category: 'heat_source', status: 'included' },
      { id: 's2', label: 'Solar pathway',   category: 'future',      status: 'optional' },
    ];
    const decision = makeDecision({ quoteScope: scopeItems });
    const result   = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.includedScope).toHaveLength(1);
    expect(result.includedScope[0].label).toBe('System boiler');
  });

  it('passes requiredWorks through unchanged', () => {
    const decision  = makeDecision({ requiredWorks: ['Install system boiler', 'G3 commissioning'] });
    const result    = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.requiredWorks).toEqual(['Install system boiler', 'G3 commissioning']);
  });

  it('passes compatibilityWarnings through unchanged', () => {
    const decision  = makeDecision({ compatibilityWarnings: ['Hydraulic assessment required'] });
    const result    = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.compatibilityWarnings).toEqual(['Hydraulic assessment required']);
  });

  it('passes keyReasons through unchanged', () => {
    const decision  = makeDecision({ keyReasons: ['Mains-fed supply suits household size'] });
    const result    = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.keyReasons).toEqual(['Mains-fed supply suits household size']);
  });

  it('passes futureUpgradePaths through as futurePath', () => {
    const decision = makeDecision({ futureUpgradePaths: ['Heat pump pathway'] });
    const result   = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.futurePath).toEqual(['Heat pump pathway']);
  });
});

// ─── Existing system ──────────────────────────────────────────────────────────

describe('buildEngineerHandoff — existing system', () => {
  it('uses lifecycle type and ageYears when no engineInput', () => {
    const decision = makeDecision();
    const result   = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.existingSystem.boilerType).toBe('combi');
    expect(result.existingSystem.boilerAgeYears).toBe(8);
  });

  it('uses engineInput boiler type when present', () => {
    const decision    = makeDecision();
    const engineInput = makeEngineInput({ currentSystem: { boiler: { type: 'system', ageYears: 12 } } });
    const result      = buildEngineerHandoff(decision, [makeScenario()], engineInput);
    expect(result.existingSystem.boilerType).toBe('system');
    expect(result.existingSystem.boilerAgeYears).toBe(12);
  });

  it('includes nominalOutputKw from engineInput', () => {
    const decision    = makeDecision();
    const engineInput = makeEngineInput();
    const result      = buildEngineerHandoff(decision, [makeScenario()], engineInput);
    expect(result.existingSystem.nominalOutputKw).toBe(28);
  });

  it('includes hotWaterType from engineInput DHW architecture', () => {
    const decision    = makeDecision();
    const engineInput = makeEngineInput({ dhw: { architecture: 'stored_mixergy' } });
    const result      = buildEngineerHandoff(decision, [makeScenario()], engineInput);
    expect(result.existingSystem.hotWaterType).toBe('stored_mixergy');
  });

  it('omits boilerAgeYears when lifecycle ageYears is 0 and no engineInput', () => {
    const decision = makeDecision();
    decision.lifecycle.currentSystem.ageYears = 0;
    const result = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.existingSystem.boilerAgeYears).toBeUndefined();
  });
});

// ─── Measured facts ───────────────────────────────────────────────────────────

describe('buildEngineerHandoff — measured facts', () => {
  it('includes supportingFacts from AtlasDecisionV1', () => {
    const result = buildEngineerHandoff(makeDecision(), [makeScenario()]);
    expect(result.measuredFacts.some(f => f.label === 'System age')).toBe(true);
    expect(result.measuredFacts.some(f => f.label === 'Boiler type')).toBe(true);
  });

  it('adds primary pipe diameter from engineInput', () => {
    const result = buildEngineerHandoff(makeDecision(), [makeScenario()], makeEngineInput());
    const fact   = result.measuredFacts.find(f => f.label === 'Primary pipe diameter');
    expect(fact?.value).toBe('22 mm');
    expect(fact?.source).toBe('survey');
  });

  it('adds peak heat loss from engineInput', () => {
    const result = buildEngineerHandoff(makeDecision(), [makeScenario()], makeEngineInput());
    const fact   = result.measuredFacts.find(f => f.label === 'Peak heat loss');
    expect(fact?.value).toBe('8.5 kW');
    expect(fact?.source).toBe('engine');
  });

  it('adds mains pressure from engineInput', () => {
    const result = buildEngineerHandoff(makeDecision(), [makeScenario()], makeEngineInput());
    expect(result.measuredFacts.some(f => f.label === 'Mains static pressure')).toBe(true);
    expect(result.measuredFacts.some(f => f.label === 'Mains dynamic pressure')).toBe(true);
  });

  it('does not duplicate facts already present in supportingFacts', () => {
    const decision = makeDecision({
      supportingFacts: [
        { label: 'Primary pipe diameter', value: '22 mm', source: 'survey' },
      ],
    });
    const result = buildEngineerHandoff(decision, [makeScenario()], makeEngineInput());
    const matches = result.measuredFacts.filter(f => f.label === 'Primary pipe diameter');
    expect(matches).toHaveLength(1);
  });
});

// ─── Install notes ────────────────────────────────────────────────────────────

describe('buildEngineerHandoff — install notes', () => {
  it('adds a note when hydraulicLimit flag is set', () => {
    const scenarios = [makeScenario({ physicsFlags: { hydraulicLimit: true } })];
    const result    = buildEngineerHandoff(makeDecision(), scenarios);
    expect(result.installNotes.some(n => /verify flow rate/i.test(n))).toBe(true);
  });

  it('adds a note when pressureConstraint flag is set', () => {
    const scenarios = [makeScenario({ physicsFlags: { pressureConstraint: true } })];
    const result    = buildEngineerHandoff(makeDecision(), scenarios);
    expect(result.installNotes.some(n => /discharge route/i.test(n))).toBe(true);
  });

  it('adds a note when highTempRequired flag is set', () => {
    const scenarios = [makeScenario({ physicsFlags: { highTempRequired: true } })];
    const result    = buildEngineerHandoff(makeDecision(), scenarios);
    expect(result.installNotes.some(n => /radiator/i.test(n))).toBe(true);
  });

  it('adds a note when combiFlowRisk flag is set', () => {
    const scenarios = [makeScenario({ physicsFlags: { combiFlowRisk: true } })];
    const result    = buildEngineerHandoff(makeDecision(), scenarios);
    expect(result.installNotes.some(n => /cylinder sizing/i.test(n))).toBe(true);
  });

  it('adds a Mixergy note when DHW architecture is stored_mixergy', () => {
    const engineInput = makeEngineInput({ dhw: { architecture: 'stored_mixergy' } });
    const result      = buildEngineerHandoff(makeDecision(), [makeScenario()], engineInput);
    expect(result.installNotes.some(n => /mixergy/i.test(n))).toBe(true);
  });

  it('adds G3 note when DHW architecture is stored_standard', () => {
    const engineInput = makeEngineInput({ dhw: { architecture: 'stored_standard' } });
    const result      = buildEngineerHandoff(makeDecision(), [makeScenario()], engineInput);
    expect(result.installNotes.some(n => /g3/i.test(n))).toBe(true);
  });

  it('adds lifecycle note when condition is at_risk', () => {
    const decision = makeDecision();
    decision.lifecycle.currentSystem.condition = 'at_risk';
    const result = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.installNotes.some(n => /beyond typical service life/i.test(n))).toBe(true);
  });

  it('adds lifecycle note when condition is worn', () => {
    const decision = makeDecision();
    decision.lifecycle.currentSystem.condition = 'worn';
    const result = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.installNotes.some(n => /beyond typical service life/i.test(n))).toBe(true);
  });

  it('does not add lifecycle note when condition is good', () => {
    const decision = makeDecision();
    decision.lifecycle.currentSystem.condition = 'good';
    const result = buildEngineerHandoff(decision, [makeScenario()]);
    expect(result.installNotes.every(n => !/beyond typical service life/i.test(n))).toBe(true);
  });
});

// ─── Evidence ─────────────────────────────────────────────────────────────────

describe('buildEngineerHandoff — evidence', () => {
  it('returns empty evidence array (placeholder until floor plan truth is available)', () => {
    const result = buildEngineerHandoff(makeDecision(), [makeScenario()]);
    expect(result.evidence).toEqual([]);
  });
});
