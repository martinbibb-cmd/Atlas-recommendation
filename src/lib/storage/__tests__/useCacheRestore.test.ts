/**
 * useCacheRestore.test.ts
 *
 * Unit tests for the useCacheRestore hook covering:
 *   - cache restores matching version
 *   - cache ignores mismatched version
 *   - absence of stored data returns null notice
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCacheRestore } from '../../hooks/useCacheRestore';
import {
  writeVersionedCache,
  type CacheEnvelope,
} from '../versionedCache';
import {
  ATLAS_CACHE_KEY_SESSION,
  ATLAS_CACHE_KEY_VISIT,
  ATLAS_CACHE_SCHEMA_VERSION,
  ATLAS_CACHE_KEYS,
} from '../atlasCacheKeys';

function clearAtlasKeys() {
  for (const key of ATLAS_CACHE_KEYS) {
    localStorage.removeItem(key);
  }
}

describe('useCacheRestore', () => {
  beforeEach(() => clearAtlasKeys());

  it('returns null journey and visitId with no notice when no cache exists', () => {
    const { result } = renderHook(() => useCacheRestore());
    expect(result.current.journey).toBeNull();
    expect(result.current.visitId).toBeNull();
    expect(result.current.notice).toBeNull();
  });

  it('restores journey and visitId with "restored" notice when versions match', () => {
    writeVersionedCache(
      ATLAS_CACHE_KEY_SESSION,
      ATLAS_CACHE_SCHEMA_VERSION,
      { journey: 'visit' },
    );
    writeVersionedCache(
      ATLAS_CACHE_KEY_VISIT,
      ATLAS_CACHE_SCHEMA_VERSION,
      { visitId: 'v_abc123' },
    );
    const { result } = renderHook(() => useCacheRestore());
    expect(result.current.journey).toBe('visit');
    expect(result.current.visitId).toBe('v_abc123');
    expect(result.current.notice).toBe('restored');
  });

  it('ignores mismatched version and returns "stale" notice', () => {
    const staleSession: CacheEnvelope<{ journey: string }> = {
      schemaVersion: 999,
      savedAt: '2025-01-01T00:00:00.000Z',
      value: { journey: 'visit' },
    };
    localStorage.setItem(ATLAS_CACHE_KEY_SESSION, JSON.stringify(staleSession));

    const { result } = renderHook(() => useCacheRestore());
    expect(result.current.journey).toBeNull();
    expect(result.current.visitId).toBeNull();
    expect(result.current.notice).toBe('stale');

    // Stale keys must be cleared.
    expect(localStorage.getItem(ATLAS_CACHE_KEY_SESSION)).toBeNull();
  });

  it('handles corrupted JSON in session cache without crashing', () => {
    localStorage.setItem(ATLAS_CACHE_KEY_SESSION, 'CORRUPT{{{json');
    expect(() => renderHook(() => useCacheRestore())).not.toThrow();
    const { result } = renderHook(() => useCacheRestore());
    expect(result.current.journey).toBeNull();
    expect(result.current.notice).toBeNull();
  });

  it('handles corrupted JSON in visit cache without crashing', () => {
    localStorage.setItem(ATLAS_CACHE_KEY_VISIT, ']]invalid[[');
    expect(() => renderHook(() => useCacheRestore())).not.toThrow();
    const { result } = renderHook(() => useCacheRestore());
    expect(result.current.visitId).toBeNull();
    expect(result.current.notice).toBeNull();
  });

  it('restores journey only when visit cache is absent', () => {
    writeVersionedCache(
      ATLAS_CACHE_KEY_SESSION,
      ATLAS_CACHE_SCHEMA_VERSION,
      { journey: 'simulator' },
    );
    const { result } = renderHook(() => useCacheRestore());
    expect(result.current.journey).toBe('simulator');
    expect(result.current.visitId).toBeNull();
    expect(result.current.notice).toBe('restored');
  });
});
