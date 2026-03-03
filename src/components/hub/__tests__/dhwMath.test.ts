import { describe, it, expect } from 'vitest';
import { kwForFlow, flowForKw, clamp } from '../utils/dhwMath';

describe('dhwMath', () => {
  describe('kwForFlow', () => {
    it('returns expected kW for 10 L/min at 40°C rise', () => {
      // 0.06977 × 10 × 40 = 27.908
      expect(kwForFlow(10, 40)).toBeCloseTo(27.908, 2);
    });

    it('returns expected kW for 12 L/min at 45°C rise (typical winter combi)', () => {
      // 0.06977 × 12 × 45 = 37.676
      expect(kwForFlow(12, 45)).toBeCloseTo(37.676, 2);
    });

    it('returns 0 for zero flow', () => {
      expect(kwForFlow(0, 40)).toBe(0);
    });
  });

  describe('flowForKw', () => {
    it('is the inverse of kwForFlow', () => {
      const flow = 10;
      const deltaT = 40;
      const kw = kwForFlow(flow, deltaT);
      expect(flowForKw(kw, deltaT)).toBeCloseTo(flow, 4);
    });

    it('returns ~10.8 L/min for 30 kW at 40°C rise', () => {
      // 30 / (0.06977 × 40) = 30 / 2.7908 ≈ 10.748
      expect(flowForKw(30, 40)).toBeCloseTo(10.748, 1);
    });
  });

  describe('clamp', () => {
    it('clamps value below min to min', () => {
      expect(clamp(-5, 0, 100)).toBe(0);
    });

    it('clamps value above max to max', () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('returns value unchanged when within range', () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });

    it('returns min when value equals min', () => {
      expect(clamp(0, 0, 100)).toBe(0);
    });

    it('returns max when value equals max', () => {
      expect(clamp(100, 0, 100)).toBe(100);
    });
  });
});
