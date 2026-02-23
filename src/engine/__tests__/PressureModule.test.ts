import { describe, it, expect } from 'vitest';
import { analysePressure } from '../modules/PressureModule';

describe('analysePressure', () => {
  // ── Static + Dynamic pairs ────────────────────────────────────────────────

  it('3.5 / 3.0 bar → moderate (drop 0.5 bar equals lower boundary of moderate, not < 0.5)', () => {
    const result = analysePressure(3.0, 3.5);
    expect(result.staticBar).toBe(3.5);
    expect(result.dynamicBar).toBe(3.0);
    expect(result.dropBar).toBeCloseTo(0.5);
    expect(result.quality).toBe('moderate');
  });

  it('3.5 / 3.2 bar → strong (drop 0.3 bar < 0.5)', () => {
    const result = analysePressure(3.2, 3.5);
    expect(result.quality).toBe('strong');
    expect(result.dropBar).toBeCloseTo(0.3);
  });

  it('3.5 / 2.6 bar → moderate (drop 0.9 bar, 0.5 ≤ drop < 1.0)', () => {
    const result = analysePressure(2.6, 3.5);
    expect(result.staticBar).toBe(3.5);
    expect(result.dynamicBar).toBe(2.6);
    expect(result.dropBar).toBeCloseTo(0.9);
    expect(result.quality).toBe('moderate');
  });

  it('3.5 / 1.8 bar → weak (drop 1.7 bar ≥ 1.0)', () => {
    const result = analysePressure(1.8, 3.5);
    expect(result.staticBar).toBe(3.5);
    expect(result.dynamicBar).toBe(1.8);
    expect(result.dropBar).toBeCloseTo(1.7);
    expect(result.quality).toBe('weak');
  });

  it('drop exactly 1.0 bar → weak', () => {
    const result = analysePressure(2.5, 3.5);
    expect(result.dropBar).toBeCloseTo(1.0);
    expect(result.quality).toBe('weak');
  });

  it('drop exactly 0.5 bar → moderate', () => {
    const result = analysePressure(3.0, 3.5);
    expect(result.dropBar).toBeCloseTo(0.5);
    expect(result.quality).toBe('moderate');
  });

  it('drop < 0.5 bar → strong', () => {
    const result = analysePressure(3.3, 3.5);
    expect(result.dropBar).toBeCloseTo(0.2);
    expect(result.quality).toBe('strong');
  });

  // ── formattedBullet when both static and dynamic provided ────────────────

  it('formatted bullet contains static → dynamic arrow format', () => {
    const result = analysePressure(2.0, 3.2);
    expect(result.formattedBullet).toContain('3.2 → 2.0 bar');
    expect(result.formattedBullet).toContain('static → dynamic');
    expect(result.formattedBullet).toContain('Drop:');
  });

  it('formatted bullet includes quality label', () => {
    const result = analysePressure(1.8, 3.5);
    expect(result.formattedBullet).toContain('(weak)');
  });

  // ── Dynamic only (static unknown) ────────────────────────────────────────

  it('dynamic only → undefined quality and dropBar', () => {
    const result = analysePressure(2.0);
    expect(result.staticBar).toBeUndefined();
    expect(result.dropBar).toBeUndefined();
    expect(result.quality).toBeUndefined();
  });

  it('dynamic only → formatted bullet states static not measured', () => {
    const result = analysePressure(2.0);
    expect(result.formattedBullet).toContain('dynamic only');
    expect(result.formattedBullet).toContain('2.0 bar');
    expect(result.formattedBullet).toContain('Static pressure not measured');
  });
});
