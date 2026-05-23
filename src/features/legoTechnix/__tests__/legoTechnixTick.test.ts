import { describe, expect, it } from 'vitest';
import { branchingBypassGraph } from '../fixtures/branchingBypassGraph';
import {
  simpleRegularBoilerGraph,
  simpleRegularBoilerInitialStateV1,
} from '../fixtures/simpleRegularBoilerGraph';
import {
  sPlanControlGraph,
  sPlanControlInitialStateV1,
} from '../fixtures/sPlanControlGraph';
import type { LegoTechnixGraphV1 } from '../types';
import type { DomesticDrawOffDemandV1 } from '../simulation/DomesticDrawOffDemandV1';
import type { LegoTechnixSimulationStateV1 } from '../simulation/LegoTechnixSimulationStateV1';
import type { LegoTechnixTickInputV1 } from '../simulation/LegoTechnixTickInputV1';
import { evaluatePipeEdgesV1 } from '../simulation/evaluatePipeEdgesV1';
import { runLegoTechnixTickV1 } from '../simulation/runLegoTechnixTickV1';

function cloneGraph(graph: LegoTechnixGraphV1): LegoTechnixGraphV1 {
  return JSON.parse(JSON.stringify(graph)) as LegoTechnixGraphV1;
}

function makeInitialState(wallClockMs = 0): LegoTechnixSimulationStateV1 {
  return {
    schemaVersion: '1.0',
    tickIndex: 0,
    wallClockMs,
    componentStates: [],
    edgeStates: [],
    domainStates: [],
  };
}

function makeSimpleInitialState(wallClockMs = 0): LegoTechnixSimulationStateV1 {
  const base = JSON.parse(JSON.stringify(simpleRegularBoilerInitialStateV1)) as LegoTechnixSimulationStateV1;
  return {
    ...base,
    wallClockMs,
  };
}

function makeSPlanInitialState(wallClockMs = 0): LegoTechnixSimulationStateV1 {
  const base = JSON.parse(JSON.stringify(sPlanControlInitialStateV1)) as LegoTechnixSimulationStateV1;
  return {
    ...base,
    wallClockMs,
  };
}

function makeSimpleInitialStateWithEdgeTemperature(
  graph: LegoTechnixGraphV1,
  temperatureC: number,
  wallClockMs = 0,
): LegoTechnixSimulationStateV1 {
  const state = makeSimpleInitialState(wallClockMs);
  return {
    ...state,
    edgeStates: graph.connections.map((connection) => ({
      connectionId: connection.id,
      isActive: false,
      estimatedInletTemperatureC: temperatureC,
      estimatedOutletTemperatureC: temperatureC,
      transitDelayQueueC: [],
    })),
  };
}

function makeTickInput(
  wallClockMs = 1000,
  controlOverrides?: Readonly<Record<string, unknown>>,
  timestepSeconds = 1,
  domesticDrawOffDemands?: readonly DomesticDrawOffDemandV1[],
): LegoTechnixTickInputV1 {
  return {
    wallClockMs,
    timestepSeconds,
    controlOverrides,
    domesticDrawOffDemands,
  };
}

function findComponentState(
  state: LegoTechnixSimulationStateV1,
  componentId: string,
) {
  return state.componentStates.find((componentState) => componentState.componentId === componentId);
}

function findEdgeState(
  state: LegoTechnixSimulationStateV1,
  connectionId: string,
) {
  return state.edgeStates.find((edgeState) => edgeState.connectionId === connectionId);
}

function configureStratifiedStore(
  state: LegoTechnixSimulationStateV1,
  layerTemperaturesC: readonly number[],
  chargingMode: 'top_down' | 'bottom_coil' | 'mixed' = 'top_down',
): void {
  const store = findComponentState(state, 'stored_dhw_volume');
  if (!store || typeof store.volumeLitres !== 'number' || !(store.volumeLitres > 0)) {
    throw new Error('Stored water state missing volume.');
  }

  const layerVolumeLitres = store.volumeLitres / layerTemperaturesC.length;
  store.storageModel = 'stratified';
  store.chargingMode = chargingMode;
  store.stratificationLayers = layerTemperaturesC.map((temperatureC, layerIndex) => ({
    layerIndex,
    volumeLitres: layerVolumeLitres,
    temperatureC,
    usableAtTargetTemperature: temperatureC >= 40,
    confidence: 'derived',
  }));
  store.currentTemperatureC = (
    layerTemperaturesC.reduce((sum, temperatureC) => sum + temperatureC, 0)
    / layerTemperaturesC.length
  );
}

describe('runLegoTechnixTickV1 — state containers', () => {
  it('1. ComponentStateV1 is created for every graph component', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(),
    );
    expect(result.tickBlocked).toBe(false);
    const componentIds = simpleRegularBoilerGraph.components.map((c) => c.id);
    for (const id of componentIds) {
      expect(result.nextState.componentStates.some((s) => s.componentId === id)).toBe(true);
    }
  });

  it('2. EdgeStateV1 is created for every graph connection', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(),
    );
    const connectionIds = simpleRegularBoilerGraph.connections.map((c) => c.id);
    for (const id of connectionIds) {
      expect(result.nextState.edgeStates.some((s) => s.connectionId === id)).toBe(true);
    }
  });

  it('3. DomainStateV1 is created for every hydraulicDomain', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(),
    );
    const domainIds = (simpleRegularBoilerGraph.hydraulicDomains ?? []).map((d) => d.id);
    for (const id of domainIds) {
      expect(result.nextState.domainStates.some((s) => s.domainId === id)).toBe(true);
    }
  });
});

describe('runLegoTechnixTickV1 — tick lifecycle', () => {
  it('4. schemaVersion is always "1.0"', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(),
    );
    expect(result.nextState.schemaVersion).toBe('1.0');
  });

  describe('runLegoTechnixTickV1 — PR12 controls and S-plan demand', () => {
    it('21. room below target opens heating valve and calls boiler', () => {
      const initial = makeSPlanInitialState();
      const stored = findComponentState(initial, 'stored_dhw_volume');
      if (!stored) throw new Error('Stored DHW state missing.');
      stored.currentTemperatureC = 60;

      const result = runLegoTechnixTickV1(
        sPlanControlGraph,
        initial,
        makeTickInput(1000, undefined, 30),
      );

      expect(findComponentState(result.nextState, 'room_thermostat')?.controlDemandState).toBe('demanding');
      expect(findComponentState(result.nextState, 'heating_zone_valve')?.actuatorPosition).toBe('open');
      expect(findComponentState(result.nextState, 'cylinder_zone_valve')?.actuatorPosition).toBe('closed');
      expect(findComponentState(result.nextState, 'regular_boiler')?.operatingMode).toBe('running');
    });

    it('22. room above target closes heating demand', () => {
      const initial = makeSPlanInitialState();
      const room = findComponentState(initial, 'living_room');
      const stored = findComponentState(initial, 'stored_dhw_volume');
      if (!room || !stored) throw new Error('Expected room and cylinder state.');
      room.currentTemperatureC = 21;
      stored.currentTemperatureC = 60;

      const result = runLegoTechnixTickV1(
        sPlanControlGraph,
        initial,
        makeTickInput(1000, undefined, 30),
      );

      expect(findComponentState(result.nextState, 'room_thermostat')?.controlDemandState).toBe('none');
      expect(findComponentState(result.nextState, 'heating_zone_valve')?.actuatorPosition).toBe('closed');
      expect(findComponentState(result.nextState, 'regular_boiler')?.operatingMode).toBe('idle');
    });

    it('23. cylinder below target opens cylinder valve and calls boiler', () => {
      const initial = makeSPlanInitialState();
      const room = findComponentState(initial, 'living_room');
      if (!room) throw new Error('Room state missing.');
      room.currentTemperatureC = 20;

      const result = runLegoTechnixTickV1(
        sPlanControlGraph,
        initial,
        makeTickInput(1000, undefined, 30),
      );

      expect(findComponentState(result.nextState, 'cylinder_thermostat')?.controlDemandState).toBe('demanding');
      expect(findComponentState(result.nextState, 'cylinder_zone_valve')?.actuatorPosition).toBe('open');
      expect(findComponentState(result.nextState, 'heating_zone_valve')?.actuatorPosition).toBe('closed');
      expect(findComponentState(result.nextState, 'regular_boiler')?.operatingMode).toBe('running');
    });

    it('24. cylinder at target closes DHW demand', () => {
      const initial = makeSPlanInitialState();
      const room = findComponentState(initial, 'living_room');
      const stored = findComponentState(initial, 'stored_dhw_volume');
      if (!room || !stored) throw new Error('Expected room and cylinder state.');
      room.currentTemperatureC = 20;
      stored.currentTemperatureC = 60;

      const result = runLegoTechnixTickV1(
        sPlanControlGraph,
        initial,
        makeTickInput(1000, undefined, 30),
      );

      expect(findComponentState(result.nextState, 'cylinder_thermostat')?.controlDemandState).toBe('none');
      expect(findComponentState(result.nextState, 'cylinder_zone_valve')?.actuatorPosition).toBe('closed');
    });

    it('25. both calls can coexist in S-plan', () => {
      const result = runLegoTechnixTickV1(
        sPlanControlGraph,
        makeSPlanInitialState(),
        makeTickInput(1000, undefined, 30),
      );

      expect(findComponentState(result.nextState, 'heating_zone_valve')?.actuatorPosition).toBe('open');
      expect(findComponentState(result.nextState, 'cylinder_zone_valve')?.actuatorPosition).toBe('open');
      expect(findComponentState(result.nextState, 'regular_boiler')?.operatingMode).toBe('running');
      expect(
        result.nextState.edgeStates.some((edgeState) => (
          edgeState.connectionId === 'conn_heating_valve_to_radiator' && edgeState.isActive
        )),
      ).toBe(true);
      expect(
        result.nextState.edgeStates.some((edgeState) => (
          edgeState.connectionId === 'conn_cylinder_valve_to_coil' && edgeState.isActive
        )),
      ).toBe(true);
    });

    it('26. heat source demand comes from resolved control demand, not hardcoded model state', () => {
      const graph = cloneGraph(sPlanControlGraph);
      if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
      graph.heatSourceModels[0].controlDemandState = 'demanding';

      const initial = makeSPlanInitialState();
      const room = findComponentState(initial, 'living_room');
      const stored = findComponentState(initial, 'stored_dhw_volume');
      if (!room || !stored) throw new Error('Expected room and cylinder state.');
      room.currentTemperatureC = 21;
      stored.currentTemperatureC = 60;

      const result = runLegoTechnixTickV1(
        graph,
        initial,
        makeTickInput(1000, undefined, 30),
      );

      expect(findComponentState(result.nextState, 'regular_boiler')?.controlDemandState).toBe('none');
      expect(findComponentState(result.nextState, 'regular_boiler')?.operatingMode).toBe('idle');
    });
  });

  it('5. tickIndex increments by 1 each tick', () => {
    const initial = makeInitialState();
    const r1 = runLegoTechnixTickV1(simpleRegularBoilerGraph, initial, makeTickInput(1000));
    const r2 = runLegoTechnixTickV1(simpleRegularBoilerGraph, r1.nextState, makeTickInput(2000));
    expect(r1.nextState.tickIndex).toBe(1);
    expect(r2.nextState.tickIndex).toBe(2);
  });

  it('6. wallClockMs in nextState reflects tickInput value', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(42_000),
    );
    expect(result.nextState.wallClockMs).toBe(42_000);
  });
});

