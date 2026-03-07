/**
 * systemGraphGenerator — converts a SystemConceptModel into a default BuildGraph.
 *
 * Call `conceptModelToGraph(model)` to get a pre-wired BuildGraph that can be
 * loaded directly into the lab builder or passed to `graphToLabControls()`.
 *
 * The generated graph mirrors the topology of the canonical presets:
 *
 *   combi (system_boiler + combi_plate_hex + none)
 *     → heat_source_combi, radiator_loop, manifold_hot, manifold_cold, outlets
 *
 *   regular_boiler + y_plan + vented_cylinder
 *     → heat_source_regular_boiler, feed_and_expansion, open_vent,
 *       three_port_valve, radiator_loop, dhw_vented_cylinder,
 *       cws_cistern, manifold_hot, manifold_cold, outlets
 *
 *   system_boiler + s_plan + unvented_cylinder
 *     → heat_source_system_boiler, pump, tee_ch_flow, zone_valve (×2),
 *       radiator_loop, dhw_unvented_cylinder, manifold_hot, manifold_cold, outlets
 *
 *   heat_pump + hp_diverter + unvented_cylinder
 *     → heat_source_heat_pump, buffer, tee_ch_flow, tee_ch_return,
 *       emitter loop(s), dhw_unvented_cylinder, manifold_hot, manifold_cold, outlets
 *
 * For stored systems, graphs are generated through `buildStoredTopology()` which
 * dispatches to `buildStoredYPlan()` or `buildStoredSPlan()`.  Each branch
 * produces four explicit circuit domains:
 *   heating  — boiler ↔ emitters (radiators / UFH)
 *   primary  — boiler ↔ cylinder coil
 *   cold     — mains / CWS cistern → cylinder cold_in
 *   dhw      — cylinder hot_out → outlets
 *
 * Expert/engineer detail (feed-and-vent points, expansion vessel, ABV,
 * wiring centre) is either absent from the graph or placed only where
 * physically required (e.g. open-vent on a regular-boiler Y-plan system).
 */

import type { BuildGraph, BuildEdge, BuildNode, PartKind } from '../builder/types';
import type { SystemConceptModel, EmitterKind, HotWaterServiceKind } from './types';
import type { CircuitDomain } from '../types/graph';

// ─── Small helpers ────────────────────────────────────────────────────────────

function node(id: string, kind: PartKind, x: number, y: number): BuildNode {
  return { id, kind, x, y, r: 0 };
}

function edge(id: string, fromNode: string, fromPort: string, toNode: string, toPort: string, domain?: CircuitDomain): BuildEdge {
  return {
    id,
    from: { nodeId: fromNode, portId: fromPort },
    to: { nodeId: toNode, portId: toPort },
    ...(domain !== undefined ? { domain } : {}),
  };
}

// ─── Emitter PartKind resolution ─────────────────────────────────────────────

function emitterKindToPartKind(emitter: EmitterKind): PartKind {
  switch (emitter) {
    case 'ufh':      return 'ufh_loop';
    case 'radiators':
    case 'mixed':
    default:         return 'radiator_loop';
  }
}

// ─── Cylinder PartKind resolution ────────────────────────────────────────────

function cylinderPartKind(hotWaterService: HotWaterServiceKind): PartKind {
  switch (hotWaterService) {
    case 'mixergy':           return 'dhw_mixergy';
    case 'vented_cylinder':   return 'dhw_vented_cylinder';
    case 'unvented_cylinder':
    default:                  return 'dhw_unvented_cylinder';
  }
}

// ─── Sub-builders ─────────────────────────────────────────────────────────────

/**
 * Standard DHW outlet cluster: manifold_hot + manifold_cold + 3 outlets.
 * Returns the nodes and edges to append to any graph variant.
 */
function buildOutletCluster(
  mhX: number, mhY: number,
  mcX: number, mcY: number,
  outX: number,
): { nodes: BuildNode[]; edges: BuildEdge[] } {
  const nodes: BuildNode[] = [
    node('mh',    'manifold_hot',  mhX, mhY),
    node('mc',    'manifold_cold', mcX, mcY),
    node('sh',    'shower_outlet', outX, mhY - 80),
    node('bath',  'bath_outlet',   outX, mhY + 20),
    node('tap1',  'tap_outlet',    outX, mhY + 120),
  ];

  const edges: BuildEdge[] = [
    // Hot distribution
    edge('mh_sh',   'mh', 'out1', 'sh',   'hot_in',  'dhw'),
    edge('mh_bath', 'mh', 'out2', 'bath', 'hot_in',  'dhw'),
    edge('mh_tap1', 'mh', 'out3', 'tap1', 'hot_in',  'dhw'),
    // Cold distribution
    edge('mc_sh',   'mc', 'out2', 'sh',   'cold_in', 'cold'),
    edge('mc_bath', 'mc', 'out3', 'bath', 'cold_in', 'cold'),
    edge('mc_tap1', 'mc', 'out4', 'tap1', 'cold_in', 'cold'),
  ];

  return { nodes, edges };
}

