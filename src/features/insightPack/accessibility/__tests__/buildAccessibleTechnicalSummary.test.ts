/**
 * buildAccessibleTechnicalSummary.test.ts
 *
 * Tests for the Atlas Accessible Technical Summary builder.
 *
 * Verifies:
 *   - Output includes PV / battery / low-carbon objectives when present in engine output.
 *   - Recommendation matches decision.recommendedScenarioId — never re-derived.
 *   - No independent recommendation selection: recommendation comes only from
 *     the supplied AtlasDecisionV1.
 *   - No "simultaneity" reason for 1 bathroom / ≤ 2 occupants unless engine
 *     explicitly raised a combi-simultaneous-demand red flag.
 *   - plainText does not contain a JSON dump.
 *   - JSON structure is complete and well-formed.
 *   - LLM grounding note is present.
 *   - Deterministic output for same inputs (no Math.random).
 */

import { describe, it, expect } from 'vitest';
import {
  buildAccessibleTechnicalSummary,
  LLM_GROUNDING_NOTE,
  ACCESSIBLE_SUMMARY_SCHEMA_VERSION,
} from '../buildAccessibleTechnicalSummary';
import type { EngineOutputV1 } from '../../../../contracts/EngineOutputV1';
import type { AtlasDecisionV1 } from '../../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../../contracts/ScenarioResult';
import type { InsightPackSurveyContext } from '../../buildInsightPackFromEngine';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeMinimalEngineOutput(
  overrides: Partial<EngineOutputV1> = {},
): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'System boiler with stored cylinder' },
    explainers: [],
    options: [],
    ...overrides,
  };
}

function makeScenario(
  scenarioId: string,
  systemType: ScenarioResult['system']['type'],
  overrides: Partial<ScenarioResult> = {},
): ScenarioResult {
  return {
    scenarioId,
    system: { type: systemType, summary: `${systemType} system` },
    performance: {
      hotWater: 'good',
      heating: 'good',
      efficiency: 'good',
      reliability: 'good',
    },
    keyBenefits: ['Physics-derived benefit'],
    keyConstraints: [`Physics-derived constraint for ${scenarioId}`],
    dayToDayOutcomes: ['Day-to-day outcome A'],
    requiredWorks: [],
    upgradePaths: [],
    physicsFlags: {},
    ...overrides,
  };
}

function makeDecision(
  recommendedScenarioId: string,
  overrides: Partial<AtlasDecisionV1> = {},
): AtlasDecisionV1 {
  return {
    recommendedScenarioId,
    headline: 'A system boiler with stored cylinder is the right fit for this home.',
    summary: 'Physics-driven summary.',
    keyReasons: ['Physics reason A', 'Physics reason B'],
    avoidedRisks: ['Avoided risk A'],
    dayToDayOutcomes: ['Outcome A'],
    requiredWorks: [],
    compatibilityWarnings: [],
    includedItems: [],
    quoteScope: [],
    futureUpgradePaths: [],
    supportingFacts: [],
    lifecycle: {
      currentSystem: { type: 'combi', ageYears: 12, condition: 'worn' },
      summary: 'Boiler is near end of serviceable life.',
      influencingFactors: {
        waterQuality: 'unknown',
        scaleRisk: 'low',
        usageIntensity: 'moderate',
      },
      replacementTimeline: { horizon: '1_2_years', urgency: 'high', bands: [] },
    },
    ...overrides,
  };
}

// ─── JSON structure ───────────────────────────────────────────────────────────

describe('JSON structure', () => {
  it('returns schemaVersion, generatedAt, and llmGroundingNote', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.schemaVersion).toBe(ACCESSIBLE_SUMMARY_SCHEMA_VERSION);
    expect(summary.json.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(summary.json.llmGroundingNote).toBe(LLM_GROUNDING_NOTE);
  });

  it('recommendation.recommendedScenarioId matches decision.recommendedScenarioId', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.recommendation.recommendedScenarioId).toBe('system_unvented');
  });

  it('recommendation.keyReasons comes from decision.keyReasons', () => {
    const decision = makeDecision('system_unvented', {
      keyReasons: ['Reason Alpha', 'Reason Beta'],
    });
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      decision,
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.recommendation.keyReasons).toContain('Reason Alpha');
    expect(summary.json.recommendation.keyReasons).toContain('Reason Beta');
  });

  it('recommendation.avoidedRisks comes from decision.avoidedRisks', () => {
    const decision = makeDecision('system_unvented', {
      avoidedRisks: ['Risk X', 'Risk Y'],
    });
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      decision,
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.recommendation.avoidedRisks).toContain('Risk X');
    expect(summary.json.recommendation.avoidedRisks).toContain('Risk Y');
  });
});

