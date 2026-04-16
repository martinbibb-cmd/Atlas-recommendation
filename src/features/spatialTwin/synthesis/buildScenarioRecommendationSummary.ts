/**
 * buildScenarioRecommendationSummary.ts — PR6
 *
 * Derives a ScenarioRecommendationSummary from a single scenario's EngineOutputV1.
 *
 * Rules:
 *   - headline  : verdict.title  →  recommendation.primary  →  'No recommendation'
 *   - primaryReason: verdict.primaryReason  →  verdict.reasons[0]  →  option headline
 *   - strengths : primary viable option's why[] (up to 4)
 *   - tradeoffs : warn/fail limiter impact summaries (up to 3)
 *   - requiredWork : primary option typedRequirements.mustHave
 *   - requiredSafetyAndCompliance : primary option typedRequirements.complianceRequired
 *   - upgrades  : primary option typedRequirements.likelyUpgrades
 *   - suitability: verdict.status → option.status → eligibility fallback
 */

import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { OptionCardV1 } from '../../../contracts/EngineOutputV1';
import type { ScenarioRecommendationSummary, ScenarioSuitability } from './ScenarioSynthesisModel';

/**
 * Resolve the primary recommended option card from the engine output.
 *
 * Resolution order:
 *   1. Option whose label matches recommendation.primary (engine's own choice).
 *   2. Viable option with the highest score.
 *   3. Any viable option.
 *   4. null when no options exist.
 */
function resolvePrimaryOption(output: EngineOutputV1): OptionCardV1 | null {
  const options = output.options ?? [];
  if (options.length === 0) return null;

  // 1. Label-matched option
  const labelMatch = options.find(o => o.label === output.recommendation.primary);
  if (labelMatch != null) return labelMatch;

  // 2. Highest-scored viable option
  const viableOptions = options.filter(o => o.status === 'viable');
  if (viableOptions.length > 0) {
    return viableOptions.reduce<OptionCardV1>((best, o) => {
      const bestScore = best.score?.total ?? 0;
      const oScore = o.score?.total ?? 0;
      return oScore > bestScore ? o : best;
    }, viableOptions[0]!);
  }

  // 3. Any option at all
  return options[0] ?? null;
}

/**
 * Map engine output signals to a ScenarioSuitability verdict.
 *
 * Resolution order:
 *   1. verdict.status ('good' → 'recommended', 'caution' → 'possible_with_caveats', 'fail' → 'less_suited').
 *   2. Primary option status.
 *   3. Eligibility fallback.
 */
function deriveSuitability(output: EngineOutputV1, primaryOption: OptionCardV1 | null): ScenarioSuitability {
  const verdictStatus = output.verdict?.status;
  if (verdictStatus === 'good') return 'recommended';
  if (verdictStatus === 'caution') return 'possible_with_caveats';
  if (verdictStatus === 'fail') return 'less_suited';

  if (primaryOption?.status === 'viable') return 'recommended';
  if (primaryOption?.status === 'caution') return 'possible_with_caveats';
  if (primaryOption?.status === 'rejected') return 'less_suited';

  const viableCount = output.eligibility.filter(e => e.status === 'viable').length;
  if (viableCount > 0) return 'recommended';
  const cautionCount = output.eligibility.filter(e => e.status === 'caution').length;
  if (cautionCount > 0) return 'possible_with_caveats';
  return 'less_suited';
}

/**
 * Derive a ScenarioRecommendationSummary from a single scenario's engine output.
 *
 * @param scenarioId The scenario this summary belongs to.
 * @param output     The engine output produced for this scenario.
 * @returns          A fully-populated ScenarioRecommendationSummary.
 */
export function buildScenarioRecommendationSummary(
  scenarioId: string,
  output: EngineOutputV1,
): ScenarioRecommendationSummary {
  const primaryOption = resolvePrimaryOption(output);

  const headline: string =
    output.verdict?.title
    ?? (output.recommendation.primary.length > 0 ? output.recommendation.primary : 'No recommendation');

  const primaryReason: string =
    output.verdict?.primaryReason
    ?? output.verdict?.reasons?.[0]
    ?? primaryOption?.headline
    ?? '';

  const strengths: readonly string[] = (primaryOption?.why ?? []).slice(0, 4);

  const tradeoffs: readonly string[] = (output.limiters?.limiters ?? [])
    .filter(l => l.severity === 'warn' || l.severity === 'fail')
    .slice(0, 3)
    .map(l => l.impact.summary);

  const requiredWork: readonly string[] = primaryOption?.typedRequirements?.mustHave ?? [];

  const requiredSafetyAndCompliance: readonly string[] =
    primaryOption?.typedRequirements?.complianceRequired ?? [];

  const upgrades: readonly string[] = primaryOption?.typedRequirements?.likelyUpgrades ?? [];

  const suitability = deriveSuitability(output, primaryOption);

  return {
    scenarioId,
    headline,
    primaryReason,
    strengths,
    tradeoffs,
    requiredWork,
    requiredSafetyAndCompliance,
    upgrades,
    suitability,
  };
}
