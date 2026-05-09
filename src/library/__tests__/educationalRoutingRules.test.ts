import { describe, expect, it } from 'vitest';
import { educationalRoutingRules } from '../routing/educationalRoutingRules';

const EXPECTED_RULE_IDS = [
  'combi_simultaneous_use_limitation',
  'stored_hot_water_recovery',
  'low_mains_flow_pressure_comfort',
  'heat_pump_low_flow_temperature_behaviour',
  'radiator_sizing_emitter_adequacy',
  'zoning_and_smart_controls_risk',
  'weather_load_compensation_expectations',
  'buffer_low_loss_header_explanation',
  'future_solar_battery_readiness',
  'technophobia_print_first_preference',
  'dyslexia_adhd_low_cognitive_load_preference',
  'technical_appendix_requested',
] as const;

describe('educationalRoutingRules', () => {
  it('contains the required educational routing rule foundation set', () => {
    const ids = educationalRoutingRules.map((rule) => rule.ruleId);

    for (const id of EXPECTED_RULE_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('has deterministic, unique, fully-described rules', () => {
    const ids = educationalRoutingRules.map((rule) => rule.ruleId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const rule of educationalRoutingRules) {
      expect(rule.label.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
      expect(rule.includeReason.length).toBeGreaterThan(0);
      expect(rule.priority).toBeGreaterThan(0);
      expect(rule.maxAssets).toBeGreaterThan(0);
      expect(rule.printWeight).toBeGreaterThanOrEqual(0);
    }
  });
});
