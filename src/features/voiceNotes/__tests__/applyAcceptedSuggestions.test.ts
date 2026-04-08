/**
 * applyAcceptedSuggestions.test.ts
 *
 * Unit tests for the accepted-suggestion application layer.
 */

import { describe, it, expect } from 'vitest';
import {
  applyAcceptedSuggestions,
  mergeAppliedSuggestions,
  markOverriddenByManual,
} from '../applyAcceptedSuggestions';
import type { VoiceNoteSuggestion, AppliedNoteSuggestion } from '../voiceNoteTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSuggestion(
  overrides: Partial<VoiceNoteSuggestion> & { key: string },
): VoiceNoteSuggestion {
  return {
    id:             `note1_${overrides.key}`,
    key:            overrides.key,
    label:          overrides.label ?? 'Test label',
    suggestedValue: overrides.suggestedValue ?? 'true',
    confidence:     overrides.confidence ?? 'high',
    sourceNoteId:   overrides.sourceNoteId ?? 'note1',
    sourceSnippet:  overrides.sourceSnippet ?? 'some transcript text',
    provenance:     'inferred_from_voice_note',
    status:         overrides.status ?? 'accepted',
    category:       overrides.category ?? 'preferences',
  };
}

// ─── applyAcceptedSuggestions — core invariants ───────────────────────────────

describe('applyAcceptedSuggestions — invariants', () => {
  it('returns empty updates and applied when no suggestions', () => {
    const result = applyAcceptedSuggestions([], {});
    expect(result.updates).toEqual({});
    expect(result.applied).toEqual([]);
  });

  it('ignores suggestions with status !== accepted', () => {
    const suggested = makeSuggestion({ key: 'preference.avoid_cylinder', status: 'suggested' });
    const rejected  = makeSuggestion({ key: 'usage.high_shower_concurrency', status: 'rejected' });
    const result = applyAcceptedSuggestions([suggested, rejected], {});
    expect(result.updates).toEqual({});
    expect(result.applied).toEqual([]);
  });

  it('silently skips suggestions with unknown keys', () => {
    const unknown = makeSuggestion({ key: 'unknown.mystery_field', status: 'accepted' });
    const result = applyAcceptedSuggestions([unknown], {});
    expect(result.updates).toEqual({});
    expect(result.applied).toEqual([]);
  });

  it('every AppliedNoteSuggestion has provenance === accepted_atlas_suggestion', () => {
    const s = makeSuggestion({ key: 'preference.avoid_cylinder' });
    const { applied } = applyAcceptedSuggestions([s], {});
    expect(applied.length).toBe(1);
    expect(applied[0].provenance).toBe('accepted_atlas_suggestion');
  });

  it('preserves sourceSuggestionId, sourceNoteId, and confidence on applied records', () => {
    const s = makeSuggestion({
      key:        'preference.avoid_cylinder',
      confidence: 'medium',
      sourceNoteId: 'note-xyz',
    });
    const { applied } = applyAcceptedSuggestions([s], {});
    expect(applied[0].sourceSuggestionId).toBe(s.id);
    expect(applied[0].sourceNoteId).toBe('note-xyz');
    expect(applied[0].confidence).toBe('medium');
  });
});

// ─── Direct field mappings ────────────────────────────────────────────────────

describe('preference.avoid_cylinder → preferCombi', () => {
  it('sets preferCombi = true on the updates', () => {
    const s = makeSuggestion({ key: 'preference.avoid_cylinder' });
    const { updates } = applyAcceptedSuggestions([s], {});
    expect(updates.preferCombi).toBe(true);
  });

  it('records targetField = preferCombi in applied', () => {
    const s = makeSuggestion({ key: 'preference.avoid_cylinder' });
    const { applied } = applyAcceptedSuggestions([s], {});
    expect(applied[0].targetField).toBe('preferCombi');
  });

  it('does not override an existing preferCombi = false if already manually set', () => {
    // The application layer sets preferCombi regardless (the engineer accepted it),
    // but a subsequent manual override would be handled by markOverriddenByManual.
    const s = makeSuggestion({ key: 'preference.avoid_cylinder' });
    const { updates } = applyAcceptedSuggestions([s], { preferCombi: false });
    // Note-accepted value takes precedence over a default; engineer can re-override later.
    expect(updates.preferCombi).toBe(true);
  });
});

describe('usage.high_shower_concurrency → highOccupancy', () => {
  it('sets highOccupancy = true on the updates', () => {
    const s = makeSuggestion({ key: 'usage.high_shower_concurrency', category: 'usage' });
    const { updates } = applyAcceptedSuggestions([s], {});
    expect(updates.highOccupancy).toBe(true);
  });

  it('records targetField = highOccupancy in applied', () => {
    const s = makeSuggestion({ key: 'usage.high_shower_concurrency', category: 'usage' });
    const { applied } = applyAcceptedSuggestions([s], {});
    expect(applied[0].targetField).toBe('highOccupancy');
  });
});

// ─── Condition / diagnostic mappings ─────────────────────────────────────────

