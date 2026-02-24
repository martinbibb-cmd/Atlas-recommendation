import { describe, it, expect } from 'vitest';
import {
  runBoilerSizingModuleV1,
  classifySizingBand,
  NOMINAL_KW_FALLBACK,
  DEFAULT_NOMINAL_KW,
} from '../modules/BoilerSizingModule';

describe('BoilerSizingModule', () => {
  // ── classifySizingBand ────────────────────────────────────────────────────

  describe('classifySizingBand', () => {
    it('null ratio → well_matched (conservative default)', () => {
      expect(classifySizingBand(null)).toBe('well_matched');
    });

    it('ratio ≤ 1.3 → well_matched', () => {
      expect(classifySizingBand(1.0)).toBe('well_matched');
      expect(classifySizingBand(1.3)).toBe('well_matched');
    });

    it('1.3 < ratio ≤ 1.8 → mild_oversize', () => {
      expect(classifySizingBand(1.31)).toBe('mild_oversize');
      expect(classifySizingBand(1.8)).toBe('mild_oversize');
    });

    it('1.8 < ratio ≤ 2.5 → oversized', () => {
      expect(classifySizingBand(1.81)).toBe('oversized');
      expect(classifySizingBand(2.5)).toBe('oversized');
    });

    it('ratio > 2.5 → aggressive', () => {
      expect(classifySizingBand(2.51)).toBe('aggressive');
      expect(classifySizingBand(3.3)).toBe('aggressive');
      expect(classifySizingBand(5.0)).toBe('aggressive');
    });
  });

  // ── nominalKw fallback ────────────────────────────────────────────────────

  describe('nominalKw fallback', () => {
    it('combi type defaults to 24 kW', () => {
      expect(NOMINAL_KW_FALLBACK['combi']).toBe(24);
    });

    it('system type defaults to 18 kW', () => {
      expect(NOMINAL_KW_FALLBACK['system']).toBe(18);
    });

    it('DEFAULT_NOMINAL_KW is 24', () => {
      expect(DEFAULT_NOMINAL_KW).toBe(24);
    });
  });

  // ── runBoilerSizingModuleV1 ───────────────────────────────────────────────

  describe('runBoilerSizingModuleV1', () => {
    it('no peakHeatLossKw → oversizeRatio is null', () => {
      const result = runBoilerSizingModuleV1(24, 'combi', null);
      expect(result.oversizeRatio).toBeNull();
      expect(result.nominalKw).toBe(24);
      expect(result.peakHeatLossKw).toBeNull();
    });

    it('zero peakHeatLossKw → oversizeRatio is null', () => {
      const result = runBoilerSizingModuleV1(24, 'combi', 0);
      expect(result.oversizeRatio).toBeNull();
    });

    it('nominal 30 kW, heat loss 9 kW → ratio ≈ 3.33 (aggressive)', () => {
      const result = runBoilerSizingModuleV1(30, 'combi', 9);
      expect(result.oversizeRatio).toBeCloseTo(3.333, 2);
      expect(result.sizingBand).toBe('aggressive');
      expect(result.nominalKw).toBe(30);
      expect(result.peakHeatLossKw).toBe(9);
    });

    it('nominal 24 kW, heat loss 12 kW → ratio = 2.0 (oversized)', () => {
      const result = runBoilerSizingModuleV1(24, 'combi', 12);
      expect(result.oversizeRatio).toBeCloseTo(2.0, 5);
      expect(result.sizingBand).toBe('oversized');
    });

    it('nominal 18 kW, heat loss 14 kW → ratio ≈ 1.29 (well_matched)', () => {
      const result = runBoilerSizingModuleV1(18, 'system', 14);
      expect(result.oversizeRatio).toBeCloseTo(1.286, 2);
      expect(result.sizingBand).toBe('well_matched');
    });

    it('undefined nominalOutputKw falls back to boiler type default (combi → 24)', () => {
      const result = runBoilerSizingModuleV1(undefined, 'combi', 12);
      expect(result.nominalKw).toBe(24);
    });

    it('undefined nominalOutputKw falls back to boiler type default (system → 18)', () => {
      const result = runBoilerSizingModuleV1(undefined, 'system', 12);
      expect(result.nominalKw).toBe(18);
    });

    it('unknown boiler type falls back to DEFAULT_NOMINAL_KW (24)', () => {
      const result = runBoilerSizingModuleV1(undefined, 'unknown', 12);
      expect(result.nominalKw).toBe(24);
    });

    it('undefined boiler type falls back to DEFAULT_NOMINAL_KW (24)', () => {
      const result = runBoilerSizingModuleV1(undefined, undefined, 10);
      expect(result.nominalKw).toBe(24);
    });

    it('ratio boundary: 1.3 exactly → well_matched', () => {
      // 13 kW nominal, 10 kW heat loss → ratio = 1.3
      const result = runBoilerSizingModuleV1(13, 'system', 10);
      expect(result.oversizeRatio).toBeCloseTo(1.3, 5);
      expect(result.sizingBand).toBe('well_matched');
    });

    it('ratio boundary: just above 1.3 → mild_oversize', () => {
      // 13.1 kW nominal, 10 kW heat loss → ratio = 1.31
      const result = runBoilerSizingModuleV1(13.1, 'system', 10);
      expect(result.sizingBand).toBe('mild_oversize');
    });

    it('ratio boundary: 1.8 exactly → mild_oversize', () => {
      const result = runBoilerSizingModuleV1(18, 'system', 10);
      expect(result.oversizeRatio).toBeCloseTo(1.8, 5);
      expect(result.sizingBand).toBe('mild_oversize');
    });

    it('ratio boundary: 2.5 exactly → oversized', () => {
      const result = runBoilerSizingModuleV1(25, 'combi', 10);
      expect(result.oversizeRatio).toBeCloseTo(2.5, 5);
      expect(result.sizingBand).toBe('oversized');
    });

    it('ratio boundary: just above 2.5 → aggressive', () => {
      const result = runBoilerSizingModuleV1(25.1, 'combi', 10);
      expect(result.sizingBand).toBe('aggressive');
    });
  });
});
