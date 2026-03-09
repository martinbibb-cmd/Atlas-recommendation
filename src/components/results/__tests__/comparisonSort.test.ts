/**
 * comparisonSort.test.ts
 *
 * Unit tests for the two helpers exported from RecommendationHub that power
 * the PR6 "decision pack" presentation changes:
 *
 *   sortOptionCards     — orders cards: viable → caution → rejected
 *   buildComparisonSummary — generates a one-sentence summary above the cards
 */
import { describe, it, expect } from 'vitest';
import { sortOptionCards, buildComparisonSummary } from '../RecommendationHub';
import type { OptionCardV1 } from '../../../contracts/EngineOutputV1';

// ─── Minimal card factory ─────────────────────────────────────────────────────

function makeCard(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
  overrides: Partial<OptionCardV1> = {},
): OptionCardV1 {
  return {
    id,
    label: `Label for ${id}`,
    status,
    headline: `Headline for ${id}`,
    why: [],
    requirements: [],
    heat:        { status: 'ok', headline: '', bullets: [] },
    dhw:         { status: 'ok', headline: '', bullets: [] },
    engineering: { status: 'ok', headline: '', bullets: [] },
    typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    ...overrides,
  };
}

// ─── sortOptionCards ──────────────────────────────────────────────────────────

describe('sortOptionCards', () => {
  it('returns empty array unchanged', () => {
    expect(sortOptionCards([])).toEqual([]);
  });

  it('returns single-card array unchanged', () => {
    const card = makeCard('combi', 'viable');
    expect(sortOptionCards([card])).toEqual([card]);
  });

  it('places viable before caution', () => {
    const caution  = makeCard('combi',         'caution');
    const viable   = makeCard('stored_vented', 'viable');
    const [first, second] = sortOptionCards([caution, viable]);
    expect(first.status).toBe('viable');
    expect(second.status).toBe('caution');
  });

  it('places viable before rejected', () => {
    const rejected = makeCard('combi',         'rejected');
    const viable   = makeCard('stored_vented', 'viable');
    const [first, second] = sortOptionCards([rejected, viable]);
    expect(first.status).toBe('viable');
    expect(second.status).toBe('rejected');
  });

  it('places caution before rejected', () => {
    const rejected = makeCard('combi',         'rejected');
    const caution  = makeCard('stored_vented', 'caution');
    const [first, second] = sortOptionCards([rejected, caution]);
    expect(first.status).toBe('caution');
    expect(second.status).toBe('rejected');
  });

  it('sorts full realistic set: viable → caution → rejected', () => {
    const cards = [
      makeCard('regular_vented',  'rejected'),
      makeCard('combi',           'caution'),
      makeCard('stored_unvented', 'viable'),
      makeCard('ashp',            'rejected'),
      makeCard('stored_vented',   'caution'),
    ];
    const sorted = sortOptionCards(cards);
    expect(sorted[0].status).toBe('viable');
    expect(sorted[1].status).toBe('caution');
    expect(sorted[2].status).toBe('caution');
    expect(sorted[3].status).toBe('rejected');
    expect(sorted[4].status).toBe('rejected');
  });

  it('preserves relative order within each status group (stable sort)', () => {
    const cards = [
      makeCard('combi',           'rejected'),
      makeCard('regular_vented',  'rejected'),
      makeCard('stored_vented',   'caution'),
      makeCard('stored_unvented', 'caution'),
    ];
    const sorted = sortOptionCards(cards);
    // Both caution cards should appear in their original order
    expect(sorted[0].id).toBe('stored_vented');
    expect(sorted[1].id).toBe('stored_unvented');
    // Both rejected cards should appear in their original order
    expect(sorted[2].id).toBe('combi');
    expect(sorted[3].id).toBe('regular_vented');
  });

  it('does not mutate the original array', () => {
    const cards = [
      makeCard('combi',         'rejected'),
      makeCard('stored_vented', 'viable'),
    ];
    const originalIds = cards.map(c => c.id);
    sortOptionCards(cards);
    expect(cards.map(c => c.id)).toEqual(originalIds);
  });
});

// ─── buildComparisonSummary ───────────────────────────────────────────────────

describe('buildComparisonSummary', () => {
  it('returns null for an empty options array', () => {
    expect(buildComparisonSummary([])).toBeNull();
  });

  it('returns null when only one option is present', () => {
    const card = makeCard('combi', 'viable');
    expect(buildComparisonSummary([card])).toBeNull();
  });

  it('returns null when there are no viable options', () => {
    const cards = [
      makeCard('combi',         'rejected'),
      makeCard('stored_vented', 'caution'),
    ];
    expect(buildComparisonSummary(cards)).toBeNull();
  });

  it('includes the recommended option label in the summary', () => {
    const cards = [
      makeCard('combi',         'rejected'),
      makeCard('stored_vented', 'viable', { label: 'Stored hot water — Vented cylinder' }),
    ];
    const summary = buildComparisonSummary(cards);
    expect(summary).toContain('Stored hot water — Vented cylinder');
  });

  it('does not include the why[] reason in the summary (reason is shown in the recommendation panel)', () => {
    const cards = [
      makeCard('combi',         'rejected'),
      makeCard('stored_vented', 'viable', {
        label: 'Stored hot water',
        why: ['Adequate mains pressure for stored delivery'],
      }),
    ];
    const summary = buildComparisonSummary(cards);
    // Reason must NOT appear in the comparison sentence — it is surfaced in the
    // recommendation summary panel above, so repeating it here would duplicate
    // the same point.
    expect(summary).not.toContain('adequate mains pressure');
    expect(summary).not.toContain('Adequate mains pressure');
  });

  it('produces a concise sentence even when why[] is empty', () => {
    const cards = [
      makeCard('combi',         'rejected'),
      makeCard('stored_vented', 'viable', {
        label: 'Stored hot water',
        why: [],
        headline: 'Suitable for this property',
      }),
    ];
    const summary = buildComparisonSummary(cards);
    expect(summary).toContain('Stored hot water');
    expect(summary).toMatch(/^For this home,/);
  });

  it('starts with "For this home"', () => {
    const cards = [
      makeCard('combi',         'rejected'),
      makeCard('stored_vented', 'viable'),
    ];
    const summary = buildComparisonSummary(cards);
    expect(summary).toMatch(/^For this home,/);
  });

  it('ends with a single period and does not produce double-periods', () => {
    const cards = [
      makeCard('combi',         'rejected'),
      makeCard('stored_vented', 'viable', {
        label: 'Stored hot water',
        why: ['Pressure profile suits stored delivery.'],
      }),
    ];
    const summary = buildComparisonSummary(cards);
    // Should not end with ".."
    expect(summary).not.toMatch(/\.\./);
    // Should end with exactly one period
    expect(summary).toMatch(/\.$/);
  });

  it('uses the first viable card when multiple viable options exist', () => {
    const cards = [
      makeCard('stored_vented',   'viable', { label: 'Stored Vented',   why: ['First reason'] }),
      makeCard('stored_unvented', 'viable', { label: 'Stored Unvented', why: ['Second reason'] }),
      makeCard('combi',           'rejected'),
    ];
    const summary = buildComparisonSummary(cards);
    expect(summary).toContain('Stored Vented');
    expect(summary).not.toContain('Stored Unvented');
  });

  it('does not mutate the input array', () => {
    const cards = [
      makeCard('combi',         'rejected'),
      makeCard('stored_vented', 'viable'),
    ];
    const original = cards.map(c => c.id);
    buildComparisonSummary(cards);
    expect(cards.map(c => c.id)).toEqual(original);
  });
});
