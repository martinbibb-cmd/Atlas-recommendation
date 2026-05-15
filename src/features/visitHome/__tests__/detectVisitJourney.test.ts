/**
 * detectVisitJourney.test.ts
 *
 * Unit tests for the journey archetype detection utility.
 */

import { describe, it, expect } from 'vitest';
import { detectVisitJourney } from '../detectVisitJourney';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOutput(primary: string): Partial<EngineOutputV1> {
  return {
    recommendation: { primary },
    eligibility: [],
    redFlags: [],
    explainers: [],
  };
}

function makeScenarioWithFlags(flags: Partial<ScenarioResult['physicsFlags']>): ScenarioResult[] {
  return [
    {
      scenarioId: 'combi',
      system: { type: 'combi', summary: '' },
      performance: {
        hotWater: 'good',
        heating: 'good',
        efficiency: 'good',
        reliability: 'good',
      },
      physicsFlags: flags,
      displayIdentity: { label: 'Combi', tagline: '' },
      benefits: [],
      constraints: [],
      outcomes: [],
      requiredWorks: [],
      upgradePaths: [],
    },
  ];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('detectVisitJourney', () => {
  it('returns heat_pump_reality when engine recommends ashp', () => {
    const result = detectVisitJourney(makeOutput('ashp') as EngineOutputV1, [], undefined);
    expect(result.archetype).toBe('heat_pump_reality');
    expect(result.label).toContain('Heat pump');
  });

  it('returns heat_pump_reality when recommendation contains "heat_pump"', () => {
    const result = detectVisitJourney(makeOutput('heat_pump') as EngineOutputV1, [], undefined);
    expect(result.archetype).toBe('heat_pump_reality');
  });

  it('returns open_vented_to_sealed_unvented for open-vented circuit + unvented recommendation', () => {
    const result = detectVisitJourney(
      makeOutput('system_unvented') as EngineOutputV1,
      [],
      'open_vented',
    );
    expect(result.archetype).toBe('open_vented_to_sealed_unvented');
    expect(result.label).toContain('sealed');
  });

  it('returns open_vented_to_sealed_unvented for open-vented circuit + unvented scenario', () => {
    const scenarios: ScenarioResult[] = [
      {
        scenarioId: 'system_unvented',
        system: { type: 'system', summary: '' },
        performance: {
          hotWater: 'good',
          heating: 'good',
          efficiency: 'good',
          reliability: 'good',
        },
        physicsFlags: {},
        displayIdentity: { label: 'System', tagline: '' },
        benefits: [],
        constraints: [],
        outcomes: [],
        requiredWorks: [],
        upgradePaths: [],
      },
    ];
    const result = detectVisitJourney(
      makeOutput('combi') as EngineOutputV1,
      scenarios,
      'open_vented',
    );
    expect(result.archetype).toBe('open_vented_to_sealed_unvented');
  });

  it('returns water_constraint when scenario has pressureConstraint flag', () => {
    const result = detectVisitJourney(
      makeOutput('combi') as EngineOutputV1,
      makeScenarioWithFlags({ pressureConstraint: true }),
      undefined,
    );
    expect(result.archetype).toBe('water_constraint');
    expect(result.label).toContain('constraint');
  });

  it('returns water_constraint when scenario has hydraulicLimit flag', () => {
    const result = detectVisitJourney(
      makeOutput('combi') as EngineOutputV1,
      makeScenarioWithFlags({ hydraulicLimit: true }),
      undefined,
    );
    expect(result.archetype).toBe('water_constraint');
  });

  it('returns regular_unvented for regular/unvented recommendation without open-vented circuit', () => {
    const result = detectVisitJourney(
      makeOutput('regular_unvented') as EngineOutputV1,
      [],
      'sealed',
    );
    expect(result.archetype).toBe('regular_unvented');
    expect(result.label).toContain('Regular');
  });

  it('returns null archetype for plain combi recommendation with no constraints', () => {
    const result = detectVisitJourney(
      makeOutput('combi') as EngineOutputV1,
      [],
      undefined,
    );
    expect(result.archetype).toBeNull();
  });

  it('returns null archetype when engineOutput is undefined', () => {
    const result = detectVisitJourney(undefined, [], undefined);
    expect(result.archetype).toBeNull();
  });

  it('heat_pump_reality takes precedence over other archetypes', () => {
    // Even with open-vented circuit, ashp recommendation wins
    const result = detectVisitJourney(
      makeOutput('ashp') as EngineOutputV1,
      makeScenarioWithFlags({ pressureConstraint: true }),
      'open_vented',
    );
    expect(result.archetype).toBe('heat_pump_reality');
  });
});
