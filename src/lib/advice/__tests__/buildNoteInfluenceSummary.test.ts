/**
 * buildNoteInfluenceSummary.test.ts
 *
 * Unit tests for buildNoteInfluenceSummary.
 *
 * Tests verify:
 *  - Empty / undefined input returns an empty summary with no active influence.
 *  - Direct-field suggestions (preferCombi, highOccupancy, sludge, imbalance)
 *    appear in `direct`.
 *  - Advisory-only suggestions appear in `advisory`.
 *  - Overridden suggestions appear in `overridden`, not in direct/advisory.
 *  - Non-accepted provenance records are excluded.
 *  - hasActiveInfluence flag is set correctly.
 *  - Explanation strings are returned for all known target fields.
 *  - sourceSnippet is preserved when present.
 */
import { describe, it, expect } from 'vitest';
import { buildNoteInfluenceSummary } from '../buildNoteInfluenceSummary';
import type { AppliedNoteSuggestion } from '../../../features/voiceNotes/voiceNoteTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeApplied(
  overrides: Partial<AppliedNoteSuggestion> & { targetField: string },
): AppliedNoteSuggestion {
  return {
    sourceSuggestionId: `sg-${overrides.targetField}`,
    sourceNoteId:       'note-1',
    targetField:        overrides.targetField,
    label:              overrides.label ?? 'Test label',
    appliedValue:       overrides.appliedValue ?? 'true',
    confidence:         overrides.confidence ?? 'medium',
    provenance:         'accepted_atlas_suggestion',
    category:           overrides.category ?? 'preferences',
    overriddenByManual: overrides.overriddenByManual ?? false,
    sourceSnippet:      overrides.sourceSnippet,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildNoteInfluenceSummary', () => {

  describe('empty / undefined input', () => {
    it('returns empty summary for undefined input', () => {
      const result = buildNoteInfluenceSummary(undefined);
      expect(result.direct).toEqual([]);
      expect(result.advisory).toEqual([]);
      expect(result.overridden).toEqual([]);
      expect(result.hasActiveInfluence).toBe(false);
    });

    it('returns empty summary for empty array', () => {
      const result = buildNoteInfluenceSummary([]);
      expect(result.direct).toEqual([]);
      expect(result.advisory).toEqual([]);
      expect(result.overridden).toEqual([]);
      expect(result.hasActiveInfluence).toBe(false);
    });
  });

  describe('direct survey-field suggestions', () => {
    it('places preferCombi suggestion in direct group', () => {
      const applied = [makeApplied({ targetField: 'preferCombi', category: 'preferences' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct).toHaveLength(1);
      expect(result.direct[0].influenceType).toBe('direct');
      expect(result.advisory).toHaveLength(0);
    });

    it('places highOccupancy suggestion in direct group', () => {
      const applied = [makeApplied({ targetField: 'highOccupancy', category: 'usage' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct).toHaveLength(1);
      expect(result.direct[0].influenceType).toBe('direct');
    });

    it('places sludge evidence suggestion in direct group', () => {
      const applied = [makeApplied({
        targetField: 'fullSurvey.heatingCondition.magneticDebrisEvidence',
        category: 'risks',
      })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct).toHaveLength(1);
      expect(result.direct[0].influenceType).toBe('direct');
    });

    it('places radiator imbalance suggestion in direct group', () => {
      const applied = [makeApplied({
        targetField: 'fullSurvey.heatingCondition.radiatorsHeatingUnevenly',
        category: 'risks',
      })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct).toHaveLength(1);
      expect(result.direct[0].influenceType).toBe('direct');
    });
  });

  describe('advisory-only suggestions', () => {
    it('places preference.simple_controls in advisory group', () => {
      const applied = [makeApplied({ targetField: 'preference.simple_controls', category: 'preferences' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.advisory).toHaveLength(1);
      expect(result.advisory[0].influenceType).toBe('advisory');
      expect(result.direct).toHaveLength(0);
    });

    it('places constraint.cupboard_tight in advisory group', () => {
      const applied = [makeApplied({ targetField: 'constraint.cupboard_tight', category: 'constraints' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.advisory).toHaveLength(1);
      expect(result.advisory[0].influenceType).toBe('advisory');
    });

    it('places risk.likely_sludge (mapped advisory variant) correctly', () => {
      // Note: risk.likely_sludge maps to fullSurvey.heatingCondition.magneticDebrisEvidence
      // which is in DIRECT_TARGET_FIELDS. risk.microbore_pipework is advisory.
      const applied = [makeApplied({ targetField: 'risk.microbore_pipework', category: 'risks' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.advisory).toHaveLength(1);
    });

    it('places follow-up prompts in advisory group', () => {
      const applied = [makeApplied({ targetField: 'followup.confirm_bath_shower_count', category: 'follow_ups' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.advisory).toHaveLength(1);
    });
  });

  describe('overridden suggestions', () => {
    it('places overridden suggestions in overridden group, not direct', () => {
      const applied = [
        makeApplied({ targetField: 'preferCombi', overriddenByManual: true, category: 'preferences' }),
      ];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.overridden).toHaveLength(1);
      expect(result.direct).toHaveLength(0);
      expect(result.advisory).toHaveLength(0);
    });

    it('places overridden advisory suggestions in overridden group, not advisory', () => {
      const applied = [
        makeApplied({ targetField: 'preference.simple_controls', overriddenByManual: true, category: 'preferences' }),
      ];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.overridden).toHaveLength(1);
      expect(result.advisory).toHaveLength(0);
    });

    it('overridden suggestions do not count toward hasActiveInfluence', () => {
      const applied = [
        makeApplied({ targetField: 'preferCombi', overriddenByManual: true, category: 'preferences' }),
      ];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.hasActiveInfluence).toBe(false);
    });
  });

  describe('hasActiveInfluence flag', () => {
    it('is true when there is at least one direct suggestion', () => {
      const applied = [makeApplied({ targetField: 'preferCombi', category: 'preferences' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.hasActiveInfluence).toBe(true);
    });

    it('is true when there is at least one advisory suggestion', () => {
      const applied = [makeApplied({ targetField: 'preference.simple_controls', category: 'preferences' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.hasActiveInfluence).toBe(true);
    });

    it('is false when all suggestions are overridden', () => {
      const applied = [
        makeApplied({ targetField: 'preferCombi', overriddenByManual: true, category: 'preferences' }),
        makeApplied({ targetField: 'preference.simple_controls', overriddenByManual: true, category: 'preferences' }),
      ];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.hasActiveInfluence).toBe(false);
    });
  });

  describe('mixed suggestions', () => {
    it('correctly separates direct, advisory, and overridden in a mixed list', () => {
      const applied = [
        makeApplied({ targetField: 'preferCombi', category: 'preferences' }),
        makeApplied({ targetField: 'highOccupancy', category: 'usage' }),
        makeApplied({ targetField: 'preference.simple_controls', category: 'preferences' }),
        makeApplied({ targetField: 'constraint.cupboard_tight', category: 'constraints' }),
        makeApplied({ targetField: 'preferCombi', sourceSuggestionId: 'overridden', overriddenByManual: true, category: 'preferences' }),
      ];
      // Force unique sourceSuggestionId
      applied[4].sourceSuggestionId = 'sg-preferCombi-overridden';

      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct).toHaveLength(2);
      expect(result.advisory).toHaveLength(2);
      expect(result.overridden).toHaveLength(1);
      expect(result.hasActiveInfluence).toBe(true);
    });
  });

  describe('explanation strings', () => {
    it('returns a non-empty explanation for preferCombi', () => {
      const applied = [makeApplied({ targetField: 'preferCombi', category: 'preferences' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct[0].explanation).toMatch(/combi/i);
    });

    it('returns a non-empty explanation for highOccupancy', () => {
      const applied = [makeApplied({ targetField: 'highOccupancy', category: 'usage' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct[0].explanation).toMatch(/hot.water|shower|demand/i);
    });

    it('returns a non-empty explanation for sludge', () => {
      const applied = [makeApplied({
        targetField: 'fullSurvey.heatingCondition.magneticDebrisEvidence',
        category: 'risks',
      })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct[0].explanation).toMatch(/sludge|condition/i);
    });

    it('returns a fallback explanation for unknown target fields', () => {
      const applied = [makeApplied({ targetField: 'some.unknown.field', category: 'preferences' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.advisory[0].explanation).toBeTruthy();
      expect(result.advisory[0].explanation.length).toBeGreaterThan(0);
    });
  });

  describe('sourceSnippet preservation', () => {
    it('preserves sourceSnippet when provided', () => {
      const applied = [makeApplied({
        targetField: 'preferCombi',
        sourceSnippet: 'customer said no cylinder',
        category: 'preferences',
      })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct[0].sourceSnippet).toBe('customer said no cylinder');
    });

    it('leaves sourceSnippet undefined when not provided', () => {
      const applied = [makeApplied({ targetField: 'preferCombi', category: 'preferences' })];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct[0].sourceSnippet).toBeUndefined();
    });
  });

  describe('guardrails', () => {
    it('excludes items that do not have accepted_atlas_suggestion provenance', () => {
      const applied: AppliedNoteSuggestion[] = [{
        sourceSuggestionId: 'sg-bad',
        sourceNoteId: 'note-1',
        targetField: 'preferCombi',
        label: 'Test',
        appliedValue: 'true',
        confidence: 'high',
        // Deliberately wrong provenance — TypeScript would normally prevent this
        provenance: 'inferred_from_voice_note' as 'accepted_atlas_suggestion',
        category: 'preferences',
      }];
      const result = buildNoteInfluenceSummary(applied);
      expect(result.direct).toHaveLength(0);
      expect(result.advisory).toHaveLength(0);
      expect(result.hasActiveInfluence).toBe(false);
    });
  });
});
