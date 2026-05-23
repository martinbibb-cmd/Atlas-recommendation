import type { LegoTechnixConfidence } from '../confidence';
import type { HydraulicConfidenceReportV1 } from '../hydraulicConfidenceReport';
import type { LegoTechnixGraphV1 } from '../types';
import type { DhwRecoveryMetricsV1 } from './buildDhwRecoveryMetricsV1';
import type {
  ScenarioResultV1,
  ScenarioTimelineSampleV1,
} from './runLegoTechnixScenarioV1';
import type {
  LegoTechnixCausalNoteV1,
  LegoTechnixExplainabilityReportV1,
  LegoTechnixExplainabilitySectionV1,
} from './LegoTechnixExplainabilityReportV1';

export interface BuildLegoTechnixExplainabilityReportV1Input {
  readonly graph: LegoTechnixGraphV1;
  readonly scenarioResult: ScenarioResultV1;
  readonly dhwRecoveryMetrics?: DhwRecoveryMetricsV1;
  readonly hydraulicConfidenceReport?: HydraulicConfidenceReportV1;
}

interface TimePeriodV1 {
  readonly startSecond: number;
  readonly endSecond: number;
  readonly evidenceIds: readonly string[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function formatPeriods(label: string, periods: readonly TimePeriodV1[]): string {
  if (periods.length === 0) {
    return `${label}: none observed.`;
  }
  const rangeText = periods.map((period) => `${period.startSecond}s–${period.endSecond}s`).join(', ');
  return `${label}: ${rangeText}.`;
}

function buildSampleEvidenceId(
  sample: ScenarioTimelineSampleV1,
  kind: string,
  detail?: string,
): string {
  return `sample:${sample.tickIndex}:${kind}${detail ? `:${detail}` : ''}`;
}

function buildEventEvidenceIds(samples: readonly ScenarioTimelineSampleV1[], eventType: string): string[] {
  return unique(samples.flatMap((sample) => (
    sample.events
      .filter((event) => event.type === eventType)
      .map((event) => buildSampleEvidenceId(sample, 'event', `${event.type}:${event.componentId ?? 'none'}`))
  )));
}

function buildWarningEvidenceIds(
  samples: readonly ScenarioTimelineSampleV1[],
  warningCode: string,
): string[] {
  return unique(samples.flatMap((sample) => (
    sample.warnings
      .filter((warning) => warning.code === warningCode)
      .map((warning) => buildSampleEvidenceId(sample, 'warning', `${warning.code}:${warning.componentId ?? 'none'}`))
  )));
}

function collectPeriods(
  samples: readonly ScenarioTimelineSampleV1[],
  predicate: (sample: ScenarioTimelineSampleV1) => boolean,
  evidenceKind: string,
): TimePeriodV1[] {
  const periods: TimePeriodV1[] = [];
  let currentStartSample: ScenarioTimelineSampleV1 | undefined;
  let lastSample: ScenarioTimelineSampleV1 | undefined;
  let evidenceIds: string[] = [];

  for (const sample of samples) {
    if (predicate(sample)) {
      if (!currentStartSample) {
        currentStartSample = sample;
        evidenceIds = [];
      }
      lastSample = sample;
      evidenceIds.push(buildSampleEvidenceId(sample, evidenceKind));
      continue;
    }

    if (currentStartSample && lastSample) {
      periods.push({
        startSecond: currentStartSample.offsetSeconds,
        endSecond: lastSample.offsetSeconds,
        evidenceIds: unique(evidenceIds),
      });
      currentStartSample = undefined;
      lastSample = undefined;
      evidenceIds = [];
    }
  }

  if (currentStartSample && lastSample) {
    periods.push({
      startSecond: currentStartSample.offsetSeconds,
      endSecond: lastSample.offsetSeconds,
      evidenceIds: unique(evidenceIds),
    });
  }

  return periods;
}

function buildSection(
  heading: string,
  points: readonly string[],
  evidenceIds: readonly string[],
): LegoTechnixExplainabilitySectionV1 {
  return {
    heading,
    points,
    evidenceIds: unique(evidenceIds),
  };
}

function asConfidence(value: LegoTechnixConfidence | undefined): LegoTechnixConfidence {
  return value ?? 'unknown';
}

function buildSystemSummary(
  graph: LegoTechnixGraphV1,
  scenarioResult: ScenarioResultV1,
): LegoTechnixExplainabilitySectionV1 {
  const heatSourceTypes = unique((graph.heatSourceModels ?? []).map((model) => model.heatSourceType));
  const hasStoredHotWater = graph.components.some((component) => component.role === 'store' && component.domains?.includes('domestic_hot'));
  const controlsTopology = (graph.controlLogics ?? []).some((logic) => logic.kind === 's_plan')
    ? 'S-plan control topology detected.'
    : ((graph.controlActuators?.length ?? 0) > 0 ? 'Actuator-driven control topology detected.' : 'Control topology could not be detected from graph/runtime evidence.');
  const emitterFamilies = unique((graph.heatTransferComponents ?? []).map((component) => component.family));
  const loadTypes = unique(graph.components.filter((component) => component.role === 'load').map((component) => component.label));
  const pressureRegimes = unique((graph.hydraulicDomains ?? []).map((domain) => domain.pressureRegime));
  const storageModel = scenarioResult.timelineSamples.find((sample) => sample.storedDhwStorageModel)?.storedDhwStorageModel
    ?? scenarioResult.finalState.componentStates.find((state) => state.componentId === scenarioResult.sampleSelectors.storedDhwComponentId)
      ?.storageModel;

  return buildSection(
    'System summary',
    [
      `Heat source type: ${heatSourceTypes.length > 0 ? heatSourceTypes.join(', ') : 'not detected'}.`,
      `Hot-water service type: ${hasStoredHotWater ? 'stored domestic hot-water service' : 'not detected'}.`,
      controlsTopology,
      `Emitter/load types: ${[...emitterFamilies, ...loadTypes].length > 0 ? [...emitterFamilies, ...loadTypes].join(', ') : 'not detected'}.`,
      `Pressure regimes: ${pressureRegimes.length > 0 ? pressureRegimes.join(', ') : 'not detected'}.`,
      `Storage model: ${storageModel ?? 'not detected'}.`,
    ],
    [
      ...heatSourceTypes.map((value) => `graph:heat_source:${value}`),
      ...pressureRegimes.map((value) => `graph:pressure_regime:${value}`),
      ...(storageModel ? [`scenario:storage_model:${storageModel}`] : []),
    ],
  );
}

function buildActiveCircuitSummary(
  graph: LegoTechnixGraphV1,
  samples: readonly ScenarioTimelineSampleV1[],
  finalScenarioState: ScenarioResultV1['finalState'],
): LegoTechnixExplainabilitySectionV1 {
  const activePathIds = unique(samples.flatMap((sample) => sample.activeBranches.map((branch) => branch.pathId)));
  const inactivePathIds = (graph.activeCircuitPaths ?? [])
    .filter((path) => !activePathIds.includes(path.id))
    .map((path) => path.id);
  const bypassPeriods = collectPeriods(
    samples,
    (sample) => sample.activeBranches.some((branch) => branch.pathId.includes('bypass') || branch.label.toLowerCase().includes('bypass')),
    'bypass',
  );
  const deadheadPeriods = collectPeriods(
    samples,
    (sample) => sample.warnings.some((warning) => warning.code === 'deadhead_detected'),
    'deadhead',
  );

  let branchActivityChanges = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = unique(samples[index - 1].activeBranches.map((branch) => branch.pathId)).sort().join('|');
    const current = unique(samples[index].activeBranches.map((branch) => branch.pathId)).sort().join('|');
    if (previous !== current) {
      branchActivityChanges += 1;
    }
  }

  const connectionById = new Map(graph.connections.map((connection) => [connection.id, connection]));
  const highestRiskCircuits = unique(
    finalScenarioState.edgeStates
      .filter((edgeState) => edgeState.flowRiskBand === 'high_velocity' || edgeState.flowRiskBand === 'microbore_bottleneck')
      .map((edgeState) => connectionById.get(edgeState.connectionId)?.circuitId)
      .filter((circuitId): circuitId is string => Boolean(circuitId)),
  );

  return buildSection(
    'Active circuit summary',
    [
      `Active circuits during scenario: ${activePathIds.length > 0 ? activePathIds.join(', ') : 'none'}.`,
      `Inactive circuits during scenario: ${inactivePathIds.length > 0 ? inactivePathIds.join(', ') : 'none'}.`,
      formatPeriods('Bypass events', bypassPeriods),
      formatPeriods('Deadhead events', deadheadPeriods),
      `Branch activity changes detected: ${branchActivityChanges}.`,
      `Highest-risk circuits: ${highestRiskCircuits.length > 0 ? highestRiskCircuits.join(', ') : 'none observed'}.`,
    ],
    [
      ...activePathIds.map((pathId) => `scenario:active_path:${pathId}`),
      ...inactivePathIds.map((pathId) => `graph:inactive_path:${pathId}`),
      ...bypassPeriods.flatMap((period) => period.evidenceIds),
      ...deadheadPeriods.flatMap((period) => period.evidenceIds),
      ...highestRiskCircuits.map((circuitId) => `scenario:risk_circuit:${circuitId}`),
    ],
  );
}

function buildControlDecisionSummary(
  graph: LegoTechnixGraphV1,
  samples: readonly ScenarioTimelineSampleV1[],
): LegoTechnixExplainabilitySectionV1 {
  const roomSensorIds = new Set(
    (graph.controlSensors ?? [])
      .filter((sensor) => sensor.kind === 'room_thermostat')
      .map((sensor) => sensor.componentId),
  );
  const cylinderSensorIds = new Set(
    (graph.controlSensors ?? [])
      .filter((sensor) => sensor.kind === 'cylinder_thermostat')
      .map((sensor) => sensor.componentId),
  );

  const roomDemandEvents = samples.flatMap((sample) => sample.events.filter((event) => (
    event.type === 'control_sensor_evaluated'
    && roomSensorIds.has(event.componentId ?? '')
    && event.message.includes('demanding')
  )));
  const cylinderDemandEvents = samples.flatMap((sample) => sample.events.filter((event) => (
    event.type === 'control_sensor_evaluated'
    && cylinderSensorIds.has(event.componentId ?? '')
    && event.message.includes('demanding')
  )));

  const simultaneousDemandPeriods = collectPeriods(
    samples,
    (sample) => {
      const hasHeatingPath = sample.activeBranches.some((branch) => branch.pathId.includes('heating'));
      const hasDhwPath = sample.activeBranches.some((branch) => branch.pathId.includes('dhw') || branch.pathId.includes('cylinder'));
      return hasHeatingPath && hasDhwPath;
    },
    'simultaneous_demand',
  );

  const actuatorOpenEvents = samples.flatMap((sample) => sample.events.filter((event) => (
    event.type === 'control_actuator_evaluated' && event.message.includes(' is open ')
  )));
  const actuatorClosedEvents = samples.flatMap((sample) => sample.events.filter((event) => (
    event.type === 'control_actuator_evaluated' && event.message.includes(' is closed ')
  )));

  const demandPeriods = collectPeriods(samples, (sample) => (sample.sourceHeatOutputKw ?? 0) > 0, 'heat_demand');
  const noDemandPeriods = collectPeriods(samples, (sample) => (sample.sourceHeatOutputKw ?? 0) <= 0, 'no_heat_demand');

  return buildSection(
    'Control decision summary',
    [
      `Room thermostat demand calls: ${roomDemandEvents.length}.`,
      `Cylinder thermostat demand calls: ${cylinderDemandEvents.length}.`,
      formatPeriods('S-plan simultaneous demand periods', simultaneousDemandPeriods),
      `Actuator open/closed behaviour: ${actuatorOpenEvents.length} open evaluations, ${actuatorClosedEvents.length} closed evaluations.`,
      formatPeriods('Demand periods', demandPeriods),
      formatPeriods('No-demand periods', noDemandPeriods),
    ],
    [
      ...buildEventEvidenceIds(samples, 'control_sensor_evaluated'),
      ...buildEventEvidenceIds(samples, 'control_actuator_evaluated'),
      ...simultaneousDemandPeriods.flatMap((period) => period.evidenceIds),
      ...demandPeriods.flatMap((period) => period.evidenceIds),
      ...noDemandPeriods.flatMap((period) => period.evidenceIds),
    ],
  );
}

function buildHeatSourceSummary(samples: readonly ScenarioTimelineSampleV1[]): LegoTechnixExplainabilitySectionV1 {
  const firingPeriods = collectPeriods(samples, (sample) => (sample.sourceHeatOutputKw ?? 0) > 0, 'source_firing');
  const heldOffPeriods = collectPeriods(samples, (sample) => (sample.sourceHeatOutputKw ?? 0) <= 0, 'source_held_off');
  const flowTemperatures = samples
    .map((sample) => sample.sourceFlowTemperatureC)
    .filter((value): value is number => typeof value === 'number');
  const maxRampDelta = samples.reduce((maxDelta, sample, index) => {
    if (index === 0) {
      return maxDelta;
    }
    const previous = samples[index - 1].sourceFlowTemperatureC;
    const current = sample.sourceFlowTemperatureC;
    if (typeof previous !== 'number' || typeof current !== 'number') {
      return maxDelta;
    }
    return Math.max(maxDelta, Math.abs(current - previous));
  }, 0);
  const cyclingPeriods = collectPeriods(samples, (sample) => sample.cyclingRisk === true, 'cycling_risk');
  const heatSourceWarningCodes = unique(samples.flatMap((sample) => (
    sample.warnings
      .filter((warning) => warning.code.startsWith('heat_source') || warning.code.startsWith('heat_pump'))
      .map((warning) => warning.code)
  )));

  return buildSection(
    'Heat source summary',
    [
      formatPeriods('Heat source fired', firingPeriods),
      formatPeriods('Heat source held off', heldOffPeriods),
      `Target flow behaviour: ${flowTemperatures.length > 0 ? `${Math.min(...flowTemperatures).toFixed(2)}°C to ${Math.max(...flowTemperatures).toFixed(2)}°C` : 'no source flow telemetry available'}.`,
      `Ramping behaviour: maximum adjacent flow-temperature delta ${maxRampDelta.toFixed(2)}°C.`,
      formatPeriods('Cycling-risk periods', cyclingPeriods),
      `Heat-source warnings: ${heatSourceWarningCodes.length > 0 ? heatSourceWarningCodes.join(', ') : 'none observed'}.`,
    ],
    [
      ...firingPeriods.flatMap((period) => period.evidenceIds),
      ...heldOffPeriods.flatMap((period) => period.evidenceIds),
      ...cyclingPeriods.flatMap((period) => period.evidenceIds),
      ...heatSourceWarningCodes.flatMap((warningCode) => buildWarningEvidenceIds(samples, warningCode)),
    ],
  );
}

function buildRoomHeatingSummary(
  graph: LegoTechnixGraphV1,
  scenarioResult: ScenarioResultV1,
): LegoTechnixExplainabilitySectionV1 {
  const roomTemperatures = scenarioResult.timelineSamples
    .map((sample) => sample.roomTemperatureC)
    .filter((value): value is number => typeof value === 'number');
  const startRoomTemperature = roomTemperatures[0];
  const endRoomTemperature = roomTemperatures.at(-1);
  const roomState = scenarioResult.finalState.componentStates.find((state) => state.componentId === scenarioResult.sampleSelectors.roomComponentId);
  const roomTarget = roomState?.targetTemperatureC;
  const activeEmitterPeriods = collectPeriods(
    scenarioResult.timelineSamples,
    (sample) => sample.activeBranches.some((branch) => branch.domain === 'room_air' || branch.pathId.includes('heating')),
    'room_emitter_active',
  );
  const approachedTarget = typeof roomTarget === 'number' && roomTemperatures.length > 0
    ? Math.max(...roomTemperatures) >= (roomTarget - 0.5)
    : false;
  const netTrend = typeof startRoomTemperature === 'number' && typeof endRoomTemperature === 'number'
    ? (endRoomTemperature - startRoomTemperature)
    : undefined;

  return buildSection(
    'Room heating summary',
    [
      `Room temperature start/end: ${typeof startRoomTemperature === 'number' ? `${startRoomTemperature.toFixed(2)}°C` : 'n/a'} -> ${typeof endRoomTemperature === 'number' ? `${endRoomTemperature.toFixed(2)}°C` : 'n/a'}.`,
      `Room temperature min/max: ${roomTemperatures.length > 0 ? `${Math.min(...roomTemperatures).toFixed(2)}°C / ${Math.max(...roomTemperatures).toFixed(2)}°C` : 'n/a'}.`,
      `Room approached target: ${approachedTarget ? 'yes' : 'no'}.`,
      `Net room heat trend: ${typeof netTrend === 'number' ? `${netTrend >= 0 ? '+' : ''}${netTrend.toFixed(2)}°C` : 'n/a'}.`,
      formatPeriods('Active radiator/emitter periods', activeEmitterPeriods),
    ],
    [
      ...(graph.components.some((component) => component.id === scenarioResult.sampleSelectors.roomComponentId)
        ? [`graph:room_component:${scenarioResult.sampleSelectors.roomComponentId}`]
        : []),
      ...activeEmitterPeriods.flatMap((period) => period.evidenceIds),
    ],
  );
}

function buildDhwSummary(
  scenarioResult: ScenarioResultV1,
  dhwRecoveryMetrics?: DhwRecoveryMetricsV1,
): LegoTechnixExplainabilitySectionV1 {
  const storedTemperatures = scenarioResult.timelineSamples
    .map((sample) => sample.storedDhwTemperatureC)
    .filter((value): value is number => typeof value === 'number');
  const usableHotWaterValues = scenarioResult.timelineSamples
    .map((sample) => sample.usableHotWaterLitresAt40C)
    .filter((value): value is number => typeof value === 'number');
  const drawOffPeriods = collectPeriods(
    scenarioResult.timelineSamples,
    (sample) => (sample.dhwDrawOffFlowLpm ?? 0) > 0,
    'dhw_draw_off',
  );
  const storageModel = scenarioResult.timelineSamples.find((sample) => sample.storedDhwStorageModel)?.storedDhwStorageModel
    ?? dhwRecoveryMetrics?.storageModel;

  const lastDrawOffSample = [...scenarioResult.timelineSamples].reverse().find((sample) => (sample.dhwDrawOffFlowLpm ?? 0) > 0);
  const postDrawSample = lastDrawOffSample
    ? scenarioResult.timelineSamples.find((sample) => sample.offsetSeconds > lastDrawOffSample.offsetSeconds)
    : undefined;
  const recoveryObserved = typeof lastDrawOffSample?.storedDhwTemperatureC === 'number'
    && typeof postDrawSample?.storedDhwTemperatureC === 'number'
    && postDrawSample.storedDhwTemperatureC > lastDrawOffSample.storedDhwTemperatureC;

  const exhaustionEvidenceIds = typeof dhwRecoveryMetrics?.exhaustionPoint === 'number'
    ? [`dhw_metrics:exhaustion_point:${dhwRecoveryMetrics.exhaustionPoint}`]
    : scenarioResult.timelineSamples
      .filter((sample) => (sample.usableHotWaterLitresAt40C ?? Number.POSITIVE_INFINITY) <= 0.5)
      .map((sample) => buildSampleEvidenceId(sample, 'dhw_exhaustion'));

  return buildSection(
    'DHW summary',
    [
      `Stored DHW temperature start/end: ${storedTemperatures.length > 0 ? `${storedTemperatures[0].toFixed(2)}°C -> ${storedTemperatures.at(-1)?.toFixed(2)}°C` : 'n/a'}.`,
      `Usable hot water trend: ${usableHotWaterValues.length > 1 ? `${usableHotWaterValues[0].toFixed(2)}L -> ${usableHotWaterValues.at(-1)?.toFixed(2)}L` : 'n/a'}.`,
      formatPeriods('Draw-off events', drawOffPeriods),
      `Recovery after draw-off: ${recoveryObserved ? 'observed' : 'not observed'}.`,
      `Exhaustion events: ${exhaustionEvidenceIds.length > 0 ? 'observed' : 'none observed'}.`,
      `Storage approximation label: ${storageModel ?? 'not detected'}.`,
      `Recovery confidence: ${dhwRecoveryMetrics?.recoveryConfidence ?? 'not provided'}.`,
    ],
    [
      ...drawOffPeriods.flatMap((period) => period.evidenceIds),
      ...exhaustionEvidenceIds,
      ...(storageModel ? [`scenario:dhw_storage_model:${storageModel}`] : []),
      ...(dhwRecoveryMetrics ? [`dhw_metrics:recovery_confidence:${dhwRecoveryMetrics.recoveryConfidence}`] : []),
    ],
  );
}

function buildReturnTemperatureSummary(
  scenarioResult: ScenarioResultV1,
): LegoTechnixExplainabilitySectionV1 {
  const returnTemperatures = scenarioResult.timelineSamples
    .map((sample) => sample.sourceReturnTemperatureC)
    .filter((value): value is number => typeof value === 'number');
  const runtimeReturnAvailable = returnTemperatures.length > 0;

  return buildSection(
    'Return temperature summary',
    [
      `Return temperature range: ${runtimeReturnAvailable ? `${Math.min(...returnTemperatures).toFixed(2)}°C to ${Math.max(...returnTemperatures).toFixed(2)}°C` : 'not available'}.`,
      `Runtime return telemetry available: ${runtimeReturnAvailable ? 'yes' : 'no'}.`,
    ],
    runtimeReturnAvailable
      ? scenarioResult.timelineSamples
        .filter((sample) => typeof sample.sourceReturnTemperatureC === 'number')
        .map((sample) => buildSampleEvidenceId(sample, 'return_temperature'))
      : [],
  );
}

function buildCondensingSummary(
  graph: LegoTechnixGraphV1,
  scenarioResult: ScenarioResultV1,
  hydraulicConfidenceReport?: HydraulicConfidenceReportV1,
): LegoTechnixExplainabilitySectionV1 {
  const condensingPeriods = collectPeriods(
    scenarioResult.timelineSamples,
    (sample) => sample.condensingLikely === true,
    'condensing_likely',
  );
  const runtimeReturnAvailable = scenarioResult.timelineSamples.some((sample) => typeof sample.sourceReturnTemperatureC === 'number');
  const sourceComponentId = scenarioResult.sampleSelectors.sourceComponentId;
  const sourceState = scenarioResult.finalState.componentStates.find((state) => state.componentId === sourceComponentId);
  const fallbackUsed = !runtimeReturnAvailable || sourceState?.condensingConfidence === 'assumed';
  const lowConfidenceCondensing = (hydraulicConfidenceReport?.warnings ?? []).some((warning) => warning.code === 'low_confidence_condensing_estimate')
    || (sourceState?.condensingConfidence !== undefined && sourceState.condensingConfidence !== 'derived');

  return buildSection(
    'Condensing summary',
    [
      formatPeriods('Condensing-likely periods', condensingPeriods),
      `Fallback/static-return use: ${fallbackUsed ? 'present' : 'not present'}.`,
      `Low-confidence condensing estimate: ${lowConfidenceCondensing ? 'yes' : 'no'}.`,
      `Condensing confidence source: ${sourceState?.condensingConfidence ?? 'not available'}.`,
      `Heat source type context: ${(graph.heatSourceModels ?? []).find((model) => model.componentId === sourceComponentId)?.heatSourceType ?? 'not detected'}.`,
    ],
    [
      ...condensingPeriods.flatMap((period) => period.evidenceIds),
      ...(lowConfidenceCondensing ? ['confidence:condensing:low'] : []),
    ],
  );
}

function buildWarningsSummary(
  graph: LegoTechnixGraphV1,
  samples: readonly ScenarioTimelineSampleV1[],
  hydraulicConfidenceReport?: HydraulicConfidenceReportV1,
): LegoTechnixExplainabilitySectionV1 {
  const validationAndScenarioWarnings = unique(samples.flatMap((sample) => sample.warnings.map((warning) => warning.code)));
  const hydraulicWarnings = unique((hydraulicConfidenceReport?.warnings ?? []).map((warning) => warning.code));
  const assumptions = unique((hydraulicConfidenceReport?.assumptions ?? []).map((assumption) => assumption.code));
  const unknowns = unique((hydraulicConfidenceReport?.unknowns ?? []).map((unknown) => unknown.code));

  const statuses: Record<'measured' | 'manufacturer' | 'estimated' | 'assumed', number> = {
    measured: 0,
    manufacturer: 0,
    estimated: 0,
    assumed: 0,
  };
  const confidenceValues: LegoTechnixConfidence[] = [
    graph.confidence,
    ...graph.components.map((component) => asConfidence(component.confidence)),
    ...graph.connections.map((connection) => asConfidence(connection.confidence)),
    ...(hydraulicConfidenceReport?.domainConfidence ?? []).map((entry) => asConfidence(entry.confidence)),
    ...(hydraulicConfidenceReport?.edgeConfidence ?? []).map((entry) => asConfidence(entry.confidence)),
    ...(hydraulicConfidenceReport?.componentConfidence ?? []).map((entry) => asConfidence(entry.confidence)),
  ];
  for (const value of confidenceValues) {
    if (value in statuses) {
      statuses[value as keyof typeof statuses] += 1;
    }
  }

  return buildSection(
    'Warnings summary',
    [
      `Validation/scenario warnings: ${validationAndScenarioWarnings.length > 0 ? validationAndScenarioWarnings.join(', ') : 'none observed'}.`,
      `Hydraulic confidence warnings: ${hydraulicWarnings.length > 0 ? hydraulicWarnings.join(', ') : 'none provided'}.`,
      `Assumptions: ${assumptions.length > 0 ? assumptions.join(', ') : 'none provided'}.`,
      `Unknowns: ${unknowns.length > 0 ? unknowns.join(', ') : 'none provided'}.`,
      `Confidence status counts (measured/manufacturer/estimated/assumed): ${statuses.measured}/${statuses.manufacturer}/${statuses.estimated}/${statuses.assumed}.`,
    ],
    [
      ...validationAndScenarioWarnings.flatMap((warningCode) => buildWarningEvidenceIds(samples, warningCode)),
      ...hydraulicWarnings.map((code) => `hydraulic:warning:${code}`),
      ...assumptions.map((code) => `hydraulic:assumption:${code}`),
      ...unknowns.map((code) => `hydraulic:unknown:${code}`),
    ],
  );
}

function buildConfidenceSummary(
  graph: LegoTechnixGraphV1,
  hydraulicConfidenceReport?: HydraulicConfidenceReportV1,
): LegoTechnixExplainabilitySectionV1 {
  const overallConfidence = hydraulicConfidenceReport?.overallConfidence ?? graph.confidence;
  const inferredCount = hydraulicConfidenceReport?.inferredInputs.length ?? 0;
  const measuredCount = hydraulicConfidenceReport?.measuredInputs.length ?? 0;
  const manufacturerCount = hydraulicConfidenceReport?.manufacturerInputs.length ?? 0;

  return buildSection(
    'Confidence summary',
    [
      `Overall confidence: ${overallConfidence}.`,
      `Measured inputs: ${measuredCount}.`,
      `Manufacturer inputs: ${manufacturerCount}.`,
      `Inferred/estimated inputs: ${inferredCount}.`,
      `Hydraulic confidence report linked: ${hydraulicConfidenceReport ? 'yes' : 'no'}.`,
    ],
    [
      `confidence:overall:${overallConfidence}`,
      ...(hydraulicConfidenceReport ? ['confidence:hydraulic_report:present'] : ['confidence:hydraulic_report:absent']),
    ],
  );
}

function pushCausalNote(
  notes: LegoTechnixCausalNoteV1[],
  note: LegoTechnixCausalNoteV1,
): void {
  if (note.evidenceIds.length === 0) {
    return;
  }
  notes.push(note);
}

function buildCausalNotes(
  scenarioResult: ScenarioResultV1,
  hydraulicConfidenceReport?: HydraulicConfidenceReportV1,
  dhwRecoveryMetrics?: DhwRecoveryMetricsV1,
): readonly LegoTechnixCausalNoteV1[] {
  const samples = scenarioResult.timelineSamples;
  const notes: LegoTechnixCausalNoteV1[] = [];

  const firstHeatingCallSample = samples.find((sample) => sample.events.some((event) => (
    event.type === 'control_sensor_evaluated'
    && event.message.includes('demanding')
    && (event.componentId ?? '').includes('room')
  )));
  if (firstHeatingCallSample) {
    pushCausalNote(notes, {
      id: 'controls.heating_demand_opened_heating_valve',
      category: 'controls',
      severity: 'info',
      message: 'Heating demand opened the heating valve because room temperature was below target.',
      evidenceIds: [buildSampleEvidenceId(firstHeatingCallSample, 'event', 'control_sensor_evaluated')],
      confidence: 'derived',
      engineeringOnly: false,
    });
  }

  const firstRecoverySample = samples.find((sample, index) => {
    if (index === 0) {
      return false;
    }
    const previous = samples[index - 1];
    return typeof sample.storedDhwTemperatureC === 'number'
      && typeof previous.storedDhwTemperatureC === 'number'
      && sample.storedDhwTemperatureC > previous.storedDhwTemperatureC
      && (sample.sourceHeatOutputKw ?? 0) > 0;
  });
  if (firstRecoverySample) {
    pushCausalNote(notes, {
      id: 'dhw.cylinder_recovery_raised_stored_temperature',
      category: 'dhw',
      severity: 'info',
      message: 'Cylinder recovery increased stored-water temperature because primary heat was transferred through the coil.',
      evidenceIds: [buildSampleEvidenceId(firstRecoverySample, 'dhw_recovery')],
      confidence: dhwRecoveryMetrics?.recoveryConfidence ?? 'derived',
      engineeringOnly: false,
    });
  }

  const firstDrawOffDropSample = samples.find((sample, index) => {
    if (index === 0) {
      return false;
    }
    const previous = samples[index - 1];
    return (sample.dhwDrawOffFlowLpm ?? 0) > 0
      && typeof sample.usableHotWaterLitresAt40C === 'number'
      && typeof previous.usableHotWaterLitresAt40C === 'number'
      && sample.usableHotWaterLitresAt40C < previous.usableHotWaterLitresAt40C;
  });
  if (firstDrawOffDropSample) {
    pushCausalNote(notes, {
      id: 'dhw.draw_off_reduced_usable_hot_water',
      category: 'dhw',
      severity: 'notice',
      message: 'Usable hot water fell during draw-off because stored water was depleted and replaced by colder inlet water.',
      evidenceIds: [buildSampleEvidenceId(firstDrawOffDropSample, 'dhw_draw_off')],
      confidence: 'derived',
      engineeringOnly: false,
    });
  }

  const firstCondensingSample = samples.find((sample) => sample.condensingLikely === true && typeof sample.sourceReturnTemperatureC === 'number');
  if (firstCondensingSample) {
    pushCausalNote(notes, {
      id: 'heat_source.condensing_likelihood_improved_with_low_return',
      category: 'heat_source',
      severity: 'info',
      message: 'Condensing likelihood improved when runtime return temperature fell below the condensing threshold.',
      evidenceIds: [buildSampleEvidenceId(firstCondensingSample, 'condensing')],
      confidence: 'derived',
      engineeringOnly: false,
    });
  }

  const firstBypassSample = samples.find((sample) => (
    sample.activeBranches.some((branch) => branch.pathId.includes('bypass'))
    && !sample.activeBranches.some((branch) => branch.pathId.includes('heating_cycle'))
    && (sample.sourceHeatOutputKw ?? 0) > 0
  ));
  if (firstBypassSample) {
    pushCausalNote(notes, {
      id: 'hydraulic.bypass_activated_when_heating_path_closed',
      category: 'hydraulic',
      severity: 'notice',
      message: 'Bypass path became active because the heating branch was closed while the primary driver remained available.',
      evidenceIds: [buildSampleEvidenceId(firstBypassSample, 'bypass')],
      confidence: 'derived',
      engineeringOnly: false,
    });
  }

  const lowConfidenceWarning = hydraulicConfidenceReport?.warnings.find((warning) => warning.code === 'low_confidence_condensing_estimate');
  if (lowConfidenceWarning) {
    pushCausalNote(notes, {
      id: 'confidence.low_confidence_condensing_estimate',
      category: 'confidence',
      severity: 'warning',
      message: 'Condensing estimate confidence is limited because return-side evidence is not fully constrained.',
      evidenceIds: [`hydraulic:warning:${lowConfidenceWarning.code}`],
      confidence: lowConfidenceWarning.confidence,
      engineeringOnly: true,
    });
  }

  return notes;
}

export function buildLegoTechnixExplainabilityReportV1(
  input: BuildLegoTechnixExplainabilityReportV1Input,
): LegoTechnixExplainabilityReportV1 {
  const { graph, scenarioResult, dhwRecoveryMetrics, hydraulicConfidenceReport } = input;

  return {
    schemaVersion: '1.0',
    systemSummary: buildSystemSummary(graph, scenarioResult),
    activeCircuitSummary: buildActiveCircuitSummary(graph, scenarioResult.timelineSamples, scenarioResult.finalState),
    controlDecisionSummary: buildControlDecisionSummary(graph, scenarioResult.timelineSamples),
    heatSourceSummary: buildHeatSourceSummary(scenarioResult.timelineSamples),
    roomHeatingSummary: buildRoomHeatingSummary(graph, scenarioResult),
    dhwSummary: buildDhwSummary(scenarioResult, dhwRecoveryMetrics),
    returnTemperatureSummary: buildReturnTemperatureSummary(scenarioResult),
    condensingSummary: buildCondensingSummary(graph, scenarioResult, hydraulicConfidenceReport),
    warningsSummary: buildWarningsSummary(graph, scenarioResult.timelineSamples, hydraulicConfidenceReport),
    confidenceSummary: buildConfidenceSummary(graph, hydraulicConfidenceReport),
    causalNotes: buildCausalNotes(scenarioResult, hydraulicConfidenceReport, dhwRecoveryMetrics),
  };
}
