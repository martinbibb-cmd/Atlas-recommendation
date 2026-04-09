/**
 * heatLossModel.types.ts
 *
 * HeatLossModelV1 — derived calculation results produced by calculateHeatLossModel().
 *
 * Pipeline position:
 *   AtlasSpatialModelV1
 *   → HeatLossModelV1  ← this layer
 *   → recommendation / report / portal outputs
 *
 * Design rules:
 * - Never store these results back into AtlasSpatialModelV1; they are derived.
 * - Calculations are always at zone level first, then rolled up to rooms.
 * - Whole-property total is the sum of all zone results.
 * - All heat values are in Watts (not kW) to avoid float rounding at small loads.
 */

// ─── Emitter adequacy ─────────────────────────────────────────────────────────

/**
 * Adequacy classification for a zone or room relative to its heat demand.
 *
 * adequate   — emitter output meets or meaningfully exceeds zone demand.
 * undersized — emitter output cannot meet zone heat demand at design conditions.
 * oversized  — emitter output far exceeds zone demand (> 1.8× coverage ratio).
 *              Indicates opportunity to lower system flow temperature.
 * no_emitter — no emitter is assigned; cannot assess adequacy.
 */
export type EmitterAdequacyStatus =
  | 'adequate'
  | 'undersized'
  | 'oversized'
  | 'no_emitter';

// ─── Zone result ──────────────────────────────────────────────────────────────

/**
 * Heat-loss calculation result for a single thermal zone.
 *
 * Zones are the primary calculation unit.  Room results are derived by
 * aggregating zone results for all zones that share the same roomId.
 */
export interface ZoneHeatLossResult {
  /** Zone identifier. */
  zoneId: string;
  /** Parent room identifier. */
  roomId: string;
  /** Zone label (for display). */
  zoneLabel: string;

  // ── Geometry inputs used ────────────────────────────────────────────────

  /** Floor area used in the calculation (m²). */
  floorAreaM2: number;
  /** Ceiling height used in the calculation (m). */
  heightM: number;
  /** Exposed perimeter used in the calculation (m). */
  exposedPerimeterM: number;

  // ── Heat-loss breakdown ─────────────────────────────────────────────────

  /** Fabric heat loss through external walls (W). */
  fabricWallLossW: number;
  /** Fabric heat loss through ceiling/roof (W). */
  fabricCeilingLossW: number;
  /** Fabric heat loss through floor (W). */
  fabricFloorLossW: number;
  /** Fabric heat loss through glazing (W). */
  fabricGlazingLossW: number;
  /** Total zone heat loss (sum of all fabric components) (W). */
  heatLossWatts: number;

  // ── Emitter adequacy ───────────────────────────────────────────────────

  /**
   * Total rated output of all emitters assigned to this zone (W).
   * 0 when no emitters are assigned.
   */
  totalEmitterOutputWatts: number;
  /**
   * Shortfall (positive) or surplus (negative) relative to zone heat demand (W).
   * shortfallWatts = heatLossWatts − totalEmitterOutputWatts
   */
  shortfallWatts: number;
  /** Adequacy classification for this zone. */
  adequacyStatus: EmitterAdequacyStatus;
}

// ─── Room result ──────────────────────────────────────────────────────────────

/**
 * Aggregated heat-loss result for a human-readable room.
 *
 * Derived by summing the ZoneHeatLossResult values for all zones assigned
 * to this room.  The room label is the customer-visible name.
 */
export interface RoomHeatLossResult {
  /** Room identifier. */
  roomId: string;
  /** Customer-visible room label. */
  roomLabel: string;
  /** IDs of zones that contributed to this result. */
  zoneIds: string[];

  /** Aggregate heat loss for this room (W). */
  heatLossWatts: number;
  /** Total installed emitter output for this room (W). */
  totalEmitterOutputWatts: number;
  /**
   * Aggregate shortfall (positive) or surplus (negative) (W).
   * shortfallWatts = heatLossWatts − totalEmitterOutputWatts
   */
  shortfallWatts: number;
  /** Room-level adequacy (worst-case zone status, or no_emitter). */
  adequacyStatus: EmitterAdequacyStatus;
}

// ─── Top-level model ──────────────────────────────────────────────────────────

/**
 * HeatLossModelV1
 *
 * Derived heat-loss calculation results for a property.  Produced by
 * calculateHeatLossModel() from an AtlasSpatialModelV1.
 *
 * Consumers:
 *  - Emitter adequacy checking (undersized / oversized room classification)
 *  - System sizing (total heat loss for boiler / heat pump capacity selection)
 *  - Flow-temperature reasoning (zone-level adequacy → low-temp suitability)
 *  - Customer portal (room-by-room heat loss and emitter coverage display)
 *  - PDF / engineer report outputs
 */
export interface HeatLossModelV1 {
  version: '1.0';
  /** Property identifier shared across the pipeline. */
  propertyId: string;
  /** ISO 8601 timestamp of when this calculation was run. */
  calculatedAt: string;
  /** Per-room aggregated results (one entry per AtlasRoomV1). */
  roomResults: RoomHeatLossResult[];
  /** Per-zone detailed results (one entry per AtlasThermalZoneV1). */
  zoneResults: ZoneHeatLossResult[];
  /** Sum of all zone heat losses (W) — used for system sizing. */
  totalHeatLossWatts: number;
}
