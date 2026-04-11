/**
 * mergeAtlasPropertyPatches.ts
 *
 * Utility for combining multiple AtlasPropertyPatch objects into a single patch.
 *
 * Usage
 * ─────
 * Each adapter (fullSurveyToAtlasPropertyPatch, atlasSpatialToAtlasPropertyPatch,
 * etc.) emits a partial patch covering only the fields it can derive.  Use
 * mergeAtlasPropertyPatches() to combine them before writing to the store.
 *
 * Merge semantics
 * ───────────────
 * - Later patches win for scalar fields at any level.
 * - Sub-objects (building, household, currentSystem, evidence, derived) are
 *   merged shallowly one level deep — sub-sub-objects (e.g. household.composition)
 *   are replaced wholesale by the later patch, not deep-merged further.
 * - Arrays are replaced by the later patch value (no array-item merging).
 *
 * This keeps merge behaviour predictable.  Callers that need fine-grained array
 * merging should handle that explicitly before calling this function.
 */

import type { AtlasPropertyPatch } from '../types/atlasPropertyAdapter.types';

type SubModelKey = 'building' | 'household' | 'currentSystem' | 'evidence' | 'derived';

const SUB_MODEL_KEYS: SubModelKey[] = [
  'building',
  'household',
  'currentSystem',
  'evidence',
  'derived',
];

/**
 * Shallowly merges an array of AtlasPropertyPatch objects left-to-right.
 * Later patches overwrite earlier ones for any key at the top level and one
 * level deep within sub-models.
 *
 * @param patches  One or more partial property patches.
 * @returns        A single merged AtlasPropertyPatch.
 */
export function mergeAtlasPropertyPatches(
  ...patches: AtlasPropertyPatch[]
): AtlasPropertyPatch {
  const merged: AtlasPropertyPatch = {};

  for (const patch of patches) {
    for (const key in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;

      if ((SUB_MODEL_KEYS as string[]).includes(key)) {
        const subKey = key as SubModelKey;
        const existingSub = merged[subKey] as Record<string, unknown> | undefined;
        const incomingSub = patch[subKey] as Record<string, unknown> | undefined;

        if (incomingSub == null) continue;

        merged[subKey] = existingSub != null
          ? { ...existingSub, ...incomingSub }
          : { ...incomingSub };
      } else {
        // Top-level scalar / non-sub-model field
        (merged as Record<string, unknown>)[key] =
          (patch as Record<string, unknown>)[key];
      }
    }
  }

  return merged;
}
