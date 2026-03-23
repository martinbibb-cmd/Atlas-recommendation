// src/lib/simulator/__tests__/buildResimulationFromSurvey.test.ts
//
// Unit tests for buildResimulationFromSurvey.
//
// Coverage:
//   - Returns a ResimulationFromSurveyResult for minimal survey data
//   - Returns null-safe (does not throw on empty survey)
//   - simpleInstall and bestFitInstall share the same event IDs (same schedule)
//   - upgradePackage systemType matches the current system
//   - recommendedSystemLabel is populated
//   - headlineImprovements can be present (upgrade path has effect)
//   - conflictDelta is non-negative (best-fit never makes things worse for conflicts)

import { describe, it, expect } from 'vitest';
import { buildResimulationFromSurvey } from '../buildResimulationFromSurvey';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineOutputV1, OptionCardV1 } from '../../../contracts/EngineOutputV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOption(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
): OptionCardV1 {
  return {
    id,
    label: id,
    status,
    headline: `${id} headline`,
    why: [`${id} is suitable`],
    requirements: [],
    penalties: [],
  };
}

function makeEngineOutput(
  primary = 'Stored water',
  optionId: OptionCardV1['id'] = 'stored_vented',
): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary },
    explainers: [],
    options: [makeOption(optionId, 'viable')],
  };
}

