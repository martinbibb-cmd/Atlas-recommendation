import type { LegoTechnixConfidence } from './confidence';
import type { LegoTechnixGraphV1 } from './types';
import type { DhwRecoveryMetricsV1 } from './simulation/buildDhwRecoveryMetricsV1';
import type { ScenarioResultV1 } from './simulation/runLegoTechnixScenarioV1';

const CONFIDENCE_ROLLUP_ORDER: readonly LegoTechnixConfidence[] = [
  'measured',
  'manufacturer',
  'user_entered',
  'derived',
  'estimated',
  'assumed',
  'unknown',
];

export const HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1: Readonly<Record<LegoTechnixConfidence, string>> = {
  measured: 'Measured on site',
  manufacturer: 'Taken from manufacturer data',
  user_entered: 'Entered by installer',
  derived: 'Derived from system model',
  estimated: 'Estimated from system layout',
  assumed: 'Assumed because pipe route is not yet confirmed',
  unknown: 'Unknown — needs engineer confirmation',
};

export interface HydraulicScenarioEvidenceV1 extends ScenarioResultV1 {
  readonly dhwRecoveryMetrics?: DhwRecoveryMetricsV1;
}

export interface HydraulicInputEvidenceV1 {
  readonly id: string;
  readonly scope: 'domain' | 'edge' | 'component' | 'scenario';
  readonly field: string;
  readonly confidence: LegoTechnixConfidence;
  readonly explanation: string;
}

export interface HydraulicConfidenceBucketV1 {
  readonly id: string;
  readonly confidence: LegoTechnixConfidence;
  readonly explanation: string;
  readonly critical: boolean;
}

export interface HydraulicDiagnosticV1 {
  readonly code: string;
  readonly message: string;
  readonly confidence: LegoTechnixConfidence;
  readonly explanation: string;
}

export interface HydraulicConfidenceReportV1 {
  readonly overallConfidence: LegoTechnixConfidence;
  readonly domainConfidence: readonly HydraulicConfidenceBucketV1[];
  readonly circuitConfidence: readonly HydraulicConfidenceBucketV1[];
  readonly edgeConfidence: readonly HydraulicConfidenceBucketV1[];
  readonly componentConfidence: readonly HydraulicConfidenceBucketV1[];
  readonly warnings: readonly HydraulicDiagnosticV1[];
  readonly assumptions: readonly HydraulicDiagnosticV1[];
  readonly unknowns: readonly HydraulicDiagnosticV1[];
  readonly measuredInputs: readonly HydraulicInputEvidenceV1[];
  readonly manufacturerInputs: readonly HydraulicInputEvidenceV1[];
  readonly inferredInputs: readonly HydraulicInputEvidenceV1[];
}

function rankConfidence(confidence: LegoTechnixConfidence): number {
  return CONFIDENCE_ROLLUP_ORDER.indexOf(confidence);
}

function rollupConfidence(confidences: readonly LegoTechnixConfidence[]): LegoTechnixConfidence {
  if (confidences.length === 0) {
    return 'unknown';
  }
  return confidences.reduce((worst, current) => (
    rankConfidence(current) > rankConfidence(worst) ? current : worst
  ));
}

function asConfidence(value: LegoTechnixConfidence | undefined): LegoTechnixConfidence {
  return value ?? 'unknown';
}

function asBucket(
  id: string,
  confidences: readonly LegoTechnixConfidence[],
  critical: boolean,
): HydraulicConfidenceBucketV1 {
  const confidence = rollupConfidence(confidences);
  return {
    id,
    confidence,
    explanation: HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1[confidence],
    critical,
  };
}

function asDiagnostic(
  code: string,
  message: string,
  confidence: LegoTechnixConfidence,
): HydraulicDiagnosticV1 {
  return {
    code,
    message,
    confidence,
    explanation: HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1[confidence],
  };
}

