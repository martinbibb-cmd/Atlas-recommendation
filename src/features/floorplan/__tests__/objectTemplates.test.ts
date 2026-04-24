/**
 * objectTemplates.test.ts — PR19 template registry tests.
 *
 * Covers:
 *   - Every FloorObjectType has a template entry with required fields.
 *   - Default dimensions are positive numbers.
 *   - getDefaultLabel produces correct labels and numbering.
 *   - usingDefaultDimensions correctly identifies unset objects.
 *   - Library groups cover all types exactly once.
 */

import { describe, expect, it } from 'vitest';
import type { FloorObject } from '../../../components/floorplan/propertyPlan.types';
import {
  OBJECT_TEMPLATES,
  LIBRARY_GROUPS,
  getDefaultLabel,
  defaultWidthM,
  defaultHeightM,
  defaultDepthM,
  usingDefaultDimensions,
} from '../objectTemplates';

// All FloorObjectTypes that must be registered.
const ALL_TYPES = [
  'boiler', 'cylinder', 'radiator', 'sink', 'bath', 'shower', 'flue', 'other',
] as const;

// ─── Template completeness ────────────────────────────────────────────────────

describe('OBJECT_TEMPLATES', () => {
  it('has an entry for every FloorObjectType', () => {
    for (const t of ALL_TYPES) {
      expect(OBJECT_TEMPLATES[t], `missing template for "${t}"`).toBeDefined();
    }
  });

  it('every template has a non-empty label and emoji', () => {
    for (const t of ALL_TYPES) {
      const tpl = OBJECT_TEMPLATES[t];
      expect(tpl.label.length, `empty label for "${t}"`).toBeGreaterThan(0);
      expect(tpl.emoji.length, `empty emoji for "${t}"`).toBeGreaterThan(0);
    }
  });

  it('every template has positive default dimensions in millimetres', () => {
    for (const t of ALL_TYPES) {
      const tpl = OBJECT_TEMPLATES[t];
      expect(tpl.defaultWidthMm, `non-positive defaultWidthMm for "${t}"`).toBeGreaterThan(0);
      expect(tpl.defaultHeightMm, `non-positive defaultHeightMm for "${t}"`).toBeGreaterThan(0);
      if (tpl.defaultDepthMm !== undefined) {
        expect(tpl.defaultDepthMm, `non-positive defaultDepthMm for "${t}"`).toBeGreaterThan(0);
      }
    }
  });

  it('boiler has a depth (volumetric)', () => {
    expect(OBJECT_TEMPLATES.boiler.defaultDepthMm).toBeDefined();
  });

  it('cylinder has a depth (volumetric)', () => {
    expect(OBJECT_TEMPLATES.cylinder.defaultDepthMm).toBeDefined();
  });

  it('radiator is marked alwaysNumber', () => {
    expect(OBJECT_TEMPLATES.radiator.alwaysNumber).toBe(true);
  });

  it('non-radiator types are NOT alwaysNumber', () => {
    const numberTypes = ALL_TYPES.filter((t) => OBJECT_TEMPLATES[t].alwaysNumber);
    expect(numberTypes).toEqual(['radiator']);
  });

  it('boiler and radiator are wall-mounted', () => {
    expect(OBJECT_TEMPLATES.boiler.wallMounted).toBe(true);
    expect(OBJECT_TEMPLATES.radiator.wallMounted).toBe(true);
  });

  it('cylinder and bath are NOT wall-mounted', () => {
    expect(OBJECT_TEMPLATES.cylinder.wallMounted).toBe(false);
    expect(OBJECT_TEMPLATES.bath.wallMounted).toBe(false);
  });
});

// ─── Library groups ───────────────────────────────────────────────────────────

