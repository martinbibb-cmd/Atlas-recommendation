/**
 * versionedCache.ts
 *
 * Versioned localStorage helpers for Atlas mobile-state persistence.
 *
 * Each record is stored as a JSON envelope:
 *   {
 *     schemaVersion: number,
 *     savedAt: string (ISO 8601),
 *     visitId?: string,
 *     sessionId?: string,
 *     appBuildId?: string,
 *     value: T
 *   }
 *
 * When readVersionedCache is called with a version that does not match the
 * stored schemaVersion the record is treated as stale and null is returned.
 * This prevents silently merging incompatible data across app upgrades.
 */

/** Optional metadata embedded alongside the persisted value. */
export interface CacheMetadata {
  visitId?: string;
  sessionId?: string;
}

/** The full storage envelope written to localStorage. */
export interface CacheEnvelope<T> {
  schemaVersion: number;
  savedAt: string;
  visitId?: string;
  sessionId?: string;
  appBuildId?: string;
  value: T;
}

/** Derive the app build id from the import.meta.env VITE_ build variable when available. */
function getAppBuildId(): string | undefined {
  try {
    // Vite exposes this at build time; may be undefined in dev/test environments.
    const id = (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_APP_BUILD_ID;
    return id ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read a versioned cache entry from localStorage.
 *
 * Returns the inner value when the stored schemaVersion matches the requested
 * version, or null if:
 *   - the key is absent
 *   - the JSON is corrupt
 *   - the schemaVersion does not match
 */
export function readVersionedCache<T>(
  key: string,
  version: number,
): CacheEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('schemaVersion' in parsed) ||
      !('value' in parsed)
    ) {
      return null;
    }
    const envelope = parsed as CacheEnvelope<T>;
    if (envelope.schemaVersion !== version) return null;
    return envelope;
  } catch {
    // Corrupted JSON — silently ignore, do not crash.
    return null;
  }
}

/**
 * Write a versioned cache entry to localStorage.
 *
 * Metadata (visitId, sessionId) is optional and stored alongside the value so
 * the cache entry can be matched against the current session on restore.
 */
export function writeVersionedCache<T>(
  key: string,
  version: number,
  value: T,
  metadata: CacheMetadata = {},
): void {
  try {
    const envelope: CacheEnvelope<T> = {
      schemaVersion: version,
      savedAt: new Date().toISOString(),
      ...(metadata.visitId != null ? { visitId: metadata.visitId } : {}),
      ...(metadata.sessionId != null ? { sessionId: metadata.sessionId } : {}),
      ...(getAppBuildId() != null ? { appBuildId: getAppBuildId() } : {}),
      value,
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Silently ignore write failures (e.g. storage quota exceeded in private mode).
  }
}

/**
 * Remove a single versioned cache key from localStorage.
 */
export function clearVersionedCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently ignore.
  }
}
