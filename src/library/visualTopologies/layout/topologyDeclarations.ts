/**
 * topologyDeclarations.ts
 *
 * Canonical layout declarations for all nine topology templates.
 *
 * Each declaration describes WHERE each component lives using semantic rules
 * (zone, rail offsets, emitter indices) — NOT literal pixel coordinates.
 * The layout engine evaluates these rules to produce a LayoutState that
 * templates consume for rendering.
 *
 * ─── Domestic heuristics encoded here ───────────────────────────────────────
 *   • Boiler (heat source) is always left, storage always right.
 *   • Magnetic filter is near the boiler return (service zone, low x).
 *   • Expansion vessel is near the return side (protection zone, high x).
 *   • Header tank is in the loft (far right, HEADER_TANK_TOP anchor).
 *   • Emitters are distributed across the top band between source and storage.
 *   • Pumps sit inline on the flow rail (flow_offset near zero).
 *   • D2 discharge falls continuously (handled in template routing).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pipe rail geometry (pipe: { ... }) encodes where the horizontal rails
 * connect to each topology's specific circuit arrangement.  These values
 * are expressed as named constants — not scattered literals — so every
 * template references them through the computed LayoutState.
 */

import { INSTALLATION_ZONES } from '../../visualPrimitives/primitiveTokens';
import type { TopologyLayoutDeclaration } from './topologyLayoutTypes';
import type { VisualTopologyId } from '../visualTopologyRegistry';

// ─── Shared primitive dimensions at 'sm' scale (scale factor 0.7) ────────────
//
// These are the ONLY numeric constants allowed in this file that are not
// zone/rail anchors.  They are derived from primitive FOOTPRINT constants
// (see primitives/index.ts) scaled to 'sm'.  When FOOTPRINT values change,
// these must be updated too.

const SM = 0.7;

/**
 * Approximate rendered height of the BoilerPrimitive SVG at sm scale.
 * Used to derive the mid-body return connection y.
 * BOILER_FOOTPRINT.height (138) × 0.7 = 96.6 → rounded to 97.
 */
const BOILER_SM_H = Math.round(138 * SM); // 97

// ─── Declarations ─────────────────────────────────────────────────────────────

// ── 1. Sealed unvented cylinder ───────────────────────────────────────────────
// System boiler + unvented cylinder (mains-fed).
// Standard rail heights: flowY=140, returnY=300.
//
// Heat-source heuristic: system boiler sits just below the flow rail.
// Storage heuristic: cylinder is right-zone, top aligned to flow rail.
// Service heuristic: filling loop between rails mid-canvas.
// Protection heuristic: expansion vessel near return rail right-side.

const SEALED_UNVENTED_BOILER_LEFT = 56;
const SEALED_UNVENTED_BOILER_TOP_FLOW_OFFSET = 16;  // top = flowY + 16 = 156
const SEALED_UNVENTED_CYLINDER_LEFT = 520;
const SEALED_UNVENTED_CYLINDER_TOP_FLOW_OFFSET = 20; // top = flowY + 20 = 160

const sealedUnventedDeclaration: TopologyLayoutDeclaration = {
  topologyId: 'sealed_unvented_cylinder',
  flowRailMode: 'standard',
  nodes: [
    {
      role: 'boiler',
      zone: INSTALLATION_ZONES.HEAT_SOURCE,
      leftRule: { kind: 'heat_source_default', offset: SEALED_UNVENTED_BOILER_LEFT - 56 },
      topRule: { kind: 'flow_offset', offset: SEALED_UNVENTED_BOILER_TOP_FLOW_OFFSET },
    },
    {
      role: 'radiator_branch_1',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 266 },
      topRule: { kind: 'emitter_top' },
    },
    {
      role: 'radiator_branch_2',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 410 },
      topRule: { kind: 'emitter_top' },
    },
    {
      role: 'unvented_cylinder',
      zone: INSTALLATION_ZONES.STORAGE,
      leftRule: { kind: 'storage_anchor', storageLeft: SEALED_UNVENTED_CYLINDER_LEFT },
      topRule: { kind: 'flow_offset', offset: SEALED_UNVENTED_CYLINDER_TOP_FLOW_OFFSET },
    },
    {
      role: 'cylinder_zone_valve',
      zone: INSTALLATION_ZONES.CONTROLS,
      leftRule: { kind: 'zone_anchor', x: 468 },
      topRule: { kind: 'const', value: 108 },
    },
    {
      role: 'filling_loop_disconnected_default',
      zone: INSTALLATION_ZONES.SERVICE,
      leftRule: { kind: 'zone_anchor', x: 364 },
      topRule: { kind: 'return_offset', offset: -48 }, // 300 - 48 = 252
    },
    {
      role: 'expansion_vessel_on_primary_return',
      zone: INSTALLATION_ZONES.PROTECTION,
      leftRule: { kind: 'zone_anchor', x: 635 },
      topRule: { kind: 'return_offset', offset: -105 }, // 300 - 105 = 195 — connection stub above return rail
    },
    {
      role: 'pressure_gauge',
      zone: INSTALLATION_ZONES.PROTECTION,
      leftRule: { kind: 'zone_anchor', x: 610 },
      topRule: { kind: 'const', value: 88 },
    },
  ],
  pipe: {
    // Flow rail departs from x=120 (system boiler flow spur x = left+64)
    flowRailStartX: SEALED_UNVENTED_BOILER_LEFT + 64,      // 120
    // Flow rail arrives at cylinder left edge
    flowRailEndX: SEALED_UNVENTED_CYLINDER_LEFT,           // 520
    // Return vertical x = same as flow spur x
    heatSourceReturnX: SEALED_UNVENTED_BOILER_LEFT + 64,   // 120
    // Return vertical stops at mid-body of boiler (boilerTop + BOILER_SM_H/2)
    heatSourceReturnY: 156 + Math.round(BOILER_SM_H / 2), // 205
  },
};

