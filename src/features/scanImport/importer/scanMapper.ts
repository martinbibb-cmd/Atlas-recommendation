/**
 * scanMapper.ts
 *
 * Maps a normalised ScanBundleV1 into canonical Atlas floor-plan draft entities.
 *
 * Responsibilities:
 *   - Derive Atlas RoomType from scan room labels (best-effort heuristic)
 *   - Convert normalised scan polygon bounds → Room (axis-aligned bounding box)
 *   - Map ScanWall → Wall
 *   - Map ScanOpening → Opening
 *   - Attach EntityProvenance to every imported entity
 *   - Build ScanImportWarning list (low confidence, missing data, etc.)
 *
 * The mapper does NOT:
 *   - Modify any non-floor-plan Atlas state
 *   - Write to recommendation or simulation outputs
 *   - Accept raw scan types outside this module
 */

import type { Room, Wall, Opening, FloorPlan, EntityProvenance } from '../../../components/floorplan/propertyPlan.types';
import type { ScanBundleV1, ScanRoom, ScanWall, ScanOpening } from '../contracts/scanContracts';
import type { RoomType } from '../../../components/floorplan/propertyPlan.types';

/** Generate a short unique ID for imported entities. */
function newId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// ─── Warning types ────────────────────────────────────────────────────────────

export type ScanImportWarningCode =
  | 'LOW_CONFIDENCE_ROOM'
  | 'LOW_CONFIDENCE_WALL'
  | 'LOW_CONFIDENCE_OPENING'
  | 'UNKNOWN_ROOM_TYPE'
  | 'MISSING_WALL_THICKNESS'
  | 'MISSING_OPENINGS'
  | 'UNKNOWN_OPENING_TYPE'
  | 'DEGENERATE_POLYGON'
  | 'ZERO_AREA_ROOM'
  | 'UNKNOWN_WALL_KIND'
  | 'BUNDLE_QA_ERROR'
  | 'BUNDLE_QA_WARNING';

export interface ScanImportWarning {
  code: ScanImportWarningCode;
  message: string;
  entityId?: string;
}

// ─── Canonical floor-plan draft ───────────────────────────────────────────────

/**
 * CanonicalFloorPlanDraft — the output shape of the importer.
 *
 * This is a subset of PropertyPlan that captures the geometry imported from
 * a scan bundle.  The caller is responsible for merging it into an existing
 * PropertyPlan (or creating a new one) as appropriate.
 *
 * floors              — one FloorPlan per distinct floorIndex in the bundle
 * importedRoomIds     — IDs of all rooms introduced by this import
 * importedWallIds     — IDs of all walls introduced by this import
 * importedOpeningIds  — IDs of all openings introduced by this import
 */
export interface CanonicalFloorPlanDraft {
  floors: FloorPlan[];
  importedRoomIds: string[];
  importedWallIds: string[];
  importedOpeningIds: string[];
}

// ─── Provenance summary ───────────────────────────────────────────────────────

export interface ProvenanceSummary {
  bundleId: string;
  bundleVersion: string;
  capturedAt: string;
  totalRooms: number;
  totalWalls: number;
  totalOpenings: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
}

// ─── Room-type label heuristic ────────────────────────────────────────────────

/** Lower-case tokens that suggest a known Atlas RoomType. */
const ROOM_LABEL_MAP: Array<[RegExp, RoomType]> = [
  [/living|lounge|reception|sitting/i,  'living'],
  [/dining/i,                            'dining'],
  [/kitchen/i,                           'kitchen'],
  [/bed/i,                               'bedroom'],
  [/en.?suite/i,                         'en_suite'],
  [/bath/i,                              'bathroom'],
  [/hall|entry|entrance|foyer/i,         'hallway'],
  [/landing/i,                           'landing'],
  [/utility|laundry/i,                   'utility'],
  [/garage/i,                            'garage'],
  [/study|office/i,                      'study'],
  [/conservatory|sunroom/i,              'conservatory'],
  [/loft|attic/i,                        'loft'],
  [/cupboard|closet|wardrobe/i,          'cupboard'],
  [/plant.?room|boiler.?room|meter/i,    'plant_room'],
  [/outside|garden|patio|yard/i,         'outside'],
];

