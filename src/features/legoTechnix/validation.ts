import type {
  LegoTechnixActiveCircuitPathV1,
  LegoTechnixCircuitDefinitionV1,
  LegoTechnixComponentV1,
  LegoTechnixConnectionV1,
  LegoTechnixGraphV1,
  HydraulicDomainV1,
  HydraulicPreFlightMarkerV1,
  LegoTechnixPortV1,
} from './types';

export interface LegoTechnixValidationIssueV1 {
  code: string;
  message: string;
}

export interface LegoTechnixValidationResultV1 {
  isValid: boolean;
  errors: LegoTechnixValidationIssueV1[];
  warnings: LegoTechnixValidationIssueV1[];
}

function findPort(component: LegoTechnixComponentV1, portId: string): LegoTechnixPortV1 | undefined {
  return component.ports.find((port) => port.id === portId);
}

function addError(
  errors: LegoTechnixValidationIssueV1[],
  code: string,
  message: string,
): void {
  errors.push({ code, message });
}

function addWarning(
  warnings: LegoTechnixValidationIssueV1[],
  code: string,
  message: string,
): void {
  warnings.push({ code, message });
}

function hasHydraulicLengthAndBoreData(connection: LegoTechnixConnectionV1): boolean {
  return (
    connection.physical.lengthM !== undefined
    && (
      connection.physical.internalDiameterMm !== undefined
      || connection.physical.nominalDiameterMm !== undefined
    )
  );
}

function hasMarker(
  hydraulicDomain: HydraulicDomainV1,
  marker: HydraulicPreFlightMarkerV1,
): boolean {
  return hydraulicDomain.preFlightMarkers?.includes(marker) ?? false;
}

function normaliseText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function componentContainsAllTokens(
  component: LegoTechnixComponentV1,
  tokens: string[],
): boolean {
  const id = normaliseText(component.id);
  const label = normaliseText(component.label);
  return tokens.every((token) => id.includes(token) || label.includes(token));
}

function hasCombinedFeedVentRepresentation(graph: LegoTechnixGraphV1): boolean {
  return graph.components.some((component) => (
    component.role === 'safety'
    && component.behaviours?.includes('accepts_expansion')
    && componentContainsAllTokens(component, ['feed', 'vent'])
  ));
}

function hasSeparateFeedRepresentation(graph: LegoTechnixGraphV1): boolean {
  return graph.components.some((component) => componentContainsAllTokens(component, ['feed']));
}

function hasSeparateVentRepresentation(graph: LegoTechnixGraphV1): boolean {
  return graph.components.some((component) => componentContainsAllTokens(component, ['vent']));
}

function domainModelsDomesticDrawOff(
  graph: LegoTechnixGraphV1,
  componentById: Map<string, LegoTechnixComponentV1>,
): boolean {
  for (const path of graph.activeCircuitPaths ?? []) {
    if (path.domain !== 'domestic_hot') {
      continue;
    }
    const sink = componentById.get(path.sinkComponentId);
    if (sink?.role === 'load') {
      return true;
    }
  }
  return false;
}

function validateOpenVentedPrimaryPreFlight(
  graph: LegoTechnixGraphV1,
  hydraulicDomain: HydraulicDomainV1,
  errors: LegoTechnixValidationIssueV1[],
): void {
  if (
    hydraulicDomain.availableStaticHeadM === undefined
    || hydraulicDomain.minStaticHeadM === undefined
  ) {
    addError(
      errors,
      'open_vented_static_head_missing',
      `Hydraulic domain "${hydraulicDomain.id}" must declare availableStaticHeadM and minStaticHeadM for open-vented validation.`,
    );
  } else if (hydraulicDomain.availableStaticHeadM < hydraulicDomain.minStaticHeadM) {
    addError(
      errors,
      'open_vented_static_head_below_min',
      `Hydraulic domain "${hydraulicDomain.id}" has insufficient static head (${hydraulicDomain.availableStaticHeadM}m < ${hydraulicDomain.minStaticHeadM}m).`,
    );
  }

  const hasCombinedFeedVent = hasMarker(hydraulicDomain, 'combined_feed_vent')
    || hasCombinedFeedVentRepresentation(graph);
  const hasSeparateFeed = hasMarker(hydraulicDomain, 'separate_feed')
    || hasSeparateFeedRepresentation(graph);
  const hasSeparateVent = hasMarker(hydraulicDomain, 'separate_vent')
    || hasSeparateVentRepresentation(graph);

  if (!hasCombinedFeedVent && !(hasSeparateFeed && hasSeparateVent)) {
    addError(
      errors,
      'open_vented_missing_feed_vent_representation',
      `Hydraulic domain "${hydraulicDomain.id}" must represent combined feed/vent or valid separate feed plus vent paths.`,
    );
  }

  if (hasMarker(hydraulicDomain, 'pump_feed_vent_order_invalid')) {
    addError(
      errors,
      'open_vented_invalid_pump_feed_vent_order',
      `Hydraulic domain "${hydraulicDomain.id}" marks pump/feed/vent ordering as invalid.`,
    );
  }
}