/** Minimal survey — combi, 2 adults, low demand. */
function makeMinimalSurvey(
  overrides: Partial<FullSurveyModelV1> = {},
): FullSurveyModelV1 {
  return {
    occupancyCount: 2,
    currentHeatSourceType: 'combi',
    householdComposition: {
      adultCount: 2,
      youngAdultCount18to25AtHome: 0,
      childCount0to4:  0,
      childCount5to10: 0,
      childCount11to17: 0,
    },
    dynamicMainsPressureBar: 1.5,
    currentBoilerOutputKw: 28,
    primaryPipeDiameter: 22,
    bathroomCount: 1,
    ...overrides,
  } as FullSurveyModelV1;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildResimulationFromSurvey', () => {

  it('returns a result for minimal survey data', () => {
    const survey = makeMinimalSurvey();
    const engine = makeEngineOutput();
    const result = buildResimulationFromSurvey(survey, engine);
    expect(result).not.toBeNull();
  });

  it('does not throw when survey has no householdComposition', () => {
    const survey = makeMinimalSurvey({ householdComposition: undefined });
    const engine = makeEngineOutput();
    expect(() => buildResimulationFromSurvey(survey, engine)).not.toThrow();
  });

  it('simpleInstall and bestFitInstall events share the same event IDs', () => {
    const result = buildResimulationFromSurvey(makeMinimalSurvey(), makeEngineOutput());
    expect(result).not.toBeNull();
    const simpleIds  = result!.resimulation.simpleInstall.events.map((e) => e.eventId);
    const bestFitIds = result!.resimulation.bestFitInstall.events.map((e) => e.eventId);
    expect(simpleIds).toEqual(bestFitIds);
  });

  it('upgradePackage systemType matches the proposed (recommended) system type from engine output', () => {
    // Current system is combi, but engine recommends stored_vented → upgrade
    // package should be for stored_water, not combi.
    const survey = makeMinimalSurvey({ currentHeatSourceType: 'combi' });
    const result = buildResimulationFromSurvey(survey, makeEngineOutput('Stored water', 'stored_vented'));
    expect(result).not.toBeNull();
    expect(result!.upgradePackage.systemType).toBe('stored_water');
  });

  it('upgradePackage systemType is combi when engine recommends combi', () => {
    const survey = makeMinimalSurvey({ currentHeatSourceType: 'combi' });
    const result = buildResimulationFromSurvey(survey, makeEngineOutput('Combi boiler', 'combi'));
    expect(result).not.toBeNull();
    expect(result!.upgradePackage.systemType).toBe('combi');
  });

  it('recommendedSystemLabel is a non-empty string', () => {
    const result = buildResimulationFromSurvey(makeMinimalSurvey(), makeEngineOutput('Stored water', 'stored_vented'));
    expect(result).not.toBeNull();
    expect(result!.recommendedSystemLabel.length).toBeGreaterThan(0);
  });

  it('conflictDelta is non-negative (best-fit never increases conflicts)', () => {
    const result = buildResimulationFromSurvey(makeMinimalSurvey(), makeEngineOutput());
    expect(result).not.toBeNull();
    expect(result!.resimulation.comparison.hotWater.conflictDelta).toBeGreaterThanOrEqual(0);
  });

  it('produces more conflict events for a degraded combi than a clean one', () => {
    const cleanSurvey = makeMinimalSurvey();
    const dirtySurvey = makeMinimalSurvey({
      fullSurvey: {
        heatingCondition: { magneticDebrisEvidence: true },
      },
    });
    const cleanResult = buildResimulationFromSurvey(cleanSurvey, makeEngineOutput())!;
    const dirtyResult = buildResimulationFromSurvey(dirtySurvey, makeEngineOutput())!;
    expect(dirtyResult.resimulation.simpleInstall.hotWater.conflict).toBeGreaterThanOrEqual(
      cleanResult.resimulation.simpleInstall.hotWater.conflict,
    );
  });

  it('fitSummary is a non-empty string', () => {
    const result = buildResimulationFromSurvey(makeMinimalSurvey(), makeEngineOutput());
    expect(result).not.toBeNull();
    expect(result!.fitSummary.length).toBeGreaterThan(0);
  });

  it('handles heat pump option correctly — systemType is heat_pump', () => {
    const survey: FullSurveyModelV1 = {
      ...makeMinimalSurvey(),
      currentHeatSourceType: 'ashp',
    };
    const engine = makeEngineOutput('Heat pump', 'ashp');
    const result = buildResimulationFromSurvey(survey, engine);
    expect(result).not.toBeNull();
    expect(result!.upgradePackage.systemType).toBe('heat_pump');
  });

  it('handles stored_water current system correctly', () => {
    const survey: FullSurveyModelV1 = {
      ...makeMinimalSurvey(),
      currentHeatSourceType: 'system',
    };
    const engine = makeEngineOutput('Stored water', 'stored_vented');
    const result = buildResimulationFromSurvey(survey, engine);
    expect(result).not.toBeNull();
    expect(result!.upgradePackage.systemType).toBe('stored_water');
  });

  it('cross-family: combi current system with stored_unvented recommendation uses stored_water path', () => {
    // The current system is combi but the engine recommends stored_unvented.
    // The upgrade package must target stored_water (cylinder size, S-plan), not combi.
    const survey: FullSurveyModelV1 = {
      ...makeMinimalSurvey(),
      currentHeatSourceType: 'combi',
    };
    const engine = makeEngineOutput('Unvented cylinder system', 'stored_unvented');
    const result = buildResimulationFromSurvey(survey, engine);
    expect(result).not.toBeNull();
    expect(result!.upgradePackage.systemType).toBe('stored_water');
    // A combi_size upgrade should NOT appear for a stored_water path
    const combiSizeUpgrade = result!.upgradePackage.upgrades.find((u) => u.kind === 'combi_size');
    expect(combiSizeUpgrade).toBeUndefined();
    // An S-plan controls upgrade SHOULD appear for stored_water
    const splanUpgrade = result!.upgradePackage.upgrades.find((u) => u.kind === 'system_controls_plan');
    expect(splanUpgrade).toBeDefined();
  });

  it('cross-family: combi current system with heat_pump recommendation uses heat_pump path', () => {
    // The current system is combi but the engine recommends ashp.
    // The upgrade package must target heat_pump (cylinder, pipe upgrade), not combi.
    const survey: FullSurveyModelV1 = {
      ...makeMinimalSurvey(),
      currentHeatSourceType: 'combi',
      primaryPipeDiameter: 22,   // triggers pipe-upgrade rule for heat_pump
    };
    const engine = makeEngineOutput('Air source heat pump', 'ashp');
    const result = buildResimulationFromSurvey(survey, engine);
    expect(result).not.toBeNull();
    expect(result!.upgradePackage.systemType).toBe('heat_pump');
    // A combi_size upgrade should NOT appear for a heat_pump path
    const combiSizeUpgrade = result!.upgradePackage.upgrades.find((u) => u.kind === 'combi_size');
    expect(combiSizeUpgrade).toBeUndefined();
    // A cylinder_size upgrade SHOULD appear for heat_pump
    const cylUpgrade = result!.upgradePackage.upgrades.find((u) => u.kind === 'cylinder_size');
    expect(cylUpgrade).toBeDefined();
  });

  it('result contains resimulation with all required fields', () => {
    const result = buildResimulationFromSurvey(makeMinimalSurvey(), makeEngineOutput())!;
    const { resimulation } = result;
    expect(resimulation.simpleInstall).toBeDefined();
    expect(resimulation.bestFitInstall).toBeDefined();
    expect(resimulation.comparison).toBeDefined();
    expect(resimulation.comparison.headlineImprovements).toBeInstanceOf(Array);
  });
});