describe('runLegoTechnixTickV1 — immutability', () => {
  it('7. previousState is not mutated after a successful tick', () => {
    const initial = makeInitialState();
    const frozen = JSON.stringify(initial);
    runLegoTechnixTickV1(simpleRegularBoilerGraph, initial, makeTickInput());
    expect(JSON.stringify(initial)).toBe(frozen);
  });

  it('8. previousState is not mutated when tick is blocked', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.connections[0].sourceComponentId = 'does_not_exist';

    const initial = makeInitialState();
    const frozen = JSON.stringify(initial);
    runLegoTechnixTickV1(graph, initial, makeTickInput());
    expect(JSON.stringify(initial)).toBe(frozen);
  });

  it('9. nextState object is a new reference, not the same object as previousState', () => {
    const initial = makeInitialState();
    const result = runLegoTechnixTickV1(simpleRegularBoilerGraph, initial, makeTickInput());
    expect(result.nextState).not.toBe(initial);
  });
});

describe('runLegoTechnixTickV1 — pressure pre-flight gate', () => {
  it('10. invalid graph (missing component) blocks tick', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.connections[0].sourceComponentId = 'does_not_exist';

    const result = runLegoTechnixTickV1(graph, makeInitialState(), makeTickInput());
    expect(result.tickBlocked).toBe(true);
    expect(result.blockReason).toBeDefined();
    expect(result.blockReason).toContain('pressure_pre_flight_failed');
  });

  it('11. blocked tick returns previousState as nextState unchanged', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.connections[0].sourceComponentId = 'does_not_exist';

    const initial = makeInitialState();
    const result = runLegoTechnixTickV1(graph, initial, makeTickInput());
    expect(result.nextState).toBe(initial);
  });

  it('12. blocked tick has tickBlocked = true and valid result shape', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    graph.connections[0].sourceComponentId = 'does_not_exist';

    const result = runLegoTechnixTickV1(graph, makeInitialState(), makeTickInput());
    expect(result.tickBlocked).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('13. valid graph does not block tick', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(),
    );
    expect(result.tickBlocked).toBe(false);
    expect(result.blockReason).toBeUndefined();
  });

  it('14. open_vented static head below min blocks tick', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const openVented = graph.hydraulicDomains?.find(
      (d) => d.pressureRegime === 'open_vented_primary',
    );
    if (!openVented) throw new Error('Fixture open vented domain missing.');
    openVented.availableStaticHeadM = 0.1;
    openVented.minStaticHeadM = 2;

    const result = runLegoTechnixTickV1(graph, makeInitialState(), makeTickInput());
    expect(result.tickBlocked).toBe(true);
    expect(result.blockReason).toContain('pressure_pre_flight_failed');
  });
});

describe('runLegoTechnixTickV1 — determinism', () => {
  it('15. same inputs always produce identical nextState shape', () => {
    const input = makeTickInput(5000);
    const r1 = runLegoTechnixTickV1(simpleRegularBoilerGraph, makeInitialState(), input);
    const r2 = runLegoTechnixTickV1(simpleRegularBoilerGraph, makeInitialState(), input);
    expect(JSON.stringify(r1.nextState)).toBe(JSON.stringify(r2.nextState));
  });

  it('16. same inputs always produce identical events and warnings', () => {
    const input = makeTickInput(5000);
    const r1 = runLegoTechnixTickV1(simpleRegularBoilerGraph, makeInitialState(), input);
    const r2 = runLegoTechnixTickV1(simpleRegularBoilerGraph, makeInitialState(), input);
    expect(JSON.stringify(r1.events)).toBe(JSON.stringify(r2.events));
    expect(JSON.stringify(r1.warnings)).toBe(JSON.stringify(r2.warnings));
  });

  it('17. result shape is stable (no undefined top-level fields on success)', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(),
    );
    expect(result.nextState).toBeDefined();
    expect(result.events).toBeDefined();
    expect(result.warnings).toBeDefined();
    expect(result.tickBlocked).toBeDefined();
  });
});

describe('runLegoTechnixTickV1 — public contract stability', () => {
  it('18. tick can be called repeatedly without altering graph reference', () => {
    const graphFrozen = JSON.stringify(simpleRegularBoilerGraph);
    let state = makeInitialState();
    for (let i = 0; i < 5; i++) {
      const result = runLegoTechnixTickV1(simpleRegularBoilerGraph, state, makeTickInput(i * 1000));
      state = result.nextState;
    }
    expect(JSON.stringify(simpleRegularBoilerGraph)).toBe(graphFrozen);
  });

  it('19. componentStates array length matches graph components count', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(),
    );
    expect(result.nextState.componentStates.length).toBe(
      simpleRegularBoilerGraph.components.length,
    );
  });

  it('20. edgeStates array length matches graph connections count', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(),
    );
    expect(result.nextState.edgeStates.length).toBe(simpleRegularBoilerGraph.connections.length);
  });
});