function validateSealedPrimaryPreFlight(
  graph: LegoTechnixGraphV1,
  hydraulicDomain: HydraulicDomainV1,
  errors: LegoTechnixValidationIssueV1[],
): void {
  if (!hydraulicDomain.requiresExpansionAccommodation) {
    addError(
      errors,
      'sealed_primary_requires_expansion_accommodation_flag',
      `Hydraulic domain "${hydraulicDomain.id}" must set requiresExpansionAccommodation for sealed-primary validation.`,
    );
  }

  const hasExpansionAccommodation = graph.components.some((component) => (
    component.role === 'safety'
    && component.behaviours?.includes('accepts_expansion')
  ));
  if (!hasExpansionAccommodation) {
    addError(
      errors,
      'sealed_primary_missing_expansion_accommodation',
      `Hydraulic domain "${hydraulicDomain.id}" requires expansion accommodation but no safety/expansion component exists.`,
    );
  }

  if (!hasMarker(hydraulicDomain, 'primary_pressure_relief_valve')) {
    addError(
      errors,
      'sealed_primary_missing_prv_marker',
      `Hydraulic domain "${hydraulicDomain.id}" must declare a primary pressure-relief marker.`,
    );
  }

  if (!hasMarker(hydraulicDomain, 'primary_pressure_gauge')) {
    addError(
      errors,
      'sealed_primary_missing_pressure_gauge_marker',
      `Hydraulic domain "${hydraulicDomain.id}" must declare a pressure-gauge marker.`,
    );
  }

  const hasFillingMethod = hasMarker(hydraulicDomain, 'primary_filling_loop')
    || hasMarker(hydraulicDomain, 'primary_filling_key')
    || hasMarker(hydraulicDomain, 'primary_auto_fill');
  if (!hasFillingMethod) {
    addError(
      errors,
      'sealed_primary_missing_filling_method_marker',
      `Hydraulic domain "${hydraulicDomain.id}" must declare a filling method marker.`,
    );
  }
}

function validateMainsPressureDhwPreFlight(
  hydraulicDomain: HydraulicDomainV1,
  errors: LegoTechnixValidationIssueV1[],
): void {
  const requiredMarkers: HydraulicPreFlightMarkerV1[] = [
    'g3_expansion_accommodation',
    'g3_pressure_relief_chain',
    'g3_tp_relief',
    'g3_d1_d2_discharge_route',
  ];
  const missingMarkers = requiredMarkers.filter((marker) => !hasMarker(hydraulicDomain, marker));

  if (missingMarkers.length > 0) {
    addError(
      errors,
      'mains_pressure_dhw_missing_g3_safety_chain',
      `Hydraulic domain "${hydraulicDomain.id}" is mains-pressure DHW and must declare full G3 safety-chain markers.`,
    );
  }
}

function validateTankFedDhwPreFlight(
  graph: LegoTechnixGraphV1,
  componentById: Map<string, LegoTechnixComponentV1>,
  hydraulicDomain: HydraulicDomainV1,
  errors: LegoTechnixValidationIssueV1[],
): void {
  if (!domainModelsDomesticDrawOff(graph, componentById)) {
    return;
  }

  if (
    hydraulicDomain.availableStaticHeadM === undefined
    || hydraulicDomain.minStaticHeadM === undefined
  ) {
    addError(
      errors,
      'tank_fed_dhw_missing_static_head_to_outlet',
      `Hydraulic domain "${hydraulicDomain.id}" models draw-off and must expose availableStaticHeadM and minStaticHeadM.`,
    );
    return;
  }

  if (hydraulicDomain.availableStaticHeadM < hydraulicDomain.minStaticHeadM) {
    addError(
      errors,
      'tank_fed_dhw_static_head_below_min',
      `Hydraulic domain "${hydraulicDomain.id}" draw-off static head is below minimum (${hydraulicDomain.availableStaticHeadM}m < ${hydraulicDomain.minStaticHeadM}m).`,
    );
  }
}

