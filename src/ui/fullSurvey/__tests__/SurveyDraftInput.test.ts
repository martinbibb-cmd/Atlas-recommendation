/**
 * SurveyDraftInput.test.ts
 *
 * Regression tests for the draft-vs-normalized survey state split.
 *
 *   1. INITIAL_SURVEY_DRAFT has no phantom defaults in physics-sensitive fields.
 *   2. normalizeDraftToEngineInput fills engine-safe defaults only for empty fields.
 *   3. User-entered values are preserved through normalization.
 *   4. Provenance summary correctly categorizes fields.
 *   5. Empty draft fields never appear as user-entered.
 */
import { describe, it, expect } from 'vitest';
import {
  INITIAL_SURVEY_DRAFT,
  normalizeDraftToEngineInput,
  summarizeDraftProvenance,
  userField,
  defaultedField,
  inferredField,
  emptyField,
  type SurveyDraftInput,
} from '../SurveyDraftInput';

// ─── No phantom defaults in initial draft ─────────────────────────────────────

describe('SurveyDraftInput — initial draft has no phantom defaults', () => {
  it('dynamicMainsPressure is empty (undefined) in initial draft', () => {
    expect(INITIAL_SURVEY_DRAFT.dynamicMainsPressure.value).toBeUndefined();
    expect(INITIAL_SURVEY_DRAFT.dynamicMainsPressure.source).toBe('defaulted');
  });

  it('heatLossWatts is empty (undefined) in initial draft', () => {
    expect(INITIAL_SURVEY_DRAFT.heatLossWatts.value).toBeUndefined();
    expect(INITIAL_SURVEY_DRAFT.heatLossWatts.source).toBe('defaulted');
  });

  it('bathroomCount is empty (undefined) in initial draft', () => {
    expect(INITIAL_SURVEY_DRAFT.bathroomCount.value).toBeUndefined();
    expect(INITIAL_SURVEY_DRAFT.bathroomCount.source).toBe('defaulted');
  });

  it('occupancySignature is empty (undefined) in initial draft', () => {
    expect(INITIAL_SURVEY_DRAFT.occupancySignature.value).toBeUndefined();
    expect(INITIAL_SURVEY_DRAFT.occupancySignature.source).toBe('defaulted');
  });

  it('all hydraulic fields are empty in initial draft', () => {
    expect(INITIAL_SURVEY_DRAFT.staticMainsPressureBar.value).toBeUndefined();
    expect(INITIAL_SURVEY_DRAFT.dynamicMainsPressureBar.value).toBeUndefined();
    expect(INITIAL_SURVEY_DRAFT.mainsDynamicFlowLpm.value).toBeUndefined();
  });

  it('all building fabric fields are empty in initial draft', () => {
    expect(INITIAL_SURVEY_DRAFT.buildingMass.value).toBeUndefined();
    expect(INITIAL_SURVEY_DRAFT.primaryPipeDiameter.value).toBeUndefined();
    expect(INITIAL_SURVEY_DRAFT.radiatorCount.value).toBeUndefined();
    expect(INITIAL_SURVEY_DRAFT.returnWaterTemp.value).toBeUndefined();
  });
});

// ─── Normalization applies engine-safe defaults ───────────────────────────────

describe('SurveyDraftInput — normalization fills defaults for empty fields', () => {
  it('fills dynamicMainsPressure with 1.0 bar when empty', () => {
    const result = normalizeDraftToEngineInput(INITIAL_SURVEY_DRAFT);
    expect(result.dynamicMainsPressure).toBe(1.0);
  });

  it('fills heatLossWatts with 8000 when empty', () => {
    const result = normalizeDraftToEngineInput(INITIAL_SURVEY_DRAFT);
    expect(result.heatLossWatts).toBe(8000);
  });

  it('fills bathroomCount with 1 when empty', () => {
    const result = normalizeDraftToEngineInput(INITIAL_SURVEY_DRAFT);
    expect(result.bathroomCount).toBe(1);
  });

  it('fills occupancySignature with "professional" when empty', () => {
    const result = normalizeDraftToEngineInput(INITIAL_SURVEY_DRAFT);
    expect(result.occupancySignature).toBe('professional');
  });

  it('fills buildingMass with "heavy" when empty', () => {
    const result = normalizeDraftToEngineInput(INITIAL_SURVEY_DRAFT);
    expect(result.buildingMass).toBe('heavy');
  });
});

// ─── User-entered values survive normalization ────────────────────────────────

