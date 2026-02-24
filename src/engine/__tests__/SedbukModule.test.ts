import { describe, it, expect } from 'vitest';
import { lookupSedbukV1 } from '../modules/SedbukModule';

describe('SedbukModule — lookupSedbukV1', () => {
  // ── GC lookup ──────────────────────────────────────────────────────────────

  it('known GC number returns gc_lookup source with correct seasonalEfficiency', () => {
    const result = lookupSedbukV1({ gcNumber: '47-583-01' });
    expect(result.source).toBe('gc_lookup');
    expect(result.seasonalEfficiency).toBe(0.91);
    expect(result.label).toBe('SEDBUK (GC lookup)');
  });

  it('GC lookup note mentions the product description', () => {
    const result = lookupSedbukV1({ gcNumber: '47-583-01' });
    expect(result.notes.some(n => n.includes('Worcester Bosch'))).toBe(true);
  });

  it('unknown GC number falls back to band_fallback and adds a note', () => {
    const result = lookupSedbukV1({ gcNumber: 'XX-999-99', condensing: 'yes', ageYears: 3 });
    expect(result.source).toBe('band_fallback');
    expect(result.notes.some(n => n.includes("XX-999-99") && n.includes('band fallback'))).toBe(true);
  });

  // ── Band fallback — non-condensing ──────────────────────────────────────────

  it('non-condensing boiler age 0–5 → band non_condensing_recent (0.76)', () => {
    const result = lookupSedbukV1({ condensing: 'no', ageYears: 3 });
    expect(result.source).toBe('band_fallback');
    expect(result.seasonalEfficiency).toBe(0.76);
  });

  it('non-condensing boiler age 6–15 → band non_condensing_mid (0.72)', () => {
    const result = lookupSedbukV1({ condensing: 'no', ageYears: 10 });
    expect(result.source).toBe('band_fallback');
    expect(result.seasonalEfficiency).toBe(0.72);
  });

  it('non-condensing boiler age 16+ → band non_condensing_old (0.62)', () => {
    const result = lookupSedbukV1({ condensing: 'no', ageYears: 20 });
    expect(result.source).toBe('band_fallback');
    expect(result.seasonalEfficiency).toBe(0.62);
  });

  // ── Band fallback — condensing ───────────────────────────────────────────────

  it('modern condensing boiler age 0–5 → band modern_condensing_recent (0.92)', () => {
    const result = lookupSedbukV1({ condensing: 'yes', ageYears: 2 });
    expect(result.source).toBe('band_fallback');
    expect(result.seasonalEfficiency).toBe(0.92);
  });

  it('modern condensing boiler age 6–15 → band modern_condensing_mid (0.90)', () => {
    const result = lookupSedbukV1({ condensing: 'yes', ageYears: 8 });
    expect(result.source).toBe('band_fallback');
    expect(result.seasonalEfficiency).toBe(0.90);
  });

  it('modern condensing boiler age 16–20 → band modern_condensing_old (0.88)', () => {
    const result = lookupSedbukV1({ condensing: 'yes', ageYears: 18 });
    expect(result.source).toBe('band_fallback');
    expect(result.seasonalEfficiency).toBe(0.88);
  });

  it('early condensing boiler (age > 20) → early_condensing_old band', () => {
    const result = lookupSedbukV1({ condensing: 'yes', ageYears: 22 });
    expect(result.source).toBe('band_fallback');
    expect(result.seasonalEfficiency).toBe(0.80);
  });

  // ── Band fallback — unknown condensing ─────────────────────────────────────

  it('unknown condensing + no age → unknown band (0.88)', () => {
    const result = lookupSedbukV1({ condensing: 'unknown' });
    expect(result.source).toBe('band_fallback');
    expect(result.seasonalEfficiency).toBe(0.88);
  });

  it('no input → unknown band (0.88)', () => {
    const result = lookupSedbukV1({});
    expect(result.source).toBe('band_fallback');
    expect(result.seasonalEfficiency).toBe(0.88);
  });

  // ── GC number normalisation ────────────────────────────────────────────────

  it('GC number with spaces is normalised and matched', () => {
    const result = lookupSedbukV1({ gcNumber: '47 583 01' });
    expect(result.source).toBe('gc_lookup');
    expect(result.seasonalEfficiency).toBe(0.91);
  });

  it('GC number with mixed case is normalised and matched', () => {
    const result = lookupSedbukV1({ gcNumber: '47-583-01' });
    expect(result.source).toBe('gc_lookup');
  });

  // ── Result shape ────────────────────────────────────────────────────────────

  it('result always has notes array', () => {
    const result = lookupSedbukV1({});
    expect(Array.isArray(result.notes)).toBe(true);
  });

  it('seasonalEfficiency is in range 0–1 when not null', () => {
    const result = lookupSedbukV1({ condensing: 'yes', ageYears: 5 });
    expect(result.seasonalEfficiency).not.toBeNull();
    expect(result.seasonalEfficiency!).toBeGreaterThan(0);
    expect(result.seasonalEfficiency!).toBeLessThanOrEqual(1);
  });
});
