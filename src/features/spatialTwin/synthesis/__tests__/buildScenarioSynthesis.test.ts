import { describe, it, expect } from 'vitest';
import { buildScenarioSynthesis } from '../buildScenarioSynthesis';
import type { ScenarioResultEnvelope } from '../ScenarioSynthesisModel';
import type { SpatialTwinScenarioV1 } from '../../state/spatialTwin.types';
import type { EngineOutputV1 } from '../../../../contracts/EngineOutputV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeEngineOutput(scoreTotal: number, verdictStatus: 'good' | 'caution' | 'fail' = 'good'): EngineOutputV1 {
  return {
    eligibility: [{ id: 'on_demand', label: 'On Demand (Combi)', status: 'viable' }],
    redFlags: { rejectCombi: false, rejectAshp: false, reasons: [] } as unknown as EngineOutputV1['redFlags'],
    recommendation: { primary: 'On Demand (Combi)' },
    explainers: [],
    verdict: {
      title: `Verdict for score ${scoreTotal}`,
      status: verdictStatus,
      reasons: [`Score is ${scoreTotal}`],
      primaryReason: `Best option scores ${scoreTotal}`,
      confidence: { level: 'high', reasons: [] },
      assumptionsUsed: [],
    },
    options: [
      {
        id: 'combi',
        label: 'On Demand (Combi)',
        status: 'viable',
        headline: `Combi ${scoreTotal}`,
        why: [`Strength at ${scoreTotal}`],
        requirements: [],
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw: { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
        typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        score: { total: scoreTotal, breakdown: [] },
      },
    ],
  };
}

function makeEnvelope(
  scenarioId: string,
  scoreTotal: number,
  verdictStatus: 'good' | 'caution' | 'fail' = 'good',
): ScenarioResultEnvelope {
  const engineOutput = makeEngineOutput(scoreTotal, verdictStatus);
  return {
    scenarioId,
    engineInput: {} as never,
    engineOutput,
    deltaSummary: { addedEntities: [], removedEntities: [], changedEntities: [], totalChanges: 0 },
    summary: {
      scenarioId,
      headline: `Headline ${scenarioId}`,
      primaryReason: `Primary reason for ${scenarioId}`,
      strengths: [`Strength of ${scenarioId}`],
      tradeoffs: [],
      requiredWork: [],
      requiredSafetyAndCompliance: [],
      upgrades: [],
      suitability: verdictStatus === 'good' ? 'recommended' : verdictStatus === 'caution' ? 'possible_with_caveats' : 'less_suited',
    },
  };
}

function makeScenarioState(
  scenarioId: string,
  overrides: Partial<SpatialTwinScenarioV1> = {},
): SpatialTwinScenarioV1 {
  return {
    scenarioId,
    name: `Scenario ${scenarioId}`,
    intent: 'best_fit',
    patchIds: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildScenarioSynthesis — empty input', () => {
  it('returns all-null/empty result when no envelopes provided', () => {
    const result = buildScenarioSynthesis([], []);
    expect(result.recommendedScenarioId).toBeNull();
    expect(result.selectedScenarioId).toBeNull();
    expect(result.rankedScenarioIds).toEqual([]);
    expect(result.envelopes).toEqual([]);
    expect(result.comparisonMatrix.scenarioIds).toEqual([]);
    expect(result.comparisonMatrix.rows).toEqual([]);
    expect(result.explanationsByScenario).toEqual({});
  });
});

describe('buildScenarioSynthesis — ranking', () => {
  it('ranks scenarios descending by best viable option score', () => {
    const envelopes = [
      makeEnvelope('sc-low', 40),
      makeEnvelope('sc-high', 90),
      makeEnvelope('sc-mid', 65),
    ];
    const states = envelopes.map(e => makeScenarioState(e.scenarioId));
    const result = buildScenarioSynthesis(envelopes, states);
    expect(result.rankedScenarioIds).toEqual(['sc-high', 'sc-mid', 'sc-low']);
  });

  it('breaks score ties by preserving original order', () => {
    const envelopes = [
      makeEnvelope('sc-a', 70),
      makeEnvelope('sc-b', 70),
    ];
    const states = envelopes.map(e => makeScenarioState(e.scenarioId));
    const result = buildScenarioSynthesis(envelopes, states);
    // Both have score 70; original order preserved
    expect(result.rankedScenarioIds[0]).toBe('sc-a');
    expect(result.rankedScenarioIds[1]).toBe('sc-b');
  });

  it('uses verdict status fallback when no scored options exist', () => {
    const noScoreEnvelope = (id: string, status: 'good' | 'caution' | 'fail'): ScenarioResultEnvelope => ({
      ...makeEnvelope(id, 0, status),
      engineOutput: {
        ...makeEngineOutput(0, status),
        options: [], // remove scored options
      },
    });

    const envelopes = [
      noScoreEnvelope('sc-caution', 'caution'),
      noScoreEnvelope('sc-fail', 'fail'),
      noScoreEnvelope('sc-good', 'good'),
    ];
    const states = envelopes.map(e => makeScenarioState(e.scenarioId));
    const result = buildScenarioSynthesis(envelopes, states);
    expect(result.rankedScenarioIds[0]).toBe('sc-good');
    expect(result.rankedScenarioIds[1]).toBe('sc-caution');
    expect(result.rankedScenarioIds[2]).toBe('sc-fail');
  });
});

