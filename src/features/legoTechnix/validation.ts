import type {
  LegoTechnixComponentV1,
  LegoTechnixConnectionV1,
  LegoTechnixGraphV1,
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

export function validateLegoTechnixGraphV1(graph: LegoTechnixGraphV1): LegoTechnixValidationResultV1 {
  const errors: LegoTechnixValidationIssueV1[] = [];
  const warnings: LegoTechnixValidationIssueV1[] = [];

  const componentById = new Map(graph.components.map((component) => [component.id, component]));

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

  if (!graph.hydraulicDomains || graph.hydraulicDomains.length === 0) {
    addWarning(
      warnings,
      'missing_hydraulic_domains',
      'Graph has no hydraulic domains declared.',
    );
  }

  for (const hydraulicDomain of graph.hydraulicDomains ?? []) {
    if (hydraulicDomain.confidence === 'unknown') {
      addWarning(
        warnings,
        'hydraulic_domain_unknown_confidence',
        `Hydraulic domain "${hydraulicDomain.id}" has unknown confidence.`,
      );
    }

    if (
      hydraulicDomain.pressureRegime === 'sealed_primary'
      && hydraulicDomain.requiresExpansionAccommodation
    ) {
      const hasExpansionAccommodation = graph.components.some((component) => (
        component.role === 'safety'
        || component.behaviours?.includes('accepts_expansion')
      ));

      if (!hasExpansionAccommodation) {
        addError(
          errors,
          'sealed_primary_missing_expansion_accommodation',
          `Hydraulic domain "${hydraulicDomain.id}" requires expansion accommodation but no safety/expansion component exists.`,
        );
      }
    }
  }

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
