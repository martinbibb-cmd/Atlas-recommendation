/**
 * Tests for educational explainer content.
 *
 * Validates:
 *   - Content structure (required fields, bullet count, lengths)
 *   - Terminology compliance (no prohibited Atlas terms)
 *   - Coverage (all required topics are present)
 *   - Uniqueness (no duplicate ids)
 */

import { describe, it, expect } from 'vitest';
import { EDUCATIONAL_EXPLAINERS } from '../content';
import type { EducationalExplainer } from '../types';

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

// ─── Required explainer ids ───────────────────────────────────────────────────

const REQUIRED_IDS: ReadonlyArray<string> = [
  'on_demand_vs_stored',
  'pressure_vs_flow',
  'multiple_taps',
  'cycling_efficiency',
  'condensing_return_temp',
  'heat_pump_flow_temp',
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

  it('contains exactly 6 explainers', () => {
    expect(EDUCATIONAL_EXPLAINERS).toHaveLength(6);
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
  });
});