describe('buildScenarioSynthesis — recommendedScenarioId', () => {
  it('uses the highest-ranked scenario as recommended when none is engineer-promoted', () => {
    const envelopes = [makeEnvelope('sc-a', 55), makeEnvelope('sc-b', 80)];
    const states = envelopes.map(e => makeScenarioState(e.scenarioId));
    const result = buildScenarioSynthesis(envelopes, states);
    expect(result.recommendedScenarioId).toBe('sc-b');
  });

  it('uses engineer-promoted scenario over the highest-ranked one', () => {
    const envelopes = [makeEnvelope('sc-a', 90), makeEnvelope('sc-b', 40)];
    const states = [
      makeScenarioState('sc-a'),
      makeScenarioState('sc-b', { isRecommended: true }),
    ];
    const result = buildScenarioSynthesis(envelopes, states);
    expect(result.recommendedScenarioId).toBe('sc-b');
  });

  it('sets recommendedScenarioId from the single envelope', () => {
    const envelopes = [makeEnvelope('sc-only', 60)];
    const result = buildScenarioSynthesis(envelopes, [makeScenarioState('sc-only')]);
    expect(result.recommendedScenarioId).toBe('sc-only');
  });
});

describe('buildScenarioSynthesis — selectedScenarioId', () => {
  it('returns null when no scenario has been selected by the user', () => {
    const envelopes = [makeEnvelope('sc-1', 70)];
    const states = [makeScenarioState('sc-1')];
    expect(buildScenarioSynthesis(envelopes, states).selectedScenarioId).toBeNull();
  });

  it('returns the scenarioId of the customer-selected scenario', () => {
    const envelopes = [makeEnvelope('sc-1', 70), makeEnvelope('sc-2', 50)];
    const states = [
      makeScenarioState('sc-1'),
      makeScenarioState('sc-2', { isSelectedByUser: true }),
    ];
    expect(buildScenarioSynthesis(envelopes, states).selectedScenarioId).toBe('sc-2');
  });

  it('allows selectedScenarioId to differ from recommendedScenarioId', () => {
    const envelopes = [makeEnvelope('sc-best', 90), makeEnvelope('sc-chosen', 40)];
    const states = [
      makeScenarioState('sc-best'),
      makeScenarioState('sc-chosen', { isSelectedByUser: true }),
    ];
    const result = buildScenarioSynthesis(envelopes, states);
    expect(result.recommendedScenarioId).toBe('sc-best');
    expect(result.selectedScenarioId).toBe('sc-chosen');
  });
});

describe('buildScenarioSynthesis — comparison matrix', () => {
  it('matrix scenarioIds are ranked best-first', () => {
    const envelopes = [makeEnvelope('sc-low', 30), makeEnvelope('sc-high', 80)];
    const states = envelopes.map(e => makeScenarioState(e.scenarioId));
    const result = buildScenarioSynthesis(envelopes, states);
    expect(result.comparisonMatrix.scenarioIds[0]).toBe('sc-high');
  });

  it('matrix has rows for the expected comparison dimensions', () => {
    const envelopes = [makeEnvelope('sc-1', 70)];
    const states = [makeScenarioState('sc-1')];
    const result = buildScenarioSynthesis(envelopes, states);
    const rowLabels = result.comparisonMatrix.rows.map(r => r.label);
    expect(rowLabels).toContain('Scenario name');
    expect(rowLabels).toContain('Primary system');
    expect(rowLabels).toContain('Verdict');
    expect(rowLabels).toContain('Score');
  });

  it('scenario name row uses name from scenarioStates', () => {
    const envelopes = [makeEnvelope('sc-1', 70)];
    const states = [makeScenarioState('sc-1', { name: 'Best Fit Option' })];
    const result = buildScenarioSynthesis(envelopes, states);
    const nameRow = result.comparisonMatrix.rows.find(r => r.label === 'Scenario name');
    expect(nameRow?.values['sc-1']).toBe('Best Fit Option');
  });
});

describe('buildScenarioSynthesis — explanations', () => {
  it('recommended scenario explanation references primaryReason', () => {
    const envelopes = [makeEnvelope('sc-1', 80)];
    const states = [makeScenarioState('sc-1')];
    const result = buildScenarioSynthesis(envelopes, states);
    expect(result.explanationsByScenario['sc-1']).toContain('Atlas recommends this scenario');
    expect(result.explanationsByScenario['sc-1']).toContain('sc-1');
  });

  it('non-recommended scenario explanation mentions it was not the top recommendation', () => {
    const envelopes = [makeEnvelope('sc-winner', 90), makeEnvelope('sc-loser', 40)];
    const states = envelopes.map(e => makeScenarioState(e.scenarioId));
    const result = buildScenarioSynthesis(envelopes, states);
    expect(result.explanationsByScenario['sc-loser']).toContain('not the top recommendation');
  });

  it('every envelope has an explanation', () => {
    const envelopes = [makeEnvelope('sc-a', 80), makeEnvelope('sc-b', 60), makeEnvelope('sc-c', 40)];
    const states = envelopes.map(e => makeScenarioState(e.scenarioId));
    const result = buildScenarioSynthesis(envelopes, states);
    for (const id of ['sc-a', 'sc-b', 'sc-c']) {
      expect(result.explanationsByScenario[id]).toBeTruthy();
    }
  });
});

describe('buildScenarioSynthesis — envelopes returned in ranked order', () => {
  it('envelopes in result are ordered by rank', () => {
    const envelopes = [makeEnvelope('sc-low', 20), makeEnvelope('sc-high', 95)];
    const states = envelopes.map(e => makeScenarioState(e.scenarioId));
    const result = buildScenarioSynthesis(envelopes, states);
    expect(result.envelopes[0]?.scenarioId).toBe('sc-high');
    expect(result.envelopes[1]?.scenarioId).toBe('sc-low');
  });
});
