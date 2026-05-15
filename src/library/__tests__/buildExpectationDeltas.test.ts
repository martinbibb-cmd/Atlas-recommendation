import { describe, expect, it } from 'vitest';
import { buildExpectationDeltas } from '../content';
import type { LivingExperiencePatternV1 } from '../content/LivingExperiencePatternV1';

function pattern(
  whatYouMayNotice: string,
  whatChanges: string,
  whatStaysFamiliar: string,
  commonMisunderstanding = 'Test misunderstanding.',
): LivingExperiencePatternV1 {
  return {
    whatYouMayNotice,
    whatThisMeans: 'Test meaning.',
    whatChanges,
    whatStaysFamiliar,
    reassurance: whatStaysFamiliar,
    commonMisunderstanding,
    dailyLifeEffect: whatChanges,
    analogyOptions: [{ title: 'Test analogy', explanation: 'Test explanation.' }],
    printSummary: 'Test summary.',
  };
}

describe('buildExpectationDeltas', () => {
  it('combi to stored generates a major hot-water delta', () => {
    const deltas = buildExpectationDeltas({
      currentSystem: 'combi',
      recommendedSystem: 'stored_hot_water',
      livingExperiencePatterns: {
        hot_water: {
          current: pattern(
            'Hot water drops when two outlets open.',
            'Overlap use shows shared on-demand limits.',
            'Single-outlet routines still feel familiar.',
          ),
          future: pattern(
            'Hot water stays steadier during overlap use.',
            'Heavy use can require recovery after peak demand.',
            'Daily routines stay straightforward.',
          ),
        },
      },
    });

    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.category).toBe('hot_water');
    expect(deltas[0]?.perceivedSeverity).toBe('major');
  });

  it('heat pump transition generates a warm-radiator delta', () => {
    const deltas = buildExpectationDeltas({
      currentSystem: 'boiler',
      recommendedSystem: 'heat_pump',
      livingExperiencePatterns: {
        radiators: {
          current: pattern(
            'Radiators feel very hot in short bursts.',
            'Comfort arrives in shorter peaks.',
            'Room comfort targets stay familiar.',
          ),
          future: pattern(
            'Radiators feel warm for longer periods.',
            'Comfort arrives through steady low-temperature delivery.',
            'Room comfort targets stay familiar.',
          ),
        },
      },
    });

    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.category).toBe('radiators');
    expect(deltas[0]?.futureExperience.toLowerCase()).toContain('warm');
  });

  it('same-system upgrades produce minor or no deltas', () => {
    const deltas = buildExpectationDeltas({
      currentSystem: 'regular_unvented',
      recommendedSystem: 'regular_unvented',
      livingExperiencePatterns: {
        daily_routine: {
          current: pattern(
            'Daily routines stay familiar.',
            'Only small timing tweaks may help in peak periods.',
            'Daily routines stay familiar.',
          ),
          future: pattern(
            'Daily routines stay familiar.',
            'Only small timing tweaks may help in peak periods.',
            'Daily routines stay familiar.',
          ),
        },
      },
    });

    expect(deltas).toHaveLength(1);
    expect(['none', 'minor']).toContain(deltas[0]?.perceivedSeverity);
  });

  it('projection safety sanitises installer jargon', () => {
    const deltas = buildExpectationDeltas({
      currentSystem: 'open_vented',
      recommendedSystem: 'sealed_unvented',
      livingExperiencePatterns: {
        controls: {
          current: pattern(
            'A benchmark check is mentioned in handover.',
            'G3 and commissioning terms can sound technical.',
            'Comfort targets stay familiar.',
            'Fill pressure wording can worry households.',
          ),
          future: pattern(
            'The installation record is explained in plain language.',
            'Safety setup checks are explained with customer-safe wording.',
            'Comfort targets stay familiar.',
            'System pressure wording is explained clearly.',
          ),
        },
      },
    });

    expect(deltas).toHaveLength(1);
    const serialized = JSON.stringify(deltas[0]).toLowerCase();
    expect(serialized).not.toContain('benchmark');
    expect(serialized).not.toContain('g3');
    expect(serialized).not.toContain('commissioning');
    expect(serialized).not.toContain('fill pressure');
  });
});