function inferRoomType(label: string): { roomType: RoomType; isInferred: boolean } {
  for (const [pattern, roomType] of ROOM_LABEL_MAP) {
    if (pattern.test(label)) {
      return { roomType, isInferred: false };
    }
  }
  return { roomType: 'other', isInferred: true };
}

// ─── Bounding box from polygon ────────────────────────────────────────────────

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function polygonBBox(polygon: Array<{ x: number; y: number }>): BBox {
  if (polygon.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = polygon[0].x, minY = polygon[0].y;
  let maxX = minX, maxY = minY;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ─── Confidence helpers ───────────────────────────────────────────────────────

const CONFIDENCE_NUMERIC: Record<string, number> = { high: 1.0, medium: 0.6, low: 0.3 };

function confidenceToNumber(band: string): number {
  return CONFIDENCE_NUMERIC[band] ?? 0.3;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function buildRoomProvenance(
  scanRoom: ScanRoom,
  bundle: ScanBundleV1,
): EntityProvenance {
  return {
    source: 'scanned',
    sourceBundleVersion: bundle.version,
    sourceBundleId: bundle.bundleId,
    confidence: confidenceToNumber(scanRoom.confidence),
    confidenceBand: scanRoom.confidence,
    reviewStatus: 'unreviewed',
  };
}

function buildWallProvenance(
  scanWall: ScanWall,
  bundle: ScanBundleV1,
): EntityProvenance {
  return {
    source: 'scanned',
    sourceBundleVersion: bundle.version,
    sourceBundleId: bundle.bundleId,
    confidence: confidenceToNumber(scanWall.confidence),
    confidenceBand: scanWall.confidence,
    reviewStatus: 'unreviewed',
  };
}

function buildOpeningProvenance(
  scanOpening: ScanOpening,
  bundle: ScanBundleV1,
): EntityProvenance {
  return {
    source: 'scanned',
    sourceBundleVersion: bundle.version,
    sourceBundleId: bundle.bundleId,
    confidence: confidenceToNumber(scanOpening.confidence),
    confidenceBand: scanOpening.confidence,
    reviewStatus: 'unreviewed',
  };
}

function mapScanOpeningToOpening(
  scanOpening: ScanOpening,
  floorId: string,
  wallId: string,
  bundle: ScanBundleV1,
  warnings: ScanImportWarning[],
): Opening {
  const id = newId();
  if (scanOpening.type === 'unknown') {
    warnings.push({
      code: 'UNKNOWN_OPENING_TYPE',
      message: `Opening '${scanOpening.id}' has unknown type — defaulting to door.`,
      entityId: scanOpening.id,
    });
  }
  return {
    id,
    floorId,
    type: scanOpening.type === 'window' ? 'window' : 'door',
    wallId,
    offsetM: scanOpening.offsetM,
    widthM: scanOpening.widthM,
    provenance: buildOpeningProvenance(scanOpening, bundle),
  };
}

function mapScanWallToWall(
  scanWall: ScanWall,
  floorId: string,
  bundle: ScanBundleV1,
  warnings: ScanImportWarning[],
): { wall: Wall; openings: Opening[] } {
  const wallId = newId();

  if (scanWall.kind === 'unknown') {
    warnings.push({
      code: 'UNKNOWN_WALL_KIND',
      message: `Wall '${scanWall.id}' has unknown kind — defaulting to external.`,
      entityId: scanWall.id,
    });
  }

  if (scanWall.confidence === 'low') {
    warnings.push({
      code: 'LOW_CONFIDENCE_WALL',
      message: `Wall '${scanWall.id}' has low scan confidence — review geometry.`,
      entityId: scanWall.id,
    });
  }

  if (scanWall.thicknessMm === 0) {
    warnings.push({
      code: 'MISSING_WALL_THICKNESS',
      message: `Wall '${scanWall.id}' has unknown thickness — defaulting to undefined.`,
      entityId: scanWall.id,
    });
  }

  const wall: Wall = {
    id: wallId,
    floorId,
    kind: scanWall.kind === 'internal' ? 'internal' : 'external',
    x1: scanWall.start.x,
    y1: scanWall.start.y,
    x2: scanWall.end.x,
    y2: scanWall.end.y,
    thicknessMm: scanWall.thicknessMm > 0 ? scanWall.thicknessMm : undefined,
    provenance: buildWallProvenance(scanWall, bundle),
  };

  const openings: Opening[] = scanWall.openings.map(o =>
    mapScanOpeningToOpening(o, floorId, wallId, bundle, warnings),
  );

  if (scanWall.openings.length === 0) {
    // Not a warning by itself — external walls often have no openings.
    // Only warn if the wall is internal and has no openings (unusual).
    if (scanWall.kind === 'internal') {
      warnings.push({
        code: 'MISSING_OPENINGS',
        message: `Internal wall '${scanWall.id}' has no detected openings — check for doors.`,
        entityId: scanWall.id,
      });
    }
  }

  return { wall, openings };
}

function mapScanRoomToRoom(
  scanRoom: ScanRoom,
  floorId: string,
  bundle: ScanBundleV1,
  warnings: ScanImportWarning[],
): { room: Room; walls: Wall[]; openings: Opening[] } {
  const { roomType, isInferred } = inferRoomType(scanRoom.label);

  if (isInferred) {
    warnings.push({
      code: 'UNKNOWN_ROOM_TYPE',
      message: `Room '${scanRoom.id}' label '${scanRoom.label}' did not match a known room type — assigned 'other'.`,
      entityId: scanRoom.id,
    });
  }

  if (scanRoom.confidence === 'low') {
    warnings.push({
      code: 'LOW_CONFIDENCE_ROOM',
      message: `Room '${scanRoom.id}' has low scan confidence — review shape and dimensions.`,
      entityId: scanRoom.id,
    });
  }

  const bbox = polygonBBox(scanRoom.polygon);

  if (bbox.width === 0 || bbox.height === 0) {
    warnings.push({
      code: 'DEGENERATE_POLYGON',
      message: `Room '${scanRoom.id}' has a degenerate polygon (zero width or height) — check scan data.`,
      entityId: scanRoom.id,
    });
  }

  if (scanRoom.areaM2 <= 0) {
    warnings.push({
      code: 'ZERO_AREA_ROOM',
      message: `Room '${scanRoom.id}' reports zero or negative area — check scan data.`,
      entityId: scanRoom.id,
    });
  }

  const room: Room = {
    id: newId(),
    name: scanRoom.label || roomType,
    roomType,
    floorId,
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    areaM2: scanRoom.areaM2 > 0 ? scanRoom.areaM2 : undefined,
    heightM: scanRoom.heightM > 0 ? scanRoom.heightM : undefined,
    provenance: buildRoomProvenance(scanRoom, bundle),
  };

  const walls: Wall[] = [];
  const openings: Opening[] = [];

  for (const scanWall of scanRoom.walls) {
    const { wall, openings: wallOpenings } = mapScanWallToWall(scanWall, floorId, bundle, warnings);
    walls.push(wall);
    openings.push(...wallOpenings);
  }

  return { room, walls, openings };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildScanImportWarnings — inspects bundle-level QA flags and returns
 * ScanImportWarning entries for any error or warning flags raised by the
 * scan client.
 *
 * This is called before the structural mapping so that QA-level issues are
 * surfaced even if the import ultimately succeeds.
 */
export function buildScanImportWarnings(bundle: ScanBundleV1): ScanImportWarning[] {
  const warnings: ScanImportWarning[] = [];

  for (const flag of bundle.qaFlags) {
    if (flag.severity === 'error') {
      warnings.push({
        code: 'BUNDLE_QA_ERROR',
        message: `[QA error] ${flag.code}: ${flag.message}`,
        entityId: flag.entityId,
      });
    } else if (flag.severity === 'warning') {
      warnings.push({
        code: 'BUNDLE_QA_WARNING',
        message: `[QA warning] ${flag.code}: ${flag.message}`,
        entityId: flag.entityId,
      });
    }
  }

  return warnings;
}

/**
 * mapScanBundleToFloorPlanDraft — maps a normalised ScanBundleV1 into a
 * CanonicalFloorPlanDraft.
 *
 * Returns both the draft and any warnings accumulated during mapping.
 * The caller decides whether to treat warnings as blocking.
 */
export function mapScanBundleToFloorPlanDraft(
  bundle: ScanBundleV1,
): { draft: CanonicalFloorPlanDraft; warnings: ScanImportWarning[] } {
  const warnings: ScanImportWarning[] = buildScanImportWarnings(bundle);

  // Group rooms by floorIndex → FloorPlan
  const floorMap = new Map<number, {
    rooms: Room[];
    walls: Wall[];
    openings: Opening[];
  }>();

  for (const scanRoom of bundle.rooms) {
    if (!floorMap.has(scanRoom.floorIndex)) {
      floorMap.set(scanRoom.floorIndex, { rooms: [], walls: [], openings: [] });
    }
  }

  const importedRoomIds: string[] = [];
  const importedWallIds: string[] = [];
  const importedOpeningIds: string[] = [];

  for (const scanRoom of bundle.rooms) {
    const floorIndex = scanRoom.floorIndex;
    const floorId = `floor-${floorIndex}`;
    const entry = floorMap.get(floorIndex)!;

    const { room, walls, openings } = mapScanRoomToRoom(scanRoom, floorId, bundle, warnings);

    entry.rooms.push(room);
    entry.walls.push(...walls);
    entry.openings.push(...openings);

    importedRoomIds.push(room.id);
    importedWallIds.push(...walls.map(w => w.id));
    importedOpeningIds.push(...openings.map(o => o.id));
  }

  const floors: FloorPlan[] = Array.from(floorMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([floorIndex, { rooms, walls, openings }]) => ({
      id: `floor-${floorIndex}`,
      name: floorIndex === 0 ? 'Ground Floor' : floorIndex === 1 ? 'First Floor' : `Floor ${floorIndex}`,
      levelIndex: floorIndex,
      rooms,
      walls,
      openings,
      zones: [],
    }));

  return {
    draft: { floors, importedRoomIds, importedWallIds, importedOpeningIds },
    warnings,
  };
}

/**
 * buildProvenanceSummary — produces a summary of confidence distribution
 * across all imported entities for display in the dev harness and logs.
 */
export function buildProvenanceSummary(
  bundle: ScanBundleV1,
  draft: CanonicalFloorPlanDraft,
): ProvenanceSummary {
  let high = 0, medium = 0, low = 0;

  for (const floor of draft.floors) {
    for (const room of floor.rooms) {
      const band = room.provenance?.confidenceBand;
      if (band === 'high') high++;
      else if (band === 'medium') medium++;
      else if (band === 'low') low++;
    }
    for (const wall of floor.walls) {
      const band = wall.provenance?.confidenceBand;
      if (band === 'high') high++;
      else if (band === 'medium') medium++;
      else if (band === 'low') low++;
    }
    for (const opening of floor.openings) {
      const band = opening.provenance?.confidenceBand;
      if (band === 'high') high++;
      else if (band === 'medium') medium++;
      else if (band === 'low') low++;
    }
  }

  return {
    bundleId: bundle.bundleId,
    bundleVersion: bundle.version,
    capturedAt: bundle.meta.capturedAt,
    totalRooms: draft.importedRoomIds.length,
    totalWalls: draft.importedWallIds.length,
    totalOpenings: draft.importedOpeningIds.length,
    highConfidenceCount: high,
    mediumConfidenceCount: medium,
    lowConfidenceCount: low,
  };
}
