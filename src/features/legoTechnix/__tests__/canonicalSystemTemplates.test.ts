import { describe, expect, it } from 'vitest';
import {
  LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1,
  buildDhwRecoveryMetricsV1,
  buildHydraulicConfidenceReportV1,
  buildLegoTechnixExplainabilityReportV1,
  runLegoTechnixScenarioV1,
  validateLegoTechnixGraphV1,
} from '..';
import type { LegoTechnixSimulationStateV1 } from '../simulation/LegoTechnixSimulationStateV1';

function cloneState(state: LegoTechnixSimulationStateV1): LegoTechnixSimulationStateV1 {
  return JSON.parse(JSON.stringify(state)) as LegoTechnixSimulationStateV1;
}

describe('LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1', () => {
  it('contains all PR22 canonical UK system templates', () => {
    expect(LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1).toHaveLength(6);

    const templateIds = LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1.map((template) => template.id);
    expect(templateIds).toEqual([
      'template_regular_boiler_vented_cylinder_y_plan',
      'template_system_boiler_unvented_cylinder_s_plan',
      'template_combi_boiler_radiators',
      'template_heat_pump_unvented_weather_comp',
      'template_mixergy_stratified_cylinder',
      'template_thermal_store',
    ]);
  });

  for (const template of LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1) {
    it(`${template.id} passes structural/path/pre-flight and reporting acceptance`, () => {
      const validation = validateLegoTechnixGraphV1(template.graph);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      const scenarioResult = runLegoTechnixScenarioV1({
        graph: template.graph,
        initialState: cloneState(template.initialState),
        ...template.scenario,
      });

      expect(scenarioResult.timelineSamples.length).toBeGreaterThan(0);
      expect(scenarioResult.finalState.tickIndex).toBeGreaterThan(0);

      const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);
      expect(dhwRecoveryMetrics.usableHotWaterTimeline.length).toBeGreaterThan(0);

      const hydraulicConfidence = buildHydraulicConfidenceReportV1(template.graph, {
        ...scenarioResult,
        dhwRecoveryMetrics,
      });
      expect(hydraulicConfidence.overallConfidence).toBeDefined();
      expect(hydraulicConfidence.warnings).toBeDefined();

      const explainability = buildLegoTechnixExplainabilityReportV1({
        graph: template.graph,
        scenarioResult,
        dhwRecoveryMetrics,
        hydraulicConfidenceReport: hydraulicConfidence,
      });

      expect(explainability.schemaVersion).toBe('1.0');
      expect(explainability.systemSummary.heading).toBe('System summary');
      expect(explainability.causalNotes.length).toBeGreaterThan(0);

      const hasRoomComfortEvidence = scenarioResult.timelineSamples.some(
        (sample) => typeof sample.roomTemperatureC === 'number',
      );
      expect(hasRoomComfortEvidence).toBe(true);
    });
  }
});
