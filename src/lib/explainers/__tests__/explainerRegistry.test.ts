/**
 * Tests for the explainer registry.
 *
 * Validates:
 *   - All registry entries reference valid educational explainer IDs
 *   - All registry entries have valid categories and kinds
 *   - The registry covers all five category groups
 *   - Lookup helpers work correctly
 */

import { describe, it, expect } from 'vitest';
import { EXPLAINER_REGISTRY, getRegistryEntry } from '../explainerRegistry';
import { EDUCATIONAL_EXPLAINERS } from '../../../explainers/educational/content';
import type { ExplainerCategory } from '../../../explainers/educational/types';

// ─── Valid values ─────────────────────────────────────────────────────────────

const VALID_KINDS = ['inline', 'menu', 'both'] as const;
const VALID_CATEGORIES: ReadonlyArray<ExplainerCategory> = [
  'physics',
  'energy',
  'water',
  'space',
  'system_behaviour',
];
const EDUCATIONAL_IDS = new Set(EDUCATIONAL_EXPLAINERS.map(e => e.id));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EXPLAINER_REGISTRY', () => {
  it('is a non-empty array', () => {
    expect(EXPLAINER_REGISTRY.length).toBeGreaterThan(0);
  });

  it('has no duplicate ids', () => {
    const ids = EXPLAINER_REGISTRY.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry references a valid educational explainer id', () => {
    for (const entry of EXPLAINER_REGISTRY) {
      expect(
        EDUCATIONAL_IDS.has(entry.id),
        `Registry entry "${entry.id}" has no matching EducationalExplainer`,
      ).toBe(true);
    }
  });

  it('every entry has a valid category', () => {
    for (const entry of EXPLAINER_REGISTRY) {
      expect(
        VALID_CATEGORIES,
        `Registry entry "${entry.id}" has unknown category "${entry.category}"`,
      ).toContain(entry.category);
    }
  });

  it('every entry has a valid kind', () => {
    for (const entry of EXPLAINER_REGISTRY) {
      expect(
        VALID_KINDS,
        `Registry entry "${entry.id}" has unknown kind "${entry.kind}"`,
      ).toContain(entry.kind);
    }
  });

  it('every entry has a non-empty component field', () => {
    for (const entry of EXPLAINER_REGISTRY) {
      expect(entry.component.trim().length).toBeGreaterThan(0);
    }
  });

  it('covers the physics category', () => {
    const physicsEntries = EXPLAINER_REGISTRY.filter(e => e.category === 'physics');
    expect(physicsEntries.length).toBeGreaterThan(0);
  });

  it('covers the energy category', () => {
    const energyEntries = EXPLAINER_REGISTRY.filter(e => e.category === 'energy');
    expect(energyEntries.length).toBeGreaterThan(0);
  });

  it('covers the water category', () => {
    const waterEntries = EXPLAINER_REGISTRY.filter(e => e.category === 'water');
    expect(waterEntries.length).toBeGreaterThan(0);
  });

  it('covers the space category', () => {
    const spaceEntries = EXPLAINER_REGISTRY.filter(e => e.category === 'space');
    expect(spaceEntries.length).toBeGreaterThan(0);
  });

  it('covers the system_behaviour category', () => {
    const systemEntries = EXPLAINER_REGISTRY.filter(e => e.category === 'system_behaviour');
    expect(systemEntries.length).toBeGreaterThan(0);
  });

  it('includes shared_mains_flow in the water category', () => {
    const entry = EXPLAINER_REGISTRY.find(e => e.id === 'shared_mains_flow');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('water');
  });

  it('includes low_and_slow in the energy category', () => {
    const entry = EXPLAINER_REGISTRY.find(e => e.id === 'low_and_slow');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('energy');
  });
});

describe('getRegistryEntry', () => {
  it('returns the entry for a known id', () => {
    const entry = getRegistryEntry('on_demand_vs_stored');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('on_demand_vs_stored');
  });

  it('returns undefined for an unknown id', () => {
    expect(getRegistryEntry('nonexistent_explainer')).toBeUndefined();
  });
});