describe('LIBRARY_GROUPS', () => {
  it('contains all FloorObjectTypes exactly once', () => {
    const allGrouped = LIBRARY_GROUPS.flatMap((g) => g.types);
    const sorted = [...allGrouped].sort();
    const expected = [...ALL_TYPES].sort();
    expect(sorted).toEqual(expected);
  });

  it('boiler and radiator are in the heating group', () => {
    const heating = LIBRARY_GROUPS.find((g) => g.id === 'heating');
    expect(heating?.types).toContain('boiler');
    expect(heating?.types).toContain('radiator');
  });

  it('cylinder is in the hot_water group', () => {
    const hw = LIBRARY_GROUPS.find((g) => g.id === 'hot_water');
    expect(hw?.types).toContain('cylinder');
  });

  it('sink, bath, and shower are in the bathroom group', () => {
    const bath = LIBRARY_GROUPS.find((g) => g.id === 'bathroom');
    expect(bath?.types).toContain('sink');
    expect(bath?.types).toContain('bath');
    expect(bath?.types).toContain('shower');
  });

  it('flue is in the building_services group', () => {
    const bs = LIBRARY_GROUPS.find((g) => g.id === 'building_services');
    expect(bs?.types).toContain('flue');
  });
});

// ─── getDefaultLabel ──────────────────────────────────────────────────────────

function makeObj(type: FloorObject['type'], label?: string): FloorObject {
  return {
    id: `o_${Math.random().toString(36).slice(2)}`,
    floorId: 'f1',
    type,
    x: 0,
    y: 0,
    label,
    provenance: { source: 'manual', reviewStatus: 'corrected' },
  };
}

describe('getDefaultLabel', () => {
  // Radiator — always numbered
  it('labels the first radiator "Radiator 1"', () => {
    expect(getDefaultLabel('radiator', [])).toBe('Radiator 1');
  });

  it('labels the second radiator "Radiator 2"', () => {
    const existing = [makeObj('radiator')];
    expect(getDefaultLabel('radiator', existing)).toBe('Radiator 2');
  });

  it('labels the third radiator "Radiator 3"', () => {
    const existing = [makeObj('radiator'), makeObj('radiator')];
    expect(getDefaultLabel('radiator', existing)).toBe('Radiator 3');
  });

  // Non-numbered types — plain name for first instance
  it('labels the first boiler "Boiler"', () => {
    expect(getDefaultLabel('boiler', [])).toBe('Boiler');
  });

  it('labels a second boiler "Boiler 2"', () => {
    const existing = [makeObj('boiler')];
    expect(getDefaultLabel('boiler', existing)).toBe('Boiler 2');
  });

  it('labels the first bath "Bath"', () => {
    expect(getDefaultLabel('bath', [])).toBe('Bath');
  });

  it('labels a second bath "Bath 2"', () => {
    const existing = [makeObj('bath')];
    expect(getDefaultLabel('bath', existing)).toBe('Bath 2');
  });

  it('ignores objects of a different type when counting', () => {
    // One sink exists — should not affect radiator numbering
    const existing = [makeObj('sink')];
    expect(getDefaultLabel('radiator', existing)).toBe('Radiator 1');
  });
});

// ─── Dimension helpers ────────────────────────────────────────────────────────

describe('defaultWidthM / defaultHeightM / defaultDepthM', () => {
  it('converts millimetres to metres correctly', () => {
    expect(defaultWidthM('boiler')).toBeCloseTo(0.6);
    expect(defaultHeightM('boiler')).toBeCloseTo(0.7);
    expect(defaultDepthM('boiler')).toBeCloseTo(0.35);
  });

  it('returns undefined depthM for types without a depth', () => {
    expect(defaultDepthM('radiator')).toBeUndefined();
    expect(defaultDepthM('sink')).toBeUndefined();
    expect(defaultDepthM('bath')).toBeUndefined();
  });

  it('returns a defined depthM for cylinder', () => {
    expect(defaultDepthM('cylinder')).toBeGreaterThan(0);
  });
});

// ─── usingDefaultDimensions ───────────────────────────────────────────────────

describe('usingDefaultDimensions', () => {
  it('returns true when all dimensions are undefined', () => {
    const obj = makeObj('sink');
    expect(usingDefaultDimensions(obj)).toBe(true);
  });

  it('returns false when widthM is set', () => {
    const obj = { ...makeObj('sink'), widthM: 0.5 };
    expect(usingDefaultDimensions(obj)).toBe(false);
  });

  it('returns false when heightM is set', () => {
    const obj = { ...makeObj('sink'), heightM: 0.4 };
    expect(usingDefaultDimensions(obj)).toBe(false);
  });

  it('returns false when depthM is set', () => {
    const obj = { ...makeObj('cylinder'), depthM: 1.0 };
    expect(usingDefaultDimensions(obj)).toBe(false);
  });
});
