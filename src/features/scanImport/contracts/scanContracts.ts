/**
 * scanContracts.ts
 *
 * Versioned scan bundle contract definitions.
 *
 * These types represent the external boundary between any future native
 * scan client (e.g. an iOS RoomPlan companion app) and the Atlas canonical
 * floor-plan model.
 *
 * IMPORTANT: These types must not spread across the application.
 * All scan bundle data must be translated through the importer before it
 * reaches any canonical Atlas state.
 *
 * The current supported contract version is "1.0".
 */

// ─── Contract version ─────────────────────────────────────────────────────────

/**
 * All supported scan bundle contract versions.
 * Bump the minor version for backwards-compatible additions.
 * Bump the major version for breaking changes (old importers must reject).
 */
export const SUPPORTED_SCAN_BUNDLE_VERSIONS = ['1.0'] as const;
export type ScanBundleVersion = (typeof SUPPORTED_SCAN_BUNDLE_VERSIONS)[number];

// ─── Coordinate conventions ───────────────────────────────────────────────────

/**
 * Coordinate convention used in the scan bundle.
 *
 * - 'metric_m' — SI metres, right-handed coordinate system, Y-up (default for
 *   RoomPlan-style outputs). The importer normalises to Atlas canvas units.
 */
export type ScanCoordinateConvention = 'metric_m';

// ─── Quality / confidence ─────────────────────────────────────────────────────

/**
 * Banded confidence rating for a scanned entity.
 *
 * high   — scanner had good coverage, measurement uncertainty < 5 cm
 * medium — partial coverage or occlusion, uncertainty 5–20 cm
 * low    — estimated / inferred, uncertainty > 20 cm or reconstruction artefact
 */
export type ScanConfidenceBand = 'high' | 'medium' | 'low';

/**
 * A QA flag attached to a scanned entity or to the whole bundle.
 *
 * Fields:
 *   code        — machine-readable flag code
 *   message     — human-readable description
 *   severity    — 'info' | 'warning' | 'error'
 *   entityId    — optional reference to the affected entity within the bundle
 */
export interface ScanQAFlag {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  entityId?: string;
}

// ─── Scan geometry primitives ─────────────────────────────────────────────────

/**
 * A 2-D point in scan coordinate space (before normalisation to Atlas canvas units).
 *
 * x, y — horizontal plane coordinates in metres (origin arbitrary, set by scanner).
 */
export interface ScanPoint2D {
  x: number;
  y: number;
}

/**
 * A 3-D point in scan coordinate space.
 *
 * x, y — horizontal plane.
 * z     — vertical (elevation) in metres.
 */
export interface ScanPoint3D extends ScanPoint2D {
  z: number;
}

// ─── Opening (door / window) ──────────────────────────────────────────────────

/**
 * An opening detected on a wall by the scanner.
 *
 * widthM       — detected opening width in metres
 * heightM      — detected opening height in metres (0 if not captured)
 * offsetM      — distance from the wall's start point to the opening centre
 * type         — 'door' | 'window' | 'unknown'
 * confidence   — scanner confidence in this detection
 */
export interface ScanOpening {
  id: string;
  widthM: number;
  heightM: number;
  offsetM: number;
  type: 'door' | 'window' | 'unknown';
  confidence: ScanConfidenceBand;
}

// ─── Wall ────────────────────────────────────────────────────────────────────

/**
 * A wall segment detected by the scanner.
 *
 * start / end  — endpoints in scan coordinate space (metric_m)
 * heightM      — wall height (ceiling-to-floor) in metres; 0 if not captured
 * thicknessMm  — estimated wall thickness in millimetres; 0 if unknown
 * kind         — 'internal' | 'external' | 'unknown'
 * openings     — detected openings (doors / windows) on this wall
 * confidence   — scanner confidence in this wall segment
 */
export interface ScanWall {
  id: string;
  start: ScanPoint3D;
  end: ScanPoint3D;
  heightM: number;
  thicknessMm: number;
  kind: 'internal' | 'external' | 'unknown';
  openings: ScanOpening[];
  confidence: ScanConfidenceBand;
}

// ─── Detected object ──────────────────────────────────────────────────────────

