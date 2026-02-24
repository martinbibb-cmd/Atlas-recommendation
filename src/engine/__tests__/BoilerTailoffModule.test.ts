import { describe, it, expect } from 'vitest';
import { ageFactor, cyclingFactor, buildBoilerEfficiencySeriesV1 } from '../modules/BoilerTailoffModule';

describe('BoilerTailoffModule', () => {
  // ── ageFactor ────────────────────────────────────────────────────────────────

  describe('ageFactor', () => {
    it('0–5 years → 1.00', () => {
      expect(ageFactor(0)).toBe(1.00);
      expect(ageFactor(5)).toBe(1.00);
    });

    it('6–10 years → 0.98', () => {
      expect(ageFactor(6)).toBe(0.98);
      expect(ageFactor(10)).toBe(0.98);
    });

    it('11–15 years → 0.95', () => {
      expect(ageFactor(11)).toBe(0.95);
      expect(ageFactor(15)).toBe(0.95);
    });

    it('16–20 years → 0.92', () => {
      expect(ageFactor(16)).toBe(0.92);
      expect(ageFactor(20)).toBe(0.92);
    });

    it('21+ years → 0.88', () => {
      expect(ageFactor(21)).toBe(0.88);
      expect(ageFactor(30)).toBe(0.88);
    });

    it('older age produces lower ageFactor than newer', () => {
      expect(ageFactor(25)).toBeLessThan(ageFactor(3));
    });
  });

  // ── cyclingFactor ─────────────────────────────────────────────────────────────

  describe('cyclingFactor', () => {
    it('empty demand array returns 1.0', () => {
      expect(cyclingFactor([], 4.8)).toBe(1.0);
    });

    it('all demand above threshold → no cycling penalty (factor = 1.0)', () => {
      const demand = new Array(96).fill(10); // all above 4.8 kW threshold
      expect(cyclingFactor(demand, 4.8)).toBe(1.0);
    });

    it('high cycling (all low demand) → factor < 1.0', () => {
      const demand = new Array(96).fill(0.5); // all below threshold
      const cf = cyclingFactor(demand, 4.8);
      expect(cf).toBeLessThan(1.0);
      expect(cf).toBeGreaterThanOrEqual(0.91); // max penalty is 9%
    });

    it('high cycling produces lower factor than steady demand', () => {
      const steadyDemand = new Array(96).fill(8.0);  // all above threshold
      const cyclicDemand = new Array(96).fill(0.5);  // all below threshold
      expect(cyclingFactor(cyclicDemand, 4.8)).toBeLessThan(cyclingFactor(steadyDemand, 4.8));
    });

    it('zero demand points are not counted as low-load cycling', () => {
      const demand = new Array(96).fill(0); // all zero (no boiler firing)
      expect(cyclingFactor(demand, 4.8)).toBe(1.0);
    });
  });

  // ── buildBoilerEfficiencySeriesV1 ────────────────────────────────────────────

  describe('buildBoilerEfficiencySeriesV1', () => {
    const demand96 = Array.from({ length: 96 }, (_, i) =>
      i % 4 === 0 ? 6.0 : 1.0, // mix of above/below threshold
    );

    it('returns exactly 96 values', () => {
      const series = buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: 0.90,
        ageYears: 5,
        demandHeatKw: demand96,
      });
      expect(series).toHaveLength(96);
    });

    it('all values clamped to [0.55, 0.95]', () => {
      const series = buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: 0.90,
        ageYears: 5,
        demandHeatKw: demand96,
      });
      for (const v of series) {
        expect(v).toBeGreaterThanOrEqual(0.55);
        expect(v).toBeLessThanOrEqual(0.95);
      }
    });

    it('no NaN values in output', () => {
      const series = buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: 0.90,
        ageYears: 5,
        demandHeatKw: demand96,
      });
      for (const v of series) {
        expect(isNaN(v)).toBe(false);
      }
    });

    it('older boiler produces lower mean efficiency than newer boiler', () => {
      const newSeries = buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: 0.90,
        ageYears: 2,
        demandHeatKw: demand96,
      });
      const oldSeries = buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: 0.90,
        ageYears: 25,
        demandHeatKw: demand96,
      });
      const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      expect(mean(oldSeries)).toBeLessThan(mean(newSeries));
    });

    it('high cycling demand produces lower mean efficiency than steady demand', () => {
      const steadyDemand = new Array(96).fill(8.0); // all above low-load threshold
      const cyclicDemand = new Array(96).fill(0.5); // all below low-load threshold

      const steadySeries = buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: 0.90,
        ageYears: 5,
        demandHeatKw: steadyDemand,
      });
      const cyclicSeries = buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: 0.90,
        ageYears: 5,
        demandHeatKw: cyclicDemand,
      });
      const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      expect(mean(cyclicSeries)).toBeLessThan(mean(steadySeries));
    });

    it('null seasonalEfficiency falls back to 0.85 baseline', () => {
      const series = buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: null,
        ageYears: 0,
        demandHeatKw: new Array(96).fill(8.0),
      });
      // With age 0 and all steady demand, eta ≈ 0.85 * 1.0 * 1.0 = 0.85
      const mean = series.reduce((a, b) => a + b, 0) / series.length;
      expect(mean).toBeCloseTo(0.85, 2);
    });

    it('efficiency series varies over time when demand is mixed (not constant)', () => {
      const mixedDemand = Array.from({ length: 96 }, (_, i) => i % 2 === 0 ? 0.5 : 8.0);
      const series = buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: 0.90,
        ageYears: 8,
        demandHeatKw: mixedDemand,
      });
      // Series should have variation (not all the same value)
      const min = Math.min(...series);
      const max = Math.max(...series);
      expect(max).toBeGreaterThan(min);
    });
  });
});
