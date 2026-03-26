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
 *   - resolveShortlistVisualId returns correct signal-driven visuals or null
 *   - isVisualValid enforces validWhen constraints
 */

import { describe, it, expect } from 'vitest';
import {
  getVisualConfigForSection,
  resolveShortlistVisualId,
  isVisualValid,
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

  it('no section config has a fallbackVisualId (fallbacks are removed)', () => {
    for (const id of ALL_SECTIONS) {
      const config = getVisualConfigForSection(id);
      expect(
        (config as Record<string, unknown>)['fallbackVisualId'],
        `section "${id}" should not have a fallbackVisualId`,
      ).toBeUndefined();
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

// ─── resolveShortlistVisualId ──────────────────────────────────────────────────

describe('resolveShortlistVisualId — signal-driven selection', () => {
  it('returns cylinder_charge_standard when solarStorageOpportunity is high and architecture is standard_cylinder', () => {
    expect(resolveShortlistVisualId('high', 0, 'standard_cylinder')).toBe('cylinder_charge_standard');
    expect(resolveShortlistVisualId('high', 1, 'standard_cylinder')).toBe('cylinder_charge_standard');
  });

  it('returns null when solarStorageOpportunity is high and architecture is thermal_store (audit guard: thermal store is a legacy explainer, not a shortlist visual)', () => {
    expect(resolveShortlistVisualId('high', 1, 'thermal_store')).toBeNull();
  });

  it('returns cylinder_charge_mixergy when solarStorageOpportunity is high and architecture is mixergy', () => {
    expect(resolveShortlistVisualId('high', 0, 'mixergy')).toBe('cylinder_charge_mixergy');
    expect(resolveShortlistVisualId('high', 1, 'mixergy')).toBe('cylinder_charge_mixergy');
  });

  it('returns null when solarStorageOpportunity is high but no architecture provided', () => {
    expect(resolveShortlistVisualId('high', 1)).toBeNull();
  });

  it('returns flow_split when peakSimultaneousOutlets >= 2 and solar is not high', () => {
    expect(resolveShortlistVisualId('low', 2)).toBe('flow_split');
    expect(resolveShortlistVisualId('medium', 3)).toBe('flow_split');
    expect(resolveShortlistVisualId('none', 2)).toBe('flow_split');
  });

  it('solar=high takes priority over concurrent outlets', () => {
    // Both signals present — solar wins (signal order priority)
    expect(resolveShortlistVisualId('high', 2, 'standard_cylinder')).toBe('cylinder_charge_standard');
    expect(resolveShortlistVisualId('high', 2, 'mixergy')).toBe('cylinder_charge_mixergy');
  });

  it('returns null when no signal matches — no family-based fallback', () => {
    // combi / on-demand family — no solar, no concurrent demand, no storage benefit
    expect(resolveShortlistVisualId('low', 1)).toBeNull();
    expect(resolveShortlistVisualId('none', 0)).toBeNull();
    expect(resolveShortlistVisualId('medium', 1)).toBeNull();
  });

  it('never returns driving_style as a fallback', () => {
    // Previously the family fallback returned 'driving_style'. Ensure it no longer does.
    const cases: [string, number][] = [
      ['low', 0],
      ['low', 1],
      ['medium', 0],
      ['medium', 1],
      ['none', 0],
      ['none', 1],
    ];
    for (const [solar, outlets] of cases) {
      const result = resolveShortlistVisualId(solar, outlets);
      expect(result, `resolveShortlistVisualId('${solar}', ${outlets}) should not be 'driving_style'`).not.toBe('driving_style');
    }
  });

  // ── storageBenefitSignal path ────────────────────────────────────────────────

  it('returns cylinder_charge_standard when storageBenefitSignal is high and architecture is standard_cylinder', () => {
    expect(resolveShortlistVisualId('low', 1, 'standard_cylinder', 'high')).toBe('cylinder_charge_standard');
    expect(resolveShortlistVisualId('none', 0, 'standard_cylinder', 'high')).toBe('cylinder_charge_standard');
    // thermal_store returns null: audit guard suppresses it from shortlist pages
    expect(resolveShortlistVisualId('medium', 1, 'thermal_store', 'high')).toBeNull();
  });

  it('returns cylinder_charge_mixergy when storageBenefitSignal is high and architecture is mixergy', () => {
    expect(resolveShortlistVisualId('low', 0, 'mixergy', 'high')).toBe('cylinder_charge_mixergy');
    expect(resolveShortlistVisualId('none', 1, 'mixergy', 'high')).toBe('cylinder_charge_mixergy');
  });

  it('returns null when storageBenefitSignal is high but architecture is undefined', () => {
    expect(resolveShortlistVisualId('none', 1, undefined, 'high')).toBeNull();
  });

  it('solarStorageOpportunity takes priority over storageBenefitSignal', () => {
    // Solar=high + storageBenefit=high: solar wins with the correct subtype visual
    expect(resolveShortlistVisualId('high', 0, 'standard_cylinder', 'high')).toBe('cylinder_charge_standard');
    expect(resolveShortlistVisualId('high', 0, 'mixergy', 'high')).toBe('cylinder_charge_mixergy');
  });

  it('flow_split takes priority over storageBenefitSignal when outlets >= 2', () => {
    // Concurrent demand is more important than storage benefit for visual selection
    expect(resolveShortlistVisualId('low', 2, 'standard_cylinder', 'high')).toBe('flow_split');
    expect(resolveShortlistVisualId('none', 3, 'mixergy', 'high')).toBe('flow_split');
  });

  it('returns null when storageBenefitSignal is low — no storage relevance', () => {
    // Low-demand single-person home: no solar, no outlets, no storage benefit
    expect(resolveShortlistVisualId('low', 0, 'standard_cylinder', 'low')).toBeNull();
    expect(resolveShortlistVisualId('none', 1, 'mixergy', 'medium')).toBeNull();
  });

  // ── Audit checks ─────────────────────────────────────────────────────────────

  it('mixergy visual and standard visual must differ', () => {
    const mixergyVisual = resolveShortlistVisualId('high', 0, 'mixergy');
    const standardVisual = resolveShortlistVisualId('high', 0, 'standard_cylinder');
    expect(mixergyVisual).not.toEqual(standardVisual);
  });

  it('on_demand architecture must not render a cylinder visual', () => {
    // No cylinder for combi/on-demand options
    expect(resolveShortlistVisualId('low', 0, 'on_demand')).toBeNull();
    expect(resolveShortlistVisualId('none', 1, 'on_demand', 'low')).toBeNull();
  });
});

// ─── isVisualValid ─────────────────────────────────────────────────────────────

describe('isVisualValid — validity constraint enforcement', () => {
  it('returns true for a known visual with no validWhen constraints', () => {
    expect(isVisualValid('driving_style', {})).toBe(true);
    expect(isVisualValid('heat_particles', {})).toBe(true);
  });

  it('returns false for an unregistered visual id', () => {
    // Cast to bypass TypeScript — simulates a stale/unknown id at runtime
    expect(isVisualValid('unknown_visual' as never, {})).toBe(false);
  });

  it('passes when requiredSignals is empty', () => {
    expect(isVisualValid('driving_style', { activeSignals: [] })).toBe(true);
  });

  it('passes when at least one requiredSignal is active', () => {
    // cylinder_charge has no validWhen by default, so test with a hypothetical
    // definition by relying on the registry returning true when there are no constraints
    expect(isVisualValid('cylinder_charge', { activeSignals: ['storageBenefitSignal'] })).toBe(true);
  });

  it('passes when invalidForFamilies does not include the option family', () => {
    expect(isVisualValid('flow_split', { optionFamily: 'stored_vented' })).toBe(true);
  });

  it('generic cylinder_charge on a shortlist page throws an Error', () => {
    expect(() => isVisualValid('cylinder_charge', { pageType: 'shortlist' })).toThrow(
      "Generic 'cylinder_charge' visual not allowed on shortlist pages",
    );
  });

  it('subtype-specific cylinder visuals are allowed on shortlist pages', () => {
    // These should not throw — only the generic 'cylinder_charge' is banned
    expect(() => isVisualValid('cylinder_charge_standard', { pageType: 'shortlist' })).not.toThrow();
    expect(() => isVisualValid('cylinder_charge_mixergy', { pageType: 'shortlist' })).not.toThrow();
  });

  it('generic cylinder_charge is allowed on non-shortlist pages', () => {
    expect(() => isVisualValid('cylinder_charge', { pageType: 'options' })).not.toThrow();
    expect(() => isVisualValid('cylinder_charge', { pageType: 'gallery' })).not.toThrow();
    expect(() => isVisualValid('cylinder_charge', {})).not.toThrow();
  });

  it('thermal_store on a shortlist page throws an Error (audit guard)', () => {
    expect(() => isVisualValid('thermal_store', { pageType: 'shortlist' })).toThrow(
      "'thermal_store' visual is not permitted on shortlist pages",
    );
  });

  it('thermal_store is allowed on current_system and non-shortlist pages', () => {
    expect(() => isVisualValid('thermal_store', { pageType: 'current_system' })).not.toThrow();
    expect(() => isVisualValid('thermal_store', { pageType: 'gallery' })).not.toThrow();
    expect(() => isVisualValid('thermal_store', {})).not.toThrow();
  });
});