describe('runLegoTechnixTickV1 — active hydraulic path resolution', () => {
  it('21. open heating valve activates heating branch and leaves bypass branch inactive', () => {
    const result = runLegoTechnixTickV1(
      branchingBypassGraph,
      makeInitialState(),
      makeTickInput(1000, {
        zone_valve: true,
        auto_bypass_valve: false,
      }),
    );

    expect(result.tickBlocked).toBe(false);
    expect(findEdgeState(result.nextState, 'conn_boiler_to_pump')?.isActive).toBe(true);
    expect(findEdgeState(result.nextState, 'conn_pump_to_split')?.isActive).toBe(true);
    expect(findEdgeState(result.nextState, 'conn_split_to_zone_valve')?.isActive).toBe(true);
    expect(findEdgeState(result.nextState, 'conn_zone_valve_to_radiator')?.isActive).toBe(true);
    expect(findEdgeState(result.nextState, 'conn_radiator_to_merge')?.isActive).toBe(true);
    expect(findEdgeState(result.nextState, 'conn_split_to_abv')?.isActive).toBe(false);
    expect(findEdgeState(result.nextState, 'conn_abv_to_bypass_load')?.isActive).toBe(false);
    expect(findEdgeState(result.nextState, 'conn_bypass_load_to_merge')?.isActive).toBe(false);
    expect(findComponentState(result.nextState, 'radiator_emitter')?.isActive).toBe(true);
    expect(findComponentState(result.nextState, 'bypass_load')?.isActive).toBe(false);
    expect(result.warnings.some((warning) => warning.code === 'deadhead_detected')).toBe(false);
  });

  it('22. closing heating valve and opening bypass restores continuity deterministically', () => {
    const input = makeTickInput(2000, {
      zone_valve: false,
      auto_bypass_valve: true,
    });

    const first = runLegoTechnixTickV1(branchingBypassGraph, makeInitialState(), input);
    const second = runLegoTechnixTickV1(branchingBypassGraph, makeInitialState(), input);

    expect(JSON.stringify(first.nextState)).toBe(JSON.stringify(second.nextState));
    expect(findEdgeState(first.nextState, 'conn_split_to_zone_valve')?.isActive).toBe(false);
    expect(findEdgeState(first.nextState, 'conn_zone_valve_to_radiator')?.isActive).toBe(false);
    expect(findEdgeState(first.nextState, 'conn_radiator_to_merge')?.isActive).toBe(false);
    expect(findEdgeState(first.nextState, 'conn_split_to_abv')?.isActive).toBe(true);
    expect(findEdgeState(first.nextState, 'conn_abv_to_bypass_load')?.isActive).toBe(true);
    expect(findEdgeState(first.nextState, 'conn_bypass_load_to_merge')?.isActive).toBe(true);
    expect(findComponentState(first.nextState, 'bypass_load')?.isActive).toBe(true);
    expect(findComponentState(first.nextState, 'radiator_emitter')?.operatingMode).toBe('bypassed');
    expect(first.warnings.some((warning) => warning.code === 'deadhead_detected')).toBe(false);
  });

  it('23. closing both branches deadheads the pump and blocks all primary flow', () => {
    const result = runLegoTechnixTickV1(
      branchingBypassGraph,
      makeInitialState(),
      makeTickInput(3000, {
        zone_valve: false,
        auto_bypass_valve: false,
      }),
    );

    expect(result.tickBlocked).toBe(false);
    for (const connectionId of [
      'conn_boiler_to_pump',
      'conn_pump_to_split',
      'conn_split_to_zone_valve',
      'conn_zone_valve_to_radiator',
      'conn_radiator_to_merge',
      'conn_split_to_abv',
      'conn_abv_to_bypass_load',
      'conn_bypass_load_to_merge',
      'conn_merge_to_filter',
      'conn_filter_to_boiler',
    ]) {
      expect(findEdgeState(result.nextState, connectionId)?.isActive).toBe(false);
    }
    expect(findComponentState(result.nextState, 'circulation_pump')?.operatingMode).toBe('fault');
    expect(result.warnings.some((warning) => (
      warning.code === 'deadhead_detected' && warning.componentId === 'circulation_pump'
    ))).toBe(true);
  });

  it('24. active-path resolution keeps graph immutable and component temperatures unset', () => {
    const graph = cloneGraph(branchingBypassGraph);
    const frozenGraph = JSON.stringify(graph);

    const result = runLegoTechnixTickV1(
      graph,
      makeInitialState(),
      makeTickInput(4000, {
        zone_valve: true,
        auto_bypass_valve: false,
      }),
    );

    expect(JSON.stringify(graph)).toBe(frozenGraph);
    expect(result.nextState.componentStates.every((componentState) => (
      componentState.measuredTemperatureC === undefined
    ))).toBe(true);
  });
});

