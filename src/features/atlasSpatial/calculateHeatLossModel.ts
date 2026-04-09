/**
 * calculateHeatLossModel.ts
 *
 * Derives a HeatLossModelV1 from an AtlasSpatialModelV1.
 *
 * Pipeline position:
 *   AtlasSpatialModelV1  →  HeatLossModelV1  ← this step
 *
 * Calculation strategy:
 * 1. For each AtlasThermalZoneV1, compute zone heat loss from fabric inputs
 *    (or fall back to geometry-derived estimates when inputs are absent).
 * 2. Compute emitter adequacy per zone.
 * 3. Roll up zone results to room-level results (sum over zoneIds).
 * 4. Roll up room results to whole-property total.
 *
 * Physics:
 *   Heat loss (W) = Σ (U × A × ΔT)
 *   where ΔT = designTempC − outdoorDesignTempC
 *
 * Default U-values follow UK pre-2000 dwelling stock assumptions and match the
 * constants used in floorplanDerivations.ts so that both calculation paths
 * produce consistent results.
 *
 * Design rules:
 * - No Math.random() — results are deterministic from the same input.
 * - Calculations are zone-first; room and property totals are derived sums.
 * - Use Watts throughout; never mix kW and W in the same expression.
 * - The GRID constant (24 canvas units = 1 metre) matches FloorPlanBuilder.tsx.
 */

import type { AtlasSpatialModelV1, AtlasThermalZoneV1, AtlasEmitterV1 } from './atlasSpatialModel.types';
import type { HeatLossModelV1, ZoneHeatLossResult, RoomHeatLossResult, EmitterAdequacyStatus } from './heatLossModel.types';

// ─── Canvas scale ─────────────────────────────────────────────────────────────

/** Canvas units per metre. */
const GRID = 24;

// ─── Default U-values (W/m²K) ─────────────────────────────────────────────────
// UK pre-2000 dwelling stock assumptions, consistent with floorplanDerivations.ts.
// cavity_uninsulated is intentionally equal to solid_masonry (high heat-loss band).

const U_VALUES_W_M2K: Record<string, number> = {
  solid_masonry:      1.6,
  cavity_uninsulated: 1.6,  // high heat-loss band — same as solid_masonry
  cavity_insulated:   0.5,
  cavity_full_fill:   0.3,
  timber_frame:       0.3,
  unknown:            1.6,  // conservative default
};

/** Default ceiling / roof U-value (W/m²K). */
const U_CEILING_DEFAULT_W_M2K = 0.35;

/** Default ground / intermediate floor U-value (W/m²K). */
const U_FLOOR_DEFAULT_W_M2K = 0.45;

/** Default double-glazed window U-value (W/m²K). */
const U_WINDOW_DEFAULT_W_M2K = 2.8;

// ─── Design temperature assumptions ──────────────────────────────────────────

/**
 * Outdoor design temperature (°C) for UK EN 12831 sizing.
 * Represents a cold winter design condition (-1 °C at the boundary of the
 * heated envelope, effectively -1 °C outdoor for standard UK calculations).
 */
const OUTDOOR_DESIGN_TEMP_C = 0;

/**
 * BS EN 12831 reference indoor design temperatures by room type (°C).
 * Applied when a zone's designTempC is not explicitly set.
 */
const DESIGN_TEMP_BY_ROOM_TYPE: Record<string, number> = {
  living:        21,
  dining:        21,
  kitchen:       18,
  bedroom:       18,
  bathroom:      22,
  en_suite:      22,
  hallway:       18,
  landing:       18,
  utility:       18,
  garage:        12,
  study:         21,
  conservatory:  21,
  loft:          18,
  cupboard:      18,
  plant_room:    18,
  other:         21,
};

const DEFAULT_INDOOR_DESIGN_TEMP_C = 21;

// ─── Emitter adequacy thresholds ──────────────────────────────────────────────

/** Coverage ratio below which a zone is classified as undersized. */
const COVERAGE_UNDERSIZED_THRESHOLD = 1.0;

/** Coverage ratio above which a zone is classified as oversized. */
const COVERAGE_OVERSIZED_THRESHOLD  = 1.8;

// ─── Zone heat-loss helpers ────────────────────────────────────────────────────

/**
 * Derive the floor area (m²) for a zone.
 * Explicit floorAreaM2 takes precedence; falls back to bounding box geometry.
 */
function resolveFloorAreaM2(zone: AtlasThermalZoneV1): number {
  if (zone.floorAreaM2 !== undefined && zone.floorAreaM2 > 0) {
    return zone.floorAreaM2;
  }
  const bb = zone.geometry?.boundingBox;
  if (bb) {
    return Number(((bb.width / GRID) * (bb.height / GRID)).toFixed(2));
  }
  return 0;
}

/**
 * Derive the ceiling height (m) for a zone.
 * Falls back to a typical UK 2.4 m ceiling when not specified.
 */
