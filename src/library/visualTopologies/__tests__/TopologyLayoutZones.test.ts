/**
 * TopologyLayoutZones.test.ts
 *
 * Zone regression test — asserts that equipment anchor coordinates in
 * visualTopologies.tsx remain within the bounds defined in
 * TOPOLOGY_LAYOUT_GRID.md.
 *
 * Strategy: static analysis of the source file.  We parse every
 * `nodeStyle(x, y)` call alongside the immediately-following primitive
 * component name, then validate x/y against the canonical zone table.
 *
 * When a topology legitimately places equipment outside a zone (e.g. the
 * powerflush topology puts the boiler on the right side of the circuit),
 * add it to KNOWN_OUT_OF_ZONE below and explain why.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TOPOLOGIES_SRC = path.resolve(
  __dirname,
  '../topologies/visualTopologies.tsx',
);

// ─── Canonical zone bounds (matches TOPOLOGY_LAYOUT_GRID.md) ────────────────

interface Zone { xMin: number; xMax: number; yMin: number; yMax: number }

const ZONES: Record<string, Zone> = {
  boiler:     { xMin: 44,  xMax: 175, yMin: 140, yMax: 225 },
  cylinder:   { xMin: 460, xMax: 725, yMin: 130, yMax: 225 },
  radiator:   { xMin: 240, xMax: 725, yMin: 60,  yMax: 135 },
  pump:       { xMin: 140, xMax: 225, yMin: 225, yMax: 295 },
  header_tank:{ xMin: 640, xMax: 810, yMin: 10,  yMax: 65  },
};

// Equipment keywords mapped to a zone name.
const COMPONENT_ZONE_MAP: Record<string, string> = {
  BoilerPrimitive:          'boiler',
  CylinderPrimitive:        'cylinder',
  MixergyCylinderPrimitive: 'cylinder',
  RadiatorPrimitive:        'radiator',
  PumpPrimitive:            'pump',
  HeaderTankPrimitive:      'header_tank',
};

/**
 * Known exceptions that are intentionally placed outside the canonical zone.
 * Each entry is a `component:x:y` string.  Add a comment explaining the reason.
 */
const KNOWN_OUT_OF_ZONE = new Set<string>([
  // PowerflushServiceTopology: boiler is on the far right because in a
  // powerflush layout the machine connects to both sides of the boiler.
  'BoilerPrimitive:690:188',
]);

// ─── Parse source file ────────────────────────────────────────────────────────

