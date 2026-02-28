import { describe, it, expect } from 'vitest';
import { analysePressure } from '../modules/PressureModule';

describe('analysePressure', () => {
  // ── Static + Dynamic pairs — drop computed, no quality label ─────────────

  it('3.5 / 3.0 bar → dropBar 0.5, no quality, no inconsistency', () => {
    const result = analysePressure(3.0, 3.5);
    expect(result.staticBar).toBe(3.5);
    expect(result.dynamicBar).toBe(3.0);
    expect(result.dropBar).toBeCloseTo(0.5);
    expect(result.inconsistentReading).toBeUndefined();
  });

  it('3.5 / 3.2 bar → dropBar 0.3 (no large-drop note)', () => {
    const result = analysePressure(3.2, 3.5);
    expect(result.dropBar).toBeCloseTo(0.3);
    expect(result.inconsistentReading).toBeUndefined();
    expect(result.notes.length).toBe(0);
  });

  it('3.5 / 2.6 bar → dropBar 0.9 (no large-drop note, < 1.0)', () => {
    const result = analysePressure(2.6, 3.5);
    expect(result.staticBar).toBe(3.5);
    expect(result.dynamicBar).toBe(2.6);
    expect(result.dropBar).toBeCloseTo(0.9);
    expect(result.notes.length).toBe(0);
  });

  it('3.5 / 1.8 bar → dropBar 1.7 → large-drop note added', () => {
    const result = analysePressure(1.8, 3.5);
    expect(result.staticBar).toBe(3.5);
    expect(result.dynamicBar).toBe(1.8);
    expect(result.dropBar).toBeCloseTo(1.7);
    expect(result.notes.some(n => n.includes('Large static-to-dynamic drop'))).toBe(true);
  });

  it('drop exactly 1.0 bar → large-drop note added', () => {
    const result = analysePressure(2.5, 3.5);
    expect(result.dropBar).toBeCloseTo(1.0);
    expect(result.notes.some(n => n.includes('Large static-to-dynamic drop'))).toBe(true);
  });

  it('drop exactly 0.5 bar → no large-drop note', () => {
    const result = analysePressure(3.0, 3.5);
    expect(result.dropBar).toBeCloseTo(0.5);
    expect(result.notes.length).toBe(0);
  });

  it('drop < 0.5 bar → no notes', () => {
    const result = analysePressure(3.3, 3.5);
    expect(result.dropBar).toBeCloseTo(0.2);
    expect(result.notes.length).toBe(0);
  });

  // ── formattedBullet when both static and dynamic provided ────────────────

  it('formatted bullet contains static → dynamic arrow format', () => {
    const result = analysePressure(2.0, 3.2);
    expect(result.formattedBullet).toContain('3.2 → 2.0 bar');
    expect(result.formattedBullet).toContain('static → dynamic');
    expect(result.formattedBullet).toContain('Drop:');
  });

  it('formatted bullet does not include quality label', () => {
    const result = analysePressure(1.8, 3.5);
    expect(result.formattedBullet).not.toContain('(weak)');
    expect(result.formattedBullet).not.toContain('(strong)');
    expect(result.formattedBullet).not.toContain('(moderate)');
  });

  // ── Dynamic only (static unknown) ────────────────────────────────────────

  it('dynamic only → undefined dropBar, no inconsistency', () => {
    const result = analysePressure(2.0);
    expect(result.staticBar).toBeUndefined();
    expect(result.dropBar).toBeUndefined();
    expect(result.inconsistentReading).toBeUndefined();
  });

  it('dynamic only → formatted bullet states static not measured', () => {
    const result = analysePressure(2.0);
    expect(result.formattedBullet).toContain('dynamic only');
    expect(result.formattedBullet).toContain('2.0 bar');
    expect(result.formattedBullet).toContain('Static pressure not measured');
  });

  // ── Inconsistency detection: dynamic > static + 0.2 ─────────────────────

  it('dynamic > static by > 0.2 bar → inconsistentReading true, no dropBar', () => {
    const result = analysePressure(3.5, 2.0); // dynamic 3.5 > static 2.0 + 0.2
    expect(result.inconsistentReading).toBe(true);
    expect(result.dropBar).toBeUndefined();
    expect(result.notes.some(n => n.includes('inconsistent'))).toBe(true);
  });

  it('dynamic exactly at static + 0.2 tolerance → NOT flagged as inconsistent', () => {
    const result = analysePressure(2.2, 2.0); // dynamic = static + 0.2 → border, not inconsistent
    expect(result.inconsistentReading).toBeUndefined();
  });

  it('dynamic just above static + 0.2 → inconsistentReading true', () => {
    const result = analysePressure(2.21, 2.0); // dynamic = static + 0.21 → inconsistent
    expect(result.inconsistentReading).toBe(true);
  });

  it('dynamic = 0 bar (flow-cup test) with static present → valid, no inconsistency', () => {
    const result = analysePressure(0, 3.5);
    expect(result.inconsistentReading).toBeUndefined();
    expect(result.dropBar).toBeCloseTo(3.5);
    // Large drop note should be added (drop >= 1.0)
    expect(result.notes.some(n => n.includes('Large static-to-dynamic drop'))).toBe(true);
  });

  // ── Guardrails for unphysical inputs ─────────────────────────────────────

  it('static > 8 bar → gauge-error note added and static capped to 8 bar', () => {
    const result = analysePressure(3.0, 10.0);
    expect(result.staticBar).toBe(8.0);
    expect(result.notes.some(n => n.includes('gauge error or unit mismatch'))).toBe(true);
    expect(result.notes.some(n => n.includes('capped to 8 bar'))).toBe(true);
  });

  it('static exactly 8 bar → no gauge-error note (within credible range)', () => {
    const result = analysePressure(3.0, 8.0);
    expect(result.notes.every(n => !n.includes('gauge error'))).toBe(true);
  });

  it('dynamic drop = 0 with positive static → unit-mismatch note added', () => {
    const result = analysePressure(3.5, 3.5);
    expect(result.dropBar).toBeCloseTo(0);
    expect(result.notes.some(n => n.includes('Dynamic drop = 0'))).toBe(true);
  });

  it('dynamic drop = 0 at static = 0 → no unit-mismatch note (trivially zero)', () => {
    const result = analysePressure(0, 0);
    expect(result.notes.every(n => !n.includes('Dynamic drop = 0'))).toBe(true);
  });
});