function resolveHeightM(zone: AtlasThermalZoneV1): number {
  return zone.heightM ?? 2.4;
}

/**
 * Derive the exposed perimeter (m) for a zone.
 * When not explicitly set, estimates the full zone perimeter
 * (conservative assumption: all sides exposed to outdoors).
 * The Atlas editor can refine this using adjacency data.
 */
function resolveExposedPerimeterM(zone: AtlasThermalZoneV1, floorAreaM2: number): number {
  if (zone.exposedPerimeterM !== undefined && zone.exposedPerimeterM >= 0) {
    return zone.exposedPerimeterM;
  }
  // Fallback: approximate a square room from its floor area.
  const sideM = Math.sqrt(floorAreaM2);
  return Number((4 * sideM).toFixed(2));
}

/**
 * Look up the external wall U-value (W/m²K) for a zone.
 * Priority: explicit override → wall construction look-up → conservative default.
 */
function resolveWallUValue(zone: AtlasThermalZoneV1): number {
  if (typeof zone.wallUValueOverride === 'number') {
    return zone.wallUValueOverride;
  }
  const construction = zone.wallConstruction ?? 'unknown';
  return U_VALUES_W_M2K[construction] ?? U_VALUES_W_M2K.unknown;
}

/**
 * Derive the indoor design temperature (°C) for a zone.
 * Uses the zone's designTempC when set; otherwise looks up the room type default.
 */
function resolveDesignTempC(zone: AtlasThermalZoneV1, roomType: string | undefined): number {
  if (zone.designTempC !== undefined) return zone.designTempC;
  return DESIGN_TEMP_BY_ROOM_TYPE[roomType ?? ''] ?? DEFAULT_INDOOR_DESIGN_TEMP_C;
}

// ─── Adequacy classification ──────────────────────────────────────────────────

/**
 * Classify a zone's emitter adequacy from the coverage ratio.
 *
 * coverage = totalEmitterOutputW / heatLossW
 *   < 1.0  → undersized
 *   > 1.8  → oversized
 *   else   → adequate
 */
function classifyAdequacy(
  totalEmitterOutputW: number,
  heatLossW: number,
): EmitterAdequacyStatus {
  if (totalEmitterOutputW === 0)               return 'no_emitter';
  if (heatLossW <= 0)                          return 'adequate';
  const ratio = totalEmitterOutputW / heatLossW;
  if (ratio < COVERAGE_UNDERSIZED_THRESHOLD)   return 'undersized';
  if (ratio > COVERAGE_OVERSIZED_THRESHOLD)    return 'oversized';
  return 'adequate';
}

/**
 * Aggregate zone-level adequacy statuses into a room-level status.
 * Worst-case rule: undersized > oversized > adequate > no_emitter.
 */
function worstAdequacyStatus(statuses: EmitterAdequacyStatus[]): EmitterAdequacyStatus {
  if (statuses.includes('undersized'))  return 'undersized';
  if (statuses.includes('oversized'))   return 'oversized';
  if (statuses.includes('adequate'))    return 'adequate';
  return 'no_emitter';
}

// ─── Zone calculation ─────────────────────────────────────────────────────────

/**
 * Calculate the ZoneHeatLossResult for a single thermal zone.
 *
 * Heat loss components:
 *   Wall loss   = U_wall × (exposedPerimeterM × heightM − windowAreaM2) × ΔT
 *   Ceiling     = U_ceiling × floorAreaM2 × ΔT
 *   Floor       = U_floor   × floorAreaM2 × ΔT
 *   Glazing     = U_window  × windowAreaM2 × ΔT
 *
 * Window area is subtracted from the opaque wall area to avoid double-counting.
 * If window area exceeds the gross wall area the wall term is clamped to zero.
 */
