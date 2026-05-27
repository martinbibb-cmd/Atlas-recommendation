/**
 * dhwPresets — a small catalogue of ready-made DHW Lego scenarios.
 *
 * Each preset is a complete LegoScenario (meta + graph) that can be loaded
 * directly into the builder or a view without further configuration.
 *
 * v1 scope: DHW paths only (vented, unvented, combi on-demand + concurrency).
 */

import type { LegoScenario } from '../schema/legoTypes';

// ─── 1. Vented cylinder — tank-fed ───────────────────────────────────────────

const ventedCylinder: LegoScenario = {
  meta: {
    name: 'Vented cylinder — tank-fed',
    description: 'Traditional tank-fed hot water supply via a vented copper cylinder heated by a primary coil.',
    tags: ['vented', 'cylinder', 'tank-fed', 'stored'],
  },
  graph: {
    blocks: [
      {
        id: 'tank1',
        type: 'tank_head',
        params: { headMeters: 3 },
      },
      {
        id: 'pipe1',
        type: 'pipe_section',
        params: { diameterMm: 15, lengthMeters: 5, label: '15mm cold feed' },
      },
      {
        id: 'cyl1',
        type: 'cylinder_vented',
        params: { volumeL: 150, coilKw: 12 },
      },
      {
        id: 'draw1',
        type: 'draw_event',
        params: { flowLpm: 10, durationMin: 8, label: 'Shower' },
      },
    ],
    edges: [
      { fromBlockId: 'tank1', fromPortId: 'out', toBlockId: 'pipe1', toPortId: 'in' },
      { fromBlockId: 'pipe1', fromPortId: 'out', toBlockId: 'cyl1',  toPortId: 'cold_in' },
      { fromBlockId: 'cyl1',  fromPortId: 'hot_out', toBlockId: 'draw1', toPortId: 'in' },
    ],
  },
};

// ─── 2. Unvented cylinder — mains-fed ────────────────────────────────────────

const unventedCylinder: LegoScenario = {
  meta: {
    name: 'Unvented cylinder — mains-fed',
    description: 'Mains-pressure stored hot water via an unvented cylinder with inlet control group.',
    tags: ['unvented', 'cylinder', 'mains-fed', 'stored'],
  },
  graph: {
    blocks: [
      {
        id: 'mains1',
        type: 'mains_supply',
        params: { staticPressureBar: 3.5, dynamicFlowLpm: 18, confidence: 'med' },
      },
      {
        id: 'inlet1',
        type: 'unvented_inlet_group',
        params: { setPressureBar: 3, maxFlowLpm: 18 },
      },
      {
        id: 'cyl2',
        type: 'cylinder_unvented',
        params: { volumeL: 180 },
      },
      {
        id: 'draw2',
        type: 'draw_event',
        params: { flowLpm: 12, durationMin: 8, label: 'Shower' },
      },
    ],
    edges: [
      { fromBlockId: 'mains1', fromPortId: 'out',  toBlockId: 'inlet1', toPortId: 'in' },
      { fromBlockId: 'inlet1', fromPortId: 'out',  toBlockId: 'cyl2',   toPortId: 'cold_in' },
      { fromBlockId: 'cyl2',   fromPortId: 'hot_out',  toBlockId: 'draw2',  toPortId: 'in' },
    ],
  },
};

// ─── 3. Combi — 30 kW, typical 10 °C ─────────────────────────────────────────

