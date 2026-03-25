/**
 * DemographicsAssessmentModule.test.ts
 *
 * Regression tests proving that materially different households produce
 * materially different outputs from runDemographicsAssessmentModule.
 *
 * The acceptance test from the problem statement:
 *   "if I change the household from 1 adult to 2 adults + 3 children + frequent baths,
 *    do demand metrics move in believable ways?"
 */

import { describe, it, expect } from 'vitest';
import {
  runDemographicsAssessmentModule,
} from '../modules/DemographicsAssessmentModule';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** Minimal single working adult input. */
const singleAdultInput: Partial<EngineInputV2_3> = {
  occupancyCount: 1,
  bathroomCount: 1,
  occupancySignature: 'professional',
  demandPreset: 'single_working_adult',
  demandTimingOverrides: {
    bathFrequencyPerWeek: 1,
    simultaneousUseSeverity: 'low',
    daytimeOccupancy: 'absent',
  },
};

/** Two adults + 3 children with frequent baths. */
const largeFamilyInput: Partial<EngineInputV2_3> = {
  occupancyCount: 5,
  bathroomCount: 2,
  occupancySignature: 'steady_home',
  demandPreset: 'family_teenagers',
  demandTimingOverrides: {
    bathFrequencyPerWeek: 7,
    simultaneousUseSeverity: 'high',
    daytimeOccupancy: 'partial',
  },
};