describe('runLegoTechnixTickV1 — mass-flow allocation skeleton', () => {
  it('25. active single loop receives non-zero flow estimates', () => {
    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeInitialState(),
      makeTickInput(),
    );

    const activeEdges = result.nextState.edgeStates.filter((edgeState) => edgeState.isActive);
    expect(activeEdges.length).toBeGreaterThan(0);
    expect(activeEdges.every((edgeState) => (edgeState.estimatedFlowLps ?? 0) > 0)).toBe(true);
    expect(activeEdges.every((edgeState) => edgeState.estimatedFlowKgPerS === edgeState.estimatedFlowLps)).toBe(true);
  });

  it('26. closed branch receives zero flow', () => {
    const result = runLegoTechnixTickV1(
      branchingBypassGraph,
      makeInitialState(),
      makeTickInput(1000, {
        zone_valve: true,
        auto_bypass_valve: false,
      }),
    );

    expect(findEdgeState(result.nextState, 'conn_abv_to_bypass_load')?.estimatedFlowLps).toBe(0);
    expect(findEdgeState(result.nextState, 'conn_bypass_load_to_merge')?.estimatedFlowLps).toBe(0);
  });

  it('27. bypass branch receives flow when active', () => {
    const result = runLegoTechnixTickV1(
      branchingBypassGraph,
      makeInitialState(),
      makeTickInput(1000, {
        zone_valve: false,
        auto_bypass_valve: true,
      }),
    );

    expect((findEdgeState(result.nextState, 'conn_split_to_abv')?.estimatedFlowLps ?? 0)).toBeGreaterThan(0);
    expect((findEdgeState(result.nextState, 'conn_abv_to_bypass_load')?.estimatedFlowLps ?? 0)).toBeGreaterThan(0);
    expect((findEdgeState(result.nextState, 'conn_bypass_load_to_merge')?.estimatedFlowLps ?? 0)).toBeGreaterThan(0);
  });

  it('28. parallel active branches split deterministically by resistance assumptions', () => {
    const input = makeTickInput(1000, {
      zone_valve: true,
      auto_bypass_valve: true,
    });

    const first = runLegoTechnixTickV1(branchingBypassGraph, makeInitialState(), input);
    const second = runLegoTechnixTickV1(branchingBypassGraph, makeInitialState(), input);

    const heatingBranchFlow = findEdgeState(first.nextState, 'conn_zone_valve_to_radiator')?.estimatedFlowLps ?? 0;
    const bypassBranchFlow = findEdgeState(first.nextState, 'conn_abv_to_bypass_load')?.estimatedFlowLps ?? 0;

    expect(heatingBranchFlow).toBeGreaterThan(0);
    expect(bypassBranchFlow).toBeGreaterThan(0);
    expect(heatingBranchFlow).not.toBe(bypassBranchFlow);
    expect(JSON.stringify(first.nextState.edgeStates)).toBe(JSON.stringify(second.nextState.edgeStates));
  });

  it('29. merged return flow equals sum of active return branches', () => {
    const result = runLegoTechnixTickV1(
      branchingBypassGraph,
      makeInitialState(),
      makeTickInput(1000, {
        zone_valve: true,
        auto_bypass_valve: true,
      }),
    );

    const mergeFlow = findEdgeState(result.nextState, 'conn_merge_to_filter')?.estimatedFlowLps ?? 0;
    const heatingReturnFlow = findEdgeState(result.nextState, 'conn_radiator_to_merge')?.estimatedFlowLps ?? 0;
    const bypassReturnFlow = findEdgeState(result.nextState, 'conn_bypass_load_to_merge')?.estimatedFlowLps ?? 0;

    expect(mergeFlow).toBeCloseTo(heatingReturnFlow + bypassReturnFlow, 3);
  });

  it('30. no heat-transfer contracts keeps edge temperatures unset', () => {
    const result = runLegoTechnixTickV1(
      branchingBypassGraph,
      makeInitialState(),
      makeTickInput(1000, {
        zone_valve: true,
        auto_bypass_valve: true,
      }),
    );

    expect(result.nextState.edgeStates.every((edgeState) => (
      edgeState.estimatedInletTemperatureC === undefined
      && edgeState.estimatedOutletTemperatureC === undefined
    ))).toBe(true);
  });

  describe('runLegoTechnixTickV1 — thermal integration', () => {
    it('31. radiator heat transfer raises room temperature over a tick', () => {
      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        makeSimpleInitialState(),
        makeTickInput(1000, {
          zone_valve: true,
          regular_boiler: { demand: true },
        }, 3600),
      );

      const roomState = findComponentState(result.nextState, 'living_room');
      expect((roomState?.currentTemperatureC ?? 0)).toBeGreaterThan(18);
    });

    it('32. room heat loss reduces net gain when outside is colder', () => {
      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        makeSimpleInitialState(),
        makeTickInput(1000, {
          zone_valve: true,
          regular_boiler: { demand: true },
        }, 3600),
      );

      const roomState = findComponentState(result.nextState, 'living_room');
      expect(roomState?.heatGainKw).toBeCloseTo(3.2, 3);
      expect((roomState?.heatLossKw ?? 0)).toBeGreaterThan(0);
      expect((roomState?.netHeatKw ?? 0)).toBeLessThan(roomState?.heatGainKw ?? 0);
    });

    it('33. room state is unchanged when radiator branch inactive', () => {
      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        makeSimpleInitialState(),
        makeTickInput(1000, {
          zone_valve: false,
        }, 3600),
      );

      const roomState = findComponentState(result.nextState, 'living_room');
      expect(roomState?.currentTemperatureC).toBe(18);
      expect(roomState?.heatGainKw).toBe(0);
      expect(roomState?.netHeatKw).toBe(0);
    });

    it('34. cylinder coil heat transfer raises stored-water temperature', () => {
      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        makeSimpleInitialState(),
        makeTickInput(1000, {
          zone_valve: true,
          regular_boiler: { demand: true },
        }, 3600),
      );

      const storeState = findComponentState(result.nextState, 'stored_dhw_volume');
      expect((storeState?.currentTemperatureC ?? 0)).toBeGreaterThan(45);
    });

    it('35. stored-water temperature update uses 1.16 Wh/L/K conversion', () => {
      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        makeSimpleInitialState(),
        makeTickInput(1000, {
          zone_valve: true,
          regular_boiler: { demand: true },
        }, 3600),
      );

      const storeState = findComponentState(result.nextState, 'stored_dhw_volume');
      const expectedTemp = 45 + (2.1 / ((150 * 1.16) / 1000));
      expect(storeState?.currentTemperatureC).toBeCloseTo(expectedTemp, 3);
    });

    it('36. missing room thermal mass emits warning, not fatal error', () => {
      const initial = makeSimpleInitialState();
      const roomState = initial.componentStates.find((state) => state.componentId === 'living_room');
      if (!roomState) {
        throw new Error('Fixture room state missing.');
      }
      delete (roomState as { thermalMassKwhPerK?: number }).thermalMassKwhPerK;

      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        initial,
        makeTickInput(1000, { zone_valve: true, regular_boiler: { demand: true } }, 3600),
      );

      expect(result.tickBlocked).toBe(false);
      expect(result.warnings.some((warning) => warning.code === 'room_thermal_mass_missing')).toBe(true);
    });

    it('37. missing stored-water volume emits warning, not fatal error', () => {
      const initial = makeSimpleInitialState();
      const storeState = initial.componentStates.find((state) => state.componentId === 'stored_dhw_volume');
      if (!storeState) {
        throw new Error('Fixture stored-water state missing.');
      }
      delete (storeState as { volumeLitres?: number }).volumeLitres;

      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        initial,
        makeTickInput(1000, { zone_valve: true, regular_boiler: { demand: true } }, 3600),
      );

      expect(result.tickBlocked).toBe(false);
      expect(result.warnings.some((warning) => warning.code === 'stored_water_volume_missing')).toBe(true);
    });

    it('38. domestic draw-off lowers stored-water temperature and energy', () => {
      const initial = makeSimpleInitialState();
      const storeState = findComponentState(initial, 'stored_dhw_volume');
      if (!storeState) throw new Error('Stored water state missing.');
      storeState.currentTemperatureC = 60;
      storeState.storedEnergyKwh = 10.44;

      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        initial,
        makeTickInput(
          1000,
          undefined,
          600,
          [{
            drawOffComponentId: 'domestic_hot_draw_off',
            drawOffFlowLpm: 10,
            mixedOutletTargetTemperatureC: 40,
            coldInletTemperatureC: 10,
          }],
        ),
      );

      const nextStore = findComponentState(result.nextState, 'stored_dhw_volume');
      expect((nextStore?.currentTemperatureC ?? 0)).toBeLessThan(60);
      expect((nextStore?.storedEnergyKwh ?? 0)).toBeLessThan(10.44);
      expect(result.events.some((event) => event.type === 'domestic_draw_off_applied')).toBe(true);
    });

    it('39. no draw-off leaves stored water unchanged when no coil gain and no standing loss', () => {
      const initial = makeSimpleInitialState();
      const storeState = findComponentState(initial, 'stored_dhw_volume');
      if (!storeState) throw new Error('Stored water state missing.');
      storeState.currentTemperatureC = 52;
      storeState.standingLossKw = 0;

      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        initial,
        makeTickInput(1000, undefined, 600),
      );

      const nextStore = findComponentState(result.nextState, 'stored_dhw_volume');
      expect(nextStore?.currentTemperatureC).toBeCloseTo(52, 3);
      expect(nextStore?.storedEnergyKwh).toBeCloseTo((150 * 1.16 * 52) / 1000, 3);
    });

    it('40. colder inlet water causes larger stored-water temperature drop for same draw', () => {
      const coldInletInitial = makeSimpleInitialState();
      const warmInletInitial = makeSimpleInitialState();
      const coldStore = findComponentState(coldInletInitial, 'stored_dhw_volume');
      const warmStore = findComponentState(warmInletInitial, 'stored_dhw_volume');
      if (!coldStore || !warmStore) throw new Error('Stored water state missing.');
      coldStore.currentTemperatureC = 60;
      warmStore.currentTemperatureC = 60;

      const baseDemand = {
        drawOffComponentId: 'domestic_hot_draw_off',
        drawOffFlowLpm: 6,
        mixedOutletTargetTemperatureC: 40,
      };
      const coldResult = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        coldInletInitial,
        makeTickInput(1000, undefined, 600, [{ ...baseDemand, coldInletTemperatureC: 5 }]),
      );
      const warmResult = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        warmInletInitial,
        makeTickInput(1000, undefined, 600, [{ ...baseDemand, coldInletTemperatureC: 15 }]),
      );

      const coldResultStore = findComponentState(coldResult.nextState, 'stored_dhw_volume');
      const warmResultStore = findComponentState(warmResult.nextState, 'stored_dhw_volume');
      expect((coldResultStore?.currentTemperatureC ?? 0)).toBeLessThan(warmResultStore?.currentTemperatureC ?? 0);
    });

    it('41. high draw-off can exhaust usable 40°C stored volume', () => {
      const initial = makeSimpleInitialState();
      const storeState = findComponentState(initial, 'stored_dhw_volume');
      if (!storeState) throw new Error('Stored water state missing.');
      storeState.currentTemperatureC = 45;

      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        initial,
        makeTickInput(
          1000,
          undefined,
          1800,
          [{
            drawOffComponentId: 'domestic_hot_draw_off',
            drawOffFlowLpm: 20,
            mixedOutletTargetTemperatureC: 40,
            coldInletTemperatureC: 10,
          }],
        ),
      );

      const nextStore = findComponentState(result.nextState, 'stored_dhw_volume');
      expect(nextStore?.usableHotWaterLitresAt40C).toBe(0);
      expect((nextStore?.currentTemperatureC ?? 0)).toBeLessThanOrEqual(10);
    });

    it('42. draw-off does not mix domestic and primary domains', () => {
      const initial = makeSimpleInitialState();
      const baselineResult = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        initial,
        makeTickInput(1000, undefined, 600),
      );
      const drawOffResult = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        makeSimpleInitialState(),
        makeTickInput(
          1000,
          undefined,
          600,
          [{
            drawOffComponentId: 'domestic_hot_draw_off',
            drawOffFlowLpm: 8,
            mixedOutletTargetTemperatureC: 40,
            coldInletTemperatureC: 10,
          }],
        ),
      );

      expect(findComponentState(drawOffResult.nextState, 'regular_boiler')?.operatingMode)
        .toBe(findComponentState(baselineResult.nextState, 'regular_boiler')?.operatingMode);
      expect(findEdgeState(drawOffResult.nextState, 'conn_boiler_to_pump')?.isActive)
        .toBe(findEdgeState(baselineResult.nextState, 'conn_boiler_to_pump')?.isActive);
      expect(drawOffResult.warnings.some((warning) => warning.code === 'domestic_draw_off_store_unmapped'))
        .toBe(false);
    });

    it('38. previousState is not mutated', () => {
      const initial = makeSimpleInitialState();
      const frozen = JSON.stringify(initial);
      runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        initial,
        makeTickInput(1000, { zone_valve: true, regular_boiler: { demand: true } }, 3600),
      );
      expect(JSON.stringify(initial)).toBe(frozen);
    });

    it('39. blocked tick does not integrate thermal state', () => {
      const graph = cloneGraph(simpleRegularBoilerGraph);
      graph.connections[0].sourceComponentId = 'does_not_exist';
      const initial = makeSimpleInitialState();

      const result = runLegoTechnixTickV1(
        graph,
        initial,
        makeTickInput(1000, { zone_valve: true, regular_boiler: { demand: true } }, 3600),
      );

      expect(result.tickBlocked).toBe(true);
      expect(result.nextState).toBe(initial);
    });

    it('40. two identical ticks produce deterministic results', () => {
      const input = makeTickInput(1000, { zone_valve: true, regular_boiler: { demand: true } }, 3600);
      const first = runLegoTechnixTickV1(simpleRegularBoilerGraph, makeSimpleInitialState(), input);
      const second = runLegoTechnixTickV1(simpleRegularBoilerGraph, makeSimpleInitialState(), input);
      expect(JSON.stringify(first.nextState)).toBe(JSON.stringify(second.nextState));
      expect(JSON.stringify(first.events)).toBe(JSON.stringify(second.events));
      expect(JSON.stringify(first.warnings)).toBe(JSON.stringify(second.warnings));
    });

    it('41. boiler is off when there is no control demand', () => {
      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        makeSimpleInitialState(),
        makeTickInput(1000, { zone_valve: true }, 30),
      );

      const boilerState = findComponentState(result.nextState, 'regular_boiler');
      expect(boilerState?.operatingMode).toBe('idle');
      expect(boilerState?.controlDemandState).toBe('none');
      expect(boilerState?.heatGainKw).toBe(0);
    });

    it('42. boiler is held off when demand exists but no active path exists', () => {
      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        makeSimpleInitialState(),
        makeTickInput(1000, {
          zone_valve: false,
          regular_boiler: { demand: true },
        }, 30),
      );

      const boilerState = findComponentState(result.nextState, 'regular_boiler');
      expect(boilerState?.operatingMode).toBe('idle');
      expect(result.warnings.some((warning) => warning.code === 'heat_source_no_active_path')).toBe(true);
    });

    it('43. boiler raises primary flow temperature during demand using ramp-rate limits', () => {
      const initial = makeSimpleInitialState();
      initial.componentStates.push({
        componentId: 'regular_boiler',
        isActive: false,
        operatingMode: 'idle',
        currentTemperatureC: 45,
        returnTemperatureC: 45,
      });

      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        initial,
        makeTickInput(1000, {
          zone_valve: true,
          regular_boiler: { demand: true },
        }, 10),
      );

      const boilerState = findComponentState(result.nextState, 'regular_boiler');
      expect(boilerState?.currentTemperatureC).toBeCloseTo(47.5, 3);
      expect((boilerState?.currentTemperatureC ?? 0)).toBeLessThan(boilerState?.targetFlowTemperatureC ?? 0);
      expect(findEdgeState(result.nextState, 'conn_boiler_to_pump')?.estimatedOutletTemperatureC).toBeCloseTo(47.5, 2);
    });

    it('44. return temperature drives condensing likelihood', () => {
      const initial = makeSimpleInitialState();
      initial.componentStates.push({
        componentId: 'regular_boiler',
        isActive: false,
        operatingMode: 'idle',
        currentTemperatureC: 50,
        returnTemperatureC: 45,
      });

      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        initial,
        makeTickInput(1000, {
          zone_valve: true,
          regular_boiler: { demand: true },
        }, 30),
      );

      const boilerState = findComponentState(result.nextState, 'regular_boiler');
      expect(boilerState?.returnTemperatureC).toBeLessThan(55);
      expect(boilerState?.condensingLikely).toBe(true);
    });

    it('45. low load versus minimum stable output flags cycling risk', () => {
      const result = runLegoTechnixTickV1(
        simpleRegularBoilerGraph,
        makeSimpleInitialState(),
        makeTickInput(1000, {
          zone_valve: true,
          regular_boiler: { demand: true },
        }, 30),
      );

      const boilerState = findComponentState(result.nextState, 'regular_boiler');
      expect(boilerState?.cyclingRisk).toBe(true);
      expect(result.warnings.some((warning) => warning.code === 'heat_source_cycling_risk')).toBe(true);
    });
  });
});

