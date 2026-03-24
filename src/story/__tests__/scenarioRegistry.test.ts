import { describe, it, expect } from 'vitest';
import { STORY_SCENARIOS, combiSwitchScenario, oldBoilerRealityScenario, flagshipDemoScenario } from '../scenarioRegistry';
import {
  sedbukBandToPct,
  resolveManufacturedPct,
} from '../scenarios/oldBoilerReality';
import { ERP_TO_NOMINAL_PCT } from '../../engine/utils/efficiency';

describe('scenarioRegistry integrity', () => {
  it('each scenario has at most 16 editable fields', () => {
    for (const scenario of STORY_SCENARIOS) {
      expect(scenario.fields.length).toBeLessThanOrEqual(16);
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

  it('STORY_SCENARIOS contains all scenarios including flagship_demo', () => {
    const ids = STORY_SCENARIOS.map(s => s.id);
    expect(ids).toContain('flagship_demo');
    expect(ids).toContain('combi_switch');
    expect(ids).toContain('old_boiler_reality');
  });

  it('flagship_demo is the first scenario in STORY_SCENARIOS', () => {
    expect(STORY_SCENARIOS[0].id).toBe('flagship_demo');
  });

  it('flagship_demo has the correct locked defaults', () => {
    const d = flagshipDemoScenario.defaults;
    expect(d.occupancyCount).toBe(3);
    expect(d.bathroomCount).toBe(1);
    expect(d.simultaneousUse).toBe('often');
    expect(d.mainsFlowLpmKnown).toBe(true);
    expect(d.mainsFlowLpm).toBe(8);
    expect(d.hotWaterDemand).toBe('high');
    expect(d.storedType).toBe('unvented');
    expect(flagshipDemoScenario.compareDefaults.systemA).toBe('combi');
    expect(flagshipDemoScenario.compareDefaults.systemB).toBe('stored_unvented');
  });

  it('combi_switch defaults are valid CombiSwitchInputs', () => {
    const d = combiSwitchScenario.defaults;
    expect(d.occupancyCount).toBeGreaterThanOrEqual(1);
    expect(d.bathroomCount).toBeGreaterThanOrEqual(1);
    expect(['rare', 'sometimes', 'often']).toContain(d.simultaneousUse);
    expect(typeof d.mainsFlowLpmKnown).toBe('boolean');
    expect(d.mainsFlowLpm).toBeGreaterThanOrEqual(6);
    expect(['low', 'medium', 'high']).toContain(d.hotWaterDemand);
    expect(['vented', 'unvented']).toContain(d.storedType);
    expect(d.storedType).toBe('unvented');
  });

  it('old_boiler_reality defaults are valid OldBoilerRealityInputs', () => {
    const d = oldBoilerRealityScenario.defaults;
    expect(d.boilerAgeYears).toBeGreaterThanOrEqual(0);
    expect(['A', 'B', 'C', 'D', 'E', 'F', 'G']).toContain(d.manufacturedBand);
    expect(['basic_stat', 'prog_stat', 'modulating', 'weather_comp']).toContain(d.controlsType);
    expect(['clean', 'some_contamination', 'heavy_contamination', 'unknown']).toContain(d.systemCleanliness);
    expect(['yes', 'no', 'unknown']).toContain(d.filterPresent);
  });

  it('old_boiler_reality scenario is imported from scenarios/oldBoilerReality', () => {
    // Confirm the registry re-exports the canonical spec from the standalone file.
    expect(oldBoilerRealityScenario.id).toBe('old_boiler_reality');
    expect(oldBoilerRealityScenario.outputFocus).toContain('band_ladder');
    expect(oldBoilerRealityScenario.outputFocus).toContain('recovery_steps');
    expect(oldBoilerRealityScenario.outputFocus).not.toContain('demand_vs_plant');
  });
});

// ── sedbukBandToPct ───────────────────────────────────────────────────────────

describe('sedbukBandToPct', () => {
  it('returns correct pct for band A', () => {
    expect(sedbukBandToPct('A')).toBe(ERP_TO_NOMINAL_PCT['A']);
  });

  it('returns correct pct for band G (lower boundary)', () => {
    expect(sedbukBandToPct('G')).toBe(ERP_TO_NOMINAL_PCT['G']);
  });

  it('band A pct is greater than band G pct', () => {
    expect(sedbukBandToPct('A')).toBeGreaterThan(sedbukBandToPct('G'));
  });

  it('all bands A–G produce stable numeric values', () => {
    const bands = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
    for (const band of bands) {
      const pct = sedbukBandToPct(band);
      expect(typeof pct).toBe('number');
      expect(pct).toBeGreaterThan(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});

// ── resolveManufacturedPct ────────────────────────────────────────────────────

describe('resolveManufacturedPct', () => {
  it('returns explicit pct when pctKnown is true', () => {
    expect(resolveManufacturedPct('A', true, 93)).toBe(93);
  });

  it('returns band midpoint when pctKnown is false', () => {
    expect(resolveManufacturedPct('C', false, 99)).toBe(ERP_TO_NOMINAL_PCT['C']);
  });

  it('band A midpoint used when pctKnown is false', () => {
    expect(resolveManufacturedPct('A', false, 0)).toBe(ERP_TO_NOMINAL_PCT['A']);
  });

  it('band G midpoint used when pctKnown is false (lower boundary)', () => {
    expect(resolveManufacturedPct('G', false, 0)).toBe(ERP_TO_NOMINAL_PCT['G']);
  });

  it('explicit pct takes precedence over band when pctKnown is true', () => {
    // Even if band says A (92), explicit 75 should be returned
    const result = resolveManufacturedPct('A', true, 75);
    expect(result).toBe(75);
    expect(result).not.toBe(ERP_TO_NOMINAL_PCT['A']);
  });
});
