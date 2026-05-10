import { describe, expect, it } from 'vitest';
import { welcomePackArchetypes } from '../packComposer/archetypes/welcomePackArchetypes';
import { buildDemoWelcomePack } from '../dev/buildDemoWelcomePack';
import {
  welcomePackDemoFixtureList,
  welcomePackDemoFixtures,
  type WelcomePackDemoFixtureId,
} from '../dev/welcomePackDemoFixtures';

const ALL_ARCHETYPE_IDS = welcomePackArchetypes.map((a) => a.archetypeId);

const EXPECTED_ARCHETYPE_COVERAGE: Record<WelcomePackDemoFixtureId, string> = {
  heat_pump_install: 'heat_pump_install',
  combi_replacement: 'combi_replacement',
  water_supply_constraint: 'water_supply_constraint',
  combi_to_stored_hot_water: 'combi_to_stored_hot_water',
  regular_or_system_boiler_upgrade: 'regular_or_system_boiler_upgrade',
  heat_pump_ready_boiler_install: 'heat_pump_ready_boiler_install',
  cylinder_upgrade: 'cylinder_upgrade',
  controls_upgrade: 'controls_upgrade',
  low_temperature_radiator_upgrade: 'low_temperature_radiator_upgrade',
  smart_cylinder_tariff_ready: 'smart_cylinder_tariff_ready',
  open_vented_to_sealed_unvented: 'open_vented_to_sealed_unvented',
  regular_to_regular_unvented: 'regular_to_regular_unvented',
  heat_pump_reality: 'heat_pump_reality',
  water_constraint_reality: 'water_constraint_reality',
};

describe('welcomePackDemoFixtures coverage', () => {
  it('every archetype defined in welcomePackArchetypes has at least one fixture', () => {
    const coveredArchetypeIds = new Set(
      welcomePackDemoFixtureList.map((fixture) => {
        const result = buildDemoWelcomePack({ fixtureId: fixture.id });
        return result.plan.archetypeId;
      }),
    );

    for (const archetypeId of ALL_ARCHETYPE_IDS) {
      expect(coveredArchetypeIds, `Archetype "${archetypeId}" has no fixture coverage`).toContain(archetypeId);
    }
  });

  it('every fixture builds a plan without error', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      expect(() => buildDemoWelcomePack({ fixtureId: fixture.id })).not.toThrow();
    }
  });

  it('every fixture resolves a non-empty archetypeId', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      const { plan } = buildDemoWelcomePack({ fixtureId: fixture.id });
      expect(plan.archetypeId.length, `Fixture "${fixture.id}" has an empty archetypeId`).toBeGreaterThan(0);
    }
  });

  it('every fixture resolves selectedConceptIds that is non-empty', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      const { plan } = buildDemoWelcomePack({ fixtureId: fixture.id });
      expect(
        plan.selectedConceptIds.length,
        `Fixture "${fixture.id}" produced no selectedConceptIds`,
      ).toBeGreaterThan(0);
    }
  });

  it('recommendedScenarioId is unchanged through build for every fixture', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      const { plan } = buildDemoWelcomePack({ fixtureId: fixture.id });
      expect(
        plan.recommendedScenarioId,
        `Fixture "${fixture.id}" changed recommendedScenarioId`,
      ).toBe(fixture.atlasDecision.recommendedScenarioId);
    }
  });

  it('each fixture maps to the expected archetype', () => {
    for (const [fixtureId, expectedArchetypeId] of Object.entries(EXPECTED_ARCHETYPE_COVERAGE)) {
      const { plan } = buildDemoWelcomePack({ fixtureId: fixtureId as WelcomePackDemoFixtureId });
      expect(
        plan.archetypeId,
        `Fixture "${fixtureId}" resolved to "${plan.archetypeId}" instead of "${expectedArchetypeId}"`,
      ).toBe(expectedArchetypeId);
    }
  });

  it('eligibility warn mode does not crash for any fixture', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      expect(() =>
        buildDemoWelcomePack({ fixtureId: fixture.id, eligibilityMode: 'warn' }),
      ).not.toThrow();
    }
  });

  it('eligibility filter mode does not crash for any fixture', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      expect(() =>
        buildDemoWelcomePack({ fixtureId: fixture.id, eligibilityMode: 'filter' }),
      ).not.toThrow();
    }
  });

  it('eligibility warn mode populates eligibilityFindings for every fixture', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      const { plan } = buildDemoWelcomePack({ fixtureId: fixture.id, eligibilityMode: 'warn' });
      expect(
        Array.isArray(plan.eligibilityFindings),
        `Fixture "${fixture.id}" did not populate eligibilityFindings in warn mode`,
      ).toBe(true);
    }
  });

  it('eligibility warn mode preserves all selectedAssetIds', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      const { plan: planOff } = buildDemoWelcomePack({ fixtureId: fixture.id, eligibilityMode: 'off' });
      const { plan: planWarn } = buildDemoWelcomePack({ fixtureId: fixture.id, eligibilityMode: 'warn' });
      expect(
        planWarn.selectedAssetIds,
        `Fixture "${fixture.id}" changed selectedAssetIds in warn mode`,
      ).toEqual(planOff.selectedAssetIds);
    }
  });

  it('eligibility filter mode may reduce selectedAssetIds but never adds assets', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      const { plan: planOff } = buildDemoWelcomePack({ fixtureId: fixture.id, eligibilityMode: 'off' });
      const { plan: planFilter } = buildDemoWelcomePack({ fixtureId: fixture.id, eligibilityMode: 'filter' });
      // filter mode can only remove, never add
      expect(
        planFilter.selectedAssetIds.length,
        `Fixture "${fixture.id}" added assets in filter mode`,
      ).toBeLessThanOrEqual(planOff.selectedAssetIds.length);
      // any remaining asset was in the original selection
      for (const assetId of planFilter.selectedAssetIds) {
        expect(planOff.selectedAssetIds).toContain(assetId);
      }
    }
  });

  it('fixture list contains all 14 fixtures', () => {
    expect(welcomePackDemoFixtureList).toHaveLength(14);
  });

  it('all fixture IDs in the registry are unique', () => {
    const ids = welcomePackDemoFixtureList.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every fixture has a non-empty label', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      expect(fixture.label.length).toBeGreaterThan(0);
    }
  });

  it('getWelcomePackDemoFixture returns the correct fixture for each ID', () => {
    for (const fixture of welcomePackDemoFixtureList) {
      const retrieved = welcomePackDemoFixtures[fixture.id];
      expect(retrieved.id).toBe(fixture.id);
    }
  });
});
