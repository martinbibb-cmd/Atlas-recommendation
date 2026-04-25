/**
 * versionedCache.test.ts
 *
 * Unit tests for the Atlas versioned localStorage cache helpers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readVersionedCache,
  writeVersionedCache,
  clearVersionedCache,
  type CacheEnvelope,
} from '../versionedCache';
import {
  clearAtlasCache,
  ATLAS_CACHE_KEYS,
  ATLAS_CACHE_KEY_SESSION,
  ATLAS_CACHE_KEY_VISIT,
  ATLAS_CACHE_SCHEMA_VERSION,
} from '../atlasCacheKeys';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearAll() {
  for (const key of ATLAS_CACHE_KEYS) {
    localStorage.removeItem(key);
  }
}

const TEST_KEY = 'atlas.test.versionedCache';
const TEST_VERSION = 1;

// ─── readVersionedCache ───────────────────────────────────────────────────────

describe('readVersionedCache', () => {
  beforeEach(() => {
    localStorage.removeItem(TEST_KEY);
  });

  it('returns null when the key is absent', () => {
    expect(readVersionedCache(TEST_KEY, TEST_VERSION)).toBeNull();
  });

  it('returns the envelope when version matches', () => {
    const envelope: CacheEnvelope<{ x: number }> = {
      schemaVersion: TEST_VERSION,
      savedAt: '2026-01-01T00:00:00.000Z',
      value: { x: 42 },
    };
    localStorage.setItem(TEST_KEY, JSON.stringify(envelope));
    const result = readVersionedCache<{ x: number }>(TEST_KEY, TEST_VERSION);
    expect(result).not.toBeNull();
    expect(result?.value.x).toBe(42);
  });

  it('returns null when schemaVersion does not match (stale cache)', () => {
    const staleEnvelope: CacheEnvelope<{ x: number }> = {
      schemaVersion: 99,
      savedAt: '2026-01-01T00:00:00.000Z',
      value: { x: 1 },
    };
    localStorage.setItem(TEST_KEY, JSON.stringify(staleEnvelope));
    expect(readVersionedCache(TEST_KEY, TEST_VERSION)).toBeNull();
  });

  it('returns null for corrupted JSON and does not throw', () => {
    localStorage.setItem(TEST_KEY, 'not-valid-json{{{');
    expect(() => readVersionedCache(TEST_KEY, TEST_VERSION)).not.toThrow();
    expect(readVersionedCache(TEST_KEY, TEST_VERSION)).toBeNull();
  });

  it('returns null for valid JSON that is missing required fields', () => {
    localStorage.setItem(TEST_KEY, JSON.stringify({ foo: 'bar' }));
    expect(readVersionedCache(TEST_KEY, TEST_VERSION)).toBeNull();
  });
});

// ─── writeVersionedCache ──────────────────────────────────────────────────────

describe('writeVersionedCache', () => {
  beforeEach(() => {
    localStorage.removeItem(TEST_KEY);
  });

  it('writes an envelope that can be read back', () => {
    writeVersionedCache(TEST_KEY, TEST_VERSION, { name: 'atlas' });
    const result = readVersionedCache<{ name: string }>(TEST_KEY, TEST_VERSION);
    expect(result?.value.name).toBe('atlas');
  });

  it('includes the schemaVersion in the stored envelope', () => {
    writeVersionedCache(TEST_KEY, TEST_VERSION, { foo: true });
    const raw = JSON.parse(localStorage.getItem(TEST_KEY)!) as CacheEnvelope<unknown>;
    expect(raw.schemaVersion).toBe(TEST_VERSION);
  });

  it('includes a savedAt ISO timestamp', () => {
    writeVersionedCache(TEST_KEY, TEST_VERSION, {});
    const raw = JSON.parse(localStorage.getItem(TEST_KEY)!) as CacheEnvelope<unknown>;
    expect(typeof raw.savedAt).toBe('string');
    expect(new Date(raw.savedAt).getTime()).toBeGreaterThan(0);
  });

  it('stores optional visitId metadata when provided', () => {
    writeVersionedCache(TEST_KEY, TEST_VERSION, {}, { visitId: 'v_123' });
    const raw = JSON.parse(localStorage.getItem(TEST_KEY)!) as CacheEnvelope<unknown>;
    expect(raw.visitId).toBe('v_123');
  });

  it('does not store visitId when not provided', () => {
    writeVersionedCache(TEST_KEY, TEST_VERSION, {});
    const raw = JSON.parse(localStorage.getItem(TEST_KEY)!) as CacheEnvelope<unknown>;
    expect(raw.visitId).toBeUndefined();
  });

  it('does not throw when localStorage is unavailable', () => {
    const original = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeVersionedCache(TEST_KEY, TEST_VERSION, {})).not.toThrow();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(original);
  });
});

// ─── clearVersionedCache ──────────────────────────────────────────────────────

describe('clearVersionedCache', () => {
  it('removes the key from localStorage', () => {
    writeVersionedCache(TEST_KEY, TEST_VERSION, { hello: 'world' });
    clearVersionedCache(TEST_KEY);
    expect(localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('does not throw when the key does not exist', () => {
    expect(() => clearVersionedCache('atlas.nonexistent.key')).not.toThrow();
  });
});

// ─── clearAtlasCache ─────────────────────────────────────────────────────────

describe('clearAtlasCache', () => {
  beforeEach(() => clearAll());

  it('clears all known Atlas keys', () => {
    // Write dummy data to every known key.
    for (const key of ATLAS_CACHE_KEYS) {
      localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, savedAt: '', value: {} }));
    }

    clearAtlasCache();

    for (const key of ATLAS_CACHE_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it('does not remove unrelated localStorage keys', () => {
    const EXTERNAL_KEY = 'some-third-party-key';
    localStorage.setItem(EXTERNAL_KEY, 'keep-me');
    clearAtlasCache();
    expect(localStorage.getItem(EXTERNAL_KEY)).toBe('keep-me');
    localStorage.removeItem(EXTERNAL_KEY);
  });
});

// ─── cacheBust path ───────────────────────────────────────────────────────────

describe('cacheBust: known keys are cleared', () => {
  beforeEach(() => clearAll());

  it('clears session and visit keys when cacheBust is triggered', () => {
    writeVersionedCache(
      ATLAS_CACHE_KEY_SESSION,
      ATLAS_CACHE_SCHEMA_VERSION,
      { journey: 'visit' },
    );
    writeVersionedCache(
      ATLAS_CACHE_KEY_VISIT,
      ATLAS_CACHE_SCHEMA_VERSION,
      { visitId: 'v_abc' },
    );

    // Simulate the cacheBust action (same as what App.tsx does on ?cacheBust=1).
    clearAtlasCache();

    expect(localStorage.getItem(ATLAS_CACHE_KEY_SESSION)).toBeNull();
    expect(localStorage.getItem(ATLAS_CACHE_KEY_VISIT)).toBeNull();
  });
});
