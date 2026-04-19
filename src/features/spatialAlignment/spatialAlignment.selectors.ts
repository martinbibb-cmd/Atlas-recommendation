/**
 * spatialAlignment.selectors.ts
 *
 * Pure selector functions that extract spatial alignment data from an
 * AtlasSpatialModelV1 without invoking the full alignment engine.
 *
 * Use these in UI components that need lightweight, derived access to the
 * spatial model without running the full insight calculation.
 */

import type {
  AtlasSpatialModelV1,
  AtlasAnchor,
  AtlasVerticalRelation,
  AtlasInferredRoute,
} from '../atlasSpatial/atlasSpatialModel.types';

/**
 * Return all confirmed-position anchors from the model.
 * Confirmed anchors are rendered with solid lines in the Alignment View.
 */
export function selectConfirmedAnchors(model: AtlasSpatialModelV1): AtlasAnchor[] {
  return (model.anchors ?? []).filter(
    (a) => a.worldPosition.confidence === 'confirmed',
  );
}

/**
 * Return all inferred-position anchors from the model.
 * Inferred anchors are rendered with dashed lines and must carry a
 * derivationReason in the insight layer.
 */
export function selectInferredAnchors(model: AtlasSpatialModelV1): AtlasAnchor[] {
  return (model.anchors ?? []).filter(
    (a) => a.worldPosition.confidence === 'inferred',
  );
}

/**
 * Return all vertical relations involving a specific anchor ID.
 * Useful for the Alignment View side-panel to highlight the selected object.
 */
export function selectVerticalRelationsForAnchor(
  model: AtlasSpatialModelV1,
  anchorId: string,
): AtlasVerticalRelation[] {
  return (model.verticalRelations ?? []).filter(
    (r) => r.fromAnchorId === anchorId || r.toAnchorId === anchorId,
  );
}

/**
 * Return inferred pipe routes only (excludes cable and flue routes).
 * Used by the engine integration layer when deriving pipe-length estimates.
 */
export function selectInferredPipeRoutes(model: AtlasSpatialModelV1): AtlasInferredRoute[] {
  return (model.inferredRoutes ?? []).filter((r) => r.type === 'pipe');
}

/**
 * Find a single anchor by its ID, or return undefined if not found.
 */
export function selectAnchorById(
  model: AtlasSpatialModelV1,
  anchorId: string,
): AtlasAnchor | undefined {
  return (model.anchors ?? []).find((a) => a.id === anchorId);
}

/**
 * Find a single anchor by label (case-insensitive), or return undefined.
 * e.g. selectAnchorByLabel(model, 'boiler')
 */
export function selectAnchorByLabel(
  model: AtlasSpatialModelV1,
  label: string,
): AtlasAnchor | undefined {
  const lower = label.toLowerCase();
  return (model.anchors ?? []).find((a) => a.label.toLowerCase() === lower);
}

/**
 * Return the total number of anchors in the model (confirmed + inferred).
 */
export function selectAnchorCount(model: AtlasSpatialModelV1): number {
  return (model.anchors ?? []).length;
}

/**
 * Return the reference anchor for alignment calculations.
 * Prefers the anchor labelled "boiler" (case-insensitive); falls back to the
 * first anchor in the array when no boiler anchor is found.
 * Returns undefined when no anchors exist.
 */
export function selectReferenceAnchor(model: AtlasSpatialModelV1): AtlasAnchor | undefined {
  const anchors = model.anchors ?? [];
  if (anchors.length === 0) return undefined;
  return anchors.find((a) => a.label.toLowerCase() === 'boiler') ?? anchors[0];
}
