/**
 * buildNoteInfluenceSummary.test.ts
 *
 * Unit tests for the note influence summary builder.
 */

import { describe, it, expect } from 'vitest';
import { buildNoteInfluenceSummary } from '../buildNoteInfluenceSummary';
import type { AppliedNoteSuggestion } from '../../../features/voiceNotes/voiceNoteTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeApplied(
  overrides: Partial<AppliedNoteSuggestion> & { targetField: string },
): AppliedNoteSuggestion {
  return {
    sourceSuggestionId: overrides.sourceSuggestionId ?? `id_${overrides.targetField}`,
    sourceNoteId:       'note1',
    targetField:        overrides.targetField,
    label:              overrides.label ?? 'Test label',
    appliedValue:       overrides.appliedValue ?? 'true',
    confidence:         overrides.confidence ?? 'high',
    provenance:         'accepted_atlas_suggestion',
    category:           overrides.category ?? 'preferences',
    sourceSnippet:      overrides.sourceSnippet,
    overriddenByManual: overrides.overriddenByManual,
  };
}

// ─── Guard: provenance filter ─────────────────────────────────────────────────

describe('provenance guardrail', () => {
  it('returns empty groups when given an empty array', () => {
    const result = buildNoteInfluenceSummary([]);
    expect(result.direct).toEqual([]);
    expect(result.advisory).toEqual([]);
    expect(result.overridden).toEqual([]);
  });

  it('excludes items that do not have accepted_atlas_suggestion provenance', () => {
    const bad: AppliedNoteSuggestion = {
      ...makeApplied({ targetField: 'preferCombi' }),
      provenance: 'inferred_from_voice_note' as AppliedNoteSuggestion['provenance'],
    };
    const result = buildNoteInfluenceSummary([bad]);
    expect(result.direct).toHaveLength(0);
    expect(result.advisory).toHaveLength(0);
    expect(result.overridden).toHaveLength(0);
  });
});

// ─── Direct vs advisory classification ───────────────────────────────────────

describe('direct / advisory classification', () => {
  it('classifies preferCombi as direct', () => {
    const item = makeApplied({ targetField: 'preferCombi' });
    const { direct, advisory } = buildNoteInfluenceSummary([item]);
    expect(direct).toHaveLength(1);
    expect(advisory).toHaveLength(0);
    expect(direct[0].influenceType).toBe('direct');
  });

  it('classifies highOccupancy as direct', () => {
    const item = makeApplied({ targetField: 'highOccupancy', category: 'usage' });
    const { direct } = buildNoteInfluenceSummary([item]);
    expect(direct).toHaveLength(1);
  });

  it('classifies magneticDebrisEvidence as direct', () => {
    const item = makeApplied({
      targetField: 'fullSurvey.heatingCondition.magneticDebrisEvidence',
      category: 'risks',
    });
    const { direct } = buildNoteInfluenceSummary([item]);
    expect(direct).toHaveLength(1);
  });

  it('classifies radiatorsHeatingUnevenly as direct', () => {
    const item = makeApplied({
      targetField: 'fullSurvey.heatingCondition.radiatorsHeatingUnevenly',
      category: 'risks',
    });
    const { direct } = buildNoteInfluenceSummary([item]);
    expect(direct).toHaveLength(1);
  });

  it('classifies advisory-only targetFields as advisory', () => {
    const ADVISORY = [
      'preference.simple_controls',
      'constraint.cupboard_tight',
      'risk.microbore_pipework',
      'followup.confirm_boiler_location',
    ];
    for (const targetField of ADVISORY) {
      const item = makeApplied({ targetField });
      const { direct, advisory } = buildNoteInfluenceSummary([item]);
      expect(direct).toHaveLength(0);
      expect(advisory).toHaveLength(1);
      expect(advisory[0].influenceType).toBe('advisory');
    }
  });
});

// ─── Overridden items ─────────────────────────────────────────────────────────

describe('overridden items', () => {
  it('places overridden items into the overridden group, not direct or advisory', () => {
    const item = makeApplied({ targetField: 'preferCombi', overriddenByManual: true });
    const { direct, advisory, overridden } = buildNoteInfluenceSummary([item]);
    expect(direct).toHaveLength(0);
    expect(advisory).toHaveLength(0);
    expect(overridden).toHaveLength(1);
  });

  it('overridden advisory items also go to the overridden group', () => {
    const item = makeApplied({
      targetField: 'constraint.cupboard_tight',
      category: 'constraints',
      overriddenByManual: true,
    });
    const { overridden } = buildNoteInfluenceSummary([item]);
    expect(overridden).toHaveLength(1);
  });
});