describe('runLegoTechnixTickV1 — PR19 heat pump and weather compensation', () => {
  function runDemandTick(
    graph: LegoTechnixGraphV1,
    initial = makeSimpleInitialState(),
  ) {
    return runLegoTechnixTickV1(
      graph,
      initial,
      makeTickInput(1000, {
        zone_valve: true,
        regular_boiler: { demand: true },
      }, 30),
    );
  }

  it('46. colder outside temperature raises weather-compensated target flow', () => {
    const coldGraph = cloneGraph(simpleRegularBoilerGraph);
    const mildGraph = cloneGraph(simpleRegularBoilerGraph);
    if (!coldGraph.heatSourceModels?.[0] || !mildGraph.heatSourceModels?.[0]) {
      throw new Error('Heat source model missing.');
    }

    for (const graph of [coldGraph, mildGraph]) {
      graph.heatSourceModels[0].weatherCompensationEnabled = true;
      graph.heatSourceModels[0].weatherCompensation = {
        enabled: true,
        outsideTemperatureSourceComponentId: 'outside_air',
        designOutsideTemperatureC: -3,
        mildOutsideTemperatureC: 15,
        targetFlowAtDesignC: 65,
        targetFlowAtMildC: 40,
        confidence: 'assumed',
      };
    }

    const coldInitial = makeSimpleInitialState();
    const mildInitial = makeSimpleInitialState();
    const coldOutside = findComponentState(coldInitial, 'outside_air');
    const mildOutside = findComponentState(mildInitial, 'outside_air');
    if (!coldOutside || !mildOutside) throw new Error('Outside air state missing.');
    coldOutside.currentTemperatureC = -3;
    mildOutside.currentTemperatureC = 12;

    const coldResult = runDemandTick(coldGraph, coldInitial);
    const mildResult = runDemandTick(mildGraph, mildInitial);
    const coldState = findComponentState(coldResult.nextState, 'regular_boiler');
    const mildState = findComponentState(mildResult.nextState, 'regular_boiler');

    expect((coldState?.targetFlowTemperatureC ?? 0)).toBeGreaterThan(mildState?.targetFlowTemperatureC ?? 0);
  });

  it('47. milder outside temperature lowers weather-compensated target flow', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
    graph.heatSourceModels[0].weatherCompensationEnabled = true;
    graph.heatSourceModels[0].weatherCompensation = {
      enabled: true,
      outsideTemperatureSourceComponentId: 'outside_air',
      designOutsideTemperatureC: -2,
      mildOutsideTemperatureC: 14,
      targetFlowAtDesignC: 62,
      targetFlowAtMildC: 38,
      confidence: 'assumed',
    };

    const coldInitial = makeSimpleInitialState();
    const mildInitial = makeSimpleInitialState();
    const coldOutside = findComponentState(coldInitial, 'outside_air');
    const mildOutside = findComponentState(mildInitial, 'outside_air');
    if (!coldOutside || !mildOutside) throw new Error('Outside air state missing.');
    coldOutside.currentTemperatureC = 0;
    mildOutside.currentTemperatureC = 12;

    const coldResult = runDemandTick(graph, coldInitial);
    const mildResult = runDemandTick(graph, mildInitial);
    expect(
      (findComponentState(coldResult.nextState, 'regular_boiler')?.targetFlowTemperatureC ?? 0),
    ).toBeGreaterThan(findComponentState(mildResult.nextState, 'regular_boiler')?.targetFlowTemperatureC ?? 0);
  });

  it('48. weather-compensated target flow clamps to min/max', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
    graph.heatSourceModels[0].weatherCompensationEnabled = true;
    graph.heatSourceModels[0].weatherCompensation = {
      enabled: true,
      outsideTemperatureSourceComponentId: 'outside_air',
      designOutsideTemperatureC: -5,
      mildOutsideTemperatureC: 15,
      targetFlowAtDesignC: 70,
      targetFlowAtMildC: 30,
      minTargetFlowTemperatureC: 42,
      maxTargetFlowTemperatureC: 58,
      confidence: 'assumed',
    };

    const coldInitial = makeSimpleInitialState();
    const warmInitial = makeSimpleInitialState();
    const coldOutside = findComponentState(coldInitial, 'outside_air');
    const warmOutside = findComponentState(warmInitial, 'outside_air');
    if (!coldOutside || !warmOutside) throw new Error('Outside air state missing.');
    coldOutside.currentTemperatureC = -15;
    warmOutside.currentTemperatureC = 22;

    const coldState = findComponentState(runDemandTick(graph, coldInitial).nextState, 'regular_boiler');
    const warmState = findComponentState(runDemandTick(graph, warmInitial).nextState, 'regular_boiler');
    expect(coldState?.targetFlowTemperatureC).toBe(58);
    expect(warmState?.targetFlowTemperatureC).toBe(42);
  });

  it('49. missing outside temperature emits warning and falls back to configured target', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
    graph.heatSourceModels[0].weatherCompensationEnabled = true;
    graph.heatSourceModels[0].targetFlowTemperatureC = 68;
    graph.heatSourceModels[0].weatherCompensation = {
      enabled: true,
      outsideTemperatureSourceComponentId: 'outside_air_missing',
      designOutsideTemperatureC: -3,
      mildOutsideTemperatureC: 15,
      targetFlowAtDesignC: 64,
      targetFlowAtMildC: 38,
      confidence: 'assumed',
    };

    const result = runDemandTick(graph);
    const boilerState = findComponentState(result.nextState, 'regular_boiler');
    expect(result.warnings.some((warning) => warning.code === 'weather_comp_outside_temperature_missing')).toBe(true);
    expect(boilerState?.targetFlowTemperatureC).toBe(68);
  });

  it('50. heat pump exposes estimated COP bands by target-flow range', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
    graph.heatSourceModels[0].heatSourceType = 'heat_pump';

    graph.heatSourceModels[0].targetFlowTemperatureC = 35;
    const highState = findComponentState(runDemandTick(graph).nextState, 'regular_boiler');
    graph.heatSourceModels[0].targetFlowTemperatureC = 45;
    const normalState = findComponentState(runDemandTick(graph).nextState, 'regular_boiler');
    graph.heatSourceModels[0].targetFlowTemperatureC = 55;
    const reducedState = findComponentState(runDemandTick(graph).nextState, 'regular_boiler');
    graph.heatSourceModels[0].targetFlowTemperatureC = 60;
    const poorState = findComponentState(runDemandTick(graph).nextState, 'regular_boiler');

    expect(highState?.estimatedCopBand).toBe('high');
    expect(normalState?.estimatedCopBand).toBe('normal');
    expect(reducedState?.estimatedCopBand).toBe('reduced');
    expect(poorState?.estimatedCopBand).toBe('poor');
  });

  it('51. high heat-pump target flow emits efficiency warning', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
    graph.heatSourceModels[0].heatSourceType = 'heat_pump';
    graph.heatSourceModels[0].targetFlowTemperatureC = 60;

    const result = runDemandTick(graph);
    expect(result.warnings.some((warning) => warning.code === 'heat_pump_target_flow_high_temperature')).toBe(true);
  });

  it('52. weather-compensated gas boiler uses calculated target flow', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const initial = makeSimpleInitialState();
    if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
    graph.heatSourceModels[0].heatSourceType = 'gas_boiler';
    graph.heatSourceModels[0].weatherCompensationEnabled = true;
    graph.heatSourceModels[0].weatherCompensation = {
      enabled: true,
      outsideTemperatureSourceComponentId: 'outside_air',
      designOutsideTemperatureC: -3,
      mildOutsideTemperatureC: 15,
      targetFlowAtDesignC: 66,
      targetFlowAtMildC: 42,
      confidence: 'assumed',
    };
    const outside = findComponentState(initial, 'outside_air');
    if (!outside) throw new Error('Outside air state missing.');
    outside.currentTemperatureC = 6;

    const result = runDemandTick(graph, initial);
    const boilerState = findComponentState(result.nextState, 'regular_boiler');
    expect(boilerState?.calculatedTargetFlowTemperatureC).toBe(54);
    expect(boilerState?.targetFlowTemperatureC).toBe(54);
  });

  it('53. runtime return temperature overrides fallback condensing estimate', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
    graph.heatSourceModels[0].targetFlowTemperatureC = 80;
    graph.heatSourceModels[0].returnTemperatureC = 75;
    graph.heatSourceModels[0].heatSourceType = 'gas_boiler';
    graph.heatTransferComponents = (graph.heatTransferComponents ?? []).map((contract) => {
      if (contract.family !== 'radiator' && contract.family !== 'cylinder_coil') {
        return contract;
      }
      return {
        ...contract,
        output: {
          ...contract.output,
          energyTransfer: {
            ...contract.output.energyTransfer,
            primaryEnergyRemovedKw: contract.family === 'radiator' ? 18 : 8,
            secondaryEnergyGainedKw: contract.family === 'radiator' ? 18 : 8,
          },
        },
      };
    });

    const result = runDemandTick(graph);
    const boilerState = findComponentState(result.nextState, 'regular_boiler');
    const fallbackCondensingLikely = (graph.heatSourceModels[0].targetFlowTemperatureC - 20) < 55;
    expect(fallbackCondensingLikely).toBe(false);
    expect(boilerState?.condensingLikely).toBe(true);
    expect(boilerState?.condensingConfidence).toBe('derived');
  });

  it('54. low-temperature emitter output shortfall warning appears when output cannot meet room heat loss', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const initial = makeSimpleInitialState();
    const room = findComponentState(initial, 'living_room');
    if (!graph.heatSourceModels?.[0] || !room) throw new Error('Required state missing.');
    graph.heatSourceModels[0].heatSourceType = 'heat_pump';
    graph.heatSourceModels[0].targetFlowTemperatureC = 35;
    room.heatLossKwPerK = 1.1;
    room.targetTemperatureC = 21;

    const result = runDemandTick(graph, initial);
    const boilerState = findComponentState(result.nextState, 'regular_boiler');
    expect(result.warnings.some((warning) => warning.code === 'low_temperature_emitter_output_shortfall')).toBe(true);
    expect(boilerState?.lowTemperatureEmitterSuitability?.status).toBe('shortfall');
  });

  it('55. heat pump outputs COP band only with no exact COP claim', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
    graph.heatSourceModels[0].heatSourceType = 'heat_pump';
    graph.heatSourceModels[0].targetFlowTemperatureC = 42;

    const result = runDemandTick(graph);
    const boilerState = findComponentState(result.nextState, 'regular_boiler');
    const combinedMessages = [...result.events, ...result.warnings].map((entry) => entry.message).join(' ');
    expect(boilerState?.estimatedCopBand).toBe('normal');
    expect(boilerState?.estimatedCop).toBeUndefined();
    expect(combinedMessages).not.toMatch(/\bCOP\s*\d/);
  });
});