// ─── No independent recommendation selection ──────────────────────────────────

describe('no independent recommendation selection', () => {
  it('recommendedScenarioId is always taken from decision, not re-derived from engine output', () => {
    // Engine recommends "combi" but decision says "system_unvented" — summary must follow decision.
    const output = makeMinimalEngineOutput({
      recommendation: { primary: 'Combination boiler (on-demand hot water)' },
    });
    const summary = buildAccessibleTechnicalSummary(
      output,
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system'), makeScenario('combi', 'combi')],
    );
    expect(summary.json.recommendation.recommendedScenarioId).toBe('system_unvented');
    expect(summary.json.recommendation.recommendedScenarioId).not.toBe('combi');
  });

  it('rejected scenarios list contains non-recommended scenarios from the scenarios array', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [
        makeScenario('system_unvented', 'system'),
        makeScenario('combi', 'combi'),
        makeScenario('ashp', 'ashp'),
      ],
    );
    const ids = summary.json.rejectedScenarios.map(r => r.scenarioId);
    expect(ids).toContain('combi');
    expect(ids).toContain('ashp');
    expect(ids).not.toContain('system_unvented');
  });

  it('rejected scenario entry contains engine-derived keyConstraints', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [
        makeScenario('system_unvented', 'system'),
        makeScenario('combi', 'combi', {
          keyConstraints: ['Combi constraint from engine'],
        }),
      ],
    );
    const combiRejected = summary.json.rejectedScenarios.find(r => r.scenarioId === 'combi');
    expect(combiRejected?.keyConstraints).toContain('Combi constraint from engine');
  });
});

// ─── Energy context — solar PV and battery / EV ───────────────────────────────

describe('energy context', () => {
  it('includes solarPv block when futureEnergyOpportunities.solarPv is present', () => {
    const output = makeMinimalEngineOutput({
      futureEnergyOpportunities: {
        solarPv: {
          status: 'suitable_now',
          summary: 'South-facing roof is suitable for solar PV.',
          reasons: [],
          checksRequired: [],
        },
        evCharging: {
          status: 'check_required',
          summary: 'Supply capacity check required.',
          reasons: [],
          checksRequired: [],
        },
      },
    });
    const summary = buildAccessibleTechnicalSummary(
      output,
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.energyContext.solarPv).toBeDefined();
    expect(summary.json.energyContext.solarPv?.status).toBe('suitable_now');
    expect(summary.json.energyContext.solarPv?.summary).toContain('solar PV');
  });

  it('includes evBatteryReadiness block when futureEnergyOpportunities.evCharging is present', () => {
    const output = makeMinimalEngineOutput({
      futureEnergyOpportunities: {
        solarPv: {
          status: 'check_required',
          summary: 'Roof survey required.',
          reasons: [],
          checksRequired: [],
        },
        evCharging: {
          status: 'suitable_now',
          summary: 'Supply capacity is sufficient for EV charging.',
          reasons: [],
          checksRequired: [],
        },
      },
    });
    const summary = buildAccessibleTechnicalSummary(
      output,
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.energyContext.evBatteryReadiness).toBeDefined();
    expect(summary.json.energyContext.evBatteryReadiness?.status).toBe('suitable_now');
  });

  it('solarPv is absent when futureEnergyOpportunities is not present', () => {
    const output = makeMinimalEngineOutput();
    const summary = buildAccessibleTechnicalSummary(
      output,
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.energyContext.solarPv).toBeUndefined();
    expect(summary.json.energyContext.evBatteryReadiness).toBeUndefined();
  });

  it('lowCarbonObjective is true when recommended scenario is ASHP', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('ashp'),
      [makeScenario('ashp', 'ashp')],
    );
    expect(summary.json.energyContext.lowCarbonObjective).toBe(true);
  });

  it('lowCarbonObjective is true when solar PV status is suitable_now', () => {
    const output = makeMinimalEngineOutput({
      futureEnergyOpportunities: {
        solarPv: {
          status: 'suitable_now',
          summary: 'Suitable.',
          reasons: [],
          checksRequired: [],
        },
        evCharging: {
          status: 'not_currently_favoured',
          summary: 'Not favoured.',
          reasons: [],
          checksRequired: [],
        },
      },
    });
    const summary = buildAccessibleTechnicalSummary(
      output,
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.energyContext.lowCarbonObjective).toBe(true);
  });

  it('lowCarbonObjective is false when no ASHP and no suitable PV/EV', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.energyContext.lowCarbonObjective).toBe(false);
  });
});

