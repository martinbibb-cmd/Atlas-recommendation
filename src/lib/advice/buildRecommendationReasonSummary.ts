/**
 * buildRecommendationReasonSummary.ts
 *
 * PR6 — "Why Atlas suggested this" helper.
 *
 * Selects the top 2–4 customer-facing reasons from existing engine signals:
 *   - verdict primary reason
 *   - verdict reasons array
 *   - recommended option's why array (fallback when verdict reasons are sparse)
 *
 * Rules:
 *   - presentation layer only: no engine/scoring changes.
 *   - uses only data already present in EngineOutputV1.
 *   - returns at most 4 reasons.
 *   - deduplicates: primaryReason is never repeated.
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendationReasonSummary {
  /** Top reasons Atlas recommends this system. Maximum 4. */
  reasons: string[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the "Why Atlas suggested this" summary from existing engine signals.
 *
 * Priority order:
 *   1. verdict.primaryReason (if present)
 *   2. verdict.reasons (deduplicating primaryReason)
 *   3. recommended option's why[] (fallback when verdict reasons are sparse)
 *
 * @param engineOutput      Full EngineOutputV1.
 * @param recommendedOptionId  The ID of the Atlas-recommended option.
 */
export function buildRecommendationReasonSummary(
  engineOutput: EngineOutputV1,
  recommendedOptionId: string,
): RecommendationReasonSummary {
  const collected: string[] = [];
  const seen = new Set<string>();

  function push(reason: string) {
    const trimmed = reason.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      collected.push(trimmed);
    }
  }

  // 1. Primary reason — highest priority
  const primaryReason = engineOutput.verdict?.primaryReason;
  if (primaryReason != null) {
    push(primaryReason);
  }

  // 2. Verdict reasons array (skip any that duplicate the primary reason)
  const verdictReasons = engineOutput.verdict?.reasons ?? [];
  for (const reason of verdictReasons) {
    if (collected.length >= 4) break;
    push(reason);
  }

  // 3. Recommended option's why[] as fallback when verdict reasons are sparse
  if (collected.length < 2) {
    const recommendedOption = engineOutput.options?.find(
      o => o.id === recommendedOptionId,
    );
    const optionWhy = recommendedOption?.why ?? [];
    for (const why of optionWhy) {
      if (collected.length >= 4) break;
      push(why);
    }
  }

  return { reasons: collected.slice(0, 4) };
}
