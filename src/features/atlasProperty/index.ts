/**
 * src/features/atlasProperty/index.ts
 *
 * Public barrel for the atlasProperty adapter layer.
 *
 * Exports:
 *   - AtlasPropertyPatch and EngineRunMeta type helpers
 *   - fullSurveyToAtlasPropertyPatch()
 *   - atlasSpatialToAtlasPropertyPatch()
 *   - atlasPropertyToEngineInput()
 *   - engineRunToDerivedSnapshot()
 *   - mergeAtlasPropertyPatches()
 *   - atlasPropertyCompletenessSummary()
 *
 * @atlas/contracts types (AtlasPropertyV1, FieldValue, etc.) are NOT
 * re-exported here — consumers should import them directly from @atlas/contracts
 * to avoid creating a local shadow of the shared contract surface.
 */

export type {
  AtlasPropertyPatch,
  EngineRunMeta,
  AtlasPropertyCompletenessSummary,
} from './types/atlasPropertyAdapter.types';

export { fullSurveyToAtlasPropertyPatch } from './adapters/fullSurveyToAtlasPropertyPatch';
export { atlasSpatialToAtlasPropertyPatch } from './adapters/atlasSpatialToAtlasPropertyPatch';
export { atlasPropertyToEngineInput } from './adapters/atlasPropertyToEngineInput';
export { engineRunToDerivedSnapshot } from './adapters/engineRunToDerivedSnapshot';
export type { EngineRunDerivedSnapshot } from './adapters/engineRunToDerivedSnapshot';
export { mergeAtlasPropertyPatches } from './adapters/mergeAtlasPropertyPatches';
export { atlasPropertyCompletenessSummary } from './selectors/atlasPropertyCompletenessSummary';