/**
 * An object detected in the room by the scanner (furniture, fixtures, etc.).
 *
 * category     — broad class of the object (e.g. 'furniture', 'appliance')
 * label        — scanner's best-guess label (e.g. 'sofa', 'washing_machine')
 * boundingBox  — axis-aligned bounding box in scan coordinate space
 * confidence   — scanner confidence in this detection
 */
export interface ScanDetectedObject {
  id: string;
  category: string;
  label: string;
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  confidence: ScanConfidenceBand;
}

// ─── Anchor ───────────────────────────────────────────────────────────────────

/**
 * A georeferencing anchor that links scan coordinate space to the real world.
 *
 * type         — 'gps' | 'qr_code' | 'manual' | 'unknown'
 * position     — anchor position in scan coordinate space
 * realWorldRef — optional external reference (e.g. GPS coordinate, QR payload)
 * confidence   — how reliable this anchor is
 *
 * Anchors are optional. If absent the importer treats the origin as arbitrary.
 */
export interface ScanAnchor {
  id: string;
  type: 'gps' | 'qr_code' | 'manual' | 'unknown';
  position: ScanPoint3D;
  realWorldRef?: string;
  confidence: ScanConfidenceBand;
}

// ─── Room ────────────────────────────────────────────────────────────────────

/**
 * A room captured by the scanner.
 *
 * label        — scanner's suggested room label (free-text; may be empty)
 * floorIndex   — which storey this room is on (0 = ground, 1 = first, etc.)
 * polygon      — floor polygon boundary in scan coordinate space (metric_m)
 * areaM2       — calculated floor area in m²
 * heightM      — ceiling height in metres
 * walls        — walls bounding this room
 * detectedObjects — objects detected inside this room
 * confidence   — scanner confidence in the overall room geometry
 */
export interface ScanRoom {
  id: string;
  label: string;
  floorIndex: number;
  polygon: ScanPoint2D[];
  areaM2: number;
  heightM: number;
  walls: ScanWall[];
  detectedObjects: ScanDetectedObject[];
  confidence: ScanConfidenceBand;
}

// ─── Scan metadata ────────────────────────────────────────────────────────────

/**
 * Metadata about the scan session that produced this bundle.
 *
 * capturedAt         — ISO-8601 timestamp of when the scan was taken
 * deviceModel        — scanner hardware identifier (e.g. 'iPhone 15 Pro')
 * scannerApp         — app name and version (e.g. 'AtlasScan 1.0.0')
 * coordinateConvention — coordinate system used in this bundle
 * propertyRef        — optional Atlas property / visit ID this scan is for
 * operatorNotes      — free-text notes from the operator
 */
export interface ScanMeta {
  capturedAt: string;
  deviceModel: string;
  scannerApp: string;
  coordinateConvention: ScanCoordinateConvention;
  propertyRef?: string;
  operatorNotes?: string;
}

// ─── Top-level bundle ─────────────────────────────────────────────────────────

/**
 * ScanBundleV1 — the top-level unit of data sent from a future scan client.
 *
 * version — contract version string; must be one of SUPPORTED_SCAN_BUNDLE_VERSIONS.
 *           The importer rejects bundles whose version is not supported.
 * bundleId — unique identifier for this bundle (generated by the scan client).
 * rooms    — list of captured rooms.
 * anchors  — optional georeferencing anchors.
 * qaFlags  — QA flags raised by the scan client during capture.
 * meta     — capture session metadata.
 */
export interface ScanBundleV1 {
  version: '1.0';
  bundleId: string;
  rooms: ScanRoom[];
  anchors: ScanAnchor[];
  qaFlags: ScanQAFlag[];
  meta: ScanMeta;
}

/**
 * ScanBundle — discriminated union of all versioned scan bundle shapes.
 *
 * Use this type when accepting an unknown bundle (e.g. from a file or network).
 * The importer inspects the `version` field to select the correct handler.
 */
export type ScanBundle = ScanBundleV1;

/**
 * A raw unknown input — used at the validation boundary before the bundle
 * has been confirmed to match any versioned contract.
 */
export type UnknownScanBundle = Record<string, unknown>;
