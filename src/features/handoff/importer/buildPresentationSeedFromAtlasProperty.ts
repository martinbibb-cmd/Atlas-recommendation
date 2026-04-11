/**
 * buildPresentationSeedFromAtlasProperty.ts
 *
 * Creates the minimum state required to open Atlas Mind from a canonical
 * AtlasPropertyV1 handoff payload.
 *
 * The PresentationSeed is a transient navigation/route payload — it is not
 * persisted directly.  It is passed from the handoff arrival route to the
 * simulator or recommendation hub so that Atlas Mind can start in a
 * pre-populated state.
 *
 * Architecture note
 * ──────────────────
 * This is the last step before handing off to the Atlas Mind UI layer.
 * Typical call sequence:
 *   1. importAtlasProperty(raw)                      → AtlasPropertyImportResult
 *   2. buildPresentationSeedFromAtlasProperty(result) → PresentationSeed
 *   3. navigate('/simulator', { state: seed })       → Atlas Mind opens
 */

import type { AtlasPropertyImportResult, PresentationSeed } from '../types/atlasPropertyHandoff.types';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildPresentationSeedFromAtlasProperty — build the transient presentation
 * seed needed to open Atlas Mind from a canonical handoff result.
 *
 * @param result        The import result from importAtlasProperty().
 * @param launchContext Optional opaque launch context (e.g. route params or
 *                      deep-link state).  Not interpreted by this function —
 *                      passed through to the seed for the navigation layer.
 * @returns             PresentationSeed suitable for React Router state or
 *                      equivalent navigation payload.
 */
export function buildPresentationSeedFromAtlasProperty(
  result: AtlasPropertyImportResult,
  launchContext?: Record<string, unknown>,
): PresentationSeed {
  return {
    atlasProperty:  result.atlasProperty,
    engineInput:    result.engineInput,
    completeness:   result.completeness,
    source:         result.source,
    launchContext,
  };
}