const combiTypical: LegoScenario = {
  meta: {
    name: 'Combi — 30 kW, typical 10 °C',
    description: 'On-demand hot water from a 30 kW combi boiler; typical autumn/spring cold inlet at 10 °C.',
    tags: ['combi', 'on-demand', 'typical'],
  },
  graph: {
    blocks: [
      {
        id: 'mains2',
        type: 'mains_supply',
        params: { staticPressureBar: 3, dynamicFlowLpm: 16, confidence: 'med' },
      },
      {
        id: 'hex1',
        type: 'boiler_combi_dhw_hex',
        params: { dhwOutputKw: 30, coldTempC: 10, dhwSetpointC: 50 },
      },
      {
        id: 'draw3',
        type: 'draw_event',
        params: { flowLpm: 10, durationMin: 8, label: 'Mixer shower' },
      },
    ],
    edges: [
      { fromBlockId: 'mains2', fromPortId: 'out', toBlockId: 'hex1',  toPortId: 'in' },
      { fromBlockId: 'hex1',   fromPortId: 'out', toBlockId: 'draw3', toPortId: 'in' },
    ],
  },
};

// ─── 4. Combi — winter 5 °C ───────────────────────────────────────────────────

const combiWinter: LegoScenario = {
  meta: {
    name: 'Combi — winter 5 °C',
    description: 'On-demand hot water from a 30 kW combi boiler with cold inlet at 5 °C (winter). Thermal limit is lower.',
    tags: ['combi', 'on-demand', 'winter'],
  },
  graph: {
    blocks: [
      {
        id: 'mains3',
        type: 'mains_supply',
        params: { staticPressureBar: 3, dynamicFlowLpm: 16, confidence: 'med' },
      },
      {
        id: 'hex2',
        type: 'boiler_combi_dhw_hex',
        params: { dhwOutputKw: 30, coldTempC: 5, dhwSetpointC: 50 },
      },
      {
        id: 'draw4',
        type: 'draw_event',
        params: { flowLpm: 10, durationMin: 8, label: 'Mixer shower' },
      },
    ],
    edges: [
      { fromBlockId: 'mains3', fromPortId: 'out', toBlockId: 'hex2',  toPortId: 'in' },
      { fromBlockId: 'hex2',   fromPortId: 'out', toBlockId: 'draw4', toPortId: 'in' },
    ],
  },
};

// ─── 5. Two outlets — mixer + basin ───────────────────────────────────────────

const twoOutlets: LegoScenario = {
  meta: {
    name: 'Two outlets — mixer + basin',
    description: 'Combi supplying two simultaneous outlets: a mixer shower and a basin tap. Tests concurrency.',
    tags: ['combi', 'concurrency', 'two-outlets'],
  },
  graph: {
    blocks: [
      {
        id: 'mains4',
        type: 'mains_supply',
        params: { staticPressureBar: 3, dynamicFlowLpm: 16, confidence: 'med' },
      },
      {
        id: 'hex3',
        type: 'boiler_combi_dhw_hex',
        params: { dhwOutputKw: 30, coldTempC: 10, dhwSetpointC: 50 },
      },
      {
        id: 'split1',
        type: 'branch_splitter',
        params: { branches: 2, simultaneousUse: 2 },
      },
      {
        id: 'draw5',
        type: 'draw_event',
        params: { flowLpm: 10, durationMin: 8, label: 'Mixer shower' },
      },
      {
        id: 'draw6',
        type: 'draw_event',
        params: { flowLpm: 6, durationMin: 4, label: 'Basin tap' },
      },
    ],
    edges: [
      { fromBlockId: 'mains4',  fromPortId: 'out',  toBlockId: 'hex3',   toPortId: 'in' },
      { fromBlockId: 'hex3',    fromPortId: 'out',  toBlockId: 'split1', toPortId: 'in' },
      { fromBlockId: 'split1',  fromPortId: 'out1', toBlockId: 'draw5',  toPortId: 'in' },
      { fromBlockId: 'split1',  fromPortId: 'out2', toBlockId: 'draw6',  toPortId: 'in' },
    ],
  },
};

// ─── 6. System boiler + vented cylinder — full heating + DHW ──────────────────

