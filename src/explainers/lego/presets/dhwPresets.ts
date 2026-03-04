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
      { fromBlockId: 'pipe1', fromPortId: 'out', toBlockId: 'cyl1',  toPortId: 'in' },
      { fromBlockId: 'cyl1',  fromPortId: 'out', toBlockId: 'draw1', toPortId: 'in' },
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
      { fromBlockId: 'inlet1', fromPortId: 'out',  toBlockId: 'cyl2',   toPortId: 'in' },
      { fromBlockId: 'cyl2',   fromPortId: 'out',  toBlockId: 'draw2',  toPortId: 'in' },
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

// ─── Exports ──────────────────────────────────────────────────────────────────

export const DHW_PRESETS: LegoScenario[] = [
  ventedCylinder,
  unventedCylinder,
  combiTypical,
  combiWinter,
  twoOutlets,
];
