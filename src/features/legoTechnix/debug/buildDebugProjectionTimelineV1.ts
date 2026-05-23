import type { LegoTechnixConfidence } from '../confidence';
import type { HydraulicConfidenceReportV1 } from '../hydraulicConfidenceReport';
import type { LegoTechnixGraphV1 } from '../types';
import type { LegoTechnixExplainabilityReportV1 } from '../simulation/LegoTechnixExplainabilityReportV1';
import type { ScenarioResultV1 } from '../simulation/runLegoTechnixScenarioV1';
import type { EdgeStateV1 } from '../simulation/EdgeStateV1';
import type { ComponentStateV1, ComponentOperatingModeV1 } from '../simulation/ComponentStateV1';
import type {
  ProjectionDemandStateV1,
  ProjectionEdgeV1,
  ProjectionFrameV1,
  ProjectionInferredVsMeasuredStateV1,
  ProjectionNodeV1,
  ProjectionNodeTemperatureV1,
  ProjectionOverlayEntryV1,
  ProjectionOverlayV1,
  ProjectionTimelineV1,
} from './ProjectionContractsV1';

export interface BuildDebugProjectionTimelineV1Input {
  readonly graph: LegoTechnixGraphV1;
  readonly scenarioResult: ScenarioResultV1;
  readonly hydraulicConfidenceReport?: HydraulicConfidenceReportV1;
  readonly explainabilityReport?: LegoTechnixExplainabilityReportV1;
  readonly templateId?: string;
}

interface LayoutPointV1 {
  readonly x: number;
  readonly y: number;
}

function toProjectionState(confidence: LegoTechnixConfidence): ProjectionInferredVsMeasuredStateV1 {
  if (confidence === 'measured' || confidence === 'manufacturer' || confidence === 'user_entered') {
    return 'measured';
  }
  if (confidence === 'assumed') {
    return 'assumed';
  }
  if (confidence === 'unknown') {
    return 'unknown';
  }
  return 'inferred';
}

function inferFamily(graph: LegoTechnixGraphV1, componentId: string): string {
  const sourceModel = graph.heatSourceModels?.find((model) => model.componentId === componentId);
  if (sourceModel) {
    return sourceModel.heatSourceType;
  }
  const transferModel = graph.heatTransferComponents?.find((model) => model.componentId === componentId);
  if (transferModel) {
    return transferModel.family;
  }
  const component = graph.components.find((entry) => entry.id === componentId);
  return component?.role ?? 'component';
}

function roleColumn(role: LegoTechnixGraphV1['components'][number]['role']): number {
  switch (role) {
    case 'source':
      return 0;
    case 'control_sensor':
    case 'control_logic':
      return 1;
    case 'control_actuator':
    case 'pump':
      return 2;
    case 'junction':
      return 3;
    case 'emitter':
      return 4;
    case 'store':
      return 5;
    case 'sink':
      return 6;
    case 'safety':
      return 7;
    default:
      return 8;
  }
}

function buildLayoutMap(graph: LegoTechnixGraphV1): ReadonlyMap<string, LayoutPointV1> {
  const ordered = [...graph.components].sort((left, right) => {
    const columnDelta = roleColumn(left.role) - roleColumn(right.role);
    if (columnDelta !== 0) {
      return columnDelta;
    }
    const leftDomain = left.domains?.[0] ?? '';
    const rightDomain = right.domains?.[0] ?? '';
    const domainDelta = leftDomain.localeCompare(rightDomain);
    if (domainDelta !== 0) {
      return domainDelta;
    }
    const labelDelta = left.label.localeCompare(right.label);
    if (labelDelta !== 0) {
      return labelDelta;
    }
    return left.id.localeCompare(right.id);
  });

  const rowByDomain = new Map<string, number>();
  const points = new Map<string, LayoutPointV1>();
  for (const component of ordered) {
    const domainKey = component.domains?.[0] ?? 'unassigned';
    const row = rowByDomain.get(domainKey) ?? 0;
    rowByDomain.set(domainKey, row + 1);
    const column = roleColumn(component.role);
    points.set(component.id, {
      x: 140 + (column * 220),
      y: 80 + (row * 120),
    });
  }

  return points;
}