function calculateZoneResult(
  zone: AtlasThermalZoneV1,
  roomType: string | undefined,
  zoneEmitters: AtlasEmitterV1[],
): ZoneHeatLossResult {
  const floorAreaM2       = resolveFloorAreaM2(zone);
  const heightM           = resolveHeightM(zone);
  const exposedPerimeterM = resolveExposedPerimeterM(zone, floorAreaM2);
  const wallU             = resolveWallUValue(zone);
  const windowU           = zone.windowUValue ?? U_WINDOW_DEFAULT_W_M2K;
  const windowAreaM2      = zone.windowAreaM2 ?? 0;
  const designTempC       = resolveDesignTempC(zone, roomType);
  const deltaT            = designTempC - OUTDOOR_DESIGN_TEMP_C;

  const grossWallAreaM2   = exposedPerimeterM * heightM;
  const netWallAreaM2     = Math.max(0, grossWallAreaM2 - windowAreaM2);

  const fabricWallLossW    = wallU * netWallAreaM2 * deltaT;
  const fabricCeilingLossW = U_CEILING_DEFAULT_W_M2K * floorAreaM2 * deltaT;
  const fabricFloorLossW   = U_FLOOR_DEFAULT_W_M2K   * floorAreaM2 * deltaT;
  const fabricGlazingLossW = windowU * windowAreaM2   * deltaT;

  const heatLossWatts = Number(
    (fabricWallLossW + fabricCeilingLossW + fabricFloorLossW + fabricGlazingLossW).toFixed(1),
  );

  // Emitter output at design conditions — use outputWattsAtDesign when available.
  const totalEmitterOutputWatts = zoneEmitters.reduce((sum, e) => {
    const output = e.outputWattsAtDesign ?? e.outputWattsAtDt50 ?? 0;
    return sum + output;
  }, 0);

  const shortfallWatts  = Number((heatLossWatts - totalEmitterOutputWatts).toFixed(1));
  const adequacyStatus  = classifyAdequacy(totalEmitterOutputWatts, heatLossWatts);

  return {
    zoneId:                zone.zoneId,
    roomId:                zone.roomId,
    zoneLabel:             zone.label,
    floorAreaM2:           Number(floorAreaM2.toFixed(2)),
    heightM:               Number(heightM.toFixed(2)),
    exposedPerimeterM:     Number(exposedPerimeterM.toFixed(2)),
    fabricWallLossW:       Number(fabricWallLossW.toFixed(1)),
    fabricCeilingLossW:    Number(fabricCeilingLossW.toFixed(1)),
    fabricFloorLossW:      Number(fabricFloorLossW.toFixed(1)),
    fabricGlazingLossW:    Number(fabricGlazingLossW.toFixed(1)),
    heatLossWatts,
    totalEmitterOutputWatts,
    shortfallWatts,
    adequacyStatus,
  };
}

// ─── Room rollup ──────────────────────────────────────────────────────────────

/**
 * Aggregate zone results into a room-level RoomHeatLossResult.
 */
function rollUpToRoom(
  room: AtlasSpatialModelV1['rooms'][number],
  roomZoneResults: ZoneHeatLossResult[],
): RoomHeatLossResult {
  const heatLossWatts           = Number(roomZoneResults.reduce((s, z) => s + z.heatLossWatts,           0).toFixed(1));
  const totalEmitterOutputWatts = Number(roomZoneResults.reduce((s, z) => s + z.totalEmitterOutputWatts, 0).toFixed(1));
  const shortfallWatts          = Number((heatLossWatts - totalEmitterOutputWatts).toFixed(1));
  const adequacyStatus          = worstAdequacyStatus(roomZoneResults.map((z) => z.adequacyStatus));

  return {
    roomId:                 room.roomId,
    roomLabel:              room.label,
    zoneIds:                roomZoneResults.map((z) => z.zoneId),
    heatLossWatts,
    totalEmitterOutputWatts,
    shortfallWatts,
    adequacyStatus,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate a HeatLossModelV1 from an AtlasSpatialModelV1.
 *
 * Zones without explicit geometry fall back to bounding-box estimates.
 * Zones without emitters are classified as 'no_emitter'.
 *
 * @param spatial       The AtlasSpatialModelV1 to calculate from.
 * @param calculatedAt  Optional ISO 8601 timestamp (defaults to now).
 * @returns             A fully-populated HeatLossModelV1.
 */
export function calculateHeatLossModel(
  spatial: AtlasSpatialModelV1,
  calculatedAt?: string,
): HeatLossModelV1 {
  // Build a fast emitter lookup: zoneId → AtlasEmitterV1[].
  const emittersByZone = new Map<string, AtlasEmitterV1[]>();
  for (const emitter of spatial.emitters) {
    const key = emitter.zoneId ?? '';
    if (!emittersByZone.has(key)) emittersByZone.set(key, []);
    emittersByZone.get(key)!.push(emitter);
  }

  // Build a fast room look up: roomId → roomType.
  const roomTypeById = new Map<string, string>();
  for (const room of spatial.rooms) {
    roomTypeById.set(room.roomId, room.roomType);
  }

  // ── Zone-level calculation ─────────────────────────────────────────────────

  const zoneResults: ZoneHeatLossResult[] = spatial.zones.map((zone) => {
    const zoneEmitters = emittersByZone.get(zone.zoneId) ?? [];
    const roomType     = roomTypeById.get(zone.roomId);
    return calculateZoneResult(zone, roomType, zoneEmitters);
  });

  // ── Room-level rollup ─────────────────────────────────────────────────────

  const roomResults: RoomHeatLossResult[] = spatial.rooms.map((room) => {
    const roomZoneResults = zoneResults.filter((z) => z.roomId === room.roomId);
    return rollUpToRoom(room, roomZoneResults);
  });

  // ── Property total ────────────────────────────────────────────────────────

  const totalHeatLossWatts = Number(
    roomResults.reduce((s, r) => s + r.heatLossWatts, 0).toFixed(1),
  );

  return {
    version: '1.0',
    propertyId:  spatial.propertyId,
    calculatedAt: calculatedAt ?? new Date().toISOString(),
    roomResults,
    zoneResults,
    totalHeatLossWatts,
  };
}
