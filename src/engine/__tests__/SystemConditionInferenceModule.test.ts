import { describe, it, expect } from 'vitest';
import { inferSystemConditionFlags } from '../modules/SystemConditionInferenceModule';
import type { SystemConditionInferenceInput } from '../modules/SystemConditionInferenceModule';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const cleanSystem: SystemConditionInferenceInput = {
  heatingCondition: {
    systemCircuitType: 'sealed',
    pumpingOverObserved: false,
    radiatorsColdeAtBottom: false,
    radiatorsHeatingUnevenly: false,
    bleedWaterColour: 'clear',
    magneticDebrisEvidence: false,
    pumpSpeedHigh: false,
    repeatedPumpOrValveReplacements: false,
    boilerCavitationOrNoise: false,
  },
  dhwCondition: {
    plateHexAgeYears: 3,
    cylinderAgeEstimate: 'under_5',
    kettlingOrScaleSymptoms: false,
    immersionFailureHistory: false,
  },
  waterHardnessCategory: 'soft',
  systemAgeYears: 5,
};

const heavilyFouledOpenVented: SystemConditionInferenceInput = {
  heatingCondition: {
    systemCircuitType: 'open_vented',
    pumpingOverObserved: false,
    radiatorsColdeAtBottom: true,
    radiatorsHeatingUnevenly: true,
    bleedWaterColour: 'black',
    magneticDebrisEvidence: true,
    pumpSpeedHigh: true,
    repeatedPumpOrValveReplacements: true,
    boilerCavitationOrNoise: false,
  },
  dhwCondition: {
    cylinderAgeEstimate: 'over_15',
    kettlingOrScaleSymptoms: true,
    immersionFailureHistory: true,
  },
  waterHardnessCategory: 'very_hard',
  systemAgeYears: 20,
};

// ─── Pumping Over ─────────────────────────────────────────────────────────────

describe('inferSystemConditionFlags — pumping over', () => {
  it('sets pumpingOverPresent to false when not observed', () => {
    const result = inferSystemConditionFlags(cleanSystem);
    expect(result.pumpingOverPresent).toBe(false);
  });

  it('sets pumpingOverPresent to true when pumpingOverObserved is true', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: { pumpingOverObserved: true },
    });
    expect(result.pumpingOverPresent).toBe(true);
  });

  it('sets openVentedFaultRisk to "likely" when pumping over is observed', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: { pumpingOverObserved: true },
    });
    expect(result.openVentedFaultRisk).toBe('likely');
  });

  it('emits at least one advisory message when pumping over is observed', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: { pumpingOverObserved: true },
    });
    expect(result.pumpingOverAdvisory.length).toBeGreaterThan(0);
  });

  it('advisory message mentions feed-and-vent connection', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: { pumpingOverObserved: true },
    });
    const joined = result.pumpingOverAdvisory.join(' ').toLowerCase();
    expect(joined).toContain('feed-and-vent');
  });

  it('advisory message recommends checking beyond chemical treatment when pumping over observed on open vented system', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: {
        pumpingOverObserved: true,
        systemCircuitType: 'open_vented',
      },
    });
    expect(result.pumpingOverAdvisory.length).toBeGreaterThanOrEqual(2);
    const joined = result.pumpingOverAdvisory.join(' ').toLowerCase();
    expect(joined).toContain('open vented');
  });

  it('emits no advisory when pumping over is not observed', () => {
    const result = inferSystemConditionFlags(cleanSystem);
    expect(result.pumpingOverAdvisory).toHaveLength(0);
  });
});

// ─── Open Vented Fault Risk ───────────────────────────────────────────────────

describe('inferSystemConditionFlags — openVentedFaultRisk', () => {
  it('returns "none" for a sealed system with no pumping over', () => {
    const result = inferSystemConditionFlags(cleanSystem);
    expect(result.openVentedFaultRisk).toBe('none');
  });

  it('returns "possible" for an open vented system with no pumping over observed', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: { systemCircuitType: 'open_vented', pumpingOverObserved: false },
    });
    expect(result.openVentedFaultRisk).toBe('possible');
  });

  it('returns "likely" regardless of circuit type when pumping over is observed', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: { systemCircuitType: 'sealed', pumpingOverObserved: true },
    });
    expect(result.openVentedFaultRisk).toBe('likely');
  });
});

// ─── Sludge Risk ─────────────────────────────────────────────────────────────

describe('inferSystemConditionFlags — sludgeRisk', () => {
  it('is "low" for a clean system', () => {
    const result = inferSystemConditionFlags(cleanSystem);
    expect(result.sludgeRisk).toBe('low');
  });

  it('is "high" when 3+ heating symptoms are present', () => {
    const result = inferSystemConditionFlags(heavilyFouledOpenVented);
    expect(result.sludgeRisk).toBe('high');
  });

  it('is "moderate" for a single heating symptom', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: { radiatorsColdeAtBottom: true },
    });
    expect(result.sludgeRisk).toBe('moderate');
  });

  it('escalates to "moderate" via age proxy when system is 10+ years old and no symptoms observed', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: {},
      systemAgeYears: 12,
    });
    expect(result.sludgeRisk).toBe('moderate');
  });

  it('escalates to "high" via age proxy when system is 20+ years old and no symptoms observed', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: {},
      systemAgeYears: 22,
    });
    expect(result.sludgeRisk).toBe('high');
  });

  it('black bleed water colour is counted as a sludge symptom', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: { bleedWaterColour: 'black' },
    });
    expect(result.sludgeRisk).toBe('moderate');
  });

  it('clear bleed water colour is not counted as a sludge symptom', () => {
    const result = inferSystemConditionFlags({
      heatingCondition: { bleedWaterColour: 'clear' },
    });
    expect(result.sludgeRisk).toBe('low');
  });
});

