/**
 * atlasSpatialToAtlasPropertyPatch.ts
 *
 * Derives a partial AtlasPropertyV1 building section from the canonical
 * Atlas spatial model (AtlasSpatialModelV1).
 *
 * Architecture note
 * ─────────────────
 * AtlasSpatialModelV1 is already the canonical corrected and enriched spatial
 * model — it is produced by the Atlas floor-plan editor from the imported scan
 * bundle.  This adapter is NOT accepting raw ScanBundleV1 data.  It translates
 * the already-canonical Atlas spatial truth into the shared AtlasPropertyV1
 * building section.
 *
 * The mapping is structural — both models describe the same physical building
 * geometry, but with slightly different field names and structures appropriate
 * to their respective layers.
 *
 * Provenance rules applied here:
 *   - All spatial values are marked 'scanned', 'medium' unless corrected
 *     by the engineer in which case 'observed', 'high' would be appropriate
 *     (the correction status is not visible from AtlasSpatialModelV1 v1.0 so
 *     'scanned', 'medium' is used conservatively for all values).
 */

import type {
  BuildingModelV1,
  FloorV1,
  RoomV1,
  ThermalZoneV1,
  BoundaryV1,
  OpeningV1,
  EmitterV1,
  FieldValue,
  ConfidenceBand,
  ProvenanceSource,
} from '@atlas/contracts';
import type { AtlasSpatialModelV1 } from '../../atlasSpatial/atlasSpatialModel.types';
import type { AtlasPropertyPatch } from '../types/atlasPropertyAdapter.types';

// ─── FieldValue factory ───────────────────────────────────────────────────────

function fv<T>(
  value: T,
  source: ProvenanceSource = 'scanned',
  confidence: ConfidenceBand = 'medium',
): FieldValue<T> {
  return { value, source, confidence };
}

// ─── Canvas unit constants ────────────────────────────────────────────────────

/** Canvas units per metre — matches FloorPlanBuilder.GRID = 24. */
const GRID = 24;

function canvasToMetres(canvasUnits: number): number {
  return canvasUnits / GRID;
}

// ─── Floor derivation ─────────────────────────────────────────────────────────

/**
 * Derives FloorV1 entries from room geometry floorIds in the spatial model.
 * AtlasSpatialModelV1 v1.0 has no explicit floors array, so floors are
 * inferred from the unique floorIds present in room geometry.
 */
function deriveFloors(spatial: AtlasSpatialModelV1): FloorV1[] {
  const floorMap = new Map<string, FloorV1>();

  for (const room of spatial.rooms) {
    const floorId = room.geometry?.floorId;
    if (!floorId || floorMap.has(floorId)) continue;

    floorMap.set(floorId, {
      floorId,
      index: floorMap.size,
      label: `Floor ${floorMap.size}`,
    });
  }

  // If no floor IDs were found in room geometry, emit a single default floor
  if (floorMap.size === 0) {
    floorMap.set('floor_0', { floorId: 'floor_0', index: 0, label: 'Ground Floor' });
  }

  return Array.from(floorMap.values());
}

// ─── Room mapping ─────────────────────────────────────────────────────────────

function mapRoom(room: import('../../atlasSpatial/atlasSpatialModel.types').AtlasRoomV1): RoomV1 {
  const bb = room.geometry?.boundingBox;
  const areaM2 = bb != null
    ? canvasToMetres(bb.width) * canvasToMetres(bb.height)
    : undefined;

  return {
    roomId:  room.roomId,
    floorId: room.geometry?.floorId ?? 'floor_0',
    label:   room.label,
    areaM2:  areaM2 != null ? fv(areaM2) : undefined,
    heated:  true,
  };
}

// ─── Zone mapping ─────────────────────────────────────────────────────────────

function mapZone(
  zone: import('../../atlasSpatial/atlasSpatialModel.types').AtlasThermalZoneV1,
): ThermalZoneV1 {
  return {
    zoneId:     zone.zoneId,
    label:      zone.label,
    roomIds:    [zone.roomId],
    designTempC: zone.designTempC != null
      ? fv(zone.designTempC, 'defaulted', 'medium')
      : undefined,
    heated: true,
  };
}

// ─── Emitter mapping ──────────────────────────────────────────────────────────

type AtlasEmitterType = import('../../atlasSpatial/atlasSpatialModel.types').AtlasEmitterType;

