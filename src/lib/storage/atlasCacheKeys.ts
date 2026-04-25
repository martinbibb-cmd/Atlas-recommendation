/**
 * atlasCacheKeys.ts
 *
 * Canonical registry of all Atlas-owned localStorage keys.
 *
 * Rules:
 *   - Every key stored by Atlas must appear here.
 *   - clearAtlasCache() removes only these keys — never a broad localStorage.clear().
 *   - Sensitive data (tokens, passwords) must never be stored under these keys.
 */

import { clearVersionedCache } from './versionedCache';
import { ATLAS_TOUR_SEEN_KEY } from '../tourStorage';

// ─── Cache schema version ─────────────────────────────────────────────────────
// Bump this constant whenever the shape of a stored value changes in a way that
// is not backward-compatible. readVersionedCache will then reject old records.
export const ATLAS_CACHE_SCHEMA_VERSION = 1;

// ─── Key constants ────────────────────────────────────────────────────────────

/** Active journey route + current step (e.g. 'visit', 'landing'). */
export const ATLAS_CACHE_KEY_SESSION = 'atlas.session.v1';

/** Active visit ID for the current Atlas session. */
export const ATLAS_CACHE_KEY_VISIT = 'atlas.visit.v1';

/** Draft survey state (FullSurveyModelV1 partial). */
export const ATLAS_CACHE_KEY_SURVEY_DRAFT = 'atlas.survey.draft.v1';

/** Last known property/location fields (postcode, address snippet). */
export const ATLAS_CACHE_KEY_PROPERTY = 'atlas.property.v1';

/** Active floor planner viewport (scale, pan). */
export const ATLAS_CACHE_KEY_PLANNER_VIEWPORT = 'atlas.planner.viewport.v1';

/**
 * All Atlas-owned localStorage keys.
 *
 * clearAtlasCache() iterates this list — add any new key here so it is
 * included in cache resets and cache-bust flows.
 */
export const ATLAS_CACHE_KEYS: readonly string[] = [
  ATLAS_CACHE_KEY_SESSION,
  ATLAS_CACHE_KEY_VISIT,
  ATLAS_CACHE_KEY_SURVEY_DRAFT,
  ATLAS_CACHE_KEY_PROPERTY,
  ATLAS_CACHE_KEY_PLANNER_VIEWPORT,
  ATLAS_TOUR_SEEN_KEY,
] as const;

/**
 * Clear all Atlas-owned localStorage keys.
 *
 * This is a targeted operation — it never calls localStorage.clear() and will
 * not remove keys belonging to other libraries or browser features.
 */
export function clearAtlasCache(): void {
  for (const key of ATLAS_CACHE_KEYS) {
    clearVersionedCache(key);
  }
}
