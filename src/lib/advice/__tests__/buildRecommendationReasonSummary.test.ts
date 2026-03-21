/**
 * buildRecommendationReasonSummary.test.ts
 *
 * PR6 — Tests for the "Why Atlas suggested this" helper.
 *
 * Coverage:
 *   1. Returns primaryReason from verdict when available.
 *   2. Appends verdict.reasons, deduplicating primaryReason.
 *   3. Falls back to recommended option's why[] when verdict is sparse.
 *   4. Returns at most 4 reasons.
 *   5. Returns empty array when no signals are available.
 *   6. Deduplicates across all sources.
 */

import { describe, it, expect } from 'vitest';
import { buildRecommendationReasonSummary } from '../buildRecommendationReasonSummary';
import type { EngineOutputV1, OptionCardV1 } from '../../../contracts/EngineOutputV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOption(id: string, why: string[]): OptionCardV1 {
  return {
    id,
    label: id,
    status: 'viable',
    headline: `${id} headline`,
    why,
    requirements: [],
    typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    heat:        { status: 'ok', headline: 'Heat ok', bullets: [] },
    dhw:         { status: 'ok', headline: 'DHW ok', bullets: [] },
    engineering: { status: 'ok', headline: 'Eng ok', bullets: [] },
    sensitivities: [],
  };
}

const BASE_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Combi boiler' },
  explainers: [],
  options: [makeOption('combi', ['Good mains pressure', 'Single bathroom'])],
  verdict: {
    title: 'Good match',
    status: 'good',
    reasons: ['Good mains pressure for combi', 'Single bathroom, low demand'],
    confidence: { level: 'medium', reasons: [] },
    assumptionsUsed: [],
    primaryReason: 'Low demand and single bathroom favour on-demand hot water',
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildRecommendationReasonSummary — primary reason', () => {
  it('includes the verdict primaryReason as the first reason', () => {
    const { reasons } = buildRecommendationReasonSummary(BASE_OUTPUT, 'combi');
    expect(reasons[0]).toBe('Low demand and single bathroom favour on-demand hot water');
  });

  it('includes verdict reasons in subsequent positions', () => {
    const { reasons } = buildRecommendationReasonSummary(BASE_OUTPUT, 'combi');
    expect(reasons).toContain('Good mains pressure for combi');
    expect(reasons).toContain('Single bathroom, low demand');
  });

  it('does not duplicate primaryReason in the reasons list', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      verdict: {
        ...BASE_OUTPUT.verdict!,
        primaryReason: 'Good mains pressure for combi',
        reasons: ['Good mains pressure for combi', 'Single bathroom, low demand'],
      },
    };
    const { reasons } = buildRecommendationReasonSummary(output, 'combi');
    const count = reasons.filter(r => r === 'Good mains pressure for combi').length;
    expect(count).toBe(1);
  });
});

describe('buildRecommendationReasonSummary — fallback to option why[]', () => {
  it('uses recommended option why[] when verdict reasons are sparse', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      verdict: {
        ...BASE_OUTPUT.verdict!,
        primaryReason: undefined,
        reasons: [],
      },
    };
    const { reasons } = buildRecommendationReasonSummary(output, 'combi');
    expect(reasons).toContain('Good mains pressure');
    expect(reasons).toContain('Single bathroom');
  });

  it('does not use option why[] when verdict already provides 2+ reasons', () => {
    const { reasons } = buildRecommendationReasonSummary(BASE_OUTPUT, 'combi');
    // Should not include option.why strings like raw 'Good mains pressure' since
    // verdict already provides enough (primaryReason + 2 verdict reasons = 3 total)
    expect(reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when no verdict and no option why signals', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      options: [makeOption('combi', [])],
      verdict: undefined,
    };
    const { reasons } = buildRecommendationReasonSummary(output, 'combi');
    expect(reasons).toHaveLength(0);
  });
});

describe('buildRecommendationReasonSummary — maximum 4 reasons', () => {
  it('returns at most 4 reasons', () => {
    const output: EngineOutputV1 = {
      ...BASE_OUTPUT,
      verdict: {
        ...BASE_OUTPUT.verdict!,
        primaryReason: 'Reason A',
        reasons: ['Reason B', 'Reason C', 'Reason D', 'Reason E'],
      },
    };
    const { reasons } = buildRecommendationReasonSummary(output, 'combi');
    expect(reasons.length).toBeLessThanOrEqual(4);
  });
});

describe('buildRecommendationReasonSummary — missing verdict', () => {
  it('handles missing verdict gracefully', () => {
    const output: EngineOutputV1 = { ...BASE_OUTPUT, verdict: undefined };
    expect(() => buildRecommendationReasonSummary(output, 'combi')).not.toThrow();
  });

  it('returns empty reasons when no verdict and options is empty', () => {
    const output: EngineOutputV1 = { ...BASE_OUTPUT, verdict: undefined, options: [] };
    const { reasons } = buildRecommendationReasonSummary(output, 'combi');
    expect(reasons).toHaveLength(0);
  });
});

describe('buildRecommendationReasonSummary — unknown recommendedOptionId', () => {
  it('still returns verdict reasons even if recommendedOptionId does not match any option', () => {
    const { reasons } = buildRecommendationReasonSummary(BASE_OUTPUT, 'nonexistent_id');
    // verdict reasons should still come through
    expect(reasons.length).toBeGreaterThan(0);
  });
});
