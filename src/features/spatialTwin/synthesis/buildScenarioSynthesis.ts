/**
 * buildScenarioSynthesis.ts — PR6
 *
 * Synthesizes a list of ScenarioResultEnvelopes into a complete
 * ScenarioSynthesisResult: ranked shortlist, recommended/selected IDs,
 * comparison matrix, and per-scenario "Why Atlas suggested this" explanations.
 *
 * Ranking algorithm:
 *   1. Best viable option score from engineOutput.options[].score.total.
 *   2. When no scored options exist, fall back to verdict status:
 *      good=75, caution=40, fail=10.
 *   3. Ties broken by scenario creation order (stable sort, first wins).
 *
 * recommendedScenarioId resolution:
 *   1. Scenario explicitly marked isRecommended=true in scenarioStates (engineer-promoted).
 *   2. Highest-ranked scenario from the computed ranking.
 *   3. null when envelopes is empty.
 *
 * selectedScenarioId:
 *   - First scenario with isSelectedByUser=true in scenarioStates.
 *   - null when none has been selected.
 */

import type { SpatialTwinScenarioV1 } from '../state/spatialTwin.types';
import type {
  ScenarioResultEnvelope,
  ScenarioSynthesisResult,
  ScenarioComparisonMatrix,
  ScenarioComparisonMatrixRow,
} from './ScenarioSynthesisModel';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

/** Fallback scenario display name when the ID is not found in the name map. */
const UNKNOWN_SCENARIO_NAME = 'top scenario';

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Compute a deterministic rank score for a single scenario envelope.
 * Higher is better.
 */
function computeRankScore(output: EngineOutputV1): number {
  const bestOptionScore = (output.options ?? [])
    .filter(o => o.status === 'viable')
    .map(o => o.score?.total ?? 0)
    .reduce<number>((max, s) => (s > max ? s : max), 0);

  if (bestOptionScore > 0) return bestOptionScore;

  // Fallback when no scored options are present
  const status = output.verdict?.status;
  if (status === 'good') return 75;
  if (status === 'caution') return 40;
  return 10;
}

/**
 * Rank envelopes descending by score.  The original order is preserved for ties
 * so the result is stable across multiple calls.
 */
function rankEnvelopes(envelopes: readonly ScenarioResultEnvelope[]): readonly ScenarioResultEnvelope[] {
  return [...envelopes].sort((a, b) => {
    const scoreA = computeRankScore(a.engineOutput);
    const scoreB = computeRankScore(b.engineOutput);
    return scoreB - scoreA;
  });
}

// ─── Comparison matrix ────────────────────────────────────────────────────────

function buildComparisonMatrix(
  ranked: readonly ScenarioResultEnvelope[],
  scenarioStates: readonly SpatialTwinScenarioV1[],
): ScenarioComparisonMatrix {
  if (ranked.length === 0) {
    return { scenarioIds: [], rows: [] };
  }

  const scenarioIds = ranked.map(e => e.scenarioId);

  const nameById = new Map(scenarioStates.map(s => [s.scenarioId, s.name]));

  const rows: ScenarioComparisonMatrixRow[] = [
    {
      label: 'Scenario name',
      values: Object.fromEntries(
        ranked.map(e => [e.scenarioId, nameById.get(e.scenarioId) ?? e.scenarioId]),
      ),
    },
    {
      label: 'Primary system',
      values: Object.fromEntries(
        ranked.map(e => [e.scenarioId, e.engineOutput.recommendation.primary]),
      ),
    },
    {
      label: 'Verdict',
      values: Object.fromEntries(
        ranked.map(e => [e.scenarioId, e.summary.suitability]),
      ),
    },
    {
      label: 'Score',
      values: Object.fromEntries(
        ranked.map(e => [e.scenarioId, computeRankScore(e.engineOutput)]),
      ),
    },
    {
      label: 'Required work items',
      values: Object.fromEntries(
        ranked.map(e => [e.scenarioId, e.summary.requiredWork.length]),
      ),
    },
    {
      label: 'Trade-offs',
      values: Object.fromEntries(
        ranked.map(e => [e.scenarioId, e.summary.tradeoffs.length]),
      ),
    },
    {
      label: 'Spatial changes',
      values: Object.fromEntries(
        ranked.map(e => [e.scenarioId, e.deltaSummary.totalChanges]),
      ),
    },
  ];

  return { scenarioIds, rows };
}

