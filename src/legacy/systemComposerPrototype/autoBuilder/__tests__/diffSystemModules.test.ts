/**
 * diffSystemModules.test.ts
 *
 * Unit tests for the diffConcepts, conceptToCurrentModules, and
 * conceptToRecommendedModules functions.
 */

import { describe, it, expect } from 'vitest';
import {
  conceptToCurrentModules,
  conceptToRecommendedModules,
  diffConcepts,
} from '../diffSystemModules';
import {
  CANONICAL_REGULAR_BOILER,
  CANONICAL_SYSTEM_BOILER,
  CANONICAL_COMBI,
  CANONICAL_HEAT_PUMP,
} from '../../model/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countByState(modules: ReturnType<typeof conceptToCurrentModules>, state: string) {
  return modules.filter(m => m.state === state).length;
}

function findByRole(modules: ReturnType<typeof conceptToCurrentModules>, role: string) {
  return modules.filter(m => m.role === role);
}

// ─── conceptToCurrentModules ──────────────────────────────────────────────────

describe('conceptToCurrentModules', () => {
  it('tags all modules as "current"', () => {
    const modules = conceptToCurrentModules(CANONICAL_REGULAR_BOILER);
    expect(modules.every(m => m.state === 'current')).toBe(true);
  });

  it('produces a heat_source module for every system', () => {
    for (const concept of [CANONICAL_REGULAR_BOILER, CANONICAL_COMBI, CANONICAL_HEAT_PUMP]) {
      const mods = conceptToCurrentModules(concept);
      expect(findByRole(mods, 'heat_source').length).toBeGreaterThan(0);
    }
  });

  it('suppresses controls layer for combi (controls: none)', () => {
    const modules = conceptToCurrentModules(CANONICAL_COMBI);
    expect(findByRole(modules, 'controls').length).toBe(0);
  });

  it('produces a controls module for y_plan systems', () => {
    const modules = conceptToCurrentModules(CANONICAL_REGULAR_BOILER);
    const controls = findByRole(modules, 'controls');
    expect(controls.length).toBe(1);
    expect(controls[0].visualId).toBe('y_plan');
  });

  it('produces a vented_cylinder DHW module for regular boiler', () => {
    const modules = conceptToCurrentModules(CANONICAL_REGULAR_BOILER);
    const dhw = findByRole(modules, 'dhw_storage');
    expect(dhw.length).toBe(1);
    expect(dhw[0].visualId).toBe('vented_cylinder');
  });

  it('produces a combi_on_demand DHW module for combi', () => {
    const modules = conceptToCurrentModules(CANONICAL_COMBI);
    const dhw = findByRole(modules, 'dhw_storage');
    expect(dhw.length).toBe(1);
    expect(dhw[0].visualId).toBe('combi_on_demand');
  });

  it('produces emitters modules', () => {
    const modules = conceptToCurrentModules(CANONICAL_REGULAR_BOILER);
    expect(findByRole(modules, 'emitters').length).toBeGreaterThan(0);
  });
});

// ─── conceptToRecommendedModules ──────────────────────────────────────────────

describe('conceptToRecommendedModules', () => {
  it('tags all base modules as "recommended"', () => {
    const modules = conceptToRecommendedModules(CANONICAL_SYSTEM_BOILER);
    const baseMods = modules.filter(m => m.state !== 'future_ready');
    expect(baseMods.every(m => m.state === 'recommended')).toBe(true);
  });

  it('appends future pathway modules tagged future_ready', () => {
    const modules = conceptToRecommendedModules(CANONICAL_SYSTEM_BOILER, [
      { id: 'solar_connection' },
      { id: 'heat_pump_ready' },
    ]);
    const future = modules.filter(m => m.state === 'future_ready');
    expect(future.length).toBe(2);
    expect(future[0].visualId).toBe('solar_connection');
    expect(future[1].visualId).toBe('heat_pump_ready');
  });
});

// ─── diffConcepts — no changes ────────────────────────────────────────────────

describe('diffConcepts — identical systems', () => {
  it('tags all core modules as "kept" when current === recommended', () => {
    const diff = diffConcepts(CANONICAL_REGULAR_BOILER, CANONICAL_REGULAR_BOILER);
    const currentKept = countByState(diff.current, 'kept');
    const recKept = countByState(diff.recommended, 'kept');
    expect(currentKept).toBeGreaterThan(0);
    // Both sides should have identical kept counts
    expect(currentKept).toBe(recKept);
    // No removed or added items
    expect(countByState(diff.current, 'removed')).toBe(0);
    expect(countByState(diff.recommended, 'added')).toBe(0);
  });
});

// ─── diffConcepts — regular boiler + vented → system boiler + unvented ────────

