/**
 * presentationVisualMapping.test.ts
 *
 * Validates the declarative section-to-visual mapping:
 *   - every canonical section id has a config entry
 *   - preferred visual ids are valid registry entries
 *   - display modes are valid
 *   - the four priority sections map to the expected visuals
 *   - wallTypeToVisualKey and systemTypeToDrivingMode are exercised via
 *     buildCanonicalPresentation integration
 */

import { describe, it, expect } from 'vitest';
import {
  getVisualConfigForSection,
  type CanonicalPresentationSectionId,
} from '../presentationVisualMapping';
import { getVisualDefinition } from '../../physics-visuals/physicsVisualRegistry';

// ─── All section ids ──────────────────────────────────────────────────────────

const ALL_SECTIONS: CanonicalPresentationSectionId[] = [
  'house',
  'home',
  'energy',
  'current_system',
  'options',
  'ranking',
  'shortlist_option_1',
  'shortlist_option_2',
  'simulator',
];

const VALID_DISPLAY_MODES = ['preview', 'inline', 'focus'] as const;

// ─── Shape ────────────────────────────────────────────────────────────────────

describe('presentationVisualMapping — shape', () => {
  it('returns a config for every canonical section id', () => {
    for (const id of ALL_SECTIONS) {
      const config = getVisualConfigForSection(id);
      expect(config, `section "${id}" has no config`).toBeDefined();
    }
  });

  it('every config has a valid display mode', () => {
    for (const id of ALL_SECTIONS) {
      const config = getVisualConfigForSection(id);
      expect(
        VALID_DISPLAY_MODES.includes(config.displayMode as typeof VALID_DISPLAY_MODES[number]),
        `section "${id}" has invalid displayMode "${config.displayMode}"`,
      ).toBe(true);
    }
  });

  it('every preferred visual id exists in the registry', () => {
    for (const id of ALL_SECTIONS) {
      const config = getVisualConfigForSection(id);
      const def = getVisualDefinition(config.preferredVisualId);
      expect(
        def,
        `section "${id}" preferred visual "${config.preferredVisualId}" not in registry`,
      ).toBeDefined();
    }
  });

  it('every fallback visual id (if present) exists in the registry', () => {
    for (const id of ALL_SECTIONS) {
      const config = getVisualConfigForSection(id);
      if (config.fallbackVisualId) {
        const def = getVisualDefinition(config.fallbackVisualId);
        expect(
          def,
          `section "${id}" fallback visual "${config.fallbackVisualId}" not in registry`,
        ).toBeDefined();
      }
    }
  });

  it('every config has a signalPriority array', () => {
    for (const id of ALL_SECTIONS) {
      const config = getVisualConfigForSection(id);
      expect(Array.isArray(config.signalPriority)).toBe(true);
    }
  });
});

// ─── Priority section mappings ────────────────────────────────────────────────

describe('presentationVisualMapping — priority section assignments', () => {
  it('house → heat_particles inline', () => {
    const cfg = getVisualConfigForSection('house');
    expect(cfg.preferredVisualId).toBe('heat_particles');
    expect(cfg.displayMode).toBe('inline');
  });

  it('home → flow_split inline', () => {
    const cfg = getVisualConfigForSection('home');
    expect(cfg.preferredVisualId).toBe('flow_split');
    expect(cfg.displayMode).toBe('inline');
  });

  it('energy → solar_mismatch inline', () => {
    const cfg = getVisualConfigForSection('energy');
    expect(cfg.preferredVisualId).toBe('solar_mismatch');
    expect(cfg.displayMode).toBe('inline');
  });

  it('current_system → driving_style inline', () => {
    const cfg = getVisualConfigForSection('current_system');
    expect(cfg.preferredVisualId).toBe('driving_style');
    expect(cfg.displayMode).toBe('inline');
  });

  it('options → cylinder_charge inline', () => {
    const cfg = getVisualConfigForSection('options');
    expect(cfg.preferredVisualId).toBe('cylinder_charge');
    expect(cfg.displayMode).toBe('inline');
  });
});

// ─── Signal priority ──────────────────────────────────────────────────────────

describe('presentationVisualMapping — signal priority fields', () => {
  it('house section references wallType signal', () => {
    const cfg = getVisualConfigForSection('house');
    expect(cfg.signalPriority).toContain('wallType');
  });

  it('home section references peakConcurrentOutlets signal', () => {
    const cfg = getVisualConfigForSection('home');
    expect(cfg.signalPriority).toContain('peakConcurrentOutlets');
  });

  it('energy section references pvSuitability signal', () => {
    const cfg = getVisualConfigForSection('energy');
    expect(cfg.signalPriority).toContain('pvSuitability');
  });

  it('current_system section references system_family signal', () => {
    const cfg = getVisualConfigForSection('current_system');
    expect(cfg.signalPriority).toContain('system_family');
  });
});