describe('SurveyDraftInput — user values preserved through normalization', () => {
  it('preserves user-entered dynamicMainsPressure', () => {
    const draft: SurveyDraftInput = {
      ...INITIAL_SURVEY_DRAFT,
      dynamicMainsPressure: userField(2.5),
    };
    const result = normalizeDraftToEngineInput(draft);
    expect(result.dynamicMainsPressure).toBe(2.5);
  });

  it('preserves user-entered heatLossWatts', () => {
    const draft: SurveyDraftInput = {
      ...INITIAL_SURVEY_DRAFT,
      heatLossWatts: userField(12000),
    };
    const result = normalizeDraftToEngineInput(draft);
    expect(result.heatLossWatts).toBe(12000);
  });

  it('preserves user-entered bathroomCount', () => {
    const draft: SurveyDraftInput = {
      ...INITIAL_SURVEY_DRAFT,
      bathroomCount: userField(3),
    };
    const result = normalizeDraftToEngineInput(draft);
    expect(result.bathroomCount).toBe(3);
  });

  it('preserves optional measured mains fields when present', () => {
    const draft: SurveyDraftInput = {
      ...INITIAL_SURVEY_DRAFT,
      staticMainsPressureBar: userField(3.2),
      dynamicMainsPressureBar: userField(2.8),
      mainsDynamicFlowLpm: userField(14.5),
    };
    const result = normalizeDraftToEngineInput(draft);
    expect(result.staticMainsPressureBar).toBe(3.2);
    expect(result.dynamicMainsPressureBar).toBe(2.8);
    expect(result.mainsDynamicFlowLpm).toBe(14.5);
  });

  it('omits optional mains fields when not user-entered', () => {
    const result = normalizeDraftToEngineInput(INITIAL_SURVEY_DRAFT);
    expect(result.staticMainsPressureBar).toBeUndefined();
    expect(result.dynamicMainsPressureBar).toBeUndefined();
    expect(result.mainsDynamicFlowLpm).toBeUndefined();
  });
});

// ─── Provenance summary ───────────────────────────────────────────────────────

describe('SurveyDraftInput — provenance summary', () => {
  it('empty draft has no user-entered fields', () => {
    const summary = summarizeDraftProvenance(INITIAL_SURVEY_DRAFT);
    expect(summary.userEntered).toHaveLength(0);
  });

  it('empty draft has all physics fields in the empty list', () => {
    const summary = summarizeDraftProvenance(INITIAL_SURVEY_DRAFT);
    expect(summary.empty).toContain('dynamicMainsPressure');
    expect(summary.empty).toContain('heatLossWatts');
    expect(summary.empty).toContain('bathroomCount');
    expect(summary.empty).toContain('buildingMass');
  });

  it('preference fields appear in defaulted list', () => {
    const summary = summarizeDraftProvenance(INITIAL_SURVEY_DRAFT);
    expect(summary.defaulted).toContain('hasLoftConversion');
    expect(summary.defaulted).toContain('installationPolicy');
  });

  it('user-entered field appears in userEntered list', () => {
    const draft: SurveyDraftInput = {
      ...INITIAL_SURVEY_DRAFT,
      dynamicMainsPressure: userField(2.0),
      bathroomCount: userField(1),
    };
    const summary = summarizeDraftProvenance(draft);
    expect(summary.userEntered).toContain('dynamicMainsPressure');
    expect(summary.userEntered).toContain('bathroomCount');
    expect(summary.empty).not.toContain('dynamicMainsPressure');
    expect(summary.empty).not.toContain('bathroomCount');
  });

  it('inferred fields appear in inferred list', () => {
    const draft: SurveyDraftInput = {
      ...INITIAL_SURVEY_DRAFT,
      heatLossWatts: inferredField(6500),
    };
    const summary = summarizeDraftProvenance(draft);
    expect(summary.inferred).toContain('heatLossWatts');
  });
});

// ─── Regression: empty draft fields must never be user-entered ────────────────

describe('SurveyDraftInput — regression: no phantom user values', () => {
  it('no field in INITIAL_SURVEY_DRAFT has source === "user"', () => {
    for (const [key, field] of Object.entries(INITIAL_SURVEY_DRAFT)) {
      const pf = field as { source: string };
      expect(pf.source, `${key} must not be "user" in initial draft`).not.toBe('user');
    }
  });

  it('physics-sensitive fields in INITIAL_SURVEY_DRAFT have value === undefined', () => {
    const physicsKeys = [
      'dynamicMainsPressure',
      'staticMainsPressureBar',
      'dynamicMainsPressureBar',
      'mainsDynamicFlowLpm',
      'buildingMass',
      'primaryPipeDiameter',
      'heatLossWatts',
      'radiatorCount',
      'returnWaterTemp',
      'bathroomCount',
      'occupancySignature',
      'highOccupancy',
    ] as const;

    for (const key of physicsKeys) {
      const field = INITIAL_SURVEY_DRAFT[key];
      expect(field.value, `${key} must be undefined in initial draft`).toBeUndefined();
    }
  });
});
