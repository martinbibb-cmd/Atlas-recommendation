import { describe, expect, it } from 'vitest';
import {
  HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1,
  buildHydraulicConfidenceReportV1,
} from '../hydraulicConfidenceReport';
import {
  simpleRegularBoilerGraph,
  simpleRegularBoilerInitialStateV1,
} from '../fixtures/simpleRegularBoilerGraph';
import type { LegoTechnixGraphV1 } from '../types';
import type { DhwRecoveryMetricsV1 } from '../simulation/buildDhwRecoveryMetricsV1';
import type { ScenarioResultV1 } from '../simulation/runLegoTechnixScenarioV1';

const CONFIDENCE_ORDER = [
  'measured',
  'manufacturer',
  'user_entered',
  'derived',
  'estimated',
  'assumed',
  'unknown',
] as const;

function cloneGraph(graph: LegoTechnixGraphV1): LegoTechnixGraphV1 {
  return JSON.parse(JSON.stringify(graph)) as LegoTechnixGraphV1;
}

function buildScenarioResult(): ScenarioResultV1 {
  return {
    schemaVersion: '1.0',
    durationSeconds: 60,
    timestepSeconds: 60,
    tickCount: 1,
    sampleSelectors: {},
    timelineSamples: [
      {
        offsetSeconds: 60,
        wallClockMs: 60000,
        tickIndex: 1,
        activeBranches: [{ pathId: 'active_primary_heating_cycle', label: 'Primary', domain: 'primary_heating' }],
        events: [],
        warnings: [{
          code: 'pipe_geometry_missing',
          message: 'Pipe geometry is missing.',
          componentId: 'conn_boiler_to_pump',
        }],
        tickBlocked: false,
      },
    ],
    finalState: {
      ...simpleRegularBoilerInitialStateV1,
      tickIndex: 1,
      edgeStates: [
        {
          connectionId: 'conn_boiler_to_pump',
          isActive: true,
          estimatedFlowKgPerS: 0.4,
          estimatedVelocityMps: 2.1,
          flowRiskBand: 'high_velocity',
          estimatedPipeHeatLossKw: 0.4,
        },
      ],
    },
  };
}

describe('buildHydraulicConfidenceReportV1', () => {
  it('1) measured values roll up higher than estimated values', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.hydraulicDomains = [
      {
        id: 'measured_domain',
        pressureRegime: 'open_vented_primary',
        openToAtmosphere: true,
        minStaticHeadM: 1,
        availableStaticHeadM: 2,
        nominalColdPressureBar: 0.3,
        maxSafePressureBar: 1.2,
        requiresExpansionAccommodation: true,
        confidence: 'measured',
      },
    ];
    graph.connections[0].confidence = 'estimated';

    const report = buildHydraulicConfidenceReportV1(graph);
    const measuredRank = CONFIDENCE_ORDER.indexOf(report.domainConfidence[0].confidence);
    const estimatedRank = CONFIDENCE_ORDER.indexOf(report.edgeConfidence[0].confidence);
    expect(measuredRank).toBeLessThan(estimatedRank);
  });

  it('2) unknown safety-critical pressure/head values produce warnings', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    if (!graph.hydraulicDomains?.[0]) {
      throw new Error('Fixture domain missing.');
    }
    graph.hydraulicDomains[0].minStaticHeadM = undefined;
    graph.hydraulicDomains[0].availableStaticHeadM = undefined;

    const report = buildHydraulicConfidenceReportV1(graph);
    expect(report.warnings.some((warning) => warning.code === 'unknown_static_head')).toBe(true);
  });

  it('3) missing pipe geometry appears in assumptions and unknowns', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.connections[0].physical.lengthM = undefined;
    graph.connections[0].physical.nominalDiameterMm = undefined;
    graph.connections[0].physical.internalDiameterMm = undefined;

    const report = buildHydraulicConfidenceReportV1(graph);
    expect(report.assumptions.some((entry) => entry.code === 'missing_pipe_geometry_assumption')).toBe(true);
    expect(report.unknowns.some((entry) => entry.code === 'missing_pipe_geometry_unknown')).toBe(true);
  });

  it('4) manufacturer heat-source data is reported separately from assumptions', () => {
    const report = buildHydraulicConfidenceReportV1(simpleRegularBoilerGraph);
    expect(report.manufacturerInputs.some((entry) => entry.field === 'heatSourceModelData')).toBe(true);
    expect(report.assumptions.some((entry) => entry.code.includes('heat_source_model_data'))).toBe(false);
  });

  it('5) scenario flow and velocity warnings appear in report output', () => {
    const report = buildHydraulicConfidenceReportV1(simpleRegularBoilerGraph, buildScenarioResult());
    expect(report.warnings.some((warning) => warning.code === 'scenario_velocity_warning')).toBe(true);
    expect(report.warnings.some((warning) => warning.code === 'scenario_pipe_heat_loss_warning')).toBe(true);
  });

  it('6) DHW recovery confidence is included when scenario metrics exist', () => {
    const scenario = buildScenarioResult() as ScenarioResultV1 & { dhwRecoveryMetrics: DhwRecoveryMetricsV1 };
    scenario.dhwRecoveryMetrics = {
      schemaVersion: '1.0',
      usableHotWaterTimeline: [],
      recoveryConfidence: 'estimated',
      provenance: ['Synthetic test metrics'],
      storageModel: 'mixed',
      mixedCylinderApproximation: true,
      stratifiedCylinderApproximation: false,
    };

    const report = buildHydraulicConfidenceReportV1(simpleRegularBoilerGraph, scenario);
    expect(report.inferredInputs.some((input) => input.field === 'dhwRecoveryConfidence')).toBe(true);
    expect(report.warnings.some((warning) => warning.code === 'low_confidence_dhw_recovery_result')).toBe(true);
  });

  it('7) overall confidence is capped by weakest critical input', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    if (!graph.hydraulicDomains?.[0]) {
      throw new Error('Fixture domain missing.');
    }
    graph.hydraulicDomains[0].confidence = 'measured';
    graph.hydraulicDomains[0].availableStaticHeadM = undefined;
    graph.hydraulicDomains[0].minStaticHeadM = undefined;

    const report = buildHydraulicConfidenceReportV1(graph);
    expect(report.overallConfidence).toBe('unknown');
  });

  it('8) report explanation strings remain stable for portal and PDF copy', () => {
    expect(HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1.measured).toBe('Measured on site');
    expect(HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1.manufacturer).toBe('Taken from manufacturer data');
    expect(HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1.estimated).toBe('Estimated from system layout');
    expect(HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1.assumed).toBe(
      'Assumed because pipe route is not yet confirmed',
    );
    expect(HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1.unknown).toBe('Unknown — needs engineer confirmation');
  });

  it('9) no recommendation logic is introduced in the report output', () => {
    const report = buildHydraulicConfidenceReportV1(simpleRegularBoilerGraph);
    expect(Object.prototype.hasOwnProperty.call(report, 'recommendations')).toBe(false);
    expect(JSON.stringify(report)).not.toContain('recommendation');
  });

  it('10) report builder works without a scenario result', () => {
    const report = buildHydraulicConfidenceReportV1(simpleRegularBoilerGraph);
    expect(report.overallConfidence).toBeDefined();
    expect(report.domainConfidence.length).toBeGreaterThan(0);
    expect(report.componentConfidence.length).toBeGreaterThan(0);
  });
});