function validatePressureRegimesPreFlight(
  graph: LegoTechnixGraphV1,
  componentById: Map<string, LegoTechnixComponentV1>,
  warnings: LegoTechnixValidationIssueV1[],
  errors: LegoTechnixValidationIssueV1[],
): void {
  if (!graph.hydraulicDomains || graph.hydraulicDomains.length === 0) {
    addWarning(
      warnings,
      'missing_hydraulic_domains',
      'Graph has no hydraulic domains declared.',
    );
    return;
  }

  for (const hydraulicDomain of graph.hydraulicDomains) {
    if (hydraulicDomain.confidence === 'unknown') {
      addWarning(
        warnings,
        'hydraulic_domain_unknown_confidence',
        `Hydraulic domain "${hydraulicDomain.id}" has unknown confidence.`,
      );
    }

    if (
      hydraulicDomain.pressureRegime === 'open_vented_primary'
      || hydraulicDomain.pressureRegime === 'thermal_store_primary'
    ) {
      validateOpenVentedPrimaryPreFlight(graph, hydraulicDomain, errors);
      continue;
    }

    if (hydraulicDomain.pressureRegime === 'sealed_primary') {
      validateSealedPrimaryPreFlight(graph, hydraulicDomain, errors);
      continue;
    }

    if (hydraulicDomain.pressureRegime === 'mains_pressure_dhw') {
      validateMainsPressureDhwPreFlight(hydraulicDomain, errors);
      continue;
    }

    if (hydraulicDomain.pressureRegime === 'tank_fed_dhw') {
      validateTankFedDhwPreFlight(graph, componentById, hydraulicDomain, errors);
    }
  }
}

function isPrimaryDomain(domain: string): boolean {
  return domain === 'primary_heating';
}

function collectPathConnections(
  path: LegoTechnixActiveCircuitPathV1,
  connectionById: Map<string, LegoTechnixConnectionV1>,
  errors: LegoTechnixValidationIssueV1[],
): {
  forwardConnections: LegoTechnixConnectionV1[];
  returnConnections: LegoTechnixConnectionV1[];
} {
  const forwardConnections: LegoTechnixConnectionV1[] = [];
  const returnConnections: LegoTechnixConnectionV1[] = [];

  for (const connectionId of path.forwardConnectionIds) {
    const connection = connectionById.get(connectionId);
    if (!connection) {
      addError(
        errors,
        'active_path_missing_forward_connection',
        `Active path "${path.id}" references missing forward connection "${connectionId}".`,
      );
      continue;
    }
    forwardConnections.push(connection);
  }

  for (const connectionId of path.returnConnectionIds ?? []) {
    const connection = connectionById.get(connectionId);
    if (!connection) {
      addError(
        errors,
        'active_path_missing_return_connection',
        `Active path "${path.id}" references missing return connection "${connectionId}".`,
      );
      continue;
    }
    returnConnections.push(connection);
  }

  return { forwardConnections, returnConnections };
}

function validateConnectionChainContinuity(
  chainType: 'forward' | 'return',
  path: LegoTechnixActiveCircuitPathV1,
  connections: LegoTechnixConnectionV1[],
  expectedStartComponentId: string,
  expectedEndComponentId: string,
  errors: LegoTechnixValidationIssueV1[],
): void {
  if (connections.length === 0) {
    addError(
      errors,
      `active_path_empty_${chainType}_chain`,
      `Active path "${path.id}" must include at least one ${chainType} connection.`,
    );
    return;
  }

  const firstConnection = connections[0];
  if (firstConnection.sourceComponentId !== expectedStartComponentId) {
    addError(
      errors,
      `active_path_${chainType}_source_mismatch`,
      `Active path "${path.id}" ${chainType} chain must start at component "${expectedStartComponentId}".`,
    );
  }

  const lastConnection = connections[connections.length - 1];
  if (lastConnection.targetComponentId !== expectedEndComponentId) {
    addError(
      errors,
      `active_path_${chainType}_sink_mismatch`,
      `Active path "${path.id}" ${chainType} chain must end at component "${expectedEndComponentId}".`,
    );
  }

  for (let index = 0; index < connections.length - 1; index += 1) {
    const currentConnection = connections[index];
    const nextConnection = connections[index + 1];
    if (currentConnection.targetComponentId !== nextConnection.sourceComponentId) {
      addError(
        errors,
        `active_path_${chainType}_continuity_break`,
        `Active path "${path.id}" ${chainType} chain breaks continuity between "${currentConnection.id}" and "${nextConnection.id}".`,
      );
    }
  }
}

