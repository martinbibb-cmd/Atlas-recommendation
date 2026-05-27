/**
 * Tests for educational explainer content.
 *
 * Validates:
 *   - Content structure (required fields, bullet count, lengths)
 *   - Terminology compliance (no prohibited Atlas terms)
 *   - Coverage (all required topics are present)
 *   - Uniqueness (no duplicate ids)
 *   - Category assignment (all explainers declare a valid category)
 */

import { describe, it, expect } from 'vitest';
import { EDUCATIONAL_EXPLAINERS } from '../content';
import type { EducationalExplainer, ExplainerCategory } from '../types';

// ─── Terminology: prohibited terms from docs/atlas-terminology.md §8 ─────────

const PROHIBITED_TERMS: ReadonlyArray<{ term: string; replacement: string }> = [
  { term: 'gravity system',          replacement: 'tank-fed hot water' },
  { term: 'low pressure system',     replacement: 'tank-fed supply' },
  { term: 'high pressure system',    replacement: 'mains-fed supply' },
  { term: 'instantaneous hot water', replacement: 'on-demand hot water' },
  { term: 'unlimited hot water',     replacement: 'stored hot water' },
  { term: 'powerful shower',         replacement: 'supply-limited / flow-limited' },
  { term: 'high performance',        replacement: 'thermal capacity / recovery time' },
];

// ─── Valid categories ─────────────────────────────────────────────────────────

const VALID_CATEGORIES: ReadonlyArray<ExplainerCategory> = [
  'physics',
  'energy',
  'water',
  'space',
  'system_behaviour',
  'analogy',
];

// ─── Required explainer ids ───────────────────────────────────────────────────

