/**
 * buildAtlasSpatialModel.ts
 *
 * Converts a PropertyPlan (floor plan editor state) into an AtlasSpatialModelV1.
 *
 * This is the ingest step of the pipeline:
 *   PropertyPlan  →  AtlasSpatialModelV1
 *
 * What it does:
 * - Maps each PropertyPlan Room to an AtlasRoomV1.
 * - Creates one default AtlasThermalZoneV1 per heated room (the whole-room zone).
 * - Converts radiator_loop / ufh_loop PlacementNodes to AtlasEmitterV1 records,
 *   assigned to the default zone for their parent room.
 * - Converts Openings (doors and windows) to AtlasOpeningV1 records.
 * - Classifies Walls as AtlasBoundaryV1 records (external / internal_heated).
 *
 * What it does NOT do:
 * - Modify SessionCaptureV1; that schema is observational only.
 * - Calculate heat loss; that is done by calculateHeatLossModel().
 * - Create sub-zones; those are added later by the Atlas floor plan editor.
 *
 * Design rules:
 * - No Math.random() — all IDs are deterministic from the source entity IDs.
 * - 'outside'-typed rooms are excluded (not heated spaces).
 * - Emitters without a roomId are excluded (not yet spatially placed).
 */

import type { PropertyPlan, Room, Wall } from '../../components/floorplan/propertyPlan.types';
import type {
  AtlasSpatialModelV1,
  AtlasRoomV1,
  AtlasThermalZoneV1,
  AtlasEmitterV1,
  AtlasEmitterType,
  AtlasOpeningV1,
  AtlasBoundaryV1,
} from './atlasSpatialModel.types';

// ─── Canvas scale ─────────────────────────────────────────────────────────────

/** Canvas units per metre — matches FloorPlanBuilder.tsx and floorplanDerivations.ts. */
const GRID = 24;

// ─── Emitter kind helpers ─────────────────────────────────────────────────────

const RADIATOR_PART_KINDS = new Set(['radiator_loop']);
const UFH_PART_KINDS      = new Set(['ufh_loop']);

function partKindToEmitterType(kind: string): AtlasEmitterType {
  if (RADIATOR_PART_KINDS.has(kind)) return 'radiator';
  if (UFH_PART_KINDS.has(kind))      return 'ufh';
  return 'other';
}

// ─── Zone defaults ────────────────────────────────────────────────────────────

/**
 * Derive a default zone ID that is stable and deterministic for a given room.
 * Format: `zone_default_<roomId>`
 */
function defaultZoneId(roomId: string): string {
  return `zone_default_${roomId}`;
}

/**
 * Build a single default AtlasThermalZoneV1 covering the full room footprint.
 * Called by buildAtlasSpatialModel() for every heated room that has no
 * pre-existing zone split.
 */
function buildDefaultZone(room: Room): AtlasThermalZoneV1 {
  const widthM  = room.width  / GRID;
  const heightM = room.height / GRID;

  return {
    zoneId: defaultZoneId(room.id),
    roomId: room.id,
    label: room.name,
    geometry: {
      floorId: room.floorId,
      boundingBox: {
        x:      room.x,
        y:      room.y,
        width:  room.width,
        height: room.height,
      },
    },
    floorAreaM2:        Number((widthM * heightM).toFixed(2)),
    heightM:            room.heightM,
    emitterIds: [],
  };
}

// ─── Wall classification helpers ──────────────────────────────────────────────

/**
 * Map a PropertyPlan WallKind to an AtlasBoundaryV1 kind.
 *
 * 'external' walls separate the heated envelope from outdoors.
 * 'internal' walls separate two spaces inside the dwelling; we classify them
 * as internal_heated by default (the Atlas editor can reclassify to
 * internal_unheated or party where appropriate).
 */
