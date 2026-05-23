import { describe, expect, it } from 'vitest';
import { branchingBypassGraph } from '../fixtures/branchingBypassGraph';
import { simpleRegularBoilerGraph } from '../fixtures/simpleRegularBoilerGraph';
import type { LegoTechnixGraphV1 } from '../types';
import type { LegoTechnixSimulationStateV1 } from '../simulation/LegoTechnixSimulationStateV1';
import type { LegoTechnixTickInputV1 } from '../simulation/LegoTechnixTickInputV1';
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

function makeTickInput(
  wallClockMs = 1000,
  controlOverrides?: Readonly<Record<string, unknown>>,
): LegoTechnixTickInputV1 {
  return {
    wallClockMs,
    timestepSeconds: 1,
    controlOverrides,
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

  it('24. active-path resolution does not populate temperatures or mutate graph structure', () => {
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
    expect(result.nextState.edgeStates.every((edgeState) => (
      edgeState.estimatedInletTemperatureC === undefined
      && edgeState.estimatedOutletTemperatureC === undefined
    ))).toBe(true);
    expect(result.nextState.componentStates.every((componentState) => (
      componentState.measuredTemperatureC === undefined
    ))).toBe(true);
  });
});
