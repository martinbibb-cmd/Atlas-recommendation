/**
 * sanitiseModelForEngine.householdComposition.test.ts
 *
 * Tests for the household-composition source-of-truth enforcement in
 * sanitiseModelForEngine.
 *
 * When householdComposition is present:
 *   - occupancyCount must always be derived from the composition headcounts.
 *   - demandPreset must be derived from the composition unless
 *     demandPresetIsManualOverride === true.
 *
 * Covers:
 *   1. occupancyCount is overwritten by the composition-derived value
 *   2. demandPreset is overwritten by the composition-derived preset
 *   3. demandPresetIsManualOverride=true preserves the existing demandPreset
 *   4. Without householdComposition, existing occupancyCount/demandPreset are untouched
 *   5. daytimeOccupancy hint from demandTimingOverrides feeds derivation correctly
 *   6. fullSurvey.usage.daytimeOccupancy feeds derivation when demandTimingOverrides absent
 *   7. fullSurvey.usage.bathUse feeds derivation when demandTimingOverrides absent
 *   8. demandTimingOverrides takes priority over fullSurvey.usage when both present
 */

import { describe, it, expect } from 'vitest';
import { sanitiseModelForEngine } from '../sanitiseModelForEngine';
import type { FullSurveyModelV1 } from '../FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid engine input fields shared across tests. */
const BASE: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
};

const TWO_ADULT_COMPOSITION = {
  adultCount: 2,
  childCount0to4: 0,
  childCount5to10: 0,
  childCount11to17: 0,
  youngAdultCount18to25AtHome: 0,
};

const FAMILY_WITH_TEENAGERS_COMPOSITION = {
  adultCount: 2,
  childCount0to4: 0,
  childCount5to10: 0,
  childCount11to17: 2,
  youngAdultCount18to25AtHome: 0,
};

// ─── 1. occupancyCount is always derived from composition ─────────────────────

describe('sanitiseModelForEngine — householdComposition source of truth: occupancyCount', () => {
  it('overwrites a stale occupancyCount with the composition-derived value', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      occupancyCount: 99, // stale / conflicting value
      householdComposition: TWO_ADULT_COMPOSITION,
    };
    const sanitised = sanitiseModelForEngine(model);
    // 2 adults → occupancyCount = 2
    expect(sanitised.occupancyCount).toBe(2);
  });

  it('sets occupancyCount even when it was previously undefined', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: {
        adultCount: 1,
        childCount0to4: 0,
        childCount5to10: 1,
        childCount11to17: 0,
        youngAdultCount18to25AtHome: 0,
      },
    };
    const sanitised = sanitiseModelForEngine(model);
    // Math.max(1, 1) + 1 = 2
    expect(sanitised.occupancyCount).toBe(2);
  });

  it('includes all five age bands in the derived occupancyCount', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: {
        adultCount: 1,
        childCount0to4: 1,
        childCount5to10: 1,
        childCount11to17: 1,
        youngAdultCount18to25AtHome: 1,
      },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.occupancyCount).toBe(5);
  });
});

// ─── 2. demandPreset is derived from composition (default path) ───────────────

describe('sanitiseModelForEngine — householdComposition source of truth: demandPreset', () => {
  it('overwrites a contradictory demandPreset with the composition-derived preset', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: FAMILY_WITH_TEENAGERS_COMPOSITION,
      demandPreset: 'single_working_adult', // contradicts composition
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('family_teenagers');
  });

  it('sets demandPreset even when it was previously undefined', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      // daytimeOccupancy not set → defaults to usually_out → working_couple
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('working_couple');
  });

  it('derives retired_couple when daytimeOccupancy=full (usually_home) and two adults', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      demandTimingOverrides: { daytimeOccupancy: 'full' },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('retired_couple');
  });

  it('derives shift_worker when daytimeOccupancy=partial (irregular) and two adults', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      demandTimingOverrides: { daytimeOccupancy: 'partial' },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('shift_worker');
  });

  it('derives bath_heavy when bathFrequencyPerWeek ≥ 7 and adults only', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      demandTimingOverrides: { bathFrequencyPerWeek: 7 },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('bath_heavy');
  });
});

// ─── 3. demandPresetIsManualOverride=true preserves the user's choice ─────────

describe('sanitiseModelForEngine — demandPresetIsManualOverride flag', () => {
  it('preserves an existing demandPreset when demandPresetIsManualOverride=true', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: FAMILY_WITH_TEENAGERS_COMPOSITION,
      demandPreset: 'single_working_adult', // manual surveyor override
      demandPresetIsManualOverride: true,
    };
    const sanitised = sanitiseModelForEngine(model);
    // demandPreset must NOT be overwritten
    expect(sanitised.demandPreset).toBe('single_working_adult');
  });

  it('still derives occupancyCount from composition even with manual override', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: FAMILY_WITH_TEENAGERS_COMPOSITION, // 2 adults + 2 teenagers = 4
      demandPreset: 'single_working_adult',
      demandPresetIsManualOverride: true,
    };
    const sanitised = sanitiseModelForEngine(model);
    // occupancyCount is always derived; only demandPreset is guarded by the flag
    expect(sanitised.occupancyCount).toBe(4);
  });
});