// ─── Variant generators ───────────────────────────────────────────────────────

/**
 * Combi variant — system_boiler + combi_plate_hex + none.
 *
 * heat_source_combi provides both CH flow and DHW on-demand.
 * No separate cylinder or zone-control topology.
 */
function buildCombiGraph(emitters: EmitterKind[]): BuildGraph {
  const primaryEmitter = emitters[0] ?? 'radiators';
  const emitterKind = emitterKindToPartKind(primaryEmitter);

  const nodes: BuildNode[] = [
    node('hs',   'heat_source_combi', 180, 300),
    node('rads', emitterKind,         520, 420),
  ];
  const edges: BuildEdge[] = [
    edge('ch1', 'hs',   'flow_out',     'rads', 'flow_in',      'heating'),
    edge('ch2', 'rads', 'return_out',   'hs',   'return_in',    'heating'),
    edge('hot_link', 'hs', 'hot_out',  'mh', 'in',              'dhw'),
    edge('cold_link','hs', 'cold_in',  'mc', 'in',              'cold'),
  ];

  // Include a UFH loop alongside radiators for 'mixed' emitters
  if (primaryEmitter === 'mixed') {
    nodes.push(node('ufh', 'ufh_loop', 520, 540));
    edges.push(
      edge('ufh1', 'hs',  'flow_out',    'ufh', 'flow_in',      'heating'),
      edge('ufh2', 'ufh', 'return_out',  'hs',  'return_in',    'heating'),
    );
  }

  const { nodes: outletNodes, edges: outletEdges } = buildOutletCluster(
    720, 200, 720, 380, 960,
  );

  return {
    nodes: [...nodes, ...outletNodes],
    edges: [...edges, ...outletEdges],
    outletBindings: { A: 'sh', B: 'bath', C: 'tap1' },
  };
}

// ─── Stored-system topology builders ─────────────────────────────────────────

/**
 * Stored Y-plan topology: regular boiler + 3-port valve + vented cylinder.
 *
 * Branch structure:
 *   heating — boiler.ch_flow_out → 3-port valve → radiators → boiler.ch_return_in
 *   primary — 3-port valve → cylinder.coil_flow → cylinder.coil_return → boiler.ch_return_in
 *   cold    — CWS cistern → manifold_cold → cylinder.cold_in
 *   dhw     — cylinder.hot_out → manifold_hot → outlets
 *
 * Open-vented primary circuit: feed-and-expansion cistern and open vent are
 * included as physically required components.
 *
 * Note: Y-plan is an open-vented topology and is always paired with a vented
 * cylinder (dhw_vented_cylinder).  The `hotWaterService` parameter is accepted
 * for API symmetry with `buildStoredSPlan` but the cylinder kind is fixed.
 *
 * Radiators connect only on the heating domain.
 * Cylinder coil connects only on the primary domain.
 * Cylinder domestic side (cold_in / hot_out) uses cold / dhw domains only.
 */
export function buildStoredYPlan(
  _hotWaterService: HotWaterServiceKind,
  emitters: EmitterKind[],
): BuildGraph {
  const emitterKind = emitterKindToPartKind(emitters[0] ?? 'radiators');

  const nodes: BuildNode[] = [
    node('hs',   'heat_source_regular_boiler', 160, 340),
    node('fe',   'feed_and_expansion',         160, 160),
    node('ov',   'open_vent',                  160, 240),
    node('v3',   'three_port_valve',           420, 340),
    node('rads', emitterKind,                  700, 460),
    node('cyl',  'dhw_vented_cylinder',        700, 180),
    node('cws',  'cws_cistern',                480,  60),
  ];

  const edges: BuildEdge[] = [
    // ── Heating branch: boiler → 3-port valve.out_a → radiators → boiler ──────
    edge('b1', 'hs',   'flow_out',    'v3',  'in',           'heating'),
    edge('b2', 'v3',   'out_a',       'rads','flow_in',       'heating'),
    edge('b3', 'rads', 'return_out',  'hs',  'return_in',    'heating'),
    // ── Primary branch: 3-port valve.out_b → cylinder coil → boiler ──────────
    edge('b4', 'v3',  'out_b',        'cyl', 'coil_flow',    'primary'),
    edge('b5', 'cyl', 'coil_return',  'hs',  'return_in',    'primary'),
    // ── Feed-and-expansion and open vent (open-vented circuit) ────────────────
    edge('fe1', 'fe', 'feed_in',  'hs', 'return_in',  'heating'),
    edge('ov1', 'ov', 'vent_in',  'hs', 'flow_out',   'heating'),
    // ── DHW hot draw-off: cylinder.hot_out → manifold_hot ────────────────────
    edge('hot_link', 'cyl', 'hot_out', 'mh', 'in',         'dhw'),
    // ── Cold branch: CWS cistern → manifold_cold → cylinder.cold_in ──────────
    edge('cws_mc', 'cws', 'cold_out', 'mc',  'in',         'cold'),
    edge('mc_cyl', 'mc',  'out1',     'cyl', 'cold_in',    'cold'),
  ];

  const { nodes: outletNodes, edges: outletEdges } = buildOutletCluster(
    880, 160, 880, 340, 1100,
  );

  return {
    nodes: [...nodes, ...outletNodes],
    edges: [...edges, ...outletEdges],
    outletBindings: { A: 'sh', B: 'bath', C: 'tap1' },
  };
}

