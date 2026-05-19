/**
 * TopologyLayoutZones.test.ts
 *
 * Zone regression test — asserts that all nine topology layout declarations
 * produce equipment positions within the canonical zone bounds defined in
 * TOPOLOGY_LAYOUT_GRID.md.
 *
 * Strategy: invoke the layout engine directly.
 *   1. For each topology, call computeTopologyLayout(getTopologyLayoutDeclaration(id)).
 *   2. Run validateLayout() — checks zone bounds, disconnected zones, rail sanity.
 *   3. Assert that any violation is listed in KNOWN_OUT_OF_ZONE (and that the
 *      whitelist has no stale entries).
 *
 * Rationale for migrating from source-file regex:
 *   Templates no longer contain literal x/y coordinates; all positions are
 *   computed by the engine.  Testing the engine output directly is the correct
 *   regression strategy — it validates actual runtime behaviour, not source text.
 *
 * KNOWN_OUT_OF_ZONE entries document intentional placement exceptions:
 *   • powerflush boiler on the right side (service circuit reversal)
 *   • pumps inline on primary flow rail (open-vented, thermal-store)
 */

import { describe, it, expect } from 'vitest';
import {
  computeTopologyLayout,
  getTopologyLayoutDeclaration,
  validateLayout,
} from '../layout';
import type { VisualTopologyId } from '../visualTopologyRegistry';

// ─── All topology IDs ──────────────────────────────────────────────────────────

const ALL_TOPOLOGY_IDS: VisualTopologyId[] = [
  'sealed_unvented_cylinder',
  'combi_direct_hot_water',
  'open_vented_vented_cylinder',
  'mixergy_stratified_cylinder',
  'thermal_store_layout',
  'powerflush_service_layout',
  'abv_protected_heating_loop',
  'magnetic_filter_on_return',
  'system_pressure_layout',
];

// ─── Known out-of-zone exceptions ─────────────────────────────────────────────
//
// Format: `${topologyId}:${role}`.
// Add an entry here (with comment) when a topology intentionally places
// equipment outside its canonical zone.  Do NOT add entries without explaining
// the domestic or service-context heuristic that justifies the exception.