// ── 2. Combi direct hot water ─────────────────────────────────────────────────
// Combi boiler only — no cylinder.
// Combi sits further right (left=142) to leave room for DHW stubs on the left.

const COMBI_BOILER_LEFT = 142;
const COMBI_FLOW_OFFSET = 24;    // top = flowY + 24 = 164

const combiDeclaration: TopologyLayoutDeclaration = {
  topologyId: 'combi_direct_hot_water',
  flowRailMode: 'standard',
  nodes: [
    {
      role: 'combi_boiler',
      zone: INSTALLATION_ZONES.HEAT_SOURCE,
      leftRule: { kind: 'const', value: COMBI_BOILER_LEFT },
      topRule: { kind: 'flow_offset', offset: COMBI_FLOW_OFFSET },
    },
    {
      role: 'radiator_branch_1',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 340 },
      topRule: { kind: 'emitter_top' },
    },
    {
      role: 'radiator_branch_2',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 496 },
      topRule: { kind: 'emitter_top' },
    },
  ],
  pipe: {
    // Combi flow rail departs from boiler right edge (left + BOILER_SM_W = 142 + 78 = 220)
    flowRailStartX: COMBI_BOILER_LEFT + 78,   // 220
    flowRailEndX: 620,
    heatSourceReturnX: COMBI_BOILER_LEFT + 78, // 220
    heatSourceReturnY: 164 + Math.round(BOILER_SM_H / 2), // 213
  },
};

// ── 3. Open-vented + vented cylinder ─────────────────────────────────────────
// Regular boiler + external pump + vented cylinder + header tank in loft.
// Pump sits INLINE on the flow rail (downstream of neutral point),
// placed in the emitter zone x range but at flow-rail y — this is
// KNOWN_OUT_OF_ZONE for pump (pump zone is return-side by default,
// but open-vented pumps must be on flow).

const OV_BOILER_LEFT = 56;
const OV_BOILER_FLOW_OFFSET = 20;   // 160 = 140 + 20
const OV_PUMP_LEFT = 245;
const OV_CYLINDER_LEFT = 520;

const openVentedDeclaration: TopologyLayoutDeclaration = {
  topologyId: 'open_vented_vented_cylinder',
  flowRailMode: 'standard',
  nodes: [
    {
      role: 'boiler',
      zone: INSTALLATION_ZONES.HEAT_SOURCE,
      leftRule: { kind: 'heat_source_default', offset: OV_BOILER_LEFT - 56 },
      topRule: { kind: 'flow_offset', offset: OV_BOILER_FLOW_OFFSET },
    },
    {
      // Pump inline on primary flow rail, downstream of neutral point.
      // KNOWN_OUT_OF_ZONE: sits above the canonical pump return zone.
      role: 'primary_flow_pump_downstream_vent_feed',
      zone: INSTALLATION_ZONES.SERVICE,
      leftRule: { kind: 'const', value: OV_PUMP_LEFT },
      topRule: { kind: 'flow_offset', offset: -21 }, // 119 = 140 - 21
    },
    {
      role: 'radiator_branch_1',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 274 },
      topRule: { kind: 'emitter_top' },
    },
    {
      role: 'radiator_branch_2',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 420 },
      topRule: { kind: 'emitter_top' },
    },
    {
      // Loft — above system, far right (domestic heuristic).
      role: 'header_tank',
      zone: INSTALLATION_ZONES.STORAGE,
      leftRule: { kind: 'const', value: 666 },
      topRule: { kind: 'header_tank_top' },
    },
    {
      role: 'vented_cylinder',
      zone: INSTALLATION_ZONES.STORAGE,
      leftRule: { kind: 'storage_anchor', storageLeft: OV_CYLINDER_LEFT },
      topRule: { kind: 'flow_offset', offset: 30 }, // 170 = 140 + 30
    },
  ],
  pipe: {
    flowRailStartX: OV_BOILER_LEFT + 64,   // 120
    flowRailEndX: OV_CYLINDER_LEFT,        // 560 (cylinder down-stub starts here)
    heatSourceReturnX: OV_BOILER_LEFT + 64, // 120
    heatSourceReturnY: 160 + Math.round(BOILER_SM_H / 2), // ~208 → 210
  },
};