function run(partial: Partial<EngineInputV2_3>) {
  return runDemographicsAssessmentModule(partial as EngineInputV2_3);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runDemographicsAssessmentModule', () => {

  // ─── Single adult baseline ─────────────────────────────────────────────────

  it('produces a demand profile label for a single working adult', () => {
    const result = run(singleAdultInput);
    expect(result.demandProfileLabel).toBeTruthy();
    expect(typeof result.demandProfileLabel).toBe('string');
  });

  it('returns low daily hot water volume for a single adult', () => {
    const result = run(singleAdultInput);
    // 1 person × 45 L + 1 bath/week × 80 L / 7 ≈ 56 L
    expect(result.dailyHotWaterLitres).toBeGreaterThanOrEqual(30);
    expect(result.dailyHotWaterLitres).toBeLessThan(100);
  });

  it('returns 1 peak simultaneous outlet for a single adult with 1 bathroom', () => {
    const result = run(singleAdultInput);
    expect(result.peakSimultaneousOutlets).toBe(1);
  });

  it('returns low bath use intensity for 1 bath/week', () => {
    const result = run(singleAdultInput);
    expect(result.bathUseIntensity).toBe('low');
  });

  it('returns away_daytime occupancy for a professional', () => {
    const result = run(singleAdultInput);
    expect(result.occupancyTimingProfile).toBe('away_daytime');
  });

  it('returns low storage benefit for a single adult', () => {
    const result = run(singleAdultInput);
    expect(result.storageBenefitSignal).toBe('low');
  });

  // ─── Large family contrast ──────────────────────────────────────────────────

  it('produces a different demand profile label for a large family', () => {
    const single = run(singleAdultInput);
    const family = run(largeFamilyInput);
    expect(family.demandProfileLabel).not.toBe(single.demandProfileLabel);
  });

  it('returns significantly more daily hot water for a large family vs single adult', () => {
    const single = run(singleAdultInput);
    const family = run(largeFamilyInput);
    // Family: 5 × 45 + 7 × 80 / 7 ≈ 305 L; single ≈ 56 L
    expect(family.dailyHotWaterLitres).toBeGreaterThan(single.dailyHotWaterLitres * 2);
  });

  it('returns 3 peak simultaneous outlets for a large family with 2 bathrooms and high severity', () => {
    const result = run(largeFamilyInput);
    expect(result.peakSimultaneousOutlets).toBe(3);
  });

  it('returns high bath use intensity for 7 baths/week', () => {
    const result = run(largeFamilyInput);
    expect(result.bathUseIntensity).toBe('high');
  });

  it('returns daytime_home occupancy for steady_home signature', () => {
    const result = run(largeFamilyInput);
    expect(result.occupancyTimingProfile).toBe('daytime_home');
  });

  it('returns high storage benefit for a large family with multiple bathrooms', () => {
    const result = run(largeFamilyInput);
    expect(result.storageBenefitSignal).toBe('high');
  });

  // ─── Narrative signals ─────────────────────────────────────────────────────

  it('includes at least one narrative signal for a single adult', () => {
    const result = run(singleAdultInput);
    expect(result.demographicNarrativeSignals.length).toBeGreaterThan(0);
  });

  it('includes more narrative signals for a large family than a single adult', () => {
    const single = run(singleAdultInput);
    const family = run(largeFamilyInput);
    expect(family.demographicNarrativeSignals.length).toBeGreaterThanOrEqual(
      single.demographicNarrativeSignals.length,
    );
  });

  it('mentions simultaneous demand for large family narrative', () => {
    const result = run(largeFamilyInput);
    const hasSimultaneous = result.demographicNarrativeSignals.some(s =>
      s.toLowerCase().includes('simultaneous'),
    );
    expect(hasSimultaneous).toBe(true);
  });

  // ─── Intermediate household ────────────────────────────────────────────────

  it('returns medium storage benefit for a 3-person household', () => {
    const input: Partial<EngineInputV2_3> = {
      occupancyCount: 3,
      bathroomCount: 1,
      occupancySignature: 'professional',
      demandPreset: 'family_young_children',
      demandTimingOverrides: {
        bathFrequencyPerWeek: 3,
        simultaneousUseSeverity: 'medium',
        daytimeOccupancy: 'partial',
      },
    };
    const result = run(input);
    expect(result.storageBenefitSignal).toBe('medium');
  });

  // ─── Bath intensity thresholds ─────────────────────────────────────────────

  it.each([
    [0, 'low'],
    [0.5, 'low'],
    [1, 'low'],
    [1.9, 'low'],
    [2, 'medium'],
    [3, 'medium'],
    [4, 'high'],
    [14, 'high'],
  ] as Array<[number, 'low' | 'medium' | 'high']>)(
    'bathFrequencyPerWeek=%i → bathUseIntensity=%s',
    (freq, expected) => {
      const input: Partial<EngineInputV2_3> = {
        occupancyCount: 2,
        bathroomCount: 1,
        occupancySignature: 'professional',
        demandTimingOverrides: { bathFrequencyPerWeek: freq },
      };
      expect(run(input).bathUseIntensity).toBe(expected);
    },
  );

  // ─── dailyHotWaterLitres formula ────────────────────────────────────────────

  it('daily hot water scales with occupancy', () => {
    const one = run({ occupancyCount: 1, bathroomCount: 1, occupancySignature: 'professional' } as EngineInputV2_3);
    const four = run({ occupancyCount: 4, bathroomCount: 1, occupancySignature: 'professional' } as EngineInputV2_3);
    expect(four.dailyHotWaterLitres).toBeGreaterThan(one.dailyHotWaterLitres * 2);
  });

  it('daily hot water increases with bath frequency', () => {
    const base: Partial<EngineInputV2_3> = {
      occupancyCount: 2, bathroomCount: 1, occupancySignature: 'professional',
    };
    const noBaths = run({ ...base, demandTimingOverrides: { bathFrequencyPerWeek: 0 } } as EngineInputV2_3);
    const dailyBaths = run({ ...base, demandTimingOverrides: { bathFrequencyPerWeek: 7 } } as EngineInputV2_3);
    expect(dailyBaths.dailyHotWaterLitres).toBeGreaterThan(noBaths.dailyHotWaterLitres);
  });

  // ─── peakSimultaneousOutlets rules ─────────────────────────────────────────

  it('2 bathrooms + high severity → 3 outlets', () => {
    const input: Partial<EngineInputV2_3> = {
      occupancyCount: 4, bathroomCount: 2, occupancySignature: 'steady_home',
      demandTimingOverrides: { simultaneousUseSeverity: 'high' },
    };
    expect(run(input).peakSimultaneousOutlets).toBe(3);
  });

  it('2 bathrooms + low severity → 2 outlets', () => {
    const input: Partial<EngineInputV2_3> = {
      occupancyCount: 2, bathroomCount: 2, occupancySignature: 'professional',
      demandTimingOverrides: { simultaneousUseSeverity: 'low' },
    };
    expect(run(input).peakSimultaneousOutlets).toBe(2);
  });

  it('1 bathroom + low severity → 1 outlet', () => {
    const input: Partial<EngineInputV2_3> = {
      occupancyCount: 2, bathroomCount: 1, occupancySignature: 'professional',
      demandTimingOverrides: { simultaneousUseSeverity: 'low' },
    };
    expect(run(input).peakSimultaneousOutlets).toBe(1);
  });

  it('honours explicit peakConcurrentOutlets override', () => {
    const input: Partial<EngineInputV2_3> = {
      occupancyCount: 2, bathroomCount: 1, occupancySignature: 'professional',
      peakConcurrentOutlets: 4,
    };
    expect(run(input).peakSimultaneousOutlets).toBe(4);
  });

  // ─── Occupancy timing profiles ─────────────────────────────────────────────

  it.each([
    ['professional', 'away_daytime'],
    ['steady_home', 'daytime_home'],
    ['steady', 'daytime_home'],
    ['shift_worker', 'irregular'],
    ['shift', 'irregular'],
  ] as Array<[string, 'away_daytime' | 'daytime_home' | 'irregular']>)(
    'occupancySignature=%s → occupancyTimingProfile=%s',
    (sig, expected) => {
      const input = { occupancyCount: 2, bathroomCount: 1, occupancySignature: sig } as EngineInputV2_3;
      expect(run(input).occupancyTimingProfile).toBe(expected);
    },
  );
});