function buildPathMaps(graph: LegoTechnixGraphV1): {
  readonly connectionIdsByPathId: ReadonlyMap<string, readonly string[]>;
  readonly componentIdsByPathId: ReadonlyMap<string, readonly string[]>;
} {
  const connectionIdsByPathId = new Map<string, readonly string[]>();
  const componentIdsByPathId = new Map<string, readonly string[]>();

  for (const path of graph.activeCircuitPaths ?? []) {
    const connectionIds = [...path.forwardConnectionIds, ...(path.returnConnectionIds ?? [])];
    const componentIds = new Set<string>([path.sourceComponentId, path.sinkComponentId]);
    for (const connectionId of connectionIds) {
      const connection = graph.connections.find((entry) => entry.id === connectionId);
      if (!connection) {
        continue;
      }
      componentIds.add(connection.sourceComponentId);
      componentIds.add(connection.targetComponentId);
    }

    connectionIdsByPathId.set(path.id, connectionIds);
    componentIdsByPathId.set(path.id, [...componentIds]);
  }

  return {
    connectionIdsByPathId,
    componentIdsByPathId,
  };
}

function toTemperatureEntries(state: ComponentStateV1 | undefined): readonly ProjectionNodeTemperatureV1[] {
  if (!state) {
    return [];
  }

  const entries: ProjectionNodeTemperatureV1[] = [];
  if (typeof state.currentTemperatureC === 'number') {
    entries.push({ label: 'current', temperatureC: state.currentTemperatureC });
  }
  if (typeof state.targetTemperatureC === 'number') {
    entries.push({ label: 'target', temperatureC: state.targetTemperatureC });
  }
  if (typeof state.returnTemperatureC === 'number') {
    entries.push({ label: 'return', temperatureC: state.returnTemperatureC });
  }
  if (typeof state.measuredTemperatureC === 'number') {
    entries.push({ label: 'measured', temperatureC: state.measuredTemperatureC });
  }
  return entries;
}

function deriveDemandState(componentState: ComponentStateV1 | undefined, isActive: boolean): ProjectionDemandStateV1 {
  if (componentState?.controlDemandState === 'demanding') {
    return 'demanding';
  }
  if (componentState?.controlDemandState === 'none') {
    return 'none';
  }
  return isActive ? 'demanding' : 'none';
}

function buildConfidenceEntries(
  report: HydraulicConfidenceReportV1 | undefined,
): readonly ProjectionOverlayEntryV1[] {
  if (!report) {
    return [];
  }

  return [
    ...report.edgeConfidence.map((bucket): ProjectionOverlayEntryV1 => ({
      id: `confidence:${bucket.id}`,
      label: `${bucket.id} → ${bucket.confidence}`,
      targetType: 'edge',
      targetId: bucket.id.replace('edge:', ''),
      status: bucket.critical ? 'warning' : 'info',
      confidence: bucket.confidence,
      metadata: {
        measuredState: toProjectionState(bucket.confidence),
      },
    })),
    ...report.assumptions.map((diagnostic): ProjectionOverlayEntryV1 => ({
      id: `confidence:assumption:${diagnostic.code}:${diagnostic.message}`,
      label: diagnostic.message,
      targetType: 'timeline',
      status: 'warning',
      confidence: diagnostic.confidence,
      metadata: {
        measuredState: 'assumed',
      },
    })),
    ...report.unknowns.map((diagnostic): ProjectionOverlayEntryV1 => ({
      id: `confidence:unknown:${diagnostic.code}:${diagnostic.message}`,
      label: diagnostic.message,
      targetType: 'timeline',
      status: 'critical',
      confidence: diagnostic.confidence,
      metadata: {
        measuredState: 'unknown',
      },
    })),
  ];
}

function buildExplainabilityEntries(
  report: LegoTechnixExplainabilityReportV1 | undefined,
): readonly ProjectionOverlayEntryV1[] {
  if (!report) {
    return [];
  }

  return report.causalNotes.map((note): ProjectionOverlayEntryV1 => ({
    id: `note:${note.id}`,
    label: note.message,
    targetType: 'timeline',
    status: note.severity === 'critical' ? 'critical' : note.severity === 'warning' ? 'warning' : 'info',
    confidence: note.confidence,
    evidence: note.evidenceIds,
    metadata: {
      noteCategory: note.category,
      noteSeverity: note.severity,
    },
  }));
}

function warningForConnection(
  warnings: readonly ScenarioResultV1['timelineSamples'][number]['warnings'],
  connectionId: string,
): readonly string[] {
  return warnings
    .filter((warning) => warning.componentId === connectionId || warning.message.includes(connectionId))
    .map((warning) => warning.message);
}

function warningForComponent(
  warnings: readonly ScenarioResultV1['timelineSamples'][number]['warnings'],
  componentId: string,
): readonly string[] {
  return warnings
    .filter((warning) => warning.componentId === componentId)
    .map((warning) => warning.message);
}

