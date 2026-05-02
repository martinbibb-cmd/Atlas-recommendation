/**
 * src/features/branding/activeBrand.test.ts
 *
 * Unit tests for resolveActiveBrandId.
 *
 * Coverage:
 *   - visitBrandId wins over routeBrandId and fallbackBrandId
 *   - routeBrandId used when no visitBrandId
 *   - fallbackBrandId used when neither visitBrandId nor routeBrandId
 *   - falls back to 'atlas-default' when all inputs are absent/null/empty
 *   - empty-string inputs are treated as absent
 */

import { describe, it, expect } from 'vitest';
import { resolveActiveBrandId } from './activeBrand';

describe('resolveActiveBrandId', () => {
  // ── visitBrandId wins ─────────────────────────────────────────────────────

  it('returns visitBrandId when all three are supplied', () => {
    expect(
      resolveActiveBrandId({
        visitBrandId: 'installer-demo',
        routeBrandId: 'route-brand',
        fallbackBrandId: 'fallback-brand',
      }),
    ).toBe('installer-demo');
  });

  it('returns visitBrandId when only visitBrandId is supplied', () => {
    expect(resolveActiveBrandId({ visitBrandId: 'installer-demo' })).toBe('installer-demo');
  });

  // ── routeBrandId fallback ─────────────────────────────────────────────────

  it('returns routeBrandId when visitBrandId is null', () => {
    expect(
      resolveActiveBrandId({
        visitBrandId: null,
        routeBrandId: 'route-brand',
        fallbackBrandId: 'fallback-brand',
      }),
    ).toBe('route-brand');
  });

  it('returns routeBrandId when visitBrandId is undefined', () => {
    expect(
      resolveActiveBrandId({
        visitBrandId: undefined,
        routeBrandId: 'route-brand',
        fallbackBrandId: 'fallback-brand',
      }),
    ).toBe('route-brand');
  });

  it('returns routeBrandId when visitBrandId is an empty string', () => {
    expect(
      resolveActiveBrandId({
        visitBrandId: '',
        routeBrandId: 'route-brand',
      }),
    ).toBe('route-brand');
  });

  // ── fallbackBrandId fallback ──────────────────────────────────────────────

  it('returns fallbackBrandId when visitBrandId and routeBrandId are absent', () => {
    expect(resolveActiveBrandId({ fallbackBrandId: 'my-fallback' })).toBe('my-fallback');
  });

  it('returns fallbackBrandId when visitBrandId is null and routeBrandId is null', () => {
    expect(
      resolveActiveBrandId({
        visitBrandId: null,
        routeBrandId: null,
        fallbackBrandId: 'my-fallback',
      }),
    ).toBe('my-fallback');
  });

  // ── atlas-default last resort ─────────────────────────────────────────────

  it('returns atlas-default when all inputs are absent', () => {
    expect(resolveActiveBrandId({})).toBe('atlas-default');
  });

  it('returns atlas-default when all inputs are null', () => {
    expect(
      resolveActiveBrandId({
        visitBrandId: null,
        routeBrandId: null,
        fallbackBrandId: null,
      }),
    ).toBe('atlas-default');
  });

  it('returns atlas-default when all inputs are empty strings', () => {
    expect(
      resolveActiveBrandId({
        visitBrandId: '',
        routeBrandId: '',
        fallbackBrandId: '',
      }),
    ).toBe('atlas-default');
  });

  // ── whitespace-only strings treated as absent ─────────────────────────────

  it('treats a whitespace-only visitBrandId as absent and falls back', () => {
    expect(
      resolveActiveBrandId({
        visitBrandId: '   ',
        routeBrandId: 'route-brand',
      }),
    ).toBe('route-brand');
  });
});