function mapEmitterType(
  type: AtlasEmitterType,
): EmitterV1['type'] {
  switch (type) {
    case 'radiator': return 'panel_radiator';
    case 'ufh':      return 'ufh_loop';
    case 'other':    return 'unknown';
  }
}

function mapEmitter(
  emitter: import('../../atlasSpatial/atlasSpatialModel.types').AtlasEmitterV1,
): EmitterV1 {
  return {
    emitterId: emitter.emitterId,
    roomId:    emitter.roomId,
    type:      mapEmitterType(emitter.type),
    ratedOutputW:     emitter.outputWattsAtDt50 != null
      ? fv(emitter.outputWattsAtDt50)
      : undefined,
    correctedOutputW: emitter.outputWattsAtDesign != null
      ? fv(emitter.outputWattsAtDesign, 'derived', 'medium')
      : undefined,
  };
}

// ─── Opening mapping ──────────────────────────────────────────────────────────

function mapOpening(
  opening: import('../../atlasSpatial/atlasSpatialModel.types').AtlasOpeningV1,
  boundaryIdForWall: (wallId: string | undefined) => string,
): OpeningV1 {
  return {
    openingId:  opening.openingId,
    boundaryId: boundaryIdForWall(opening.wallId),
    type:       opening.type === 'door' ? 'door' : 'window',
    widthM:     fv(opening.widthM),
    heightM:    opening.heightM != null ? fv(opening.heightM) : undefined,
  };
}

// ─── Boundary mapping ─────────────────────────────────────────────────────────

type BoundaryKind = import('../../atlasSpatial/atlasSpatialModel.types').BoundaryKind;

function mapBoundaryKind(
  kind: BoundaryKind,
): BoundaryV1['type'] {
  switch (kind) {
    case 'external':           return 'external_wall';
    case 'party':              return 'party_wall';
    case 'internal_heated':    return 'internal_wall';
    case 'internal_unheated':  return 'internal_wall';
  }
}

function mapBoundary(
  boundary: import('../../atlasSpatial/atlasSpatialModel.types').AtlasBoundaryV1,
): BoundaryV1 {
  return {
    boundaryId: boundary.boundaryId,
    type:       mapBoundaryKind(boundary.kind),
    roomIds:    [],
  };
}

// ─── Wall-to-boundary index ───────────────────────────────────────────────────

/**
 * Builds a lookup from wallId → boundaryId using AtlasBoundaryV1.wallIds.
 * When a wall is not listed in any boundary, falls back to a sentinel value.
 */
function buildWallToBoundaryIndex(
  boundaries: import('../../atlasSpatial/atlasSpatialModel.types').AtlasBoundaryV1[],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const boundary of boundaries) {
    for (const wallId of boundary.wallIds) {
      index.set(wallId, boundary.boundaryId);
    }
  }
  return index;
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

/**
 * Derives a partial AtlasPropertyV1 building section from an AtlasSpatialModelV1.
 *
 * The output patch covers only the `building` sub-model.  Compose with other
 * patches using mergeAtlasPropertyPatches() to build a complete AtlasPropertyV1.
 *
 * @param spatial  The canonical Atlas spatial model produced by the floor-plan
 *                 editor.  Must NOT be raw ScanBundleV1 data.
 * @returns        An AtlasPropertyPatch with building.floors, rooms, zones,
 *                 boundaries, openings, and emitters populated.
 */
export function atlasSpatialToAtlasPropertyPatch(spatial: AtlasSpatialModelV1): AtlasPropertyPatch {
  const floors     = deriveFloors(spatial);
  const rooms      = spatial.rooms.map(mapRoom);
  const zones      = spatial.zones.map(mapZone);
  const boundaries = spatial.boundaries.map(mapBoundary);
  const emitters   = spatial.emitters.map(mapEmitter);

  // Build wall → boundary index for opening mapping
  const wallToBoundary = buildWallToBoundaryIndex(spatial.boundaries);
  const lookupBoundary = (wallId: string | undefined): string =>
    (wallId != null ? wallToBoundary.get(wallId) : undefined) ?? 'unknown_boundary';

  const openings = spatial.openings.map(o => mapOpening(o, lookupBoundary));

  const building: Partial<BuildingModelV1> = {
    floors,
    rooms,
    zones,
    boundaries,
    openings,
    emitters,
    systemComponents: [],
  };

  return { building };
}