describe('runLegoTechnixTickV1 — PR13 pipe transit delay and heat loss', () => {
  it('46. long primary pipe delays heat arrival versus short pipe', () => {
    const shortGraph = cloneGraph(simpleRegularBoilerGraph);
    const longGraph = cloneGraph(simpleRegularBoilerGraph);
    const shortEdge = shortGraph.connections.find((connection) => connection.id === 'conn_boiler_to_pump');
    const longEdge = longGraph.connections.find((connection) => connection.id === 'conn_boiler_to_pump');
    if (!shortEdge || !longEdge) {
      throw new Error('Fixture pipe edge missing.');
    }
    shortEdge.physical.lengthM = 0.1;
    longEdge.physical.lengthM = 30;

    const shortResult = runLegoTechnixTickV1(
      shortGraph,
      makeSimpleInitialStateWithEdgeTemperature(shortGraph, 20),
      makeTickInput(1000, {
        zone_valve: true,
        regular_boiler: { demand: true },
      }, 3600),
    );
    const longResult = runLegoTechnixTickV1(
      longGraph,
      makeSimpleInitialStateWithEdgeTemperature(longGraph, 20),
      makeTickInput(1000, {
        zone_valve: true,
        regular_boiler: { demand: true },
      }, 3600),
    );

    const shortCoil = findComponentState(shortResult.nextState, 'cylinder_coil_exchanger');
    const longCoil = findComponentState(longResult.nextState, 'cylinder_coil_exchanger');
    expect(shortCoil?.lastPrimaryInletTemperatureC ?? 0).toBeGreaterThan(longCoil?.lastPrimaryInletTemperatureC ?? 0);
  });

  it('47. uninsulated pipe loses more heat than insulated pipe at exchanger inlet', () => {
    const insulatedGraph = cloneGraph(simpleRegularBoilerGraph);
    const uninsulatedGraph = cloneGraph(simpleRegularBoilerGraph);
    insulatedGraph.heatTransferComponents = (insulatedGraph.heatTransferComponents ?? [])
      .filter((contract) => contract.componentId !== 'cylinder_coil_exchanger');
    uninsulatedGraph.heatTransferComponents = (uninsulatedGraph.heatTransferComponents ?? [])
      .filter((contract) => contract.componentId !== 'cylinder_coil_exchanger');

    for (const graph of [insulatedGraph, uninsulatedGraph]) {
      for (const connection of graph.connections) {
        if (connection.domain === 'primary_heating') {
          connection.physical.lengthM = 0.1;
        }
      }
    }

    const insulatedEdge = insulatedGraph.connections.find((connection) => connection.id === 'conn_coil_to_radiator');
    const uninsulatedEdge = uninsulatedGraph.connections.find((connection) => connection.id === 'conn_coil_to_radiator');
    if (!insulatedEdge || !uninsulatedEdge) {
      throw new Error('Fixture coil-to-radiator edge missing.');
    }
    insulatedEdge.physical.lengthM = 10;
    insulatedEdge.physical.insulationState = 'insulated';
    insulatedEdge.physical.simpleHeatLossWPerM = 2;
    uninsulatedEdge.physical.lengthM = 10;
    uninsulatedEdge.physical.insulationState = 'uninsulated';
    uninsulatedEdge.physical.simpleHeatLossWPerM = 20;

    const insulatedResult = runLegoTechnixTickV1(
      insulatedGraph,
      makeSimpleInitialStateWithEdgeTemperature(insulatedGraph, 20),
      makeTickInput(1000, {
        zone_valve: true,
        regular_boiler: { demand: true },
      }, 3600),
    );
    const uninsulatedResult = runLegoTechnixTickV1(
      uninsulatedGraph,
      makeSimpleInitialStateWithEdgeTemperature(uninsulatedGraph, 20),
      makeTickInput(1000, {
        zone_valve: true,
        regular_boiler: { demand: true },
      }, 3600),
    );

    const insulatedRadiator = findComponentState(insulatedResult.nextState, 'radiator_emitter');
    const uninsulatedRadiator = findComponentState(uninsulatedResult.nextState, 'radiator_emitter');
    expect(insulatedRadiator?.lastPrimaryInletTemperatureC ?? 0)
      .toBeGreaterThan(uninsulatedRadiator?.lastPrimaryInletTemperatureC ?? 0);
  });

  it('48. inactive edge does not advance thermal queue', () => {
    const connectionId = 'conn_boiler_to_pump';
    const result = evaluatePipeEdgesV1(
      simpleRegularBoilerGraph,
      [],
      [
        {
          connectionId,
          isActive: false,
          estimatedInletTemperatureC: 30,
          estimatedOutletTemperatureC: 29,
          transitDelayQueueC: [50, 49],
        },
      ],
      [
        {
          connectionId,
          isActive: false,
          estimatedFlowKgPerS: 0,
          estimatedVelocityMps: 0.5,
        },
      ],
      {
        activeConnectionIds: [],
        activeComponentIds: [],
        componentOperatingModes: {},
        deadheadedComponentIds: [],
        resolvedPaths: [],
        events: [],
        warnings: [],
      },
      1,
    );

    const edgeState = result.edgeThermalStateByConnectionId[connectionId];
    expect(edgeState?.transitDelayQueueC).toEqual([50, 49]);
  });

  it('49. zero-flow active edge retains previous thermal state', () => {
    const connectionId = 'conn_boiler_to_pump';
    const result = evaluatePipeEdgesV1(
      simpleRegularBoilerGraph,
      [],
      [
        {
          connectionId,
          isActive: true,
          estimatedInletTemperatureC: 30,
          estimatedOutletTemperatureC: 29,
          transitDelayQueueC: [45],
        },
      ],
      [
        {
          connectionId,
          isActive: true,
          estimatedFlowKgPerS: 0,
          estimatedVelocityMps: 0.5,
        },
      ],
      {
        activeConnectionIds: [connectionId],
        activeComponentIds: [],
        componentOperatingModes: {},
        deadheadedComponentIds: [],
        resolvedPaths: [],
        events: [],
        warnings: [],
      },
      1,
    );

    expect(result.edgeTemperatureByConnectionId[connectionId]?.estimatedOutletTemperatureC).toBe(29);
    expect(result.edgeThermalStateByConnectionId[connectionId]?.transitDelayQueueC).toEqual([45]);
  });

  it('50. missing pipe geometry falls back to pass-through with warning', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const edge = graph.connections.find((connection) => connection.id === 'conn_boiler_to_pump');
    if (!edge) throw new Error('Fixture edge missing.');
    delete edge.physical.lengthM;

    const result = evaluatePipeEdgesV1(
      graph,
      [],
      [],
      [
        {
          connectionId: edge.id,
          isActive: true,
          estimatedFlowKgPerS: 0.2,
          estimatedVelocityMps: 0.8,
        },
      ],
      {
        activeConnectionIds: [edge.id],
        activeComponentIds: [],
        componentOperatingModes: {},
        deadheadedComponentIds: [],
        resolvedPaths: [],
        events: [],
        warnings: [],
      },
      1,
      {
        initialEdgeTemperatureByConnectionId: {
          [edge.id]: {
            estimatedInletTemperatureC: 60,
            estimatedOutletTemperatureC: 60,
          },
        },
      },
    );

    expect(result.edgeTemperatureByConnectionId[edge.id]?.estimatedInletTemperatureC).toBe(60);
    expect(result.edgeTemperatureByConnectionId[edge.id]?.estimatedOutletTemperatureC).toBe(60);
    expect(result.warnings.some((warning) => warning.code === 'pipe_geometry_missing')).toBe(true);
  });
});