// ─── Explanation strings ──────────────────────────────────────────────────────

describe('explanation strings', () => {
  it('uses assertive language for high-confidence preferCombi', () => {
    const item = makeApplied({ targetField: 'preferCombi', confidence: 'high' });
    const { direct } = buildNoteInfluenceSummary([item]);
    expect(direct[0].explanation).toContain('strengthened');
  });

  it('uses softer language for low-confidence preferCombi', () => {
    const item = makeApplied({ targetField: 'preferCombi', confidence: 'low' });
    const { direct } = buildNoteInfluenceSummary([item]);
    expect(direct[0].explanation).toContain('verify');
  });

  it('uses assertive language for high-confidence sludge risk', () => {
    const item = makeApplied({
      targetField: 'fullSurvey.heatingCondition.magneticDebrisEvidence',
      category: 'risks',
      confidence: 'high',
    });
    const { direct } = buildNoteInfluenceSummary([item]);
    expect(direct[0].explanation).toContain('confirmed');
  });

  it('falls back to advisory explanation for unknown targetField', () => {
    const item = makeApplied({
      targetField: 'some.unknown.field',
      label: 'Custom label',
      category: 'constraints',
      confidence: 'medium',
    });
    const { advisory } = buildNoteInfluenceSummary([item]);
    expect(advisory[0].explanation).toContain('Custom label');
    expect(advisory[0].explanation).toContain('context only');
  });
});

// ─── sourceSnippet ────────────────────────────────────────────────────────────

describe('sourceSnippet propagation', () => {
  it('carries sourceSnippet from the applied record to the influence item', () => {
    const item = makeApplied({
      targetField: 'preferCombi',
      sourceSnippet: 'she said she never uses the bath',
    });
    const { direct } = buildNoteInfluenceSummary([item]);
    expect(direct[0].sourceSnippet).toBe('she said she never uses the bath');
  });

  it('sourceSnippet is undefined when not set on the applied record', () => {
    const item = makeApplied({ targetField: 'preferCombi' });
    const { direct } = buildNoteInfluenceSummary([item]);
    expect(direct[0].sourceSnippet).toBeUndefined();
  });
});

// ─── Deduplication ────────────────────────────────────────────────────────────

describe('deduplication', () => {
  it('deduplicates by sourceSuggestionId, keeping the last occurrence', () => {
    const first  = makeApplied({ targetField: 'preferCombi', appliedValue: 'true' });
    const second: AppliedNoteSuggestion = {
      ...makeApplied({ targetField: 'preferCombi', appliedValue: 'false' }),
      sourceSuggestionId: first.sourceSuggestionId,
    };
    const { direct } = buildNoteInfluenceSummary([first, second]);
    expect(direct).toHaveLength(1);
    expect(direct[0].appliedValue).toBe('false'); // last wins
  });

  it('does not deduplicate items with different sourceSuggestionIds', () => {
    const a = makeApplied({ targetField: 'preferCombi' });
    const b: AppliedNoteSuggestion = {
      ...makeApplied({ targetField: 'highOccupancy', category: 'usage' }),
      sourceSuggestionId: 'different_id',
    };
    const { direct } = buildNoteInfluenceSummary([a, b]);
    expect(direct).toHaveLength(2);
  });
});

// ─── Mixed scenarios ──────────────────────────────────────────────────────────

describe('mixed applied suggestions', () => {
  it('correctly partitions direct, advisory, and overridden in a realistic set', () => {
    const items: AppliedNoteSuggestion[] = [
      makeApplied({ targetField: 'preferCombi' }),
      makeApplied({ targetField: 'highOccupancy', category: 'usage' }),
      makeApplied({ targetField: 'constraint.cupboard_tight', category: 'constraints' }),
      makeApplied({ targetField: 'risk.microbore_pipework', category: 'risks' }),
      makeApplied({ targetField: 'preferCombi', overriddenByManual: true,
        sourceSuggestionId: 'id_overridden' }),
    ];

    const summary = buildNoteInfluenceSummary(items);

    // Two direct items: preferCombi (active) + highOccupancy
    expect(summary.direct).toHaveLength(2);
    // Two advisory items
    expect(summary.advisory).toHaveLength(2);
    // One overridden
    expect(summary.overridden).toHaveLength(1);
  });
});
