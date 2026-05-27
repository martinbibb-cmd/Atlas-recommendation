/**
 * blockCatalog — static catalogue of all Lego block definitions.
 *
 * Keyed by BlockType. Each entry describes:
 *  - label / category
 *  - defaultParams
 *  - port definitions
 *  - param schema (for form generation)
 */

import type {
  BlockType,
  BlockCategory,
  LegoPort,
  BlockParams,
  ParamSchema,
} from '../schema/legoTypes';

// ─── Catalog entry shape ──────────────────────────────────────────────────────

export interface CatalogEntry {
  label: string;
  category: BlockCategory;
  defaultParams: BlockParams;
  ports: LegoPort[];
  paramSchema: Record<string, ParamSchema>;
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const BLOCK_CATALOG: Record<BlockType, CatalogEntry> = {

  // ── Pressure source ─────────────────────────────────────────────────────────

  mains_supply: {
    label: 'Mains supply',
    category: 'pressure_source',
    defaultParams: { staticPressureBar: 3, confidence: 'med' },
    ports: [
      { id: 'out', type: 'cold_water', direction: 'out' },
    ],
    paramSchema: {
      staticPressureBar:   { type: 'number', min: 0.5, max: 10 },
      dynamicFlowLpm:      { type: 'number', min: 0, max: 60 },
      dynamicPressureBar:  { type: 'number', min: 0.5, max: 10 },
      confidence:          { type: 'enum', options: ['high', 'med', 'low'] },
    },
  },

  tank_head: {
    label: 'Tank head pressure',
    category: 'pressure_source',
    defaultParams: { headMeters: 3 },
    ports: [
      { id: 'out', type: 'cold_water', direction: 'out' },
    ],
    paramSchema: {
      headMeters: { type: 'number', min: 0.5, max: 20 },
    },
  },

  whole_house_booster: {
    label: 'Whole-house booster',
    category: 'pressure_source',
    defaultParams: { targetPressureBar: 3 },
    ports: [
      { id: 'in',  type: 'water', direction: 'in' },
      { id: 'out', type: 'water', direction: 'out' },
    ],
    paramSchema: {
      targetPressureBar: { type: 'number', min: 1, max: 6 },
      maxFlowLpm:        { type: 'number', min: 0, max: 60 },
    },
  },

  // ── Flow restriction ────────────────────────────────────────────────────────

  pipe_section: {
    label: 'Pipe section',
    category: 'flow_restriction',
    defaultParams: { diameterMm: 15, lengthMeters: 5, fittingsCount: 2 },
    ports: [
      { id: 'in',  type: 'water', direction: 'in' },
      { id: 'out', type: 'water', direction: 'out' },
    ],
    paramSchema: {
      diameterMm:    { type: 'enum', options: ['10', '12', '15', '22', '28'] },
      lengthMeters:  { type: 'number', min: 0.1, max: 100 },
      fittingsCount: { type: 'number', min: 0, max: 20 },
    },
  },

  outlet_restriction: {
    label: 'Outlet restriction',
    category: 'flow_restriction',
    defaultParams: { fixtureType: 'shower_mixer' },
    ports: [
      { id: 'in',  type: 'water', direction: 'in' },
      { id: 'out', type: 'water', direction: 'out' },
    ],
    paramSchema: {
      fixtureType:   { type: 'enum', options: ['basin', 'kitchen', 'shower_mixer', 'shower_rainfall', 'bath', 'unknown'] },
      ratedFlowLpm:  { type: 'number', min: 1, max: 30 },
    },
  },

  unvented_inlet_group: {
    label: 'Unvented inlet group (PRV / strainer / check)',
    category: 'flow_restriction',
    defaultParams: { setPressureBar: 3 },
    ports: [
      { id: 'in',  type: 'cold_water', direction: 'in' },
      { id: 'out', type: 'cold_water', direction: 'out' },
    ],
    paramSchema: {
      setPressureBar: { type: 'number', min: 1, max: 6 },
      maxFlowLpm:     { type: 'number', min: 0, max: 60 },
    },
  },

  // ── Heat source ─────────────────────────────────────────────────────────────

  boiler_combi_dhw_hex: {
    label: 'Combi DHW heat exchanger',
    category: 'heat_source',
    defaultParams: {
      dhwOutputKw: 30,
      coldTempC: 10,
      dhwSetpointC: 50,
    },
    ports: [
      { id: 'in',  type: 'cold_water', direction: 'in' },
      { id: 'out', type: 'hot_water',  direction: 'out' },
    ],
    paramSchema: {
      dhwOutputKw:   { type: 'number', min: 15, max: 50 },
      coldTempC:     { type: 'enum',   options: ['5', '10', '15'] },
      dhwSetpointC:  { type: 'number', min: 40, max: 65 },
      minFlowToFireLpm:        { type: 'number', min: 0, max: 5 },
      pressureDropToFireBar:   { type: 'number', min: 0, max: 1 },
      scaleRisk:     { type: 'enum',   options: ['low', 'med', 'high'] },
    },
  },

  boiler_primary: {
    label: 'Boiler (primary / CH)',
    category: 'heat_source',
    defaultParams: { outputKw: 24 },
    ports: [
      { id: 'in',  type: 'heating_return', direction: 'in',  circuit: 'heating_return' },
      { id: 'out', type: 'heating_flow',   direction: 'out', circuit: 'heating_flow' },
    ],
    paramSchema: {
      outputKw:    { type: 'number', min: 6, max: 50 },
      minOutputKw: { type: 'number', min: 0, max: 30 },
    },
  },

  heat_pump_primary: {
    label: 'Heat pump (primary)',
    category: 'heat_source',
    defaultParams: { maxFlowTempC: 55, copAt35: 3.5 },
    ports: [
      { id: 'in',  type: 'heating_return', direction: 'in',  circuit: 'heating_return' },
      { id: 'out', type: 'heating_flow',   direction: 'out', circuit: 'heating_flow' },
    ],
    paramSchema: {
      maxFlowTempC: { type: 'number', min: 35, max: 65 },
      copAt35:      { type: 'number', min: 1, max: 6 },
      copAt55:      { type: 'number', min: 1, max: 4 },
    },
  },

  immersion_heater: {
    label: 'Immersion heater',
    category: 'heat_source',
    defaultParams: { powerKw: 3 },
    ports: [
      { id: 'in',  type: 'heat', direction: 'in' },
      { id: 'out', type: 'heat', direction: 'out' },
    ],
    paramSchema: {
      powerKw: { type: 'number', min: 1, max: 6 },
    },
  },

  // ── Storage ─────────────────────────────────────────────────────────────────

  cylinder_vented: {
    label: 'Cylinder — vented (tank-fed)',
    category: 'storage',
    defaultParams: { volumeL: 150 },
    ports: [
      // Domestic water side
      { id: 'cold_in',        type: 'cold_water',    direction: 'in',  circuit: 'dhw_cold' },
      { id: 'hot_out',        type: 'hot_water',     direction: 'out', circuit: 'dhw_hot' },
      { id: 'vent',           type: 'water',         direction: 'out', circuit: 'vent' },
      // Primary heating coil side (boiler heats cylinder through coil — not direct hot-water supply)
      { id: 'coil_flow_in',   type: 'heating_flow',  direction: 'in',  circuit: 'primary_flow' },
      { id: 'coil_return_out',type: 'heating_return', direction: 'out', circuit: 'primary_return' },
    ],
    paramSchema: {
      volumeL: { type: 'number', min: 50, max: 400 },
      coilKw:  { type: 'number', min: 0, max: 30 },
    },
  },

  cylinder_unvented: {
    label: 'Cylinder — unvented (mains-fed)',
    category: 'storage',
    defaultParams: { volumeL: 150 },
    ports: [
      // Domestic water side
      { id: 'cold_in',        type: 'cold_water',    direction: 'in',  circuit: 'dhw_cold' },
      { id: 'hot_out',        type: 'hot_water',     direction: 'out', circuit: 'dhw_hot' },
      // Primary heating coil side (boiler heats cylinder through coil — not direct hot-water supply)
      { id: 'coil_flow_in',   type: 'heating_flow',  direction: 'in',  circuit: 'primary_flow' },
      { id: 'coil_return_out',type: 'heating_return', direction: 'out', circuit: 'primary_return' },
    ],
    paramSchema: {
      volumeL: { type: 'number', min: 50, max: 400 },
      coilKw:  { type: 'number', min: 0, max: 30 },
    },
  },

  cylinder_mixergy: {
    label: 'Mixergy cylinder (stratified)',
    category: 'storage',
    defaultParams: { volumeL: 180 },
    ports: [
      // Domestic water side
      { id: 'cold_in',        type: 'cold_water',    direction: 'in',  circuit: 'dhw_cold' },
      { id: 'hot_out',        type: 'hot_water',     direction: 'out', circuit: 'dhw_hot' },
      // Primary heating coil side (indirect heating via coil)
      { id: 'coil_flow_in',   type: 'heating_flow',  direction: 'in',  circuit: 'primary_flow' },
      { id: 'coil_return_out',type: 'heating_return', direction: 'out', circuit: 'primary_return' },
    ],
    paramSchema: {
      volumeL: { type: 'number', min: 100, max: 400 },
      coilKw:  { type: 'number', min: 0, max: 30 },
    },
  },

  buffer_tank: {
    label: 'Buffer tank',
    category: 'storage',
    defaultParams: { volumeL: 100 },
    ports: [
      { id: 'in',         type: 'heating_flow',   direction: 'in' },
      { id: 'out',        type: 'heating_flow',   direction: 'out' },
      { id: 'return_in',  type: 'heating_return', direction: 'in' },
      { id: 'return_out', type: 'heating_return', direction: 'out' },
    ],
    paramSchema: {
      volumeL: { type: 'number', min: 50, max: 500 },
    },
  },

  // ── Control & switching ──────────────────────────────────────────────────────

  diverter_valve: {
    label: 'Diverter valve',
    category: 'control_switching',
    defaultParams: { mode: 'auto' },
    ports: [
      { id: 'in',   type: 'heating_flow', direction: 'in' },
      { id: 'outA', type: 'hot_water',    direction: 'out' },
      { id: 'outB', type: 'heating_flow', direction: 'out' },
    ],
    paramSchema: {
      mode: { type: 'enum', options: ['dhw', 'heating', 'auto'] },
    },
  },

  flow_sensor_gate: {
    label: 'Flow sensor / gate',
    category: 'control_switching',
    defaultParams: { minFlowLpm: 1.5 },
    ports: [
      { id: 'in',  type: 'water', direction: 'in' },
      { id: 'out', type: 'water', direction: 'out' },
    ],
    paramSchema: {
      minFlowLpm: { type: 'number', min: 0.1, max: 5 },
    },
  },

  // ── Distribution ─────────────────────────────────────────────────────────────

  branch_splitter: {
    label: 'Branch splitter',
    category: 'distribution',
    defaultParams: { branches: 2, simultaneousUse: 1 },
    ports: [
      { id: 'in',   type: 'water', direction: 'in' },
      { id: 'out1', type: 'water', direction: 'out' },
      { id: 'out2', type: 'water', direction: 'out' },
      { id: 'out3', type: 'water', direction: 'out' },
    ],
    paramSchema: {
      branches:        { type: 'number', min: 2, max: 5 },
      simultaneousUse: { type: 'number', min: 0, max: 5 },
    },
  },

  // ── Outlet / demand ──────────────────────────────────────────────────────────

  draw_event: {
    label: 'Draw event (demand)',
    category: 'outlet_demand',
    defaultParams: { flowLpm: 10, durationMin: 8 },
    ports: [
      { id: 'in', type: 'hot_water', direction: 'in' },
    ],
    paramSchema: {
      flowLpm:     { type: 'number', min: 1, max: 30 },
      durationMin: { type: 'number', min: 1, max: 60 },
    },
  },
};