function validateActivePathConnectionMembership(
  path: LegoTechnixActiveCircuitPathV1,
  connections: LegoTechnixConnectionV1[],
  errors: LegoTechnixValidationIssueV1[],
): void {
  for (const connection of connections) {
    if (!path.circuitIds.includes(connection.circuitId)) {
      addError(
        errors,
        'active_path_connection_outside_circuit_set',
        `Connection "${connection.id}" in active path "${path.id}" is not in the allowed circuit set.`,
      );
    }
    if (connection.domain !== path.domain) {
      addError(
        errors,
        'active_path_domain_mismatch',
        `Connection "${connection.id}" in active path "${path.id}" has domain "${connection.domain}" but path domain is "${path.domain}".`,
      );
    }
  }
}

function validateInlineContinuity(
  path: LegoTechnixActiveCircuitPathV1,
  connections: LegoTechnixConnectionV1[],
  graph: LegoTechnixGraphV1,
  errors: LegoTechnixValidationIssueV1[],
): void {
  const inlineComponents = graph.components.filter((component) => (
    component.role === 'inline'
    || component.role === 'control_actuator'
  ));

  for (const component of inlineComponents) {
    const incomingCount = connections.filter(
      (connection) => connection.targetComponentId === component.id,
    ).length;
    const outgoingCount = connections.filter(
      (connection) => connection.sourceComponentId === component.id,
    ).length;
    const participatesInPath = incomingCount > 0 || outgoingCount > 0;

    if (participatesInPath && (incomingCount === 0 || outgoingCount === 0)) {
      addError(
        errors,
        'inline_component_breaks_continuity',
        `Inline continuity failed in active path "${path.id}" for component "${component.id}".`,
      );
    }
  }
}

function validateBranchMergeSemantics(
  graph: LegoTechnixGraphV1,
  errors: LegoTechnixValidationIssueV1[],
): void {
  for (const component of graph.components) {
    const incomingCount = graph.connections.filter(
      (connection) => connection.targetComponentId === component.id,
    ).length;
    const outgoingCount = graph.connections.filter(
      (connection) => connection.sourceComponentId === component.id,
    ).length;

    if (component.behaviours?.includes('splits') && outgoingCount < 2) {
      addError(
        errors,
        'split_component_missing_branches',
        `Component "${component.id}" declares splits behaviour but has fewer than two outgoing connections.`,
      );
    }

    if (component.behaviours?.includes('merges') && incomingCount < 2) {
      addError(
        errors,
        'merge_component_missing_inputs',
        `Component "${component.id}" declares merges behaviour but has fewer than two incoming connections.`,
      );
    }
  }
}

function validateExchangerBoundary(
  graph: LegoTechnixGraphV1,
  warnings: LegoTechnixValidationIssueV1[],
  errors: LegoTechnixValidationIssueV1[],
): void {
  for (const component of graph.components) {
    if (component.role !== 'exchanger') {
      continue;
    }

    const connectedConnections = graph.connections.filter((connection) => (
      connection.sourceComponentId === component.id
      || connection.targetComponentId === component.id
    ));

    const domainsSeen = new Set(connectedConnections.map((connection) => connection.domain));
    const circuitDomains = new Map<string, Set<string>>();
    for (const connection of connectedConnections) {
      if (!circuitDomains.has(connection.circuitId)) {
        circuitDomains.set(connection.circuitId, new Set());
      }
      circuitDomains.get(connection.circuitId)?.add(connection.domain);
    }

    if (domainsSeen.size < 2) {
      addWarning(
        warnings,
        'exchanger_single_domain_usage',
        `Exchanger "${component.id}" currently connects to only one domain.`,
      );
    }

    for (const [circuitId, domains] of circuitDomains) {
      if (domains.size > 1) {
        addError(
          errors,
          'exchanger_circuit_crosses_domains',
          `Circuit "${circuitId}" crosses exchanger "${component.id}" across multiple domains.`,
        );
      }
    }
  }
}