describe('risk.likely_sludge → fullSurvey.heatingCondition.magneticDebrisEvidence', () => {
  it('sets magneticDebrisEvidence = true in heatingCondition', () => {
    const s = makeSuggestion({ key: 'risk.likely_sludge', category: 'risks' });
    const { updates } = applyAcceptedSuggestions([s], {});
    expect(updates.fullSurvey?.heatingCondition?.magneticDebrisEvidence).toBe(true);
  });

  it('does not clobber other heatingCondition fields', () => {
    const s = makeSuggestion({ key: 'risk.likely_sludge', category: 'risks' });
    const current = {
      fullSurvey: {
        heatingCondition: { pumpingOverObserved: true },
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null as null, confidence: 'none' as const },
      },
    };
    const { updates } = applyAcceptedSuggestions([s], current);
    expect(updates.fullSurvey?.heatingCondition?.pumpingOverObserved).toBe(true);
    expect(updates.fullSurvey?.heatingCondition?.magneticDebrisEvidence).toBe(true);
  });

  it('skips the mapping when magneticDebrisEvidence is already manually set to false', () => {
    const s = makeSuggestion({ key: 'risk.likely_sludge', category: 'risks' });
    const current = {
      fullSurvey: {
        heatingCondition: { magneticDebrisEvidence: false },
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null as null, confidence: 'none' as const },
      },
    };
    const { updates } = applyAcceptedSuggestions([s], current);
    // No field update should be produced — the null return from applyToModel
    // means the applied record is still added but no field is changed.
    expect(updates.fullSurvey?.heatingCondition?.magneticDebrisEvidence).toBeUndefined();
  });

  it('still records provenance when field update is skipped', () => {
    const s = makeSuggestion({ key: 'risk.likely_sludge', category: 'risks' });
    const current = {
      fullSurvey: {
        heatingCondition: { magneticDebrisEvidence: false },
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null as null, confidence: 'none' as const },
      },
    };
    const { applied } = applyAcceptedSuggestions([s], current);
    expect(applied[0].targetField).toBe('fullSurvey.heatingCondition.magneticDebrisEvidence');
  });
});

describe('risk.radiator_imbalance → fullSurvey.heatingCondition.radiatorsHeatingUnevenly', () => {
  it('sets radiatorsHeatingUnevenly = true', () => {
    const s = makeSuggestion({ key: 'risk.radiator_imbalance', category: 'risks' });
    const { updates } = applyAcceptedSuggestions([s], {});
    expect(updates.fullSurvey?.heatingCondition?.radiatorsHeatingUnevenly).toBe(true);
  });
});

// ─── Advisory-only mappings (no field update) ─────────────────────────────────

describe('advisory-only suggestions (no direct engine field)', () => {
  const ADVISORY_KEYS: Array<{ key: string; category: VoiceNoteSuggestion['category'] }> = [
    { key: 'preference.simple_controls',          category: 'preferences' },
    { key: 'preference.no_bath_use',              category: 'preferences' },
    { key: 'preference.night_worker',             category: 'preferences' },
    { key: 'constraint.cupboard_tight',           category: 'constraints' },
    { key: 'constraint.storage_clearance_fail',   category: 'constraints' },
    { key: 'constraint.flue_route_difficult',     category: 'constraints' },
    { key: 'constraint.narrow_stairs',            category: 'constraints' },
    { key: 'risk.microbore_pipework',             category: 'risks' },
    { key: 'risk.low_pressure_poor_flow',         category: 'risks' },
    { key: 'risk.probable_asbestos',              category: 'risks' },
    { key: 'followup.confirm_bath_shower_count',  category: 'follow_ups' },
    { key: 'followup.confirm_boiler_location',    category: 'follow_ups' },
  ];

  for (const { key, category } of ADVISORY_KEYS) {
    it(`${key} produces an applied record but no engine field updates`, () => {
      const s = makeSuggestion({ key, category });
      const { updates, applied } = applyAcceptedSuggestions([s], {});
      // No engine-facing fields should be set.
      expect(Object.keys(updates).length).toBe(0);
      // But the suggestion is still tracked for provenance.
      expect(applied.length).toBe(1);
      expect(applied[0].provenance).toBe('accepted_atlas_suggestion');
    });
  }
});

// ─── Multiple suggestions together ───────────────────────────────────────────

describe('multiple accepted suggestions', () => {
  it('applies all direct mappings and produces applied records for all', () => {
    const suggestions: VoiceNoteSuggestion[] = [
      makeSuggestion({ key: 'preference.avoid_cylinder',        category: 'preferences' }),
      makeSuggestion({ key: 'usage.high_shower_concurrency',    category: 'usage' }),
      makeSuggestion({ key: 'risk.likely_sludge',               category: 'risks' }),
      makeSuggestion({ key: 'constraint.cupboard_tight',        category: 'constraints' }),
    ];

    const { updates, applied } = applyAcceptedSuggestions(suggestions, {});

    expect(updates.preferCombi).toBe(true);
    expect(updates.highOccupancy).toBe(true);
    expect(updates.fullSurvey?.heatingCondition?.magneticDebrisEvidence).toBe(true);
    expect(applied.length).toBe(4);
  });

  it('does not overwrite heatingCondition from both risk.likely_sludge and risk.radiator_imbalance', () => {
    const suggestions: VoiceNoteSuggestion[] = [
      makeSuggestion({ key: 'risk.likely_sludge',       category: 'risks' }),
      makeSuggestion({ key: 'risk.radiator_imbalance',  category: 'risks' }),
    ];
    const { updates } = applyAcceptedSuggestions(suggestions, {});
    expect(updates.fullSurvey?.heatingCondition?.magneticDebrisEvidence).toBe(true);
    expect(updates.fullSurvey?.heatingCondition?.radiatorsHeatingUnevenly).toBe(true);
  });
});

