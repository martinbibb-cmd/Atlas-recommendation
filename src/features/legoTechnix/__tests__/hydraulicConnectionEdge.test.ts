import { describe, expect, it } from 'vitest';
import { simpleRegularBoilerGraph } from '../fixtures/simpleRegularBoilerGraph';
import {
  deriveWaterVolumeLitres,
  isWaterCarryingDomain,
  sumHydraulicDomainEdgeVolumes,
} from '../hydraulicConnectionEdge';
import type { LegoTechnixConnectionV1, LegoTechnixGraphV1 } from '../types';
import { validateLegoTechnixGraphV1 } from '../validation';

function cloneGraph(graph: LegoTechnixGraphV1): LegoTechnixGraphV1 {
  return JSON.parse(JSON.stringify(graph)) as LegoTechnixGraphV1;
}

describe('deriveWaterVolumeLitres', () => {
  it('1a. derives water volume correctly for 22mm ID pipe over 1 metre', () => {
    // π × (0.011)² × 1 × 1000 ≈ 0.3801 L
    const volume = deriveWaterVolumeLitres(1, 22);
    expect(volume).toBeCloseTo(0.3801, 3);
  });

  it('1b. derives water volume correctly for 15mm ID pipe over 3 metres', () => {
    // π × (0.0075)² × 3 × 1000 ≈ 0.5301 L
    const volume = deriveWaterVolumeLitres(3, 15);
    expect(volume).toBeCloseTo(0.5301, 3);
  });

  it('1c. derives water volume correctly for 28mm ID pipe over 10 metres', () => {
    // π × (0.014)² × 10 × 1000 ≈ 6.158 L
    const volume = deriveWaterVolumeLitres(10, 28);
    expect(volume).toBeCloseTo(6.158, 2);
  });

  it('1d. derived volume scales linearly with length', () => {
    const vol1 = deriveWaterVolumeLitres(1, 22);
    const vol5 = deriveWaterVolumeLitres(5, 22);
    expect(vol5).toBeCloseTo(vol1 * 5, 6);
  });

  it('1e. derived volume scales with square of internal diameter', () => {
    const vol22 = deriveWaterVolumeLitres(1, 22);
    const vol44 = deriveWaterVolumeLitres(1, 44);
    // doubling diameter → 4× volume
    expect(vol44).toBeCloseTo(vol22 * 4, 6);
  });
});

describe('isWaterCarryingDomain', () => {
  it('2a. primary_heating is a water-carrying domain', () => {
    expect(isWaterCarryingDomain('primary_heating')).toBe(true);
  });

  it('2b. domestic_cold is a water-carrying domain', () => {
    expect(isWaterCarryingDomain('domestic_cold')).toBe(true);
  });

  it('2c. domestic_hot is a water-carrying domain', () => {
    expect(isWaterCarryingDomain('domestic_hot')).toBe(true);
  });

  it('2d. room_air is not a water-carrying domain', () => {
    expect(isWaterCarryingDomain('room_air')).toBe(false);
  });

  it('2e. electric_control is not a water-carrying domain', () => {
    expect(isWaterCarryingDomain('electric_control')).toBe(false);
  });

  it('2f. outside_environment is not a water-carrying domain', () => {
    expect(isWaterCarryingDomain('outside_environment')).toBe(false);
  });
});

describe('PR5 — missing pipe assumptions warn but are not fatal', () => {
  it('3a. connection missing bore warns but graph remains valid otherwise', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const connection = graph.connections.find((c) => c.id === 'conn_boiler_to_pump');
    if (!connection) throw new Error('Fixture connection missing.');
    delete connection.physical.internalDiameterMm;
    delete connection.physical.nominalDiameterMm;

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.warnings.some((w) => w.code === 'connection_missing_physical_assumptions')).toBe(true);
    expect(result.errors.some((e) => e.code === 'connection_missing_physical_assumptions')).toBe(false);
  });

  it('3b. connection missing length warns but graph remains valid otherwise', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const connection = graph.connections.find((c) => c.id === 'conn_coil_to_radiator');
    if (!connection) throw new Error('Fixture connection missing.');
    delete connection.physical.lengthM;

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.warnings.some((w) => w.code === 'connection_missing_physical_assumptions')).toBe(true);
    expect(result.isValid).toBe(true);
  });
});