// ── 4. Mixergy stratified cylinder ───────────────────────────────────────────
// System boiler + Mixergy cylinder.
// Elevated flow rail (flowY=190) — connects to cylinder's charging input.

const MX_BOILER_LEFT = 66;
const MX_CYLINDER_LEFT = 470;

const mixergyDeclaration: TopologyLayoutDeclaration = {
  topologyId: 'mixergy_stratified_cylinder',
  flowRailMode: 'elevated_mixergy',
  isEmitterless: true,
  nodes: [
    {
      role: 'boiler',
      zone: INSTALLATION_ZONES.HEAT_SOURCE,
      leftRule: { kind: 'heat_source_default', offset: MX_BOILER_LEFT - 56 },
      topRule: { kind: 'flow_offset', offset: -20 }, // 170 = 190 - 20
    },
    {
      role: 'mixergy_cylinder',
      zone: INSTALLATION_ZONES.STORAGE,
      leftRule: { kind: 'storage_anchor', storageLeft: MX_CYLINDER_LEFT },
      topRule: { kind: 'flow_offset', offset: -50 }, // 140 = 190 - 50
    },
  ],
  pipe: {
    flowRailStartX: MX_BOILER_LEFT + 64,  // 130
    flowRailEndX: MX_CYLINDER_LEFT,       // 470
    heatSourceReturnX: MX_BOILER_LEFT + 64, // 130
    heatSourceReturnY: 170 + Math.round(BOILER_SM_H / 2), // 219
  },
};

// ── 5. Thermal store layout ───────────────────────────────────────────────────
// Regular boiler + external pump inline on flow + thermal store.
// Elevated flow rail (flowY=176) matches the store's primary-in port height.
// Pump inline on flow rail (KNOWN_OUT_OF_ZONE for canonical pump zone).

const TS_BOILER_LEFT = 64;
const TS_PUMP_LEFT = 170;
const TS_STORE_LEFT = 430;

const thermalStoreDeclaration: TopologyLayoutDeclaration = {
  topologyId: 'thermal_store_layout',
  flowRailMode: 'elevated_thermal',
  isEmitterless: true,
  nodes: [
    {
      role: 'boiler',
      zone: INSTALLATION_ZONES.HEAT_SOURCE,
      leftRule: { kind: 'heat_source_default', offset: TS_BOILER_LEFT - 56 },
      topRule: { kind: 'flow_offset', offset: -22 }, // 154 = 176 - 22
    },
    {
      // Pump inline on primary flow rail — KNOWN_OUT_OF_ZONE (on flow, not return).
      role: 'pump',
      zone: INSTALLATION_ZONES.SERVICE,
      leftRule: { kind: 'const', value: TS_PUMP_LEFT },
      topRule: { kind: 'flow_offset', offset: -21 }, // 155 = 176 - 21
    },
    {
      role: 'thermal_store',
      zone: INSTALLATION_ZONES.STORAGE,
      leftRule: { kind: 'storage_anchor', storageLeft: TS_STORE_LEFT },
      topRule: { kind: 'flow_offset', offset: -62 }, // 114 = 176 - 62
    },
  ],
  pipe: {
    flowRailStartX: TS_BOILER_LEFT + 68,   // 132
    flowRailEndX: TS_STORE_LEFT,           // 430 (store primary-in connection)
    heatSourceReturnX: TS_BOILER_LEFT + 68, // 132
    heatSourceReturnY: 154 + Math.round(BOILER_SM_H / 2), // 203
  },
};

