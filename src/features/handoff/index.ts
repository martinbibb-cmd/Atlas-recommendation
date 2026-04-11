/**
 * src/features/handoff/index.ts
 *
 * Public barrel for the handoff feature.
 *
 * Exports:
 *   Types:
 *     - HandoffSource
 *     - AtlasPropertyImportResult
 *     - VisitSeed
 *     - ReportSeed
 *     - PresentationSeed
 *     - AtlasMindHandoffState
 *
 *   Functions:
 *     - importAtlasProperty()
 *     - buildVisitSeedFromAtlasProperty()
 *     - buildReportSeedFromAtlasProperty()
 *     - buildPresentationSeedFromAtlasProperty()
 *
 * Architecture notes
 * ──────────────────
 * @atlas/contracts types (AtlasPropertyV1, FieldValue, etc.) are NOT
 * re-exported here — consumers should import them directly from @atlas/contracts
 * to avoid creating a local shadow of the shared contract surface.
 *
 * The legacy scan import path (scanPackageImporter / scanImporter / scanMapper)
 * is NOT touched here.  Both import paths co-exist independently.
 */

export type {
  HandoffSource,
  AtlasPropertyImportResult,
  VisitSeed,
  ReportSeed,
  PresentationSeed,
  AtlasMindHandoffState,
} from './types/atlasPropertyHandoff.types';

export type {
  KnowledgeStatus,
  HandoffKnowledgeSummary,
  HandoffReadinessSummary,
  HandoffDisplayModel,
} from './types/handoffDisplay.types';

export { importAtlasProperty } from './importer/importAtlasProperty';
export { buildVisitSeedFromAtlasProperty } from './importer/buildVisitSeedFromAtlasProperty';
export { buildReportSeedFromAtlasProperty } from './importer/buildReportSeedFromAtlasProperty';
export { buildPresentationSeedFromAtlasProperty } from './importer/buildPresentationSeedFromAtlasProperty';
export { buildHandoffDisplayModel } from './selectors/buildHandoffDisplayModel';