// ─── Simultaneity guard ───────────────────────────────────────────────────────

describe('simultaneity guard', () => {
  it('for 1 bathroom / 2 occupants: simultaneity is NOT in keyReasons without engine flag', () => {
    const decision = makeDecision('combi', {
      keyReasons: [
        'Low demand profile matches combi capacity.',
        'Simultaneous demand is not a concern for this household.',
      ],
    });
    const ctx: InsightPackSurveyContext = { occupancyCount: 2, bathroomCount: 1 };
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      decision,
      [makeScenario('combi', 'combi')],
      ctx,
    );
    const reasons = summary.json.recommendation.keyReasons.join(' ').toLowerCase();
    expect(reasons).not.toMatch(/simultan/);
  });

  it('for 1 bathroom / 2 occupants: simultaneity IS present when engine flags it', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'combi-simultaneous-demand',
          severity: 'fail',
          title: 'Simultaneous demand exceeds combi capacity',
          detail: 'Two bathrooms detected.',
        },
      ],
    });
    const decision = makeDecision('system_unvented', {
      keyReasons: ['Simultaneous demand exceeds combi capacity.'],
    });
    const ctx: InsightPackSurveyContext = { occupancyCount: 2, bathroomCount: 1 };
    const summary = buildAccessibleTechnicalSummary(
      output,
      decision,
      [makeScenario('system_unvented', 'system')],
      ctx,
    );
    const reasons = summary.json.recommendation.keyReasons.join(' ').toLowerCase();
    expect(reasons).toContain('simultan');
  });

  it('for 3+ occupants or 2+ bathrooms: simultaneity reasons are not filtered', () => {
    const decision = makeDecision('system_unvented', {
      keyReasons: [
        'Simultaneous demand from two bathrooms exceeds combi capacity.',
      ],
    });
    const ctx: InsightPackSurveyContext = { occupancyCount: 4, bathroomCount: 2 };
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      decision,
      [makeScenario('system_unvented', 'system')],
      ctx,
    );
    const reasons = summary.json.recommendation.keyReasons.join(' ').toLowerCase();
    expect(reasons).toContain('simultan');
  });
});

// ─── Plain text ───────────────────────────────────────────────────────────────

describe('plain text', () => {
  it('plainText does not contain a JSON dump (no raw JSON braces)', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    // Plain text must not contain raw JSON object notation
    expect(summary.plainText).not.toMatch(/\{[\s\S]*"schemaVersion"/);
  });

  it('plainText contains the LLM grounding note', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.plainText).toContain(LLM_GROUNDING_NOTE);
  });

  it('plainText contains the recommendation headline', () => {
    const decision = makeDecision('system_unvented', {
      headline: 'A system boiler with stored cylinder is the right fit.',
    });
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      decision,
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.plainText).toContain('A system boiler with stored cylinder is the right fit.');
  });

  it('plainText includes surveyed facts when survey context is provided', () => {
    const ctx: InsightPackSurveyContext = {
      occupancyCount: 3,
      bathroomCount: 2,
      heatLossWatts: 5200,
    };
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
      ctx,
    );
    expect(summary.plainText).toContain('3 person(s)');
    expect(summary.plainText).toContain('Bathrooms: 2');
    expect(summary.plainText).toContain('5200 W');
  });

  it('plainText includes solar PV block when engine provides it', () => {
    const output = makeMinimalEngineOutput({
      futureEnergyOpportunities: {
        solarPv: {
          status: 'suitable_now',
          summary: 'South-facing roof is suitable.',
          reasons: [],
          checksRequired: [],
        },
        evCharging: {
          status: 'check_required',
          summary: 'Needs supply capacity check.',
          reasons: [],
          checksRequired: [],
        },
      },
    });
    const summary = buildAccessibleTechnicalSummary(
      output,
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.plainText).toContain('Solar PV');
    expect(summary.plainText).toContain('South-facing roof');
  });

  it('plainText includes rejected scenario section when non-recommended scenarios are present', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [
        makeScenario('system_unvented', 'system'),
        makeScenario('combi', 'combi', { keyConstraints: ['Combi constraint from engine'] }),
      ],
    );
    expect(summary.plainText).toContain('combi');
    expect(summary.plainText).toContain('Combi constraint from engine');
  });
});