// ─── 4. Without householdComposition, existing fields are untouched ───────────

describe('sanitiseModelForEngine — no householdComposition: existing fields untouched', () => {
  it('does not touch occupancyCount when householdComposition is absent', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      occupancyCount: 3,
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.occupancyCount).toBe(3);
  });

  it('does not touch demandPreset when householdComposition is absent', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      demandPreset: 'home_worker',
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('home_worker');
  });
});

// ─── 6. fullSurvey.usage.daytimeOccupancy feeds derivation ───────────────────

describe('sanitiseModelForEngine — fullSurvey.usage.daytimeOccupancy feeds derivation', () => {
  it('derives retired_couple when fullSurvey.usage.daytimeOccupancy=usually_home and two adults', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      fullSurvey: {
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
        usage: {
          composition: TWO_ADULT_COMPOSITION,
          daytimeOccupancy: 'usually_home',
          bathUse: 'unknown',
          bathroomCount: null,
        },
      },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('retired_couple');
  });

  it('derives shift_worker when fullSurvey.usage.daytimeOccupancy=irregular and two adults', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      fullSurvey: {
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
        usage: {
          composition: TWO_ADULT_COMPOSITION,
          daytimeOccupancy: 'irregular',
          bathUse: 'unknown',
          bathroomCount: null,
        },
      },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('shift_worker');
  });

  it('defaults to working_couple (usually_out) when fullSurvey.usage.daytimeOccupancy=unknown', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      fullSurvey: {
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
        usage: {
          composition: TWO_ADULT_COMPOSITION,
          daytimeOccupancy: 'unknown',
          bathUse: 'unknown',
          bathroomCount: null,
        },
      },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('working_couple');
  });
});

// ─── 7. fullSurvey.usage.bathUse feeds derivation ────────────────────────────

describe('sanitiseModelForEngine — fullSurvey.usage.bathUse feeds derivation', () => {
  it('derives bath_heavy when fullSurvey.usage.bathUse=frequent and two adults', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      fullSurvey: {
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
        usage: {
          composition: TWO_ADULT_COMPOSITION,
          daytimeOccupancy: 'unknown',
          bathUse: 'frequent',
          bathroomCount: null,
        },
      },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).toBe('bath_heavy');
  });

  it('does NOT derive bath_heavy when fullSurvey.usage.bathUse=rare', () => {
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      fullSurvey: {
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
        usage: {
          composition: TWO_ADULT_COMPOSITION,
          daytimeOccupancy: 'unknown',
          bathUse: 'rare',
          bathroomCount: null,
        },
      },
    };
    const sanitised = sanitiseModelForEngine(model);
    expect(sanitised.demandPreset).not.toBe('bath_heavy');
  });
});

// ─── 8. demandTimingOverrides takes priority over fullSurvey.usage ────────────

describe('sanitiseModelForEngine — demandTimingOverrides priority over fullSurvey.usage', () => {
  it('uses demandTimingOverrides.daytimeOccupancy when both override and fullSurvey.usage are set', () => {
    // fullSurvey.usage says usually_home but demandTimingOverrides says absent → usually_out
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      demandTimingOverrides: { daytimeOccupancy: 'absent' },
      fullSurvey: {
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
        usage: {
          composition: TWO_ADULT_COMPOSITION,
          daytimeOccupancy: 'usually_home',
          bathUse: 'unknown',
          bathroomCount: null,
        },
      },
    };
    const sanitised = sanitiseModelForEngine(model);
    // demandTimingOverrides.absent → usually_out → working_couple
    expect(sanitised.demandPreset).toBe('working_couple');
  });

  it('uses demandTimingOverrides.bathFrequencyPerWeek when both override and fullSurvey.usage.bathUse are set', () => {
    // fullSurvey.usage says frequent but demandTimingOverrides says 0 baths/week → rare
    const model: FullSurveyModelV1 = {
      ...BASE,
      householdComposition: TWO_ADULT_COMPOSITION,
      demandTimingOverrides: { bathFrequencyPerWeek: 0 },
      fullSurvey: {
        manualEvidence: {},
        telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
        usage: {
          composition: TWO_ADULT_COMPOSITION,
          daytimeOccupancy: 'unknown',
          bathUse: 'frequent',
          bathroomCount: null,
        },
      },
    };
    const sanitised = sanitiseModelForEngine(model);
    // demandTimingOverrides.bathFrequencyPerWeek=0 → rare → NOT bath_heavy
    expect(sanitised.demandPreset).not.toBe('bath_heavy');
  });
});