describe('runLegoTechnixTickV1 — PR15 return-temperature propagation', () => {
  it('51. active radiator branch lowers source return temperature versus active cylinder branch', () => {
    const radiatorOnlyInitial = makeSPlanInitialState();
    const radiatorOnlyStore = findComponentState(radiatorOnlyInitial, 'stored_dhw_volume');
    if (!radiatorOnlyStore) throw new Error('Stored water state missing.');
    radiatorOnlyStore.currentTemperatureC = 60;

    const cylinderOnlyInitial = makeSPlanInitialState();
    const cylinderOnlyRoom = findComponentState(cylinderOnlyInitial, 'living_room');
    if (!cylinderOnlyRoom) throw new Error('Room state missing.');
    cylinderOnlyRoom.currentTemperatureC = 21;

    const radiatorOnlyResult = runLegoTechnixTickV1(
      sPlanControlGraph,
      radiatorOnlyInitial,
      makeTickInput(1000, undefined, 30),
    );
    const cylinderOnlyResult = runLegoTechnixTickV1(
      sPlanControlGraph,
      cylinderOnlyInitial,
      makeTickInput(1000, undefined, 30),
    );

    const radiatorReturn = findComponentState(radiatorOnlyResult.nextState, 'regular_boiler')?.returnTemperatureC ?? 0;
    const cylinderReturn = findComponentState(cylinderOnlyResult.nextState, 'regular_boiler')?.returnTemperatureC ?? 0;
    expect(radiatorReturn).toBeLessThan(cylinderReturn);
  });

  it('52. active cylinder branch contributes dedicated coil telemetry and runtime source return', () => {
    const initial = makeSPlanInitialState();
    const room = findComponentState(initial, 'living_room');
    if (!room) throw new Error('Room state missing.');
    room.currentTemperatureC = 21;

    const result = runLegoTechnixTickV1(
      sPlanControlGraph,
      initial,
      makeTickInput(1000, undefined, 30),
    );

    const coilState = findComponentState(result.nextState, 'cylinder_coil_exchanger');
    const boilerState = findComponentState(result.nextState, 'regular_boiler');
    expect(coilState?.primaryCoilInletTemperatureC).toBeDefined();
    expect(coilState?.primaryCoilOutletTemperatureC).toBeDefined();
    expect(coilState?.lastRecoveryKw).toBeGreaterThan(0);
    expect(boilerState?.returnTemperatureC).toBeCloseTo(coilState?.primaryCoilOutletTemperatureC ?? 0, 3);
  });

  it('53. simultaneous radiator and cylinder branches merge return by mass flow weighting', () => {
    const result = runLegoTechnixTickV1(
      sPlanControlGraph,
      makeSPlanInitialState(),
      makeTickInput(1000, undefined, 30),
    );

    const boilerReturn = findComponentState(result.nextState, 'regular_boiler')?.returnTemperatureC;
    const radiatorReturn = findComponentState(result.nextState, 'radiator_emitter')?.radiatorPrimaryReturnTemperatureC;
    const coilReturn = findComponentState(result.nextState, 'cylinder_coil_exchanger')?.primaryCoilOutletTemperatureC;
    const radiatorFlow = findEdgeState(result.nextState, 'conn_radiator_to_merge')?.estimatedFlowKgPerS ?? 0;
    const coilFlow = findEdgeState(result.nextState, 'conn_coil_to_merge')?.estimatedFlowKgPerS ?? 0;
    const expected = (radiatorFlow + coilFlow) > 0
      ? ((radiatorFlow * (radiatorReturn ?? 0)) + (coilFlow * (coilReturn ?? 0))) / (radiatorFlow + coilFlow)
      : undefined;

    expect(expected).toBeDefined();
    expect(boilerReturn).toBeCloseTo(expected ?? 0, 3);
  });

  it('54. inactive branch does not affect return-temperature aggregation', () => {
    const initial = makeSPlanInitialState();
    const room = findComponentState(initial, 'living_room');
    if (!room) throw new Error('Room state missing.');
    room.currentTemperatureC = 21;

    const result = runLegoTechnixTickV1(
      sPlanControlGraph,
      initial,
      makeTickInput(1000, undefined, 30),
    );

    expect(findEdgeState(result.nextState, 'conn_heating_valve_to_radiator')?.isActive).toBe(false);
    const radiatorState = findComponentState(result.nextState, 'radiator_emitter');
    const coilState = findComponentState(result.nextState, 'cylinder_coil_exchanger');
    const boilerState = findComponentState(result.nextState, 'regular_boiler');
    expect(radiatorState?.radiatorPrimaryReturnTemperatureC).toBeUndefined();
    expect(boilerState?.returnTemperatureC).toBeCloseTo(coilState?.primaryCoilOutletTemperatureC ?? 0, 3);
  });

  it('55. condensing flag updates from runtime return temperature before configured fallback', () => {
    const graph = cloneGraph(sPlanControlGraph);
    if (!graph.heatSourceModels?.[0]) throw new Error('Heat source model missing.');
    graph.heatSourceModels[0].returnTemperatureC = 65;

    const inactiveInitial = makeSPlanInitialState();
    const inactiveRoom = findComponentState(inactiveInitial, 'living_room');
    const inactiveStore = findComponentState(inactiveInitial, 'stored_dhw_volume');
    if (!inactiveRoom || !inactiveStore) throw new Error('Fixture state missing.');
    inactiveRoom.currentTemperatureC = 21;
    inactiveStore.currentTemperatureC = 60;

    const inactiveResult = runLegoTechnixTickV1(
      graph,
      inactiveInitial,
      makeTickInput(1000, undefined, 30),
    );
    expect(findComponentState(inactiveResult.nextState, 'regular_boiler')?.condensingLikely).toBe(false);

    const activeInitial = makeSPlanInitialState();
    const activeStore = findComponentState(activeInitial, 'stored_dhw_volume');
    if (!activeStore) throw new Error('Stored water state missing.');
    activeStore.currentTemperatureC = 60;
    const activeResult = runLegoTechnixTickV1(
      graph,
      activeInitial,
      makeTickInput(1000, undefined, 30),
    );
    const boilerState = findComponentState(activeResult.nextState, 'regular_boiler');
    expect(boilerState?.returnTemperatureC).not.toBeCloseTo(65, 3);
    expect(boilerState?.condensingLikely).toBe((boilerState?.returnTemperatureC ?? 0) < 55);
  });
});

