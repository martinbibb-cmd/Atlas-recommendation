/**
 * legoTypes — core type definitions for the Lego block graph system.
 *
 * One underlying graph + parameters model, many views.
 * Blocks are categorised by function; edges connect typed ports.
 */

// ─── Port types ───────────────────────────────────────────────────────────────

export type PortType =
  | 'cold_water'
  | 'hot_water'
  | 'water'
  | 'heating_flow'
  | 'heating_return'
  | 'heat';

// ─── Block types ──────────────────────────────────────────────────────────────

/** All block type identifiers (catalogue keys). */
export type BlockType =
  // Pressure source
  | 'mains_supply'
  | 'tank_head'
  | 'whole_house_booster'
  // Flow restriction
  | 'pipe_section'
  | 'outlet_restriction'
  | 'unvented_inlet_group'
  // Heat source
  | 'boiler_combi_dhw_hex'
  | 'boiler_primary'
  | 'heat_pump_primary'
  | 'immersion_heater'
  // Storage
  | 'cylinder_vented'
  | 'cylinder_unvented'
  | 'buffer_tank'
  // Control & switching
  | 'diverter_valve'
  | 'flow_sensor_gate'
  // Distribution
  | 'branch_splitter'
  // Outlet / demand
  | 'draw_event';

// ─── Block categories ─────────────────────────────────────────────────────────

export type BlockCategory =
  | 'pressure_source'
  | 'flow_restriction'
  | 'heat_source'
  | 'storage'
  | 'control_switching'
  | 'distribution'
  | 'outlet_demand';

// ─── Identifiers ──────────────────────────────────────────────────────────────

export type BlockId = string;

// ─── Ports ────────────────────────────────────────────────────────────────────

export interface LegoPort {
  id: string;
  type: PortType;
  direction: 'in' | 'out';
}

// ─── Params ───────────────────────────────────────────────────────────────────

/** Param schema entry for the catalog (describes valid values, not runtime). */
export interface ParamSchema {
  type: 'number' | 'string' | 'enum';
  min?: number;
  max?: number;
  options?: string[];
  default?: number | string;
}

/** Free-form param bag for a block instance. */
export type BlockParams = Record<string, number | string | undefined>;

// ─── Graph primitives ─────────────────────────────────────────────────────────

export interface LegoBlock {
  id: BlockId;
  type: BlockType;
  params: BlockParams;
  /** Optional canvas position for future visual editor. */
  x?: number;
  y?: number;
}

export interface LegoEdge {
  fromBlockId: BlockId;
  fromPortId: string;
  toBlockId: BlockId;
  toPortId: string;
}

export interface LegoGraph {
  blocks: LegoBlock[];
  edges: LegoEdge[];
}

// ─── Scenario ─────────────────────────────────────────────────────────────────

export interface ScenarioMeta {
  name: string;
  description: string;
  tags: string[];
}

export interface LegoScenario {
  meta: ScenarioMeta;
  graph: LegoGraph;
}

// ─── View modes ───────────────────────────────────────────────────────────────

export type ViewMode = 'plumbing' | 'system' | 'performance';