// ── 6. Powerflush service layout ──────────────────────────────────────────────
// Powerflush machine (far left) + 3 radiators + boiler (far RIGHT — circuit reversal).
// Boiler is KNOWN_OUT_OF_ZONE: it's on the right side because the machine
// connects to both sides of the circuit in the service context.
// Standard rail heights.

const PF_MACHINE_LEFT = 26;
const PF_BOILER_LEFT = 690;

const powerflushDeclaration: TopologyLayoutDeclaration = {
  topologyId: 'powerflush_service_layout',
  flowRailMode: 'standard',
  nodes: [
    {
      role: 'powerflush_machine',
      zone: INSTALLATION_ZONES.SERVICE,
      leftRule: { kind: 'const', value: PF_MACHINE_LEFT },
      topRule: { kind: 'flow_offset', offset: 28 }, // 168 = 140 + 28
    },
    {
      role: 'radiator_branch_1',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 316 },
      topRule: { kind: 'emitter_top' },
    },
    {
      role: 'radiator_branch_2',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 468 },
      topRule: { kind: 'emitter_top' },
    },
    {
      role: 'radiator_branch_3',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 620 },
      topRule: { kind: 'emitter_top' },
    },
    {
      // KNOWN_OUT_OF_ZONE: boiler on far right (service circuit reversal).
      role: 'boiler',
      zone: INSTALLATION_ZONES.HEAT_SOURCE,
      leftRule: { kind: 'const', value: PF_BOILER_LEFT },
      topRule: { kind: 'flow_offset', offset: 48 }, // 188 = 140 + 48
    },
    {
      // Magnetic filter near boiler return (domestic heuristic: filter near return).
      role: 'magnetic_filter_return_before_boiler',
      zone: INSTALLATION_ZONES.SERVICE,
      leftRule: { kind: 'const', value: 560 },
      topRule: { kind: 'return_offset', offset: -52 }, // 248 = 300 - 52
    },
  ],
  pipe: {
    flowRailStartX: 260,   // powerflush circuit — flow rail starts at machine exit
    flowRailEndX: PF_BOILER_LEFT,
    heatSourceReturnX: 260,
    heatSourceReturnY: 168 + Math.round(BOILER_SM_H / 2), // 217
  },
};

// ── 7. ABV protected heating loop ─────────────────────────────────────────────
// System boiler + ABV bypass valve between flow and return.
// Standard rail heights.

const ABV_BOILER_LEFT = 60;

const abvDeclaration: TopologyLayoutDeclaration = {
  topologyId: 'abv_protected_heating_loop',
  flowRailMode: 'standard',
  nodes: [
    {
      role: 'boiler',
      zone: INSTALLATION_ZONES.HEAT_SOURCE,
      leftRule: { kind: 'heat_source_default', offset: ABV_BOILER_LEFT - 56 },
      topRule: { kind: 'flow_offset', offset: 24 }, // 164 = 140 + 24
    },
    {
      role: 'restriction_radiator_branch_1',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 274 },
      topRule: { kind: 'emitter_top' },
    },
    {
      role: 'restriction_radiator_branch_2',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 420 },
      topRule: { kind: 'emitter_top' },
    },
    {
      // ABV bridge — sits between flow and return, right of emitter zone.
      role: 'abv_after_boiler_before_restrictions',
      zone: INSTALLATION_ZONES.PROTECTION,
      leftRule: { kind: 'zone_anchor', x: 470 },
      topRule: { kind: 'flow_offset', offset: 36 }, // 176 = 140 + 36
    },
  ],
  pipe: {
    flowRailStartX: ABV_BOILER_LEFT + 70,   // 130
    flowRailEndX: 620,
    heatSourceReturnX: ABV_BOILER_LEFT + 70, // 130
    heatSourceReturnY: 164 + Math.round(BOILER_SM_H / 2), // 212 → 210
  },
};

// ── 8. Magnetic filter on return ──────────────────────────────────────────────
// System boiler + magnetic filter on return (domestic heuristic: filter near boiler return).
// Standard rail heights.

const MF_BOILER_LEFT = 70;
const MF_FILTER_LEFT = 188; // near boiler return — domestic heuristic