function validatePrimaryPathSinkRole(
  path: LegoTechnixActiveCircuitPathV1,
  sinkComponent: LegoTechnixComponentV1 | undefined,
  errors: LegoTechnixValidationIssueV1[],
): void {
  if (!sinkComponent) {
    return;
  }

  if (sinkComponent.role !== 'load' && sinkComponent.role !== 'exchanger') {
    addError(
      errors,
      'primary_path_invalid_sink_role',
      `Primary active path "${path.id}" sink component "${sinkComponent.id}" must be role load or exchanger.`,
    );
  }
}

function validatePrimaryLoadsReachability(
  graph: LegoTechnixGraphV1,
  primaryPaths: LegoTechnixActiveCircuitPathV1[],
  connectionById: Map<string, LegoTechnixConnectionV1>,
  errors: LegoTechnixValidationIssueV1[],
): void {
  const primaryLoads = graph.components.filter((component) => (
    component.domains?.includes('primary_heating')
    && (component.role === 'load' || component.role === 'exchanger')
  ));
  const visitedLoadIds = new Set<string>();

  for (const path of primaryPaths) {
    for (const connectionId of path.forwardConnectionIds) {
      const connection = connectionById.get(connectionId);
      if (!connection) {
        continue;
      }
      visitedLoadIds.add(connection.sourceComponentId);
      visitedLoadIds.add(connection.targetComponentId);
    }
  }

  for (const loadComponent of primaryLoads) {
    if (!visitedLoadIds.has(loadComponent.id)) {
      addError(
        errors,
        'primary_load_not_reached_by_source_flow',
        `Primary load "${loadComponent.id}" is not reached by any primary active forward path.`,
      );
    }
  }
}

function validateCircuitRoleAssignments(
  circuitRegistry: LegoTechnixCircuitDefinitionV1[],
  activePaths: LegoTechnixActiveCircuitPathV1[],
  errors: LegoTechnixValidationIssueV1[],
): void {
  const primaryCircuitsInUse = new Set<string>();
  for (const path of activePaths) {
    if (!isPrimaryDomain(path.domain)) {
      continue;
    }
    for (const circuitId of path.circuitIds) {
      primaryCircuitsInUse.add(circuitId);
    }
  }

  for (const circuit of circuitRegistry) {
    if (!primaryCircuitsInUse.has(circuit.id)) {
      continue;
    }

    if (circuit.sourceRole !== 'source') {
      addError(
        errors,
        'primary_circuit_missing_source_role',
        `Primary circuit "${circuit.id}" must declare sourceRole as "source".`,
      );
    }

    if (!circuit.sinkRole || (circuit.sinkRole !== 'load' && circuit.sinkRole !== 'exchanger')) {
      addError(
        errors,
        'primary_circuit_missing_sink_role',
        `Primary circuit "${circuit.id}" must declare sinkRole as "load" or "exchanger".`,
      );
    }
  }
}