/**
 * Stored S-plan topology: system boiler + 2 × zone valves + cylinder.
 *
 * Branch structure:
 *   heating — boiler → pump → tee → zoneValveCH → radiators → boiler
 *   primary — boiler → pump → tee → zoneValveHW → cylinder.coil_flow
 *             → cylinder.coil_return → boiler
 *   cold    — manifold_cold (open mains entry) → cylinder.cold_in
 *   dhw     — cylinder.hot_out → manifold_hot → outlets
 *
 * Sealed circuit: no feed-and-expansion or open vent (integrated pump +
 * expansion vessel inside the system boiler body).
 *
 * Radiators connect only on the heating domain.
 * Cylinder coil connects only on the primary domain.
 * Cylinder domestic side (cold_in / hot_out) uses cold / dhw domains only.
 */
export function buildStoredSPlan(
  hotWaterService: HotWaterServiceKind,
  emitters: EmitterKind[],
): BuildGraph {
  const emitterKind = emitterKindToPartKind(emitters[0] ?? 'radiators');
  const cylKind = cylinderPartKind(hotWaterService);

  const nodes: BuildNode[] = [
    node('hs',    'heat_source_system_boiler', 160, 340),
    node('pump',  'pump',                      340, 340),
    node('tee_f', 'tee_ch_flow',               480, 340),
    node('zch',   'zone_valve',                600, 420),
    node('zcyl',  'zone_valve',                600, 240),
    node('rads',  emitterKind,                 820, 420),
    node('cyl',   cylKind,                     820, 180),
  ];

  const edges: BuildEdge[] = [
    // ── Boiler → pump → tee (shared trunk) ──────────────────────────────────
    edge('p1',  'hs',    'flow_out',  'pump',  'in',         'heating'),
    edge('p2',  'pump',  'out',       'tee_f', 'in',         'heating'),
    edge('pf1', 'tee_f', 'out1',     'zch',   'in',         'heating'),
    edge('pf2', 'tee_f', 'out2',     'zcyl',  'in',         'primary'),
    // ── Heating branch: zoneValveCH → radiators → boiler ─────────────────────
    edge('ch1', 'zch',  'out_a',      'rads', 'flow_in',      'heating'),
    edge('ch2', 'rads', 'return_out', 'hs',   'return_in',    'heating'),
    // ── Primary branch: zoneValveHW → cylinder coil → boiler ─────────────────
    edge('cy1', 'zcyl', 'out_a',       'cyl', 'coil_flow',    'primary'),
    edge('cy2', 'cyl',  'coil_return', 'hs',  'return_in',    'primary'),
    // ── DHW hot draw-off: cylinder.hot_out → manifold_hot ────────────────────
    edge('hot_link', 'cyl', 'hot_out', 'mh', 'in',             'dhw'),
    // ── Cold branch (open mains): manifold_cold → cylinder.cold_in ───────────
    edge('mc_cyl', 'mc', 'out1', 'cyl', 'cold_in',             'cold'),
  ];

  const { nodes: outletNodes, edges: outletEdges } = buildOutletCluster(
    1020, 160, 600, 560, 1220,
  );

  return {
    nodes: [...nodes, ...outletNodes],
    edges: [...edges, ...outletEdges],
    outletBindings: { A: 'sh', B: 'bath', C: 'tap1' },
  };
}

/**
 * Stored-system topology dispatcher.
 *
 * Routes to the correct dedicated builder based on the controls topology:
 *   y_plan → buildStoredYPlan  (regular boiler + 3-port valve + vented cylinder)
 *   s_plan → buildStoredSPlan  (system boiler + zone valves + cylinder)
 *
 * Falls back to the S-plan builder for any other stored-system combination.
 * Combis must NOT be routed through this function (use buildCombiGraph instead).
 */