const magneticFilterDeclaration: TopologyLayoutDeclaration = {
  topologyId: 'magnetic_filter_on_return',
  flowRailMode: 'standard',
  nodes: [
    {
      role: 'boiler',
      zone: INSTALLATION_ZONES.HEAT_SOURCE,
      leftRule: { kind: 'heat_source_default', offset: MF_BOILER_LEFT - 56 },
      topRule: { kind: 'flow_offset', offset: 24 }, // 164 = 140 + 24
    },
    {
      role: 'radiator_branch_1',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 248 },
      topRule: { kind: 'emitter_top' },
    },
    {
      role: 'radiator_branch_2',
      zone: INSTALLATION_ZONES.EMITTERS,
      leftRule: { kind: 'emitter', emitterLeft: 394 },
      topRule: { kind: 'emitter_top' },
    },
    {
      // Magnetic filter near boiler return — domestic heuristic.
      role: 'magnetic_filter_return_final_before_boiler',
      zone: INSTALLATION_ZONES.SERVICE,
      leftRule: { kind: 'zone_anchor', x: MF_FILTER_LEFT },
      topRule: { kind: 'return_offset', offset: -54 }, // 246 = 300 - 54
    },
  ],
  pipe: {
    flowRailStartX: MF_BOILER_LEFT + 70,   // 140
    flowRailEndX: 560,
    heatSourceReturnX: MF_BOILER_LEFT + 70, // 140
    heatSourceReturnY: 164 + Math.round(BOILER_SM_H / 2), // 212 → 220
  },
};

// ── 9. System pressure layout ─────────────────────────────────────────────────
// System boiler + PipeLoopPrimitive (which renders its own internal circuit) +
// three pressure gauge states + expansion vessel.
// PipeLoopPrimitive contains its own pipe rendering; the topology adds gauges.
// Standard rail heights, but pipe rail geometry is minimal (PipeLoop handles routing).

const SP_BOILER_LEFT = 46;

const systemPressureDeclaration: TopologyLayoutDeclaration = {
  topologyId: 'system_pressure_layout',
  flowRailMode: 'standard',
  isEmitterless: true,
  nodes: [
    {
      role: 'boiler',
      zone: INSTALLATION_ZONES.HEAT_SOURCE,
      leftRule: { kind: 'heat_source_default', offset: SP_BOILER_LEFT - 56 },
      topRule: { kind: 'flow_offset', offset: 14 }, // 154 = 140 + 14
    },
    {
      role: 'pipe_loop',
      zone: INSTALLATION_ZONES.SERVICE,
      leftRule: { kind: 'const', value: 190 },
      topRule: { kind: 'const', value: 116 },
    },
    {
      role: 'expansion_vessel',
      zone: INSTALLATION_ZONES.PROTECTION,
      leftRule: { kind: 'zone_anchor', x: 468 },
      topRule: { kind: 'const', value: 210 },
    },
    {
      role: 'pressure_gauge_low',
      zone: INSTALLATION_ZONES.PROTECTION,
      leftRule: { kind: 'zone_anchor', x: 612 },
      topRule: { kind: 'const', value: 58 },
    },
    {
      role: 'pressure_gauge_normal',
      zone: INSTALLATION_ZONES.PROTECTION,
      leftRule: { kind: 'zone_anchor', x: 612 },
      topRule: { kind: 'const', value: 170 },
    },
    {
      role: 'pressure_gauge_high',
      zone: INSTALLATION_ZONES.PROTECTION,
      leftRule: { kind: 'zone_anchor', x: 612 },
      topRule: { kind: 'const', value: 282 },
    },
  ],
  pipe: {
    // PipeLoopPrimitive renders its own pipe circuit; topology-level rails are minimal.
    flowRailStartX: SP_BOILER_LEFT + 64,   // 110
    flowRailEndX: 190,                     // left edge of PipeLoop
    heatSourceReturnX: SP_BOILER_LEFT + 64,
    heatSourceReturnY: 154 + Math.round(BOILER_SM_H / 2), // 202
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

const DECLARATIONS: Record<VisualTopologyId, TopologyLayoutDeclaration> = {
  sealed_unvented_cylinder:    sealedUnventedDeclaration,
  combi_direct_hot_water:      combiDeclaration,
  open_vented_vented_cylinder: openVentedDeclaration,
  mixergy_stratified_cylinder: mixergyDeclaration,
  thermal_store_layout:        thermalStoreDeclaration,
  powerflush_service_layout:   powerflushDeclaration,
  abv_protected_heating_loop:  abvDeclaration,
  magnetic_filter_on_return:   magneticFilterDeclaration,
  system_pressure_layout:      systemPressureDeclaration,
};

/**
 * Returns the canonical layout declaration for the given topology id.
 * Used by `computeTopologyLayout` in template files.
 */
export function getTopologyLayoutDeclaration(id: VisualTopologyId): TopologyLayoutDeclaration {
  return DECLARATIONS[id];
}