export function validateLegoTechnixGraphV1(graph: LegoTechnixGraphV1): LegoTechnixValidationResultV1 {
  const errors: LegoTechnixValidationIssueV1[] = [];
  const warnings: LegoTechnixValidationIssueV1[] = [];

  const componentById = new Map(graph.components.map((component) => [component.id, component]));
  const connectionById = new Map<string, LegoTechnixConnectionV1>();
  for (const connection of graph.connections) {
    if (connectionById.has(connection.id)) {
      addError(
        errors,
        'duplicate_connection_id',
        `Connection "${connection.id}" is duplicated.`,
      );
    }
    connectionById.set(connection.id, connection);
  }

  if (!graph.circuitRegistry || graph.circuitRegistry.length === 0) {
    addError(
      errors,
      'missing_circuit_registry',
      'Graph must declare a circuitId registry.',
    );
  }

  const circuitById = new Map<string, LegoTechnixCircuitDefinitionV1>();
  for (const circuit of graph.circuitRegistry ?? []) {
    if (circuitById.has(circuit.id)) {
      addError(
        errors,
        'duplicate_circuit_id',
        `Circuit "${circuit.id}" is duplicated in the circuit registry.`,
      );
    }
    circuitById.set(circuit.id, circuit);
  }

  validateCircuitRoleAssignments(
    graph.circuitRegistry ?? [],
    graph.activeCircuitPaths ?? [],
    errors,
  );
  validatePressureRegimesPreFlight(graph, componentById, warnings, errors);

  for (const component of graph.components) {
    if (!component.domains || component.domains.length === 0) {
      addError(
        errors,
        'component_missing_domains',
        `Component "${component.id}" must declare at least one domain.`,
      );
    }

    if (!component.role) {
      addError(
        errors,
        'component_missing_role',
        `Component "${component.id}" must declare a role.`,
      );
    }

    if (!component.behaviours || component.behaviours.length === 0) {
      addError(
        errors,
        'component_missing_behaviours',
        `Component "${component.id}" must declare behaviours.`,
      );
    }

    if (component.confidence === 'unknown') {
      addWarning(
        warnings,
        'component_unknown_confidence',
        `Component "${component.id}" has unknown confidence.`,
      );
    }
  }

  for (const connection of graph.connections) {
    const sourceComponent = componentById.get(connection.sourceComponentId);
    if (!sourceComponent) {
      addError(
        errors,
        'missing_source_component',
        `Connection "${connection.id}" references missing source component "${connection.sourceComponentId}".`,
      );
      continue;
    }

    const targetComponent = componentById.get(connection.targetComponentId);
    if (!targetComponent) {
      addError(
        errors,
        'missing_target_component',
        `Connection "${connection.id}" references missing target component "${connection.targetComponentId}".`,
      );
      continue;
    }

    const sourcePort = findPort(sourceComponent, connection.sourcePortId);
    if (!sourcePort) {
      addError(
        errors,
        'missing_source_port',
        `Connection "${connection.id}" references missing source port "${connection.sourcePortId}".`,
      );
      continue;
    }

    const targetPort = findPort(targetComponent, connection.targetPortId);
    if (!targetPort) {
      addError(
        errors,
        'missing_target_port',
        `Connection "${connection.id}" references missing target port "${connection.targetPortId}".`,
      );
      continue;
    }

    if (connection.domain !== sourcePort.domain || connection.domain !== targetPort.domain) {
      addError(
        errors,
        'connection_domain_mismatch',
        `Connection "${connection.id}" domain "${connection.domain}" does not match both connected ports.`,
      );
    }

    const circuitDefinition = circuitById.get(connection.circuitId);
    if (!circuitDefinition) {
      addError(
        errors,
        'connection_unknown_circuit_id',
        `Connection "${connection.id}" uses unknown circuitId "${connection.circuitId}".`,
      );
    } else if (circuitDefinition.domain !== connection.domain) {
      addError(
        errors,
        'connection_circuit_domain_mismatch',
        `Connection "${connection.id}" domain "${connection.domain}" does not match circuit "${connection.circuitId}" domain "${circuitDefinition.domain}".`,
      );
    }

    const sourceDomains = new Set(sourceComponent.domains ?? []);
    const targetDomains = new Set(targetComponent.domains ?? []);
    const sourceHasPrimary = sourceDomains.has('primary_heating');
    const targetHasPrimary = targetDomains.has('primary_heating');
    const sourceHasDomestic = sourceDomains.has('domestic_hot') || sourceDomains.has('domestic_cold');
    const targetHasDomestic = targetDomains.has('domestic_hot') || targetDomains.has('domestic_cold');
    const linksPrimaryAndDomestic = (sourceHasPrimary && targetHasDomestic) || (targetHasPrimary && sourceHasDomestic);

    if (
      linksPrimaryAndDomestic
      && sourceComponent.role !== 'exchanger'
      && targetComponent.role !== 'exchanger'
    ) {
      addError(
        errors,
        'direct_primary_to_domestic_connection',
        `Connection "${connection.id}" links primary and domestic domains without an exchanger component.`,
      );
    }

    if (!hasHydraulicLengthAndBoreData(connection)) {
      addWarning(
        warnings,
        'connection_missing_physical_assumptions',
        `Connection "${connection.id}" is missing length and bore assumptions.`,
      );
    }

    if (connection.confidence === 'unknown') {
      addWarning(
        warnings,
        'connection_unknown_confidence',
        `Connection "${connection.id}" has unknown confidence.`,
      );
    }

    if (connection.physical.routingConfidence === 'unknown') {
      addWarning(
        warnings,
        'connection_routing_unknown_confidence',
        `Connection "${connection.id}" has unknown routing confidence.`,
      );
    }
  }

  if (!graph.activeCircuitPaths || graph.activeCircuitPaths.length === 0) {
    addError(
      errors,
      'missing_active_circuit_paths',
      'Graph must declare active circuit paths.',
    );
  }

  const primaryPaths: LegoTechnixActiveCircuitPathV1[] = [];
  for (const path of graph.activeCircuitPaths ?? []) {
    if (path.forwardConnectionIds.length === 0) {
      addError(
        errors,
        'active_path_missing_forward_connections',
        `Active path "${path.id}" must include forwardConnectionIds.`,
      );
      continue;
    }

    const sourceComponent = componentById.get(path.sourceComponentId);
    if (!sourceComponent) {
      addError(
        errors,
        'active_path_missing_source_component',
        `Active path "${path.id}" references missing source component "${path.sourceComponentId}".`,
      );
    }

    const sinkComponent = componentById.get(path.sinkComponentId);
    if (!sinkComponent) {
      addError(
        errors,
        'active_path_missing_sink_component',
        `Active path "${path.id}" references missing sink component "${path.sinkComponentId}".`,
      );
    }

    for (const circuitId of path.circuitIds) {
      const circuitDefinition = circuitById.get(circuitId);
      if (!circuitDefinition) {
        addError(
          errors,
          'active_path_unknown_circuit',
          `Active path "${path.id}" references unknown circuit "${circuitId}".`,
        );
        continue;
      }
      if (circuitDefinition.domain !== path.domain) {
        addError(
          errors,
          'active_path_circuit_domain_mismatch',
          `Active path "${path.id}" domain "${path.domain}" does not match circuit "${circuitId}" domain "${circuitDefinition.domain}".`,
        );
      }
    }

    const { forwardConnections, returnConnections } = collectPathConnections(
      path,
      connectionById,
      errors,
    );
    validateActivePathConnectionMembership(path, forwardConnections, errors);
    validateActivePathConnectionMembership(path, returnConnections, errors);
    validateConnectionChainContinuity(
      'forward',
      path,
      forwardConnections,
      path.sourceComponentId,
      path.sinkComponentId,
      errors,
    );

    if (isPrimaryDomain(path.domain)) {
      primaryPaths.push(path);

      if (sourceComponent?.role !== 'source') {
        addError(
          errors,
          'primary_path_invalid_source_role',
          `Primary active path "${path.id}" source component "${path.sourceComponentId}" must have role "source".`,
        );
      }

      validatePrimaryPathSinkRole(path, sinkComponent, errors);

      if (!path.returnConnectionIds || path.returnConnectionIds.length === 0) {
        addError(
          errors,
          'primary_path_missing_return_path',
          `Primary active path "${path.id}" must include returnConnectionIds that close back to the source.`,
        );
      } else {
        validateConnectionChainContinuity(
          'return',
          path,
          returnConnections,
          path.sinkComponentId,
          path.sourceComponentId,
          errors,
        );
      }

      const pathConnections = [...forwardConnections, ...returnConnections];
      validateInlineContinuity(path, pathConnections, graph, errors);

      for (const connection of pathConnections) {
        const source = componentById.get(connection.sourceComponentId);
        const target = componentById.get(connection.targetComponentId);
        const sourceIsDomesticStore = source?.role === 'store'
          && (source.domains?.includes('domestic_hot') || source.domains?.includes('domestic_cold'));
        const targetIsDomesticStore = target?.role === 'store'
          && (target.domains?.includes('domestic_hot') || target.domains?.includes('domestic_cold'));

        if (sourceIsDomesticStore || targetIsDomesticStore) {
          addError(
            errors,
            'primary_path_enters_domestic_store',
            `Primary active path "${path.id}" cannot pass through domestic store components.`,
          );
        }
      }
    }
  }

  validatePrimaryLoadsReachability(graph, primaryPaths, connectionById, errors);
  validateBranchMergeSemantics(graph, errors);
  validateExchangerBoundary(graph, warnings, errors);

  if (!graph.components.some((component) => component.role === 'environment')) {
    addWarning(
      warnings,
      'missing_environment_component',
      'Graph has no environment component.',
    );
  }

  if (graph.confidence === 'unknown') {
    addWarning(
      warnings,
      'graph_unknown_confidence',
      'Graph confidence is unknown.',
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
