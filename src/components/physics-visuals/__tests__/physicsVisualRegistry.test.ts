/**
 * physicsVisualRegistry.test.ts
 *
 * Validates:
 *   - All registry entries have the required fields
 *   - All entries declare at least one display mode
 *   - All entries declare concept and purpose strings
 *   - Lookup helpers work correctly
 *   - New registry lookup helpers (getVisualsForPage, getVisualsForFamily, getVisualsForSignal)
 *   - The 5 core visuals are all present and fully configured
 */

import { describe, it, expect } from 'vitest';
import {
  getAllVisualDefinitions,
  getVisualDefinition,
  getVisualsForPage,
  getVisualsForFamily,
  getVisualsForSignal,
} from '../physicsVisualRegistry';
import { getVisualScript } from '../physicsVisualScripts';
import type { PhysicsVisualId } from '../physicsVisualTypes';

// ─── Valid values ─────────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['heat', 'water', 'energy', 'controls', 'system_behaviour'] as const;
const VALID_DISPLAY_MODES = ['preview', 'inline', 'focus'] as const;
const CORE_VISUAL_IDS: PhysicsVisualId[] = [
  'driving_style',
  'flow_split',
  'solar_mismatch',
  'cylinder_charge',
  'heat_particles',
];

// ─── Registry shape ───────────────────────────────────────────────────────────

describe('Physics Visual Registry — shape', () => {
  const all = getAllVisualDefinitions();

  it('returns a non-empty array', () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it('has no duplicate ids', () => {
    const ids = all.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a non-empty title', () => {
    for (const d of all) {
      expect(d.title.trim().length, `entry "${d.id}" missing title`).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty concept', () => {
    for (const d of all) {
      expect(d.concept.trim().length, `entry "${d.id}" missing concept`).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty purpose', () => {
    for (const d of all) {
      expect(d.purpose.trim().length, `entry "${d.id}" missing purpose`).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid category', () => {
    for (const d of all) {
      expect(
        VALID_CATEGORIES,
        `entry "${d.id}" has unknown category "${d.category}"`,
      ).toContain(d.category);
    }
  });

  it('every entry has at least one display mode', () => {
    for (const d of all) {
      expect(
        d.displayModes.length,
        `entry "${d.id}" has no display modes`,
      ).toBeGreaterThan(0);
    }
  });

  it('every display mode value is valid', () => {
    for (const d of all) {
      for (const m of d.displayModes) {
        expect(
          VALID_DISPLAY_MODES,
          `entry "${d.id}" has unknown display mode "${m}"`,
        ).toContain(m);
      }
    }
  });

  it('supportsReducedMotion is true for every entry', () => {
    for (const d of all) {
      expect(d.supportsReducedMotion, `entry "${d.id}" does not declare reduced motion support`).toBe(true);
    }
  });
});

// ─── Core visuals ─────────────────────────────────────────────────────────────

describe('Physics Visual Registry — core visuals', () => {
  it('all five core visuals are registered', () => {
    const all = getAllVisualDefinitions();
    const ids = new Set(all.map((d) => d.id));
    for (const id of CORE_VISUAL_IDS) {
      expect(ids.has(id), `core visual "${id}" is not registered`).toBe(true);
    }
  });

  it('every core visual supports all three display modes', () => {
    for (const id of CORE_VISUAL_IDS) {
      const def = getVisualDefinition(id);
      expect(def, `core visual "${id}" not found`).toBeDefined();
      expect(def!.displayModes, `core visual "${id}" missing preview mode`).toContain('preview');
      expect(def!.displayModes, `core visual "${id}" missing inline mode`).toContain('inline');
      expect(def!.displayModes, `core visual "${id}" missing focus mode`).toContain('focus');
    }
  });

  it('every core visual has applicablePages', () => {
    for (const id of CORE_VISUAL_IDS) {
      const def = getVisualDefinition(id)!;
      expect(def.applicablePages?.length, `core visual "${id}" has no applicablePages`).toBeGreaterThan(0);
    }
  });

  it('every core visual has applicableSystemFamilies', () => {
    for (const id of CORE_VISUAL_IDS) {
      const def = getVisualDefinition(id)!;
      expect(
        def.applicableSystemFamilies?.length,
        `core visual "${id}" has no applicableSystemFamilies`,
      ).toBeGreaterThan(0);
    }
  });
});

// ─── Scripts ──────────────────────────────────────────────────────────────────

describe('Physics Visual Scripts — core visuals', () => {
  it('every core visual has a script with title, summary, and takeaway', () => {
    for (const id of CORE_VISUAL_IDS) {
      const script = getVisualScript(id);
      expect(script.title.trim().length, `"${id}" script missing title`).toBeGreaterThan(0);
      expect(script.summary.trim().length, `"${id}" script missing summary`).toBeGreaterThan(0);
      expect(script.takeaway?.trim().length, `"${id}" script missing takeaway`).toBeGreaterThan(0);
    }
  });

  it('every core visual has focusCopy for focus mode', () => {
    for (const id of CORE_VISUAL_IDS) {
      const script = getVisualScript(id);
      expect(
        script.focusCopy?.trim().length,
        `"${id}" script missing focusCopy (required for focus mode)`,
      ).toBeGreaterThan(0);
    }
  });
});

// ─── Lookup helpers ───────────────────────────────────────────────────────────

describe('getVisualDefinition', () => {
  it('returns the definition for a known id', () => {
    const def = getVisualDefinition('driving_style');
    expect(def).toBeDefined();
    expect(def!.id).toBe('driving_style');
  });

  it('returns undefined for an unknown id', () => {
    expect(getVisualDefinition('nonexistent_visual' as PhysicsVisualId)).toBeUndefined();
  });
});

describe('getVisualsForPage', () => {
  it('returns visuals applicable to a known page', () => {
    const hotWater = getVisualsForPage('hot_water');
    expect(hotWater.length).toBeGreaterThan(0);
    for (const d of hotWater) {
      expect(d.applicablePages).toContain('hot_water');
    }
  });

  it('returns an empty array for an unknown page', () => {
    expect(getVisualsForPage('nonexistent_page')).toHaveLength(0);
  });

  it('flow_split is in hot_water page', () => {
    const hotWater = getVisualsForPage('hot_water');
    expect(hotWater.some((d) => d.id === 'flow_split')).toBe(true);
  });

  it('solar_mismatch is in energy page', () => {
    const energy = getVisualsForPage('energy');
    expect(energy.some((d) => d.id === 'solar_mismatch')).toBe(true);
  });
});

describe('getVisualsForFamily', () => {
  it('returns visuals for combi family', () => {
    const combi = getVisualsForFamily('combi');
    expect(combi.length).toBeGreaterThan(0);
    expect(combi.some((d) => d.id === 'flow_split')).toBe(true);
    expect(combi.some((d) => d.id === 'driving_style')).toBe(true);
  });

  it('returns visuals for stored_water family', () => {
    const stored = getVisualsForFamily('stored_water');
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.some((d) => d.id === 'cylinder_charge')).toBe(true);
  });

  it('returns an empty array for an unknown family', () => {
    expect(getVisualsForFamily('nonexistent_family')).toHaveLength(0);
  });
});

describe('getVisualsForSignal', () => {
  it('returns visuals for a known signal key', () => {
    const results = getVisualsForSignal('pvSuitability');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((d) => d.id === 'solar_mismatch')).toBe(true);
  });

  it('returns an empty array for an unknown signal', () => {
    expect(getVisualsForSignal('nonexistent_signal')).toHaveLength(0);
  });
});