const systemBoilerVentedCylinder: LegoScenario = {
  meta: {
    name: 'System boiler + vented cylinder — heating and DHW',
    description: 'Open-vented system boiler heating radiators via CH circuit and indirectly heating a vented cylinder via primary coil. Domestic hot water comes from stored cylinder volume, not directly from the boiler.',
    tags: ['system_boiler', 'vented', 'cylinder', 'coil', 'ch', 'heating'],
  },
  graph: {
    blocks: [
      {
        id: 'boiler1',
        type: 'boiler_primary',
        params: { outputKw: 24 },
      },
      {
        id: 'cyl3',
        type: 'cylinder_vented',
        params: { volumeL: 150, coilKw: 12 },
      },
      {
        id: 'tank2',
        type: 'tank_head',
        params: { headMeters: 3 },
      },
      {
        id: 'draw7',
        type: 'draw_event',
        params: { flowLpm: 10, durationMin: 8, label: 'Shower' },
      },
    ],
    edges: [
      // Primary coil circuit: boiler → cylinder coil → boiler
      { fromBlockId: 'boiler1', fromPortId: 'out',           toBlockId: 'cyl3',   toPortId: 'coil_flow_in' },
      { fromBlockId: 'cyl3',   fromPortId: 'coil_return_out', toBlockId: 'boiler1', toPortId: 'in' },
      // Domestic water circuit: tank cold feed → cylinder → hot draw-off
      { fromBlockId: 'tank2',  fromPortId: 'out',            toBlockId: 'cyl3',   toPortId: 'cold_in' },
      { fromBlockId: 'cyl3',   fromPortId: 'hot_out',        toBlockId: 'draw7',  toPortId: 'in' },
    ],
  },
};

// ─── 7. Unvented cylinder with boiler coil — full primary + DHW ───────────────

const systemBoilerUnventedCylinder: LegoScenario = {
  meta: {
    name: 'System boiler + unvented cylinder — heating and DHW',
    description: 'Mains-pressure sealed system. Boiler heats an unvented cylinder via primary coil. Domestic hot water is stored and drawn from the cylinder, completely separate from the primary circuit.',
    tags: ['system_boiler', 'unvented', 'cylinder', 'coil', 'heating'],
  },
  graph: {
    blocks: [
      {
        id: 'boiler2',
        type: 'boiler_primary',
        params: { outputKw: 24 },
      },
      {
        id: 'mains5',
        type: 'mains_supply',
        params: { staticPressureBar: 3.5, dynamicFlowLpm: 18, confidence: 'med' },
      },
      {
        id: 'inlet2',
        type: 'unvented_inlet_group',
        params: { setPressureBar: 3, maxFlowLpm: 18 },
      },
      {
        id: 'cyl4',
        type: 'cylinder_unvented',
        params: { volumeL: 180, coilKw: 14 },
      },
      {
        id: 'draw8',
        type: 'draw_event',
        params: { flowLpm: 12, durationMin: 8, label: 'Shower' },
      },
    ],
    edges: [
      // Primary coil circuit: boiler → cylinder coil → boiler
      { fromBlockId: 'boiler2', fromPortId: 'out',           toBlockId: 'cyl4',    toPortId: 'coil_flow_in' },
      { fromBlockId: 'cyl4',   fromPortId: 'coil_return_out', toBlockId: 'boiler2', toPortId: 'in' },
      // Domestic water circuit: mains → inlet group → cylinder → hot draw-off
      { fromBlockId: 'mains5', fromPortId: 'out',  toBlockId: 'inlet2', toPortId: 'in' },
      { fromBlockId: 'inlet2', fromPortId: 'out',  toBlockId: 'cyl4',   toPortId: 'cold_in' },
      { fromBlockId: 'cyl4',   fromPortId: 'hot_out', toBlockId: 'draw8',  toPortId: 'in' },
    ],
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const DHW_PRESETS: LegoScenario[] = [
  ventedCylinder,
  unventedCylinder,
  combiTypical,
  combiWinter,
  twoOutlets,
  systemBoilerVentedCylinder,
  systemBoilerUnventedCylinder,
];
