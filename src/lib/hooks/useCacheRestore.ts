/**
 * useCacheRestore.ts
 *
 * Hook that reads the Atlas versioned session cache on app load and returns any
 * recoverable state (journey, visitId).
 *
 * Behaviour:
 *   - If a matching-version cache entry is found, return its value and set
 *     `notice` to 'restored'.
 *   - If a cache entry exists but the schemaVersion does not match (stale),
 *     clear the stale entry and set `notice` to 'stale'.
 *   - If no entry exists, return null values and no notice.
 *
 * The caller decides how to apply the restored state and whether to show the
 * notice to the user.
 */

import { useMemo } from 'react';
import {
  readVersionedCache,
  clearVersionedCache,
} from '../storage/versionedCache';
import {
  ATLAS_CACHE_KEY_SESSION,
  ATLAS_CACHE_KEY_VISIT,
  ATLAS_CACHE_SCHEMA_VERSION,
} from '../storage/atlasCacheKeys';

export type CacheRestoreNotice = 'restored' | 'stale' | null;

export interface SessionCacheValue {
  journey: string;
}

export interface CacheRestoreResult {
  /** Restored journey string, or null if nothing was recovered. */
  journey: string | null;
  /** Restored visitId, or null if nothing was recovered. */
  visitId: string | null;
  /** Notice to surface to the user about what happened. */
  notice: CacheRestoreNotice;
}

/**
 * Read the session/visit cache entries once on mount.
 * Uses useMemo so the localStorage reads happen synchronously during render,
 * before any state is set — avoiding a re-render flash on mobile.
 */
export function useCacheRestore(): CacheRestoreResult {
  return useMemo(() => {
    // ── Session (journey) ──────────────────────────────────────────────────
    const sessionEnvelope = readVersionedCache<SessionCacheValue>(
      ATLAS_CACHE_KEY_SESSION,
      ATLAS_CACHE_SCHEMA_VERSION,
    );

    // ── Visit ID ───────────────────────────────────────────────────────────
    const visitEnvelope = readVersionedCache<{ visitId: string }>(
      ATLAS_CACHE_KEY_VISIT,
      ATLAS_CACHE_SCHEMA_VERSION,
    );

    if (sessionEnvelope !== null || visitEnvelope !== null) {
      return {
        journey: sessionEnvelope?.value?.journey ?? null,
        visitId: visitEnvelope?.value?.visitId ?? null,
        notice: 'restored',
      };
    }

    // ── Check for stale (version-mismatched) data ──────────────────────────
    // This branch only runs when both versioned reads above returned null
    // (i.e. neither session nor visit matched the current schemaVersion).
    // Re-read the raw bytes to distinguish "never written" from "wrong version".
    const rawSession = (() => {
      try {
        const raw = localStorage.getItem(ATLAS_CACHE_KEY_SESSION);
        if (raw === null) return null;
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return null;
      }
    })();

    const rawVisit = (() => {
      try {
        const raw = localStorage.getItem(ATLAS_CACHE_KEY_VISIT);
        if (raw === null) return null;
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return null;
      }
    })();

    const hasStaleData =
      (rawSession !== null &&
        typeof rawSession === 'object' &&
        'schemaVersion' in rawSession &&
        rawSession.schemaVersion !== ATLAS_CACHE_SCHEMA_VERSION) ||
      (rawVisit !== null &&
        typeof rawVisit === 'object' &&
        'schemaVersion' in rawVisit &&
        rawVisit.schemaVersion !== ATLAS_CACHE_SCHEMA_VERSION);

    if (hasStaleData) {
      // Discard incompatible stale entries — do not silently merge.
      clearVersionedCache(ATLAS_CACHE_KEY_SESSION);
      clearVersionedCache(ATLAS_CACHE_KEY_VISIT);
      return { journey: null, visitId: null, notice: 'stale' };
    }

    return { journey: null, visitId: null, notice: null };
  }, []); // intentionally run once on mount
}