const REQUIRED_IDS: ReadonlyArray<string> = [
  'on_demand_vs_stored',
  'shared_mains_flow',
  'pressure_vs_flow',
  'multiple_taps',
  'cycling_efficiency',
  'condensing_return_temp',
  'heat_pump_flow_temp',
  'low_and_slow',
  'standard_vs_mixergy',
  'cylinder_age_condition',
  'pipe_capacity',
  'water_quality_scale',
  'thermal_mass_inertia',
  'splan_vs_yplan',
  'sponge_heat_transfer',
  'cars_running_style',
  'bees_energy_sources',
  'convection_airflow',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allText(e: EducationalExplainer): string {
  return [e.title, e.point, ...e.bullets, e.simulatorLabel ?? ''].join(' ');
}

// ─── Test suites ──────────────────────────────────────────────────────────────

describe('EDUCATIONAL_EXPLAINERS', () => {

  it('exports a non-empty array', () => {
    expect(EDUCATIONAL_EXPLAINERS.length).toBeGreaterThan(0);
  });

  it('contains exactly 18 explainers', () => {
    expect(EDUCATIONAL_EXPLAINERS).toHaveLength(18);
  });

  it('includes all required topic ids', () => {
    const ids = EDUCATIONAL_EXPLAINERS.map(e => e.id);
    for (const required of REQUIRED_IDS) {
      expect(ids).toContain(required);
    }
  });

  it('has no duplicate ids', () => {
    const ids = EDUCATIONAL_EXPLAINERS.map(e => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every explainer declares a valid category', () => {
    for (const e of EDUCATIONAL_EXPLAINERS) {
      expect(
        VALID_CATEGORIES,
        `Explainer "${e.id}" has unknown category "${e.category}"`,
      ).toContain(e.category);
    }
  });

  it('includes at least one physics explainer', () => {
    const physicsIds = EDUCATIONAL_EXPLAINERS.filter(e => e.category === 'physics').map(e => e.id);
    expect(physicsIds.length).toBeGreaterThan(0);
  });

  it('includes at least one energy explainer', () => {
    const energyIds = EDUCATIONAL_EXPLAINERS.filter(e => e.category === 'energy').map(e => e.id);
    expect(energyIds.length).toBeGreaterThan(0);
  });

  it('includes at least one water explainer', () => {
    const waterIds = EDUCATIONAL_EXPLAINERS.filter(e => e.category === 'water').map(e => e.id);
    expect(waterIds.length).toBeGreaterThan(0);
  });

  it('includes at least one analogy explainer', () => {
    const analogyIds = EDUCATIONAL_EXPLAINERS.filter(e => e.category === 'analogy').map(e => e.id);
    expect(analogyIds.length).toBeGreaterThan(0);
  });

  // ── Per-explainer structure checks ─────────────────────────────────────────

  describe.each(EDUCATIONAL_EXPLAINERS.map(e => [e.id, e] as const))(
    'explainer "%s"',
    (_id, explainer) => {

      it('has a non-empty id (snake_case)', () => {
        expect(explainer.id).toMatch(/^[a-z][a-z0-9_]*$/);
      });

      it('has a title of 60 characters or fewer', () => {
        expect(explainer.title.length).toBeGreaterThan(0);
        expect(explainer.title.length).toBeLessThanOrEqual(60);
      });

      it('has a non-empty one-sentence point', () => {
        expect(explainer.point.trim().length).toBeGreaterThan(0);
      });

      it('has between 3 and 5 bullets', () => {
        expect(explainer.bullets.length).toBeGreaterThanOrEqual(3);
        expect(explainer.bullets.length).toBeLessThanOrEqual(5);
      });

      it('has no empty bullets', () => {
        for (const bullet of explainer.bullets) {
          expect(bullet.trim().length).toBeGreaterThan(0);
        }
      });

      it('has no duplicate bullets', () => {
        const unique = new Set(explainer.bullets);
        expect(unique.size).toBe(explainer.bullets.length);
      });

      it('has a valid category', () => {
        expect(VALID_CATEGORIES).toContain(explainer.category);
      });

      it('does not use any prohibited Atlas terminology', () => {
        const text = allText(explainer).toLowerCase();
        for (const { term, replacement } of PROHIBITED_TERMS) {
          expect(
            text,
            `Explainer "${explainer.id}" uses prohibited term "${term}" — use "${replacement}" instead`,
          ).not.toContain(term.toLowerCase());
        }
      });

      it('provides simulatorLabel when simulatorPanelId is set', () => {
        if (explainer.simulatorPanelId != null) {
          expect(explainer.simulatorLabel).toBeTruthy();
        }
      });

      it('provides simulatorPanelId when simulatorLabel is set', () => {
        if (explainer.simulatorLabel != null) {
          expect(explainer.simulatorPanelId).toBeTruthy();
        }
      });
    },
  );

  // ── Terminology compliance across the full set ──────────────────────────────

  describe('terminology compliance', () => {
    it('uses "on-demand hot water" not "instantaneous hot water"', () => {
      const allTexts = EDUCATIONAL_EXPLAINERS.map(allText).join(' ').toLowerCase();
      expect(allTexts).not.toContain('instantaneous hot water');
      expect(allTexts).toContain('on-demand');
    });

    it('uses "stored hot water" not "unlimited hot water"', () => {
      const allTexts = EDUCATIONAL_EXPLAINERS.map(allText).join(' ').toLowerCase();
      expect(allTexts).not.toContain('unlimited hot water');
      expect(allTexts).toContain('stored hot water');
    });

    it('does not mention "gravity system" or "low pressure system"', () => {
      const allTexts = EDUCATIONAL_EXPLAINERS.map(allText).join(' ').toLowerCase();
      expect(allTexts).not.toContain('gravity system');
      expect(allTexts).not.toContain('low pressure system');
    });
  });

  // ── Coverage checks ─────────────────────────────────────────────────────────

  describe('topic coverage', () => {
    it('covers on-demand vs stored hot water', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'on_demand_vs_stored');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toContain('on-demand');
      expect(text).toContain('stored');
    });

    it('covers flow sharing across the home', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'shared_mains_flow');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/flow|mains/);
      expect(text).toMatch(/shared|split|compet/);
    });

    it('covers pressure and flow', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'pressure_vs_flow');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/pressure/);
      expect(text).toMatch(/flow/);
    });

    it('covers simultaneous / multiple outlet demand', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'multiple_taps');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/simultaneous|multiple|concurrent/);
    });

    it('covers boiler cycling and efficiency', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'cycling_efficiency');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toContain('cycl');
      expect(text).toMatch(/efficien/);
    });

    it('covers condensing mode and return temperature', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'condensing_return_temp');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toContain('condens');
      expect(text).toMatch(/return/);
    });

    it('covers heat pump flow temperature preference', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'heat_pump_flow_temp');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toContain('heat pump');
      expect(text).toMatch(/flow temp/);
    });

    it('covers low-and-slow system running', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'low_and_slow');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/low.*slow|continuous|gentle/);
      expect(text).toMatch(/efficien/);
    });

    it('covers standard cylinder vs Mixergy comparison', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'standard_vs_mixergy');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toContain('standard');
      expect(text).toContain('mixergy');
      expect(text).toContain('stratification');
    });

    it('covers cylinder age and condition effects', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'cylinder_age_condition');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/age/);
      expect(text).toMatch(/condition/);
      expect(text).toContain('standing');
    });

    it('covers primary pipe capacity for heat pumps', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'pipe_capacity');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toContain('pipe');
      expect(text).toMatch(/flow rate|capacity/);
      expect(text).toContain('heat pump');
    });

    it('covers water quality and scale risk', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'water_quality_scale');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/scale|hardness/);
      expect(text).toMatch(/efficien/);
    });

    it('covers building thermal mass and heating strategy', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'thermal_mass_inertia');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/thermal mass|thermal inertia/);
      expect(text).toMatch(/heat/);
    });

    it('covers S-plan vs Y-plan zone control', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'splan_vs_yplan');
      expect(e).toBeDefined();
      const text = allText(e!).toLowerCase();
      expect(text).toContain('s-plan');
      expect(text).toContain('y-plan');
      expect(text).toMatch(/zone|valve|circuit/);
    });

    it('covers heat pump low-and-slow extraction (sponge analogy)', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'sponge_heat_transfer');
      expect(e).toBeDefined();
      expect(e!.category).toBe('analogy');
      const text = allText(e!).toLowerCase();
      expect(text).toContain('heat pump');
      expect(text).toMatch(/absorb|extract|transfer/);
    });

    it('covers burst vs steady running styles (cars analogy)', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'cars_running_style');
      expect(e).toBeDefined();
      expect(e!.category).toBe('analogy');
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/burst|steady|continuous/);
    });

    it('covers energy source character (bees analogy)', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'bees_energy_sources');
      expect(e).toBeDefined();
      expect(e!.category).toBe('analogy');
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/energy source|gas|electricity|heat pump/);
    });

    it('covers convection airflow and window/door effects', () => {
      const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === 'convection_airflow');
      expect(e).toBeDefined();
      expect(e!.category).toBe('physics');
      const text = allText(e!).toLowerCase();
      expect(text).toMatch(/convection|loop|airflow|window/);
      expect(text).toMatch(/heat/);
    });
  });
});