export function buildDebugProjectionTimelineV1(
  input: BuildDebugProjectionTimelineV1Input,
): ProjectionTimelineV1 {
  const layoutByComponentId = buildLayoutMap(input.graph);
  const { connectionIdsByPathId, componentIdsByPathId } = buildPathMaps(input.graph);
  const finalEdgeById = new Map<string, EdgeStateV1>(
    input.scenarioResult.finalState.edgeStates.map((edgeState) => [edgeState.connectionId, edgeState]),
  );
  const finalComponentById = new Map<string, ComponentStateV1>(
    input.scenarioResult.finalState.componentStates.map((componentState) => [componentState.componentId, componentState]),
  );

  const confidenceEntries = buildConfidenceEntries(input.hydraulicConfidenceReport);
  const explainabilityEntries = buildExplainabilityEntries(input.explainabilityReport);

  const frames: ProjectionFrameV1[] = input.scenarioResult.timelineSamples.map((sample) => {
    const activePathIds = new Set(sample.activeBranches.map((branch) => branch.pathId));
    const activeConnectionIds = new Set<string>();
    const activeComponentIds = new Set<string>();
    for (const pathId of activePathIds) {
      for (const connectionId of connectionIdsByPathId.get(pathId) ?? []) {
        activeConnectionIds.add(connectionId);
      }
      for (const componentId of componentIdsByPathId.get(pathId) ?? []) {
        activeComponentIds.add(componentId);
      }
    }

    const sampleTemperatureByComponentId = new Map<string, readonly ProjectionNodeTemperatureV1[]>();
    if (
      input.scenarioResult.sampleSelectors.roomComponentId
      && typeof sample.roomTemperatureC === 'number'
    ) {
      sampleTemperatureByComponentId.set(input.scenarioResult.sampleSelectors.roomComponentId, [{
        label: 'room',
        temperatureC: sample.roomTemperatureC,
      }]);
    }
    if (
      input.scenarioResult.sampleSelectors.storedDhwComponentId
      && typeof sample.storedDhwTemperatureC === 'number'
    ) {
      sampleTemperatureByComponentId.set(input.scenarioResult.sampleSelectors.storedDhwComponentId, [{
        label: 'stored_dhw',
        temperatureC: sample.storedDhwTemperatureC,
      }]);
    }
    if (
      input.scenarioResult.sampleSelectors.sourceComponentId
      && typeof sample.sourceFlowTemperatureC === 'number'
    ) {
      sampleTemperatureByComponentId.set(input.scenarioResult.sampleSelectors.sourceComponentId, [{
        label: 'source_flow',
        temperatureC: sample.sourceFlowTemperatureC,
      }]);
    }

    const nodes: ProjectionNodeV1[] = input.graph.components.map((component) => {
      const point = layoutByComponentId.get(component.id) ?? { x: 0, y: 0 };
      const isActive = activeComponentIds.has(component.id);
      const componentState = finalComponentById.get(component.id);
      const operatingMode: ComponentOperatingModeV1 = isActive
        ? 'running'
        : (componentState?.operatingMode ?? 'idle');

      const connectionIdsForPort = (portId: string): readonly string[] => (
        input.graph.connections
          .filter((connection) => (
            (connection.sourceComponentId === component.id && connection.sourcePortId === portId)
            || (connection.targetComponentId === component.id && connection.targetPortId === portId)
          ))
          .map((connection) => connection.id)
      );

      return {
        componentId: component.id,
        label: component.label,
        family: inferFamily(input.graph, component.id),
        role: component.role ?? 'unknown',
        x: point.x,
        y: point.y,
        ports: component.ports.map((port) => {
          const portConnectionIds = connectionIdsForPort(port.id);
          return {
            portId: port.id,
            label: port.label,
            domain: port.domain,
            direction: port.direction,
            required: port.required,
            isActive: portConnectionIds.some((connectionId) => activeConnectionIds.has(connectionId)),
          };
        }),
        operatingMode,
        confidence: component.confidence ?? 'unknown',
        warnings: warningForComponent(sample.warnings, component.id),
        temperatures: sampleTemperatureByComponentId.get(component.id)
          ?? toTemperatureEntries(componentState),
        demandState: deriveDemandState(componentState, isActive),
        engineeringMetadata: {
          domains: component.domains ?? [],
          behaviours: component.behaviours ?? [],
          stateOwnerId: component.stateOwnerId,
          isActive,
        },
      };
    });

    const edges: ProjectionEdgeV1[] = input.graph.connections.map((connection) => {
      const edgeState = finalEdgeById.get(connection.id);
      const active = activeConnectionIds.has(connection.id);
      return {
        connectionId: connection.id,
        fromNodeId: connection.sourceComponentId,
        toNodeId: connection.targetComponentId,
        active,
        estimatedFlowLps: active ? edgeState?.estimatedFlowLps : 0,
        estimatedVelocityMps: active ? edgeState?.estimatedVelocityMps : undefined,
        estimatedInletTemperatureC: edgeState?.estimatedInletTemperatureC,
        estimatedOutletTemperatureC: edgeState?.estimatedOutletTemperatureC,
        confidence: connection.confidence,
        warnings: warningForConnection(sample.warnings, connection.id),
        inferredVsMeasuredState: toProjectionState(connection.confidence),
        thermalLossKw: edgeState?.estimatedPipeHeatLossKw,
      };
    });

    const hydraulicEntries: ProjectionOverlayEntryV1[] = [
      ...edges.map((edge) => ({
        id: `hydraulic:path:${edge.connectionId}`,
        label: `${edge.connectionId} ${edge.active ? 'active' : 'inactive'}`,
        targetType: 'edge' as const,
        targetId: edge.connectionId,
        status: edge.active ? 'active' : 'inactive',
        metadata: {
          flowRiskBand: finalEdgeById.get(edge.connectionId)?.flowRiskBand,
        },
      })),
      ...edges
        .filter((edge) => finalEdgeById.get(edge.connectionId)?.flowRiskBand != null)
        .map((edge) => ({
          id: `hydraulic:bottleneck:${edge.connectionId}`,
          label: `${edge.connectionId} bottleneck ${finalEdgeById.get(edge.connectionId)?.flowRiskBand ?? ''}`,
          targetType: 'edge' as const,
          targetId: edge.connectionId,
          status: 'warning' as const,
          metadata: {
            flowRiskBand: finalEdgeById.get(edge.connectionId)?.flowRiskBand,
          },
        })),
      ...sample.warnings
        .filter((warning) => warning.code === 'deadhead_detected')
        .map((warning) => ({
          id: `hydraulic:deadhead:${warning.componentId ?? warning.code}`,
          label: warning.message,
          targetType: 'node' as const,
          targetId: warning.componentId,
          status: 'critical' as const,
        })),
      ...sample.activeBranches
        .filter((branch) => branch.pathId.includes('bypass') || branch.label.toLowerCase().includes('bypass'))
        .map((branch) => ({
          id: `hydraulic:bypass:${branch.pathId}`,
          label: `Bypass active: ${branch.label}`,
          targetType: 'timeline' as const,
          status: 'warning' as const,
        })),
    ];

    const thermalEntries: ProjectionOverlayEntryV1[] = [
      ...edges
        .filter((edge) => (
          typeof edge.estimatedInletTemperatureC === 'number'
          && typeof edge.estimatedOutletTemperatureC === 'number'
        ))
        .map((edge) => ({
          id: `thermal:edge:${edge.connectionId}`,
          label: `${edge.connectionId} ${edge.estimatedInletTemperatureC}°C → ${edge.estimatedOutletTemperatureC}°C`,
          targetType: 'edge' as const,
          targetId: edge.connectionId,
          status: edge.active ? 'active' as const : 'inactive' as const,
        })),
      ...nodes
        .filter((node) => node.role === 'emitter' && node.temperatures.length > 0)
        .map((node) => ({
          id: `thermal:emitter:${node.componentId}`,
          label: `${node.label} heat rejection evidence`,
          targetType: 'node' as const,
          targetId: node.componentId,
          status: 'info' as const,
        })),
      ...nodes
        .filter((node) => node.role === 'store')
        .map((node) => ({
          id: `thermal:store:${node.componentId}`,
          label: `${node.label} charge state visible`,
          targetType: 'node' as const,
          targetId: node.componentId,
          status: 'info' as const,
        })),
      ...nodes
        .filter((node) => node.engineeringMetadata.domains.includes('room_air'))
        .map((node) => ({
          id: `thermal:room:${node.componentId}`,
          label: `${node.label} room temperature state`,
          targetType: 'node' as const,
          targetId: node.componentId,
          status: 'info' as const,
        })),
    ];

    const overlays: ProjectionOverlayV1[] = [
      {
        overlayId: 'hydraulic',
        label: 'Hydraulic overlay',
        entries: hydraulicEntries,
      },
      {
        overlayId: 'thermal',
        label: 'Thermal overlay',
        entries: thermalEntries,
      },
      {
        overlayId: 'confidence',
        label: 'Confidence overlay',
        entries: confidenceEntries,
      },
      {
        overlayId: 'explainability',
        label: 'Explainability overlay',
        entries: explainabilityEntries,
      },
    ];

    return {
      frameId: `tick-${sample.tickIndex}`,
      tickIndex: sample.tickIndex,
      offsetSeconds: sample.offsetSeconds,
      wallClockMs: sample.wallClockMs,
      nodes,
      edges,
      overlays,
    };
  });

  return {
    schemaVersion: '1.0',
    templateId: input.templateId,
    frameCount: frames.length,
    timestepSeconds: input.scenarioResult.timestepSeconds,
    frames,
  };
}