export function buildStoredTopology(model: SystemConceptModel): BuildGraph {
  if (model.controls === 'y_plan') {
    return buildStoredYPlan(model.hotWaterService, model.emitters);
  }
  // s_plan, s_plan_multi_zone, or any fallback stored system
  return buildStoredSPlan(model.hotWaterService, model.emitters);
}

/**
 * Heat pump + hp_diverter + cylinder variant.
 *
 * Uses a buffer tank as the hydraulic separator.
 * Primary loop: heat pump → buffer → heat pump.
 * Secondary loop: buffer → tee → emitters → buffer.
 * DHW cylinder: mains cold supply + hot output to manifold.
 */
function buildHeatPumpGraph(
  hotWaterService: HotWaterServiceKind,
  emitters: EmitterKind[],
): BuildGraph {
  const primaryEmitter = emitters[0] ?? 'ufh';
  const emitterKind = emitterKindToPartKind(primaryEmitter);
  const cylKind = cylinderPartKind(hotWaterService);

  const nodes: BuildNode[] = [
    node('hp',     'heat_source_heat_pump',  140, 360),
    node('buf',    'buffer',                 340, 360),
    node('tee_sf', 'tee_ch_flow',            520, 340),
    node('tee_sr', 'tee_ch_return',          520, 420),
    node('rads',   emitterKind,              700, 300),
    node('cyl',    cylKind,                  700, 140),
  ];

  const edges: BuildEdge[] = [
    // Heat pump → buffer primary loop
    edge('h1', 'hp',  'flow_out',       'buf', 'primary_flow',   'primary'),
    edge('h2', 'buf', 'primary_return', 'hp',  'return_in',      'primary'),
    // Buffer secondary → tee → emitter loop
    edge('s0',  'buf',    'secondary_flow',   'tee_sf', 'in',    'heating'),
    edge('sf1', 'tee_sf', 'out1',             'rads',   'flow_in','heating'),
    edge('sr1', 'rads',   'return_out',       'tee_sr', 'out1',  'heating'),
    edge('s5',  'tee_sr', 'in',               'buf',    'secondary_return', 'heating'),
    // Hot manifold link
    edge('hot_link', 'cyl', 'hot_out', 'mh', 'in',               'dhw'),
    // Cold manifold link → cylinder cold_in
    edge('mc_cyl', 'mc', 'out1', 'cyl', 'cold_in',               'cold'),
  ];

  // Include UFH loop for 'mixed' or when the primary emitter is not already UFH
  if (primaryEmitter === 'mixed') {
    nodes.push(node('ufh', 'ufh_loop', 700, 440));
    edges.push(
      edge('sf2', 'tee_sf', 'out2', 'ufh',    'flow_in',         'heating'),
      edge('sr2', 'ufh',    'return_out', 'tee_sr', 'out2',      'heating'),
    );
  }

  const { nodes: outletNodes, edges: outletEdges } = buildOutletCluster(
    920, 120, 920, 340, 1120,
  );

  return {
    nodes: [...nodes, ...outletNodes],
    edges: [...edges, ...outletEdges],
    outletBindings: { A: 'sh', B: 'bath', C: 'tap1' },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a `SystemConceptModel` into a default `BuildGraph`.
 *
 * The returned graph can be loaded directly into the lab builder or passed to
 * `graphToLabControls()` to produce simulation parameters for Play mode.
 *
 * Routing logic:
 *   1. hotWaterService === 'combi_plate_hex'       → combi graph (no cylinder)
 *   2. heatSource === 'heat_pump'                  → heat pump buffer graph
 *   3. stored system (any cylinder kind)           → buildStoredTopology dispatcher
 *      ├─ controls === 'y_plan'                    → buildStoredYPlan
 *      └─ controls === 's_plan' / other            → buildStoredSPlan
 *
 * Stored systems always route through `buildStoredTopology` so that heating,
 * primary, cold, and DHW branches are generated separately and correctly.
 * Combis never reach the stored-system path.
 */
export function conceptModelToGraph(model: SystemConceptModel): BuildGraph {
  const { heatSource, hotWaterService, emitters } = model;

  // Combi — integrated plate HEX, no separate cylinder
  if (hotWaterService === 'combi_plate_hex') {
    return buildCombiGraph(emitters);
  }

  // Heat pump — always uses the buffer/diverter topology
  if (heatSource === 'heat_pump') {
    return buildHeatPumpGraph(hotWaterService, emitters);
  }

  // All stored-system variants (boiler + cylinder) route through the dedicated
  // stored-system topology dispatcher which generates correct, separate branches
  // for heating, primary, cold, and DHW domains.
  return buildStoredTopology(model);
}