describe('PR5 — primary system volume can sum edge volumes', () => {
  it('4a. sums primary_heating edge water volumes from fixture', () => {
    const primaryVolume = sumHydraulicDomainEdgeVolumes(
      simpleRegularBoilerGraph.connections,
      'primary_heating',
    );
    // Fixture primary_heating connections: 0.25 + 0.2 + 0.8 + 0.9 + 0.7 + 0.4 + 0.15 = 3.4
    expect(primaryVolume).toBeCloseTo(3.4, 6);
  });

  it('4b. sums domestic_hot edge water volumes from fixture', () => {
    const dhwVolume = sumHydraulicDomainEdgeVolumes(
      simpleRegularBoilerGraph.connections,
      'domestic_hot',
    );
    // domestic_hot connections: conn_coil_to_store (0.05) + conn_store_to_draw_off (0.22) = 0.27
    expect(dhwVolume).toBeCloseTo(0.27, 6);
  });

  it('4c. returns zero for a domain with no connections', () => {
    const volume = sumHydraulicDomainEdgeVolumes(
      simpleRegularBoilerGraph.connections,
      'solar_thermal',
    );
    expect(volume).toBe(0);
  });

  it('4d. skips connections with undefined waterVolumeLitres', () => {
    const connections: LegoTechnixConnectionV1[] = [
      {
        id: 'c1',
        sourceComponentId: 'a',
        sourcePortId: 'out',
        targetComponentId: 'b',
        targetPortId: 'in',
        domain: 'primary_heating',
        circuitId: 'loop',
        direction: 'out',
        confidence: 'assumed',
        physical: { waterVolumeLitres: 1.0 },
      },
      {
        id: 'c2',
        sourceComponentId: 'b',
        sourcePortId: 'out',
        targetComponentId: 'c',
        targetPortId: 'in',
        domain: 'primary_heating',
        circuitId: 'loop',
        direction: 'out',
        confidence: 'assumed',
        physical: {},  // no waterVolumeLitres
      },
    ];
    expect(sumHydraulicDomainEdgeVolumes(connections, 'primary_heating')).toBeCloseTo(1.0, 6);
  });
});

describe('PR5 — pipe confidence/provenance preserved', () => {
  it('5a. all fixture connections have a non-unknown confidence', () => {
    for (const connection of simpleRegularBoilerGraph.connections) {
      expect(connection.confidence).toBeDefined();
      expect(connection.confidence).not.toBe('unknown');
    }
  });

  it('5b. all fixture connections have a non-unknown routingConfidence', () => {
    for (const connection of simpleRegularBoilerGraph.connections) {
      expect(connection.physical.routingConfidence).toBeDefined();
      expect(connection.physical.routingConfidence).not.toBe('unknown');
    }
  });

  it('5c. insulation state on fixture primary pipe is preserved', () => {
    const boilerToPump = simpleRegularBoilerGraph.connections.find(
      (c) => c.id === 'conn_boiler_to_pump',
    );
    expect(boilerToPump?.physical.insulationState).toBe('insulated');
  });

  it('5d. ambient domain and heat loss W/m on exposed primary pipe are preserved', () => {
    const coilToRadiator = simpleRegularBoilerGraph.connections.find(
      (c) => c.id === 'conn_coil_to_radiator',
    );
    expect(coilToRadiator?.physical.ambientDomainId).toBe('outside_environment');
    expect(coilToRadiator?.physical.simpleHeatLossWPerM).toBe(8);
    expect(coilToRadiator?.physical.insulationState).toBe('partial');
  });
});

describe('PR5 — non-water domains do not require water volume', () => {
  it('6a. room_air connection without waterVolumeLitres does not warn or error', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const roomConn = graph.connections.find((c) => c.id === 'conn_radiator_to_room');
    if (!roomConn) throw new Error('Fixture room connection missing.');
    delete roomConn.physical.waterVolumeLitres;

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.errors.some((e) => e.code === 'connection_missing_physical_assumptions')).toBe(false);
    expect(result.warnings.some((w) => w.code === 'connection_missing_physical_assumptions')).toBe(false);
  });

  it('6b. room_air connection without bore/length does not produce missing-physical-assumptions warning', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const roomConn = graph.connections.find((c) => c.id === 'conn_radiator_to_room');
    if (!roomConn) throw new Error('Fixture room connection missing.');
    delete roomConn.physical.lengthM;
    delete roomConn.physical.internalDiameterMm;
    delete roomConn.physical.nominalDiameterMm;

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.warnings.some((w) => w.code === 'connection_missing_physical_assumptions')).toBe(false);
  });

  it('6c. non-hydraulic connection with positive waterVolumeLitres produces a warning', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const roomConn = graph.connections.find((c) => c.id === 'conn_radiator_to_room');
    if (!roomConn) throw new Error('Fixture room connection missing.');
    roomConn.physical.waterVolumeLitres = 5;

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.warnings.some((w) => w.code === 'non_hydraulic_connection_has_water_volume')).toBe(true);
  });

  it('6d. primary_heating connection still warns when bore/length are absent', () => {
    const graph = cloneGraph(simpleRegularBoilerGraph);
    const conn = graph.connections.find((c) => c.id === 'conn_filter_to_boiler');
    if (!conn) throw new Error('Fixture connection missing.');
    delete conn.physical.lengthM;
    delete conn.physical.internalDiameterMm;
    delete conn.physical.nominalDiameterMm;

    const result = validateLegoTechnixGraphV1(graph);
    expect(result.warnings.some((w) => w.code === 'connection_missing_physical_assumptions')).toBe(true);
  });
});