function collectScenarioWarnings(
  scenarioResult: HydraulicScenarioEvidenceV1 | undefined,
): readonly HydraulicDiagnosticV1[] {
  if (!scenarioResult) {
    return [];
  }
  const seen = new Set<string>();
  const diagnostics: HydraulicDiagnosticV1[] = [];
  for (const sample of scenarioResult.timelineSamples) {
    for (const warning of sample.warnings) {
      const key = `${warning.code}:${warning.componentId ?? ''}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      diagnostics.push(asDiagnostic(
        warning.code,
        warning.message,
        warning.code.includes('missing') ? 'assumed' : 'derived',
      ));
    }
  }
  return diagnostics;
}

export function buildHydraulicConfidenceReportV1(
  graph: LegoTechnixGraphV1,
  scenarioResult?: HydraulicScenarioEvidenceV1,
): HydraulicConfidenceReportV1 {
  const warnings: HydraulicDiagnosticV1[] = [];
  const assumptions: HydraulicDiagnosticV1[] = [];
  const unknowns: HydraulicDiagnosticV1[] = [];
  const measuredInputs: HydraulicInputEvidenceV1[] = [];
  const manufacturerInputs: HydraulicInputEvidenceV1[] = [];
  const inferredInputs: HydraulicInputEvidenceV1[] = [];
  const criticalConfidences: LegoTechnixConfidence[] = [];

  const domainConfidence: HydraulicConfidenceBucketV1[] = (graph.hydraulicDomains ?? []).map((domain) => {
    const confidences: LegoTechnixConfidence[] = [asConfidence(domain.confidence)];
    if (typeof domain.availableStaticHeadM !== 'number' || typeof domain.minStaticHeadM !== 'number') {
      warnings.push(asDiagnostic(
        'unknown_static_head',
        `Hydraulic domain "${domain.id}" has unknown static head; safety-critical pressure confidence is capped.`,
        'unknown',
      ));
      unknowns.push(asDiagnostic(
        'unknown_static_head',
        `Unknown static head in "${domain.id}" requires engineer confirmation.`,
        'unknown',
      ));
      confidences.push('unknown');
    }
    if (domain.preFlightMarkers?.length === 0 && domain.requiresExpansionAccommodation) {
      warnings.push(asDiagnostic(
        'unknown_safety_markers',
        `Hydraulic domain "${domain.id}" is missing safety markers for expansion accommodation.`,
        'assumed',
      ));
      assumptions.push(asDiagnostic(
        'unknown_safety_markers',
        `Safety marker assumptions used for "${domain.id}".`,
        'assumed',
      ));
      confidences.push('assumed');
    }
    criticalConfidences.push(rollupConfidence(confidences));
    return asBucket(`domain:${domain.id}`, confidences, true);
  });

  const edgeConfidence: HydraulicConfidenceBucketV1[] = graph.connections.map((connection) => {
    const confidences: LegoTechnixConfidence[] = [
      asConfidence(connection.confidence),
      asConfidence(connection.physical.routingConfidence),
    ];
    if (typeof connection.physical.lengthM !== 'number'
      || typeof connection.physical.nominalDiameterMm !== 'number'
      || typeof connection.physical.internalDiameterMm !== 'number') {
      assumptions.push(asDiagnostic(
        'missing_pipe_geometry_assumption',
        `Connection "${connection.id}" has missing pipe length/bore assumptions.`,
        'assumed',
      ));
      unknowns.push(asDiagnostic(
        'missing_pipe_geometry_unknown',
        `Connection "${connection.id}" has unknown pipe geometry.`,
        'unknown',
      ));
      confidences.push('unknown');
    }
    const routingConfidence = asConfidence(connection.physical.routingConfidence);
    if (routingConfidence !== 'measured' && routingConfidence !== 'manufacturer') {
      inferredInputs.push({
        id: `edge:${connection.id}:routing`,
        scope: 'edge',
        field: 'routingConfidence',
        confidence: routingConfidence,
        explanation: HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1.estimated,
      });
    }
    return asBucket(`edge:${connection.id}`, confidences, false);
  });

  const circuitConfidence: HydraulicConfidenceBucketV1[] = Array.from(
    new Set(graph.connections.map((connection) => connection.circuitId)),
  ).map((circuitId) => {
    const circuitEdges = graph.connections.filter((connection) => connection.circuitId === circuitId);
    const confidences = circuitEdges.map((connection) => asConfidence(connection.confidence));
    return asBucket(`circuit:${circuitId}`, confidences, false);
  });

  const componentConfidence: HydraulicConfidenceBucketV1[] = graph.components.map((component) => {
    const confidences: LegoTechnixConfidence[] = [asConfidence(component.confidence)];
    const heatSourceModel = graph.heatSourceModels?.find((model) => model.componentId === component.id);
    if (heatSourceModel) {
      const input: HydraulicInputEvidenceV1 = {
        id: `component:${component.id}:heat-source-model`,
        scope: 'component',
        field: 'heatSourceModelData',
        confidence: asConfidence(component.confidence),
        explanation: HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1[asConfidence(component.confidence)],
      };
      if (asConfidence(component.confidence) === 'manufacturer') {
        manufacturerInputs.push(input);
      }
      if (
        typeof heatSourceModel.minStableOutputKw !== 'number'
        || typeof heatSourceModel.maxOutputKw !== 'number'
      ) {
        warnings.push(asDiagnostic(
          'unknown_heat_source_modulation_range',
          `Heat source "${component.id}" has unknown modulation range.`,
          'unknown',
        ));
        unknowns.push(asDiagnostic(
          'unknown_heat_source_modulation_range',
          `Heat source "${component.id}" is missing modulation range values.`,
          'unknown',
        ));
        confidences.push('unknown');
      }
      if (asConfidence(heatSourceModel.condensingConfidence) !== 'measured'
        && asConfidence(heatSourceModel.condensingConfidence) !== 'manufacturer'
        && asConfidence(heatSourceModel.condensingConfidence) !== 'user_entered') {
        warnings.push(asDiagnostic(
          'low_confidence_condensing_estimate',
          `Heat source "${component.id}" condensing estimate is low confidence.`,
          asConfidence(heatSourceModel.condensingConfidence),
        ));
        confidences.push(asConfidence(heatSourceModel.condensingConfidence));
      }
    }

    if (component.behaviours?.includes('adds_pressure')) {
      assumptions.push(asDiagnostic(
        'missing_manufacturer_pump_head_data',
        `Pump/driver "${component.id}" is missing manufacturer pump head data.`,
        'assumed',
      ));
      warnings.push(asDiagnostic(
        'missing_manufacturer_pump_head_data',
        `Pump/driver "${component.id}" flow estimate uses assumptions because pump head data is unknown.`,
        'assumed',
      ));
      confidences.push('assumed');
    }

    return asBucket(`component:${component.id}`, confidences, component.role === 'source');
  });

  for (const model of graph.heatTransferComponents ?? []) {
    if (model.family === 'cylinder_coil'
      && typeof model.output.energyTransfer.secondaryEnergyGainedKw !== 'number') {
      unknowns.push(asDiagnostic(
        'unknown_cylinder_coil_rating',
        `Cylinder coil "${model.componentId}" has unknown coil/recovery rating.`,
        'unknown',
      ));
      warnings.push(asDiagnostic(
        'unknown_cylinder_coil_rating',
        `Cylinder coil "${model.componentId}" rating needs engineer confirmation.`,
        'unknown',
      ));
    }
  }

  const scenarioWarnings = collectScenarioWarnings(scenarioResult);
  warnings.push(...scenarioWarnings);
  const flowRiskEdges = scenarioResult?.finalState.edgeStates.filter((edgeState) => (
    edgeState.flowRiskBand === 'high_velocity' || edgeState.flowRiskBand === 'microbore_bottleneck'
  )) ?? [];
  for (const edgeState of flowRiskEdges) {
    warnings.push(asDiagnostic(
      'scenario_velocity_warning',
      `Connection "${edgeState.connectionId}" has a velocity warning (${edgeState.flowRiskBand}).`,
      'estimated',
    ));
  }
  const heatLossEdges = scenarioResult?.finalState.edgeStates.filter((edgeState) => (
    typeof edgeState.estimatedPipeHeatLossKw === 'number' && edgeState.estimatedPipeHeatLossKw > 0.2
  )) ?? [];
  for (const edgeState of heatLossEdges) {
    warnings.push(asDiagnostic(
      'scenario_pipe_heat_loss_warning',
      `Connection "${edgeState.connectionId}" has pipe heat-loss warning (${edgeState.estimatedPipeHeatLossKw}kW).`,
      'estimated',
    ));
  }
  if (scenarioWarnings.some((warning) => warning.code === 'low_temperature_emitter_output_shortfall')) {
    warnings.push(asDiagnostic(
      'low_temperature_emitter_shortfall',
      'Low-temperature emitter shortfall was observed in scenario evidence.',
      'estimated',
    ));
  }
  if (scenarioResult?.dhwRecoveryMetrics) {
    inferredInputs.push({
      id: 'scenario:dhw-recovery-confidence',
      scope: 'scenario',
      field: 'dhwRecoveryConfidence',
      confidence: scenarioResult.dhwRecoveryMetrics.recoveryConfidence,
      explanation: HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1[scenarioResult.dhwRecoveryMetrics.recoveryConfidence],
    });
    if (rankConfidence(scenarioResult.dhwRecoveryMetrics.recoveryConfidence) >= rankConfidence('estimated')) {
      warnings.push(asDiagnostic(
        'low_confidence_dhw_recovery_result',
        'DHW recovery confidence is low for the provided scenario metrics.',
        scenarioResult.dhwRecoveryMetrics.recoveryConfidence,
      ));
    }
  }

  for (const domain of graph.hydraulicDomains ?? []) {
    const confidence = asConfidence(domain.confidence);
    if (confidence === 'measured') {
      measuredInputs.push({
        id: `domain:${domain.id}:pressure-regime`,
        scope: 'domain',
        field: 'pressureRegime',
        confidence,
        explanation: HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1[confidence],
      });
    }
    if (confidence === 'manufacturer') {
      manufacturerInputs.push({
        id: `domain:${domain.id}:pressure-regime`,
        scope: 'domain',
        field: 'pressureRegime',
        confidence,
        explanation: HYDRAULIC_CONFIDENCE_EXPLANATIONS_V1[confidence],
      });
    }
  }

  for (const componentState of scenarioResult?.finalState.componentStates ?? []) {
    if (componentState.componentId.includes('room') && typeof componentState.heatLossKwPerK !== 'number') {
      assumptions.push(asDiagnostic(
        'assumed_room_heat_loss',
        `Room component "${componentState.componentId}" is using assumed room heat loss.`,
        'assumed',
      ));
    }
  }

  const overallConfidence = criticalConfidences.length > 0
    ? rollupConfidence(criticalConfidences)
    : rollupConfidence([
      graph.confidence,
      ...domainConfidence.map((entry) => entry.confidence),
      ...edgeConfidence.map((entry) => entry.confidence),
      ...componentConfidence.map((entry) => entry.confidence),
    ]);

  return {
    overallConfidence,
    domainConfidence,
    circuitConfidence,
    edgeConfidence,
    componentConfidence,
    warnings,
    assumptions,
    unknowns,
    measuredInputs,
    manufacturerInputs,
    inferredInputs,
  };
}
