import { describe, it, expect } from 'vitest';
import { STORY_SCENARIOS, combiSwitchScenario, oldBoilerRealityScenario } from '../scenarioRegistry';

describe('scenarioRegistry integrity', () => {
  it('each scenario has at most 8 editable fields', () => {
    for (const scenario of STORY_SCENARIOS) {
      expect(scenario.fields.length).toBeLessThanOrEqual(8);
    }
  });

  it('all scenarios have required properties', () => {
    for (const scenario of STORY_SCENARIOS) {
      expect(scenario.id).toBeTruthy();
      expect(scenario.title).toBeTruthy();
      expect(scenario.description).toBeTruthy();
      expect(scenario.advisorIntent).toBeTruthy();
      expect(Array.isArray(scenario.fields)).toBe(true);
      expect(scenario.defaults).toBeDefined();
      expect(scenario.compareDefaults).toBeDefined();
      expect(Array.isArray(scenario.outputFocus)).toBe(true);
      expect(typeof scenario.escalationAllowed).toBe('boolean');
    }
  });

  it('combi_switch scenario has correct id and defaults', () => {
    expect(combiSwitchScenario.id).toBe('combi_switch');
    expect(combiSwitchScenario.compareDefaults.systemA).toBe('combi');
    expect(combiSwitchScenario.compareDefaults.systemB).toBe('stored_unvented');
    expect(combiSwitchScenario.escalationAllowed).toBe(true);
  });

  it('old_boiler_reality scenario has correct id and defaults', () => {
    expect(oldBoilerRealityScenario.id).toBe('old_boiler_reality');
    expect(oldBoilerRealityScenario.escalationAllowed).toBe(true);
  });

  it('STORY_SCENARIOS contains both scenarios', () => {
    const ids = STORY_SCENARIOS.map(s => s.id);
    expect(ids).toContain('combi_switch');
    expect(ids).toContain('old_boiler_reality');
  });

  it('combi_switch defaults are valid CombiSwitchInputs', () => {
    const d = combiSwitchScenario.defaults;
    expect(d.occupancyCount).toBeGreaterThanOrEqual(1);
    expect(d.bathroomCount).toBeGreaterThanOrEqual(1);
    expect(['rare', 'sometimes', 'often']).toContain(d.simultaneousUse);
    expect(typeof d.mainsFlowLpmKnown).toBe('boolean');
    expect(d.mainsFlowLpm).toBeGreaterThanOrEqual(6);
    expect(['low', 'medium', 'high']).toContain(d.hotWaterDemand);
  });

  it('old_boiler_reality defaults are valid OldBoilerRealityInputs', () => {
    const d = oldBoilerRealityScenario.defaults;
    expect(d.boilerAgeYears).toBeGreaterThanOrEqual(0);
    expect(['A', 'B', 'C', 'D', 'E', 'F', 'G']).toContain(d.manufacturedBand);
    expect(['basic_stat', 'prog_stat', 'modulating', 'weather_comp']).toContain(d.controlsType);
    expect(['clean', 'some_contamination', 'heavy_contamination', 'unknown']).toContain(d.systemCleanliness);
    expect(['yes', 'no', 'unknown']).toContain(d.filterPresent);
  });
});