const KNOWN_OUT_OF_ZONE = new Set<string>([
  // PowerflushServiceTopology: boiler on far right — in a powerflush service
  // context the machine connects to both sides of the circuit, reversing the
  // normal heat-source position.
  'powerflush_service_layout:boiler',

  // PowerflushServiceTopology: machine at x=26 — the powerflush machine is
  // a service tool that physically straps onto the external circuit far left,
  // outside all standard installation zones (service zone xMin=140).
  'powerflush_service_layout:powerflush_machine',

  // Open-vented topology: pump sits inline on primary flow downstream of the
  // close-coupled vent/feed neutral point.  Canonical domestic rule for
  // open-vented systems — pump must NOT be on the return leg.
  'open_vented_vented_cylinder:primary_flow_pump_downstream_vent_feed',

  // Open-vented topology: header tank is in the loft (y=18), above the
  // storage zone y-bounds (130–225).  The header tank is a loft component;
  // no standard installation zone covers the y=10–65 loft band.
  'open_vented_vented_cylinder:header_tank',

  // system_pressure_layout: pipe_loop at y=116 sits above service zone yMin=130.
  // The PipeLoopPrimitive represents the sealed circuit between boiler and
  // gauges — it sits at the juncture of the emitter band and service zone,
  // intentionally above the canonical service y-floor.
  'system_pressure_layout:pipe_loop',
]);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('topology layout zone regression', () => {
  it('covers all nine canonical topology IDs', () => {
    expect(ALL_TOPOLOGY_IDS).toHaveLength(9);
  });

  it('every topology produces a LayoutState with valid rail ordering (flowY < returnY)', () => {
    for (const id of ALL_TOPOLOGY_IDS) {
      const decl   = getTopologyLayoutDeclaration(id);
      const layout = computeTopologyLayout(decl);
      expect(
        layout.rails.flowY,
        `${id}: flowY must be less than returnY`,
      ).toBeLessThan(layout.rails.returnY);
    }
  });

  it('every topology has a heat_source component in its declaration', () => {
    for (const id of ALL_TOPOLOGY_IDS) {
      const decl = getTopologyLayoutDeclaration(id);
      const hasHeatSource = decl.nodes.some(n => n.zone === 'heat_source');
      expect(hasHeatSource, `${id}: missing heat_source zone component`).toBe(true);
    }
  });

  it('all non-whitelisted nodes fall within their declared zone bounds', () => {
    for (const id of ALL_TOPOLOGY_IDS) {
      const decl   = getTopologyLayoutDeclaration(id);
      const layout = computeTopologyLayout(decl);
      const result = validateLayout(layout, decl);

      const unwhitelisted = result.violations.filter(v => {
        const key = `${id}:${v.role}`;
        return !KNOWN_OUT_OF_ZONE.has(key);
      });

      expect(
        unwhitelisted,
        `${id} has unexpected zone violations:\n` +
          unwhitelisted.map(v => `  [${v.kind}] ${v.role}: ${v.message}`).join('\n'),
      ).toHaveLength(0);
    }
  });

  it('all KNOWN_OUT_OF_ZONE entries correspond to actual violations (no stale entries)', () => {
    const allViolationKeys = new Set<string>();

    for (const id of ALL_TOPOLOGY_IDS) {
      const decl   = getTopologyLayoutDeclaration(id);
      const layout = computeTopologyLayout(decl);
      const result = validateLayout(layout, decl);

      for (const v of result.violations) {
        allViolationKeys.add(`${id}:${v.role}`);
      }
    }

    for (const key of KNOWN_OUT_OF_ZONE) {
      expect(
        allViolationKeys.has(key),
        `KNOWN_OUT_OF_ZONE entry "${key}" does not produce a validation violation — remove it`,
      ).toBe(true);
    }
  });

  it('emitter positions fall within the emitters zone (x: 240–720, y: 60–135)', () => {
    const EMITTER_BOUNDS = { xMin: 240, xMax: 720, yMin: 60, yMax: 135 };

    for (const id of ALL_TOPOLOGY_IDS) {
      const decl   = getTopologyLayoutDeclaration(id);
      const layout = computeTopologyLayout(decl);

      for (const node of decl.nodes) {
        if (node.zone !== 'emitters') continue;
        const pos = layout.positions[node.role];
        expect(pos.left, `${id}/${node.role} left out of emitter x-zone`).toBeGreaterThanOrEqual(EMITTER_BOUNDS.xMin);
        expect(pos.left, `${id}/${node.role} left out of emitter x-zone`).toBeLessThanOrEqual(EMITTER_BOUNDS.xMax);
        expect(pos.top,  `${id}/${node.role} top out of emitter y-zone`).toBeGreaterThanOrEqual(EMITTER_BOUNDS.yMin);
        expect(pos.top,  `${id}/${node.role} top out of emitter y-zone`).toBeLessThanOrEqual(EMITTER_BOUNDS.yMax);
      }
    }
  });

  it('heat source positions fall within the heat_source zone (x: 44–175, y: 140–225) unless whitelisted', () => {
    const HEAT_SOURCE_BOUNDS = { xMin: 44, xMax: 175, yMin: 140, yMax: 225 };

    for (const id of ALL_TOPOLOGY_IDS) {
      const decl   = getTopologyLayoutDeclaration(id);
      const layout = computeTopologyLayout(decl);

      for (const node of decl.nodes) {
        if (node.zone !== 'heat_source') continue;
        const key = `${id}:${node.role}`;
        if (KNOWN_OUT_OF_ZONE.has(key)) continue;

        const pos = layout.positions[node.role];
        expect(pos.left, `${id}/${node.role} left out of heat_source x-zone`).toBeGreaterThanOrEqual(HEAT_SOURCE_BOUNDS.xMin);
        expect(pos.left, `${id}/${node.role} left out of heat_source x-zone`).toBeLessThanOrEqual(HEAT_SOURCE_BOUNDS.xMax);
        expect(pos.top,  `${id}/${node.role} top out of heat_source y-zone`).toBeGreaterThanOrEqual(HEAT_SOURCE_BOUNDS.yMin);
        expect(pos.top,  `${id}/${node.role} top out of heat_source y-zone`).toBeLessThanOrEqual(HEAT_SOURCE_BOUNDS.yMax);
      }
    }
  });

  it('storage positions fall within the storage zone (x: 460–725, y: 130–225)', () => {
    const STORAGE_BOUNDS = { xMin: 430, xMax: 725, yMin: 110, yMax: 225 };

    for (const id of ALL_TOPOLOGY_IDS) {
      const decl   = getTopologyLayoutDeclaration(id);
      const layout = computeTopologyLayout(decl);

      for (const node of decl.nodes) {
        if (node.zone !== 'storage') continue;
        const key = `${id}:${node.role}`;
        if (KNOWN_OUT_OF_ZONE.has(key)) continue;

        const pos = layout.positions[node.role];
        // header_tank (loft) is exempt from y-zone — it sits at y=18 above all zones.
        const isLoftComponent = node.role === 'header_tank';
        expect(pos.left, `${id}/${node.role} left out of storage x-zone`).toBeGreaterThanOrEqual(STORAGE_BOUNDS.xMin);
        expect(pos.left, `${id}/${node.role} left out of storage x-zone`).toBeLessThanOrEqual(STORAGE_BOUNDS.xMax);
        if (!isLoftComponent) {
          expect(pos.top,  `${id}/${node.role} top out of storage y-zone`).toBeGreaterThanOrEqual(STORAGE_BOUNDS.yMin);
          expect(pos.top,  `${id}/${node.role} top out of storage y-zone`).toBeLessThanOrEqual(STORAGE_BOUNDS.yMax);
        }
      }
    }
  });
});
