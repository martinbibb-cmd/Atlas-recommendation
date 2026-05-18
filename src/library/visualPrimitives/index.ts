/**
 * src/library/visualPrimitives/index.ts
 *
 * Public API for the canonical visual primitive library (PR 1).
 */

export {
  VISUAL_PRIMITIVE_REGISTRY,
  getPrimitiveById,
  getPrimitivesByCategory,
  getPrimitivesNeedingExtraction,
  getPrimitivesNeedingRebuild,
} from './visualPrimitiveRegistry';

export type {
  VisualPrimitiveEntry,
  VisualPrimitiveCategory,
  VisualPrimitiveRecognisability,
  VisualPrimitiveReuseStatus,
  VisualPrimitiveAbstractionLevel,
} from './visualPrimitiveRegistry';

export { VisualPrimitiveGallery } from './VisualPrimitiveGallery';

export * from './primitives';