function wallKindToBoundaryKind(wallKind: Wall['kind']): AtlasBoundaryV1['kind'] {
  return wallKind === 'external' ? 'external' : 'internal_heated';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build an AtlasSpatialModelV1 from a PropertyPlan.
 *
 * @param plan            The PropertyPlan to ingest.
 * @param propertyId      Stable property identifier (e.g. CRM reference or UUID).
 * @param sourceSessionId Optional SessionCaptureV1 ID that produced this plan.
 * @returns               A fully-populated AtlasSpatialModelV1 ready for editing
 *                        and heat-loss calculation.
 */
export function buildAtlasSpatialModel(
  plan: PropertyPlan,
  propertyId: string,
  sourceSessionId?: string,
): AtlasSpatialModelV1 {
  const allRooms = plan.floors.flatMap((f) => f.rooms);

  // Exclude 'outside' rooms — they are not part of the heated envelope.
  const heatedRooms = allRooms.filter((r) => r.roomType !== 'outside');

  const heatedRoomIds = new Set(heatedRooms.map((r) => r.id));

  // ── Rooms ─────────────────────────────────────────────────────────────────

  const rooms: AtlasRoomV1[] = heatedRooms.map((room) => ({
    roomId:   room.id,
    label:    room.name,
    status:   'draft',
    roomType: room.roomType,
    geometry: {
      floorId: room.floorId,
      boundingBox: {
        x:      room.x,
        y:      room.y,
        width:  room.width,
        height: room.height,
      },
    },
    zoneIds: [defaultZoneId(room.id)],
  }));

  // ── Thermal zones (one default zone per heated room) ──────────────────────

  const zones: AtlasThermalZoneV1[] = heatedRooms.map(buildDefaultZone);

  // ── Emitters (radiator_loop and ufh_loop placement nodes) ────────────────

  const emitters: AtlasEmitterV1[] = [];

  for (const node of plan.placementNodes) {
    if (node.type !== 'radiator_loop' && node.type !== 'ufh_loop') continue;
    if (!node.roomId || !heatedRoomIds.has(node.roomId)) continue;

    const emitterId = `emitter_${node.id}`;
    const zoneId    = defaultZoneId(node.roomId);

    const emitter: AtlasEmitterV1 = {
      emitterId,
      objectId: node.id,
      roomId:   node.roomId,
      zoneId,
      type:     partKindToEmitterType(node.type),
      ...(typeof node.emitterOutputKw === 'number'
        ? { outputWattsAtDesign: Math.round(node.emitterOutputKw * 1000) }
        : {}),
    };

    emitters.push(emitter);

    // Register the emitter ID back onto the default zone.
    const zone = zones.find((z) => z.zoneId === zoneId);
    if (zone) {
      zone.emitterIds.push(emitterId);
    }
  }

  // ── Openings (doors and windows) ──────────────────────────────────────────

  const allWalls    = plan.floors.flatMap((f) => f.walls);
  const allOpenings = plan.floors.flatMap((f) => f.openings);

  // Build a fast lookup: wallId → roomIds so we can find the interior room.
  const wallRoomIds = new Map<string, string[]>();
  for (const wall of allWalls) {
    if (wall.roomIds && wall.roomIds.length > 0) {
      wallRoomIds.set(wall.id, wall.roomIds);
    }
  }

  const openings: AtlasOpeningV1[] = allOpenings.map((opening) => {
    const wallRooms = wallRoomIds.get(opening.wallId) ?? [];
    // Pick the first heated room that is listed on the wall (interior face).
    const roomId = wallRooms.find((id) => heatedRoomIds.has(id));

    return {
      openingId: opening.id,
      ...(roomId ? { roomId } : {}),
      wallId: opening.wallId,
      type:   opening.type,
      widthM: opening.widthM,
    };
  });

  // ── Boundaries (walls classified by kind) ─────────────────────────────────

  // Group walls by their kind so contiguous runs can share a boundary record.
  // For simplicity each wall becomes its own boundary; the editor can merge them.
  const boundaries: AtlasBoundaryV1[] = allWalls.map((wall) => ({
    boundaryId: `boundary_${wall.id}`,
    kind:       wallKindToBoundaryKind(wall.kind),
    wallIds:    [wall.id],
  }));

  return {
    version: '1.0',
    propertyId,
    ...(sourceSessionId ? { sourceSessionId } : {}),
    rooms,
    zones,
    emitters,
    openings,
    boundaries,
  };
}