// ─── Surveyed facts ───────────────────────────────────────────────────────────

describe('surveyed facts', () => {
  it('surveyedFacts is empty object when no survey context is provided', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.surveyedFacts).toEqual({});
  });

  it('surveyedFacts includes occupancyCount and bathroomCount from context', () => {
    const ctx: InsightPackSurveyContext = { occupancyCount: 4, bathroomCount: 2 };
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
      ctx,
    );
    expect(summary.json.surveyedFacts.occupancyCount).toBe(4);
    expect(summary.json.surveyedFacts.bathroomCount).toBe(2);
  });

  it('currentSystem is included when boiler type is known', () => {
    const ctx: InsightPackSurveyContext = {
      currentBoiler: { type: 'combi', ageYears: 14, condensing: 'yes' },
    };
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
      ctx,
    );
    expect(summary.json.surveyedFacts.currentSystem?.type).toBe('combi');
    expect(summary.json.surveyedFacts.currentSystem?.ageYears).toBe(14);
  });

  it('currentSystem is absent when boiler type is unknown', () => {
    const ctx: InsightPackSurveyContext = {
      currentBoiler: { type: 'unknown' },
    };
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
      ctx,
    );
    expect(summary.json.surveyedFacts.currentSystem).toBeUndefined();
  });
});

// ─── QuoteScopeItems ──────────────────────────────────────────────────────────

describe('quoteScopeItems', () => {
  it('quoteScopeItems is absent when not supplied', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.quoteScopeItems).toBeUndefined();
  });

  it('quoteScopeItems is absent when an empty array is supplied', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
      undefined,
      [],
    );
    expect(summary.json.quoteScopeItems).toBeUndefined();
  });

  it('quoteScopeItems is included when items are supplied', () => {
    const items = [
      {
        id: 'gas_system_boiler',
        label: 'Gas system boiler',
        category: 'heat_source' as const,
        status: 'included' as const,
      },
    ];
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
      undefined,
      items,
    );
    expect(summary.json.quoteScopeItems).toHaveLength(1);
    expect(summary.json.quoteScopeItems![0].id).toBe('gas_system_boiler');
  });
});

// ─── Confidence ───────────────────────────────────────────────────────────────

describe('confidence', () => {
  it('confidence.level matches engine meta confidence when present', () => {
    const output = makeMinimalEngineOutput({
      meta: {
        engineVersion: '2.3.0',
        contractVersion: '1.0.0',
        confidence: {
          level: 'high',
          reasons: ['Mains pressure measured directly.'],
        },
      },
    });
    const summary = buildAccessibleTechnicalSummary(
      output,
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.confidence.level).toBe('high');
    expect(summary.json.confidence.reasons).toContain('Mains pressure measured directly.');
  });

  it('confidence fields are empty when engine meta is absent', () => {
    const summary = buildAccessibleTechnicalSummary(
      makeMinimalEngineOutput(),
      makeDecision('system_unvented'),
      [makeScenario('system_unvented', 'system')],
    );
    expect(summary.json.confidence.level).toBeUndefined();
    expect(summary.json.confidence.reasons).toHaveLength(0);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('determinism (no Math.random)', () => {
  it('JSON structure is identical on repeated calls except generatedAt', () => {
    const output = makeMinimalEngineOutput();
    const decision = makeDecision('system_unvented');
    const scenarios = [makeScenario('system_unvented', 'system')];

    const s1 = buildAccessibleTechnicalSummary(output, decision, scenarios);
    const s2 = buildAccessibleTechnicalSummary(output, decision, scenarios);

    // Everything except generatedAt must be identical
    const j1 = { ...s1.json, generatedAt: 'FIXED' };
    const j2 = { ...s2.json, generatedAt: 'FIXED' };
    expect(JSON.stringify(j1)).toBe(JSON.stringify(j2));
  });
});