// ─── Scale Risk ───────────────────────────────────────────────────────────────

describe('inferSystemConditionFlags — scaleRisk', () => {
  it('is "low" for soft water with no symptoms', () => {
    const result = inferSystemConditionFlags(cleanSystem);
    expect(result.scaleRisk).toBe('low');
  });

  it('is "moderate" for hard water area without symptoms', () => {
    const result = inferSystemConditionFlags({
      waterHardnessCategory: 'hard',
    });
    expect(result.scaleRisk).toBe('moderate');
  });

  it('is "high" for very hard water area with scale symptoms', () => {
    const result = inferSystemConditionFlags({
      dhwCondition: { kettlingOrScaleSymptoms: true },
      waterHardnessCategory: 'very_hard',
    });
    expect(result.scaleRisk).toBe('high');
  });

  it('is "moderate" for soft water area when scale symptoms are present', () => {
    const result = inferSystemConditionFlags({
      dhwCondition: { kettlingOrScaleSymptoms: true },
      waterHardnessCategory: 'soft',
    });
    expect(result.scaleRisk).toBe('moderate');
  });

  it('is "high" for hard water with DHW symptoms', () => {
    const result = inferSystemConditionFlags(heavilyFouledOpenVented);
    expect(result.scaleRisk).toBe('high');
  });
});

// ─── Plate HEX Condition ─────────────────────────────────────────────────────

describe('inferSystemConditionFlags — plateHexCondition', () => {
  it('is "good" when HEX is less than 10 years old and no symptoms', () => {
    const result = inferSystemConditionFlags(cleanSystem);
    expect(result.plateHexCondition).toBe('good');
  });

  it('is "degraded" when HEX age is 10 or more years', () => {
    const result = inferSystemConditionFlags({
      dhwCondition: { plateHexAgeYears: 12 },
    });
    expect(result.plateHexCondition).toBe('degraded');
  });

  it('is "degraded" when HEX age is below threshold but kettling symptoms present', () => {
    const result = inferSystemConditionFlags({
      dhwCondition: { plateHexAgeYears: 5, kettlingOrScaleSymptoms: true },
    });
    expect(result.plateHexCondition).toBe('degraded');
  });

  it('is "unknown" when no HEX age and no kettling symptoms', () => {
    const result = inferSystemConditionFlags({
      dhwCondition: {},
    });
    expect(result.plateHexCondition).toBe('unknown');
  });
});

// ─── Cylinder Age Band ────────────────────────────────────────────────────────

describe('inferSystemConditionFlags — cylinderAgeBand', () => {
  it('maps "under_5" to "new"', () => {
    const result = inferSystemConditionFlags({ dhwCondition: { cylinderAgeEstimate: 'under_5' } });
    expect(result.cylinderAgeBand).toBe('new');
  });

  it('maps "5_to_10" to "mid"', () => {
    const result = inferSystemConditionFlags({ dhwCondition: { cylinderAgeEstimate: '5_to_10' } });
    expect(result.cylinderAgeBand).toBe('mid');
  });

  it('maps "10_to_15" to "aged"', () => {
    const result = inferSystemConditionFlags({ dhwCondition: { cylinderAgeEstimate: '10_to_15' } });
    expect(result.cylinderAgeBand).toBe('aged');
  });

  it('maps "over_15" to "aged"', () => {
    const result = inferSystemConditionFlags({ dhwCondition: { cylinderAgeEstimate: 'over_15' } });
    expect(result.cylinderAgeBand).toBe('aged');
  });

  it('maps "unknown" to "unknown"', () => {
    const result = inferSystemConditionFlags({ dhwCondition: { cylinderAgeEstimate: 'unknown' } });
    expect(result.cylinderAgeBand).toBe('unknown');
  });

  it('is "unknown" when no estimate provided', () => {
    const result = inferSystemConditionFlags({});
    expect(result.cylinderAgeBand).toBe('unknown');
  });
});

// ─── Coil Condition ───────────────────────────────────────────────────────────

describe('inferSystemConditionFlags — coilCondition', () => {
  it('is "good" for a new cylinder in soft water without symptoms', () => {
    const result = inferSystemConditionFlags(cleanSystem);
    expect(result.coilCondition).toBe('good');
  });

  it('is "degraded" for an aged cylinder', () => {
    const result = inferSystemConditionFlags({
      dhwCondition: { cylinderAgeEstimate: 'over_15' },
    });
    expect(result.coilCondition).toBe('degraded');
  });

  it('is "degraded" when scale risk is high even for a mid-age cylinder', () => {
    const result = inferSystemConditionFlags({
      dhwCondition: {
        cylinderAgeEstimate: '5_to_10',
        kettlingOrScaleSymptoms: true,
      },
      waterHardnessCategory: 'very_hard',
    });
    expect(result.coilCondition).toBe('degraded');
  });

  it('is "unknown" when cylinder age is unknown', () => {
    const result = inferSystemConditionFlags({
      dhwCondition: { cylinderAgeEstimate: 'unknown' },
      waterHardnessCategory: 'soft',
    });
    expect(result.coilCondition).toBe('unknown');
  });
});

// ─── No input (all undefined) ─────────────────────────────────────────────────

describe('inferSystemConditionFlags — empty input', () => {
  it('returns safe defaults with no input', () => {
    const result = inferSystemConditionFlags({});
    expect(result.pumpingOverPresent).toBe(false);
    expect(result.openVentedFaultRisk).toBe('none');
    expect(result.sludgeRisk).toBe('low');
    expect(result.scaleRisk).toBe('low');
    expect(result.pumpingOverAdvisory).toHaveLength(0);
  });
});
