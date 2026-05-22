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

  it('11. every connection circuitId resolves in circuit registry', () => {
    const circuitIds = new Set((simpleRegularBoilerGraph.circuitRegistry ?? []).map((circuit) => circuit.id));
    for (const connection of simpleRegularBoilerGraph.connections) {
      expect(circuitIds.has(connection.circuitId)).toBe(true);
    }
  });

  it('12. active primary path reaches loads and returns to boiler', () => {
    const primaryPath = simpleRegularBoilerGraph.activeCircuitPaths?.find(
      (path) => path.id === 'active_primary_heating_cycle',
    );
    expect(primaryPath).toBeDefined();
    expect(primaryPath?.sourceComponentId).toBe('regular_boiler');
    expect(primaryPath?.sinkComponentId).toBe('radiator_emitter');
    expect(primaryPath?.returnConnectionIds?.length).toBeGreaterThan(0);

    const result = validateLegoTechnixGraphV1(simpleRegularBoilerGraph);
    expect(result.errors.some((issue) => issue.code === 'primary_load_not_reached_by_source_flow')).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'primary_path_missing_return_path')).toBe(false);
  });

  it('13. missing primary return path fails', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const primaryPath = graph.activeCircuitPaths?.find((path) => path.id === 'active_primary_heating_cycle');
    if (!primaryPath) {
      throw new Error('Fixture primary path missing.');
    }
    primaryPath.returnConnectionIds = [];

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'primary_path_missing_return_path')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('14. inline continuity break in active path fails', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const primaryPath = graph.activeCircuitPaths?.find((path) => path.id === 'active_primary_heating_cycle');
    if (!primaryPath) {
      throw new Error('Fixture primary path missing.');
    }
    primaryPath.forwardConnectionIds = primaryPath.forwardConnectionIds.filter(
      (connectionId) => connectionId !== 'conn_pump_to_valve',
    );

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'inline_component_breaks_continuity')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('15. exchanger cannot reuse one circuit across primary and domestic domains', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const transferConnection = graph.connections.find((connection) => connection.id === 'conn_coil_to_store');
    if (!transferConnection) {
      throw new Error('Fixture transfer connection missing.');
    }
    transferConnection.circuitId = 'primary_main_loop';

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'exchanger_circuit_crosses_domains')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('16. domestic cold → store → domestic hot path remains separate from primary', () => {
    const coldPath = simpleRegularBoilerGraph.activeCircuitPaths?.find((path) => path.id === 'active_domestic_cold_fill');
    const hotPath = simpleRegularBoilerGraph.activeCircuitPaths?.find((path) => path.id === 'active_domestic_hot_draw');
    expect(coldPath?.domain).toBe('domestic_cold');
    expect(hotPath?.domain).toBe('domestic_hot');

    const primaryCircuitIds = new Set(
      (simpleRegularBoilerGraph.circuitRegistry ?? [])
        .filter((circuit) => circuit.domain === 'primary_heating')
        .map((circuit) => circuit.id),
    );

    for (const circuitId of coldPath?.circuitIds ?? []) {
      expect(primaryCircuitIds.has(circuitId)).toBe(false);
    }
    for (const circuitId of hotPath?.circuitIds ?? []) {
      expect(primaryCircuitIds.has(circuitId)).toBe(false);
    }
  });

  it('17. open_vented_primary fails when available static head is below minimum', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const openVented = graph.hydraulicDomains?.find((domain) => domain.pressureRegime === 'open_vented_primary');
    if (!openVented) {
      throw new Error('Fixture open vented domain missing.');
    }
    openVented.availableStaticHeadM = 0.4;
    openVented.minStaticHeadM = 1;

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'open_vented_static_head_below_min')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('18. open_vented_primary requires feed/vent representation', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.components = graph.components.filter((component) => component.id !== 'combined_feed_vent');
    const openVented = graph.hydraulicDomains?.find((domain) => domain.pressureRegime === 'open_vented_primary');
    if (!openVented) {
      throw new Error('Fixture open vented domain missing.');
    }
    openVented.preFlightMarkers = [];

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'open_vented_missing_feed_vent_representation')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('19. sealed_primary requires PRV, pressure gauge, and filling method markers', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
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
        preFlightMarkers: [],
      },
    ];

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'sealed_primary_missing_prv_marker')).toBe(true);
    expect(result.errors.some((issue) => issue.code === 'sealed_primary_missing_pressure_gauge_marker')).toBe(true);
    expect(result.errors.some((issue) => issue.code === 'sealed_primary_missing_filling_method_marker')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('20. mains_pressure_dhw requires G3 safety-chain markers', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.hydraulicDomains = [
      {
        id: 'mains_pressure_dhw_domain',
        pressureRegime: 'mains_pressure_dhw',
        openToAtmosphere: false,
        nominalColdPressureBar: 2,
        maxSafePressureBar: 6,
        requiresExpansionAccommodation: true,
        manufacturerRequirementSource: 'Unvented cylinder assumptions',
        confidence: 'assumed',
        preFlightMarkers: ['g3_expansion_accommodation'],
      },
    ];

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'mains_pressure_dhw_missing_g3_safety_chain')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('21. tank_fed_dhw requires static-head declaration when modelling draw-off', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const tankFed = graph.hydraulicDomains?.find((domain) => domain.pressureRegime === 'tank_fed_dhw');
    if (!tankFed) {
      throw new Error('Fixture tank-fed domain missing.');
    }
    tankFed.availableStaticHeadM = undefined;
    tankFed.minStaticHeadM = undefined;

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'tank_fed_dhw_missing_static_head_to_outlet')).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('22. graph can pass structure/circuit checks but fail pressure pre-flight', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const openVented = graph.hydraulicDomains?.find((domain) => domain.pressureRegime === 'open_vented_primary');
    if (!openVented) {
      throw new Error('Fixture open vented domain missing.');
    }
    openVented.availableStaticHeadM = 0.2;
    openVented.minStaticHeadM = 1;

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((issue) => issue.code === 'open_vented_static_head_below_min')).toBe(true);
    expect(result.errors.some((issue) => issue.code === 'missing_source_component')).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'primary_path_missing_return_path')).toBe(false);
    expect(result.isValid).toBe(false);
  });
});