// ─── Explanations ─────────────────────────────────────────────────────────────

function buildExplanations(
  ranked: readonly ScenarioResultEnvelope[],
  scenarioStates: readonly SpatialTwinScenarioV1[],
  recommendedId: string | null,
): Record<string, string> {
  const nameById = new Map(scenarioStates.map(s => [s.scenarioId, s.name]));
  const topEnvelope = ranked[0];
  const topName = topEnvelope != null ? (nameById.get(topEnvelope.scenarioId) ?? UNKNOWN_SCENARIO_NAME) : UNKNOWN_SCENARIO_NAME;

  const explanations: Record<string, string> = {};

  for (const envelope of ranked) {
    const name = nameById.get(envelope.scenarioId) ?? envelope.scenarioId;
    const isRecommended = envelope.scenarioId === recommendedId;

    if (isRecommended) {
      const reason = envelope.summary.primaryReason;
      explanations[envelope.scenarioId] = reason.length > 0
        ? `Atlas recommends this scenario: ${reason}`
        : `Atlas recommends this scenario as the best overall fit for this property.`;
    } else {
      // Explain why this scenario ranked lower
      const limitingReason =
        envelope.summary.tradeoffs[0]
        ?? envelope.engineOutput.verdict?.reasons?.[0]
        ?? null;

      const topPrimaryReason =
        topEnvelope != null
          ? (topEnvelope.summary.primaryReason.length > 0 ? topEnvelope.summary.primaryReason : null)
          : null;

      let explanation = `${name} was not the top recommendation.`;
      if (limitingReason != null) {
        explanation += ` The primary constraint was: ${limitingReason}.`;
      }
      if (topPrimaryReason != null) {
        explanation += ` ${topName} was preferred because: ${topPrimaryReason}.`;
      }
      explanations[envelope.scenarioId] = explanation;
    }
  }

  return explanations;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Synthesize a set of ScenarioResultEnvelopes into a complete ScenarioSynthesisResult.
 *
 * @param envelopes       Derived engine-run results, one per included scenario.
 * @param scenarioStates  SpatialTwinScenarioV1 records for isRecommended / isSelectedByUser flags.
 * @returns               Ranked shortlist, comparison matrix, and per-scenario explanations.
 */
export function buildScenarioSynthesis(
  envelopes: readonly ScenarioResultEnvelope[],
  scenarioStates: readonly SpatialTwinScenarioV1[],
): ScenarioSynthesisResult {
  if (envelopes.length === 0) {
    return {
      recommendedScenarioId: null,
      selectedScenarioId: null,
      rankedScenarioIds: [],
      comparisonMatrix: { scenarioIds: [], rows: [] },
      explanationsByScenario: {},
      envelopes: [],
    };
  }

  const ranked = rankEnvelopes(envelopes);
  const rankedScenarioIds = ranked.map(e => e.scenarioId);

  // recommendedScenarioId: engineer-promoted > highest-ranked
  const engineerRecommended = scenarioStates.find(s => s.isRecommended === true);
  const recommendedScenarioId = engineerRecommended?.scenarioId ?? rankedScenarioIds[0] ?? null;

  // selectedScenarioId: first scenario the customer has selected
  const customerSelected = scenarioStates.find(s => s.isSelectedByUser === true);
  const selectedScenarioId = customerSelected?.scenarioId ?? null;

  const comparisonMatrix = buildComparisonMatrix(ranked, scenarioStates);
  const explanationsByScenario = buildExplanations(ranked, scenarioStates, recommendedScenarioId);

  return {
    recommendedScenarioId,
    selectedScenarioId,
    rankedScenarioIds,
    comparisonMatrix,
    explanationsByScenario,
    envelopes: ranked,
  };
}