describe('runLegoTechnixTickV1 — stratified stored-water model', () => {
  it('keeps mixed model behaviour unchanged', () => {
    const baseline = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      makeSimpleInitialState(),
      makeTickInput(
        1000,
        undefined,
        600,
        [{
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 10,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        }],
      ),
    );
    const explicitMixedInitial = makeSimpleInitialState();
    const explicitStore = findComponentState(explicitMixedInitial, 'stored_dhw_volume');
    if (!explicitStore) throw new Error('Stored water state missing.');
    explicitStore.storageModel = 'mixed';
    const explicitMixed = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      explicitMixedInitial,
      makeTickInput(
        1000,
        undefined,
        600,
        [{
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 10,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        }],
      ),
    );

    expect(findComponentState(explicitMixed.nextState, 'stored_dhw_volume')?.currentTemperatureC)
      .toBeCloseTo(findComponentState(baseline.nextState, 'stored_dhw_volume')?.currentTemperatureC ?? 0, 3);
    expect(findComponentState(explicitMixed.nextState, 'stored_dhw_volume')?.usableHotWaterLitresAt40C)
      .toBeCloseTo(findComponentState(baseline.nextState, 'stored_dhw_volume')?.usableHotWaterLitresAt40C ?? 0, 3);
  });

  it('draw-off depletes usable top-layer capacity and cold replenishment cools the bottom first', () => {
    const initial = makeSimpleInitialState();
    configureStratifiedStore(initial, [62, 56, 46, 36, 26], 'top_down');

    const noDrawBaseline = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      JSON.parse(JSON.stringify(initial)) as LegoTechnixSimulationStateV1,
      makeTickInput(1000, undefined, 600),
    );
    const resultWithDraw = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      initial,
      makeTickInput(
        1000,
        undefined,
        600,
        [{
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 10,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        }],
      ),
    );

    const baselineStore = findComponentState(noDrawBaseline.nextState, 'stored_dhw_volume');
    const afterStore = findComponentState(resultWithDraw.nextState, 'stored_dhw_volume');
    const baselineLayers = baselineStore?.stratificationLayers;
    const afterLayers = afterStore?.stratificationLayers;
    expect((afterStore?.usableTopLayerHotWaterLitresAt40C ?? 0))
      .toBeLessThan((baselineStore?.usableTopLayerHotWaterLitresAt40C ?? Number.POSITIVE_INFINITY));
    expect((afterLayers?.[afterLayers.length - 1]?.temperatureC ?? 0))
      .toBeLessThan((baselineLayers?.[baselineLayers.length - 1]?.temperatureC ?? Number.POSITIVE_INFINITY));
  });

  it('top-down charging heats upper layers before lower layers', () => {
    const initial = makeSimpleInitialState();
    configureStratifiedStore(initial, [35, 34, 33, 32, 31], 'top_down');

    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      initial,
      makeTickInput(1000, {
        zone_valve: true,
        regular_boiler: { demand: true },
      }, 600),
    );

    const beforeLayers = findComponentState(initial, 'stored_dhw_volume')?.stratificationLayers;
    const afterLayers = findComponentState(result.nextState, 'stored_dhw_volume')?.stratificationLayers;
    expect((afterLayers?.[0]?.temperatureC ?? 0) - (beforeLayers?.[0]?.temperatureC ?? 0))
      .toBeGreaterThanOrEqual(
        (afterLayers?.[afterLayers.length - 1]?.temperatureC ?? 0)
        - (beforeLayers?.[beforeLayers.length - 1]?.temperatureC ?? 0),
      );
  });

  it('usable hot-water for stratified storage is not based on average tank temperature alone', () => {
    const mixedInitial = makeSimpleInitialState();
    const stratifiedInitial = makeSimpleInitialState();
    const mixedStore = findComponentState(mixedInitial, 'stored_dhw_volume');
    if (!mixedStore) throw new Error('Stored water state missing.');
    mixedStore.currentTemperatureC = 45;

    configureStratifiedStore(stratifiedInitial, [60, 60, 35, 35, 35], 'top_down');

    const mixedResult = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      mixedInitial,
      makeTickInput(1000, undefined, 60),
    );
    const stratifiedResult = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      stratifiedInitial,
      makeTickInput(1000, undefined, 60),
    );

    expect(findComponentState(mixedResult.nextState, 'stored_dhw_volume')?.usableHotWaterLitresAt40C)
      .not.toBe(findComponentState(stratifiedResult.nextState, 'stored_dhw_volume')?.usableHotWaterLitresAt40C);
  });

  it('heavy draw-off can exhaust top usable layers', () => {
    const initial = makeSimpleInitialState();
    configureStratifiedStore(initial, [55, 52, 45, 30, 20], 'top_down');

    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      initial,
      makeTickInput(
        1000,
        undefined,
        2400,
        [{
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 18,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        }],
      ),
    );

    expect(findComponentState(result.nextState, 'stored_dhw_volume')?.usableTopLayerHotWaterLitresAt40C)
      .toBeLessThanOrEqual(0.5);
  });

  it('neighbour smoothing reduces extreme inter-layer temperature differences over time', () => {
    const initial = makeSimpleInitialState();
    configureStratifiedStore(initial, [80, 20, 20, 20, 20], 'top_down');
    const beforeLayers = findComponentState(initial, 'stored_dhw_volume')?.stratificationLayers;

    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      initial,
      makeTickInput(1000, undefined, 300),
    );
    const afterLayers = findComponentState(result.nextState, 'stored_dhw_volume')?.stratificationLayers;

    const beforeDelta = (beforeLayers?.[0]?.temperatureC ?? 0) - (beforeLayers?.[1]?.temperatureC ?? 0);
    const afterDelta = (afterLayers?.[0]?.temperatureC ?? 0) - (afterLayers?.[1]?.temperatureC ?? 0);
    expect(afterDelta).toBeLessThan(beforeDelta);
  });

  it('warns when stratified layer volumes do not match component volume', () => {
    const initial = makeSimpleInitialState();
    const store = findComponentState(initial, 'stored_dhw_volume');
    if (!store) throw new Error('Stored water state missing.');
    store.storageModel = 'stratified';
    store.chargingMode = 'top_down';
    store.stratificationLayers = [
      { layerIndex: 0, volumeLitres: 50, temperatureC: 60, usableAtTargetTemperature: true, confidence: 'derived' },
      { layerIndex: 1, volumeLitres: 50, temperatureC: 55, usableAtTargetTemperature: true, confidence: 'derived' },
      { layerIndex: 2, volumeLitres: 40, temperatureC: 45, usableAtTargetTemperature: true, confidence: 'derived' },
    ];

    const result = runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      initial,
      makeTickInput(1000, undefined, 60),
    );

    expect(result.warnings.some((warning) => warning.code === 'stratified_layer_volume_mismatch')).toBe(true);
  });

  it('keeps previousState immutable with stratified layers', () => {
    const initial = makeSimpleInitialState();
    configureStratifiedStore(initial, [60, 55, 45, 35, 25], 'top_down');
    const frozen = JSON.stringify(initial);
    runLegoTechnixTickV1(
      simpleRegularBoilerGraph,
      initial,
      makeTickInput(
        1000,
        undefined,
        600,
        [{
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 8,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        }],
      ),
    );
    expect(JSON.stringify(initial)).toBe(frozen);
  });
});
