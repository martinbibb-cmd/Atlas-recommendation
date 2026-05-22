import { describe, expect, it } from 'vitest';
import { simpleRegularBoilerGraph } from '../fixtures/simpleRegularBoilerGraph';
import type { LegoTechnixGraphV1 } from '../types';
import { validateLegoTechnixGraphV1 } from '../validation';

function cloneGraph(graph: LegoTechnixGraphV1): LegoTechnixGraphV1 {
  return JSON.parse(JSON.stringify(graph)) as LegoTechnixGraphV1;
}

describe('validateLegoTechnixGraphV1', () => {
  it('1. simpleRegularBoilerGraph validates with no fatal errors', () => {
    const result = validateLegoTechnixGraphV1(simpleRegularBoilerGraph);
    expect(result.errors).toHaveLength(0);
    expect(result.isValid).toBe(true);
  });

  it('2. invalid missing component reference fails', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.connections[0].sourceComponentId = 'missing_component';

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'missing_source_component')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('3. invalid missing port reference fails', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.connections[0].sourcePortId = 'missing_port';

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'missing_source_port')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('4. direct primary_heating to domestic_hot connection fails', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);

    graph.components.push({
      id: 'direct_domestic_sink',
      label: 'Direct domestic sink',
      domains: ['primary_heating', 'domestic_hot'],
      role: 'load',
      behaviours: ['passes_through'],
      ports: [
        {
          id: 'sink_primary_in',
          label: 'Sink in',
          domain: 'primary_heating',
          direction: 'in',
          allowedConnectionDomains: ['primary_heating'],
          required: true,
          description: 'Invalid direct primary-to-domestic sink path.',
        },
      ],
      confidence: 'assumed',
    });

    graph.connections.push({
      id: 'invalid_primary_to_domestic',
      sourceComponentId: 'regular_boiler',
      sourcePortId: 'primary_flow_out',
      targetComponentId: 'direct_domestic_sink',
      targetPortId: 'sink_primary_in',
      domain: 'primary_heating',
      circuitId: 'invalid_domestic_mix',
      direction: 'out',
      confidence: 'assumed',
      physical: {
        lengthM: 0.5,
        nominalDiameterMm: 22,
        internalDiameterMm: 20,
        waterVolumeLitres: 0.2,
        estimatedResistanceIndex: 0.1,
        routingConfidence: 'assumed',
      },
    });

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'direct_primary_to_domestic_connection')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('5. component without role/behaviour fails', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);

    graph.components.push({
      id: 'invalid_component',
      label: 'Invalid component',
      domains: ['primary_heating'],
      ports: [
        {
          id: 'invalid_in',
          label: 'Invalid in',
          domain: 'primary_heating',
          direction: 'in',
          allowedConnectionDomains: ['primary_heating'],
          required: true,
          description: 'Missing role/behaviour component port.',
        },
      ],
    });

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'component_missing_role')).toBe(true);
    expect(result.errors.some((issue) => issue.code === 'component_missing_behaviours')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('6. sealed_primary without expansion accommodation component fails', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);

    graph.components = graph.components.filter((component) => component.id !== 'combined_feed_vent');
    graph.hydraulicDomains = [
      {
        id: 'sealed_primary_domain',
        pressureRegime: 'sealed_primary',
        openToAtmosphere: false,
        minStaticHeadM: 0,
        availableStaticHeadM: 0,
        nominalColdPressureBar: 1.2,
        maxSafePressureBar: 3,
        requiresExpansionAccommodation: true,
        manufacturerRequirementSource: 'Sealed system requirements',
        confidence: 'manufacturer',
      },
    ];

    const result = validateLegoTechnixGraphV1(graph);
    expect(
      result.errors.some((issue) => issue.code === 'sealed_primary_missing_expansion_accommodation'),
    ).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('7. radiator fixture is represented as exchanger/load into room_air', () => {
    const radiator = simpleRegularBoilerGraph.components.find((component) => component.id === 'radiator_emitter');

    expect(radiator).toBeDefined();
    expect(['exchanger', 'load']).toContain(radiator?.role);
    expect(radiator?.domains).toContain('room_air');
    expect(radiator?.behaviours).toContain('emits_heat_to_room');
  });

  it('8. cylinder fixture separates primary coil exchanger and stored domestic water volume', () => {
    const coil = simpleRegularBoilerGraph.components.find((component) => component.id === 'cylinder_coil_exchanger');
    const store = simpleRegularBoilerGraph.components.find((component) => component.id === 'stored_dhw_volume');

    expect(coil?.role).toBe('exchanger');
    expect(coil?.domains).toContain('primary_heating');
    expect(store?.role).toBe('store');
    expect(store?.domains).toContain('domestic_hot');
    expect(store?.id).not.toBe(coil?.id);
  });

  it('9. filter fixture is inline/protects/pass-through, not heat transfer', () => {
    const filter = simpleRegularBoilerGraph.components.find((component) => component.id === 'magnetic_filter');

    expect(filter?.role).toBe('inline');
    expect(filter?.behaviours).toContain('protects');
    expect(filter?.behaviours).toContain('passes_through');
    expect(filter?.behaviours).not.toContain('transfers_heat');
  });

  it('10. every connection has confidence/provenance', () => {
    expect(simpleRegularBoilerGraph.connections.length).toBeGreaterThan(0);
    for (const connection of simpleRegularBoilerGraph.connections) {
      expect(connection.confidence).toBeDefined();
      expect(connection.confidence).not.toBe('unknown');
      expect(connection.physical.routingConfidence).toBeDefined();
      expect(connection.physical.routingConfidence).not.toBe('unknown');
    }
  });
});