function parseNodeStyleCalls(source: string): { component: string; x: number; y: number }[] {
  const results: { component: string; x: number; y: number }[] = [];
  // Match: nodeStyle(X, Y)}><ComponentName
  const re = /nodeStyle\((\d+),\s*(\d+)\)}\s*><([A-Za-z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const x = parseInt(m[1], 10);
    const y = parseInt(m[2], 10);
    const component = m[3];
    results.push({ component, x, y });
  }
  return results;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('topology layout zone regression', () => {
  const source = fs.readFileSync(TOPOLOGIES_SRC, 'utf-8');
  const calls = parseNodeStyleCalls(source);

  it('parses at least 20 nodeStyle calls from visualTopologies.tsx', () => {
    // Sanity check: if the parser finds nothing the regex is broken.
    expect(calls.length).toBeGreaterThanOrEqual(20);
  });

  it('every boiler is in the left zone or is a known exception', () => {
    const boilerCalls = calls.filter(c => c.component === 'BoilerPrimitive');
    expect(boilerCalls.length).toBeGreaterThan(0);

    for (const call of boilerCalls) {
      const key = `${call.component}:${call.x}:${call.y}`;
      if (KNOWN_OUT_OF_ZONE.has(key)) continue;

      const zone = ZONES['boiler'];
      expect(call.x, `BoilerPrimitive x=${call.x} is outside zone [${zone.xMin}, ${zone.xMax}] — add to KNOWN_OUT_OF_ZONE if intentional`).toBeGreaterThanOrEqual(zone.xMin);
      expect(call.x, `BoilerPrimitive x=${call.x} is outside zone [${zone.xMin}, ${zone.xMax}] — add to KNOWN_OUT_OF_ZONE if intentional`).toBeLessThanOrEqual(zone.xMax);
      expect(call.y, `BoilerPrimitive y=${call.y} is outside zone [${zone.yMin}, ${zone.yMax}] — add to KNOWN_OUT_OF_ZONE if intentional`).toBeGreaterThanOrEqual(zone.yMin);
      expect(call.y, `BoilerPrimitive y=${call.y} is outside zone [${zone.yMin}, ${zone.yMax}] — add to KNOWN_OUT_OF_ZONE if intentional`).toBeLessThanOrEqual(zone.yMax);
    }
  });

  it('every cylinder is in the right zone', () => {
    const cylinderCalls = calls.filter(c => COMPONENT_ZONE_MAP[c.component] === 'cylinder');
    expect(cylinderCalls.length).toBeGreaterThan(0);

    for (const call of cylinderCalls) {
      const key = `${call.component}:${call.x}:${call.y}`;
      if (KNOWN_OUT_OF_ZONE.has(key)) continue;

      const zone = ZONES['cylinder'];
      expect(call.x, `${call.component} x=${call.x} outside cylinder x-zone [${zone.xMin}, ${zone.xMax}]`).toBeGreaterThanOrEqual(zone.xMin);
      expect(call.x, `${call.component} x=${call.x} outside cylinder x-zone [${zone.xMin}, ${zone.xMax}]`).toBeLessThanOrEqual(zone.xMax);
      expect(call.y, `${call.component} y=${call.y} outside cylinder y-zone [${zone.yMin}, ${zone.yMax}]`).toBeGreaterThanOrEqual(zone.yMin);
      expect(call.y, `${call.component} y=${call.y} outside cylinder y-zone [${zone.yMin}, ${zone.yMax}]`).toBeLessThanOrEqual(zone.yMax);
    }
  });

  it('every radiator is in the top-centre band', () => {
    const radiatorCalls = calls.filter(c => c.component === 'RadiatorPrimitive');
    expect(radiatorCalls.length).toBeGreaterThan(0);

    for (const call of radiatorCalls) {
      const key = `${call.component}:${call.x}:${call.y}`;
      if (KNOWN_OUT_OF_ZONE.has(key)) continue;

      const zone = ZONES['radiator'];
      expect(call.x, `RadiatorPrimitive x=${call.x} outside radiator x-zone [${zone.xMin}, ${zone.xMax}]`).toBeGreaterThanOrEqual(zone.xMin);
      expect(call.x, `RadiatorPrimitive x=${call.x} outside radiator x-zone [${zone.xMin}, ${zone.xMax}]`).toBeLessThanOrEqual(zone.xMax);
      expect(call.y, `RadiatorPrimitive y=${call.y} outside radiator y-zone [${zone.yMin}, ${zone.yMax}]`).toBeGreaterThanOrEqual(zone.yMin);
      expect(call.y, `RadiatorPrimitive y=${call.y} outside radiator y-zone [${zone.yMin}, ${zone.yMax}]`).toBeLessThanOrEqual(zone.yMax);
    }
  });

  it('every pump is on the return leg', () => {
    const pumpCalls = calls.filter(c => c.component === 'PumpPrimitive');
    expect(pumpCalls.length).toBeGreaterThan(0);

    for (const call of pumpCalls) {
      const key = `${call.component}:${call.x}:${call.y}`;
      if (KNOWN_OUT_OF_ZONE.has(key)) continue;

      const zone = ZONES['pump'];
      expect(call.x, `PumpPrimitive x=${call.x} outside pump x-zone [${zone.xMin}, ${zone.xMax}]`).toBeGreaterThanOrEqual(zone.xMin);
      expect(call.x, `PumpPrimitive x=${call.x} outside pump x-zone [${zone.xMin}, ${zone.xMax}]`).toBeLessThanOrEqual(zone.xMax);
      expect(call.y, `PumpPrimitive y=${call.y} outside pump y-zone [${zone.yMin}, ${zone.yMax}]`).toBeGreaterThanOrEqual(zone.yMin);
      expect(call.y, `PumpPrimitive y=${call.y} outside pump y-zone [${zone.yMin}, ${zone.yMax}]`).toBeLessThanOrEqual(zone.yMax);
    }
  });

  it('every header tank is in the high-right zone', () => {
    const tankCalls = calls.filter(c => c.component === 'HeaderTankPrimitive');
    expect(tankCalls.length).toBeGreaterThan(0);

    for (const call of tankCalls) {
      const key = `${call.component}:${call.x}:${call.y}`;
      if (KNOWN_OUT_OF_ZONE.has(key)) continue;

      const zone = ZONES['header_tank'];
      expect(call.x, `HeaderTankPrimitive x=${call.x} outside header-tank x-zone [${zone.xMin}, ${zone.xMax}]`).toBeGreaterThanOrEqual(zone.xMin);
      expect(call.x, `HeaderTankPrimitive x=${call.x} outside header-tank x-zone [${zone.xMin}, ${zone.xMax}]`).toBeLessThanOrEqual(zone.xMax);
      expect(call.y, `HeaderTankPrimitive y=${call.y} outside header-tank y-zone [${zone.yMin}, ${zone.yMax}]`).toBeGreaterThanOrEqual(zone.yMin);
      expect(call.y, `HeaderTankPrimitive y=${call.y} outside header-tank y-zone [${zone.yMin}, ${zone.yMax}]`).toBeLessThanOrEqual(zone.yMax);
    }
  });

  it('KNOWN_OUT_OF_ZONE entries are actually present in the source file', () => {
    // Prevents stale whitelist entries from silently hiding real violations.
    for (const key of KNOWN_OUT_OF_ZONE) {
      const found = calls.some(c => `${c.component}:${c.x}:${c.y}` === key);
      expect(found, `KNOWN_OUT_OF_ZONE entry "${key}" does not appear in visualTopologies.tsx — remove it`).toBe(true);
    }
  });
});