describe('diffConcepts — regular vented → system unvented', () => {
  const diff = diffConcepts(CANONICAL_REGULAR_BOILER, CANONICAL_SYSTEM_BOILER);

  it('current has a removed heat_source module', () => {
    const removed = diff.current.filter(m => m.role === 'heat_source' && m.state === 'removed');
    expect(removed.length).toBe(1);
    expect(removed[0].visualId).toBe('regular_boiler');
  });

  it('recommended has an added heat_source module', () => {
    const added = diff.recommended.filter(m => m.role === 'heat_source' && m.state === 'added');
    expect(added.length).toBe(1);
    expect(added[0].visualId).toBe('system_boiler');
  });

  it('current vented_cylinder is tagged removed', () => {
    const removed = diff.current.filter(m => m.role === 'dhw_storage' && m.state === 'removed');
    expect(removed[0].visualId).toBe('vented_cylinder');
  });

  it('recommended unvented_cylinder is tagged added', () => {
    const added = diff.recommended.filter(m => m.role === 'dhw_storage' && m.state === 'added');
    expect(added[0].visualId).toBe('unvented_cylinder');
  });

  it('emitters are kept (both are radiators)', () => {
    const currentEmit = diff.current.filter(m => m.role === 'emitters');
    const recEmit     = diff.recommended.filter(m => m.role === 'emitters');
    expect(currentEmit.every(m => m.state === 'kept')).toBe(true);
    expect(recEmit.every(m => m.state === 'kept')).toBe(true);
  });
});

// ─── diffConcepts — combi → stored unvented ───────────────────────────────────

describe('diffConcepts — combi → stored unvented', () => {
  const diff = diffConcepts(CANONICAL_COMBI, CANONICAL_SYSTEM_BOILER);

  it('current combi heat_source is tagged removed', () => {
    const hs = diff.current.filter(m => m.role === 'heat_source');
    expect(hs[0].state).toBe('removed');
    expect(hs[0].visualId).toBe('combi_boiler');
  });

  it('recommended system_boiler heat_source is tagged added', () => {
    const hs = diff.recommended.filter(m => m.role === 'heat_source');
    expect(hs[0].state).toBe('added');
    expect(hs[0].visualId).toBe('system_boiler');
  });

  it('current combi on-demand DHW is tagged removed', () => {
    const dhw = diff.current.filter(m => m.role === 'dhw_storage');
    expect(dhw[0].state).toBe('removed');
    expect(dhw[0].visualId).toBe('combi_on_demand');
  });

  it('recommended unvented cylinder is tagged added', () => {
    const dhw = diff.recommended.filter(m => m.role === 'dhw_storage');
    expect(dhw[0].state).toBe('added');
    expect(dhw[0].visualId).toBe('unvented_cylinder');
  });
});

// ─── diffConcepts — future pathway items ─────────────────────────────────────

describe('diffConcepts — future pathway items', () => {
  it('appends future_ready modules to recommended list', () => {
    const diff = diffConcepts(
      CANONICAL_REGULAR_BOILER,
      CANONICAL_SYSTEM_BOILER,
      [{ id: 'solar_connection' }],
    );
    const future = diff.recommended.filter(m => m.state === 'future_ready');
    expect(future.length).toBe(1);
    expect(future[0].visualId).toBe('solar_connection');
  });

  it('does NOT add future items to the current list', () => {
    const diff = diffConcepts(
      CANONICAL_REGULAR_BOILER,
      CANONICAL_SYSTEM_BOILER,
      [{ id: 'heat_pump_ready' }],
    );
    const future = diff.current.filter(m => m.state === 'future_ready');
    expect(future.length).toBe(0);
  });
});

// ─── diffConcepts — heat pump system ─────────────────────────────────────────

describe('diffConcepts — system boiler → heat pump', () => {
  const diff = diffConcepts(CANONICAL_SYSTEM_BOILER, CANONICAL_HEAT_PUMP);

  it('current system_boiler is removed', () => {
    const hs = diff.current.filter(m => m.role === 'heat_source');
    expect(hs[0].state).toBe('removed');
  });

  it('recommended heat_pump is added', () => {
    const hs = diff.recommended.filter(m => m.role === 'heat_source');
    expect(hs[0].state).toBe('added');
    expect(hs[0].visualId).toBe('heat_pump');
  });

  it('hp_diverter controls are added', () => {
    const controls = diff.recommended.filter(m => m.role === 'controls');
    expect(controls.length).toBe(1);
    expect(controls[0].visualId).toBe('hp_diverter');
    expect(controls[0].state).toBe('added');
  });
});

// ─── optionToConceptModel integration ─────────────────────────────────────────

describe('optionToConceptModel (used via diffConcepts)', () => {
  it('combi option produces combi_boiler visual in current modules', async () => {
    const { optionToConceptModel } = await import('../optionToConceptModel');
    const combi = optionToConceptModel('combi');
    const modules = conceptToCurrentModules(combi);
    const hs = modules.filter(m => m.role === 'heat_source');
    expect(hs[0].visualId).toBe('combi_boiler');
  });

  it('stored_unvented with mixergy=true produces mixergy_cylinder', async () => {
    const { optionToConceptModel } = await import('../optionToConceptModel');
    const concept = optionToConceptModel('stored_unvented', true);
    const modules = conceptToCurrentModules(concept);
    const dhw = modules.filter(m => m.role === 'dhw_storage');
    expect(dhw[0].visualId).toBe('mixergy_cylinder');
  });

  it('ashp option produces heat_pump visual', async () => {
    const { optionToConceptModel } = await import('../optionToConceptModel');
    const concept = optionToConceptModel('ashp');
    const modules = conceptToCurrentModules(concept);
    const hs = modules.filter(m => m.role === 'heat_source');
    expect(hs[0].visualId).toBe('heat_pump');
  });
});