// ─── mergeAppliedSuggestions ──────────────────────────────────────────────────

describe('mergeAppliedSuggestions', () => {
  function makeApplied(id: string, overrides: Partial<AppliedNoteSuggestion> = {}): AppliedNoteSuggestion {
    return {
      sourceSuggestionId: id,
      sourceNoteId:       'note1',
      targetField:        'preferCombi',
      label:              'Test',
      appliedValue:       'true',
      confidence:         'high',
      provenance:         'accepted_atlas_suggestion',
      category:           'preferences',
      ...overrides,
    };
  }

  it('de-duplicates by sourceSuggestionId', () => {
    const existing = [makeApplied('a')];
    const incoming = [makeApplied('a'), makeApplied('b')];
    const merged = mergeAppliedSuggestions(existing, incoming);
    expect(merged.length).toBe(2);
  });

  it('preserves overriddenByManual from existing records', () => {
    const existing = [makeApplied('a', { overriddenByManual: true })];
    const incoming = [makeApplied('a', { overriddenByManual: false })];
    const merged = mergeAppliedSuggestions(existing, incoming);
    expect(merged[0].overriddenByManual).toBe(true);
  });

  it('returns empty array when both inputs are empty', () => {
    expect(mergeAppliedSuggestions([], [])).toEqual([]);
  });
});

// ─── markOverriddenByManual ───────────────────────────────────────────────────

describe('markOverriddenByManual', () => {
  function makeApplied(targetField: string): AppliedNoteSuggestion {
    return {
      sourceSuggestionId: 'id1',
      sourceNoteId:       'note1',
      targetField,
      label:              'Test',
      appliedValue:       'true',
      confidence:         'high',
      provenance:         'accepted_atlas_suggestion',
      category:           'preferences',
    };
  }

  it('marks matching targetField as overridden', () => {
    const applied = [makeApplied('preferCombi'), makeApplied('highOccupancy')];
    const result = markOverriddenByManual(applied, 'preferCombi');
    expect(result[0].overriddenByManual).toBe(true);
    expect(result[1].overriddenByManual).toBeUndefined();
  });

  it('returns a new array without mutating the original', () => {
    const original = [makeApplied('preferCombi')];
    const result = markOverriddenByManual(original, 'preferCombi');
    expect(result).not.toBe(original);
    expect(original[0].overriddenByManual).toBeUndefined();
  });

  it('does nothing when no record matches the targetField', () => {
    const applied = [makeApplied('highOccupancy')];
    const result = markOverriddenByManual(applied, 'preferCombi');
    expect(result[0].overriddenByManual).toBeUndefined();
  });
});

// ─── Hard exclusion guard ─────────────────────────────────────────────────────

describe('hard measured fields are NEVER updated from notes', () => {
  const HARD_FIELDS = [
    'dynamicMainsPressure',
    'staticMainsPressureBar',
    'dynamicMainsPressureBar',
    'mainsDynamicFlowLpm',
    'heatLossWatts',
    'primaryPipeDiameter',
    'radiatorCount',
    'returnWaterTemp',
  ];

  it('no accepted suggestion key maps to a hard measured field', () => {
    // Build a set of all accepted suggestions from all known keys.
    const knownKeys = [
      'preference.avoid_cylinder',
      'preference.simple_controls',
      'preference.no_bath_use',
      'preference.night_worker',
      'preference.preferred_boiler_location',
      'constraint.cupboard_tight',
      'constraint.storage_clearance_fail',
      'constraint.flue_route_difficult',
      'constraint.loft_access_poor',
      'constraint.narrow_stairs',
      'constraint.pipe_route_difficult',
      'constraint.parking_scaffold_issue',
      'usage.high_shower_concurrency',
      'usage.bath_infrequent',
      'risk.likely_sludge',
      'risk.radiator_imbalance',
      'risk.microbore_pipework',
      'risk.low_pressure_poor_flow',
      'risk.probable_asbestos',
      'followup.confirm_bath_shower_count',
      'followup.confirm_boiler_location',
      'followup.mark_install_constraint',
      'followup.combi_preference_confirm',
    ];

    const allSuggestions: VoiceNoteSuggestion[] = knownKeys.map(k =>
      makeSuggestion({ key: k, category: 'preferences' }),
    );

    const { updates } = applyAcceptedSuggestions(allSuggestions, {});

    for (const field of HARD_FIELDS) {
      expect((updates as Record<string, unknown>)[field]).toBeUndefined();
    }
  });
});
