/**
 * spatial3dEvidence.ts
 *
 * Contract types for the dual 3D evidence system.
 *
 * Architecture rules:
 * - 3D captures are evidence, not physics truth.
 * - AtlasSpatialModelV1 remains the canonical internal geometry truth.
 * - EngineInputV2_3 and heat-loss calculations must NOT consume raw 3D scan geometry.
 * - External flue-clearance compliance logic must use structured measured features,
 *   not raw point cloud geometry.
 * - Point clouds / meshes may be stored as optional evidence assets only.
 *
 * Two distinct evidence kinds:
 *   1. SpatialEvidence3D         — internal room scan (RoomPlan / LiDAR)
 *   2. ExternalClearanceSceneV1  — external flue-clearance scene (ARKit / tagged features)
 */

// ─── Shared primitives ────────────────────────────────────────────────────────

/** A 3-component position or normal vector. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ─── Internal room scan evidence ──────────────────────────────────────────────

/**
 * Evidence record for an indoor room scan captured with RoomPlan / LiDAR.
 *
 * Rules:
 * - No derived maths from this asset.
 * - No direct mutation of AtlasRoomV1 from the scan model.
 * - File stored externally; metadata only in canonical JSON.
 * - Visible in engineer and portal surfaces as evidence only.
 */
export interface SpatialEvidence3D {
  id: string;
  propertyId: string;
  sourceSessionId: string;
  kind: 'internal_room_scan';
  /** Export format of the 3D model file. */
  format: 'usdz' | 'glb' | 'realitykit';
  /** URL of the 3D model asset (external storage). */
  fileUrl: string;
  /** Optional preview/thumbnail image shown before loading the 3D model. */
  previewImageUrl?: string;
  /** Room IDs that this scan covers, if linked by the engineer. */
  linkedRoomIds?: string[];
  /** Zone IDs that this scan covers, if linked by the engineer. */
  linkedZoneIds?: string[];
  /** Approximate bounding dimensions of the scanned space (metres). */
  bounds?: {
    widthM: number;
    lengthM: number;
    heightM: number;
  };
  /** Capture device and session metadata. */
  captureMeta?: {
    device: string;
    timestamp: string;
    confidence?: number;
  };
}

// ─── External flue-clearance scene ────────────────────────────────────────────

/** Feature types that can be tagged near a flue terminal. */
export type ClearanceFeatureType =
  | 'window'
  | 'door'
  | 'air_brick'
  | 'boundary'
  | 'eaves'
  | 'gutter'
  | 'soil_stack'
  | 'opening'
  | 'adjacent_flue'
  | 'balcony';

/** A tagged obstacle or opening near the flue terminal. */
export interface ClearanceFeature {
  id: string;
  type: ClearanceFeatureType;
  /** Position relative to the capture anchor origin. */
  position3D?: Vec3;
  /** Straight-line distance from the flue terminal (metres). */
  distanceToTerminalM?: number;
  notes?: string;
}

/** A measured or derived clearance distance. */
export interface ClearanceMeasurement {
  id: string;
  kind: 'terminal_to_opening' | 'terminal_to_boundary' | 'terminal_to_eaves';
  /** Measured or derived distance in metres. */
  valueM: number;
  /** Whether the value was physically measured or computationally derived. */
  source: 'measured' | 'derived';
}

/**
 * Evidence record for an external flue-clearance scene captured with
 * ARKit / RealityKit and engineer-tagged features.
 *
 * Rules:
 * - Compliance logic runs from structured measurements and tagged features.
 * - Point cloud is optional evidence only — never the canonical truth.
 * - No raw point cloud parsing in report rendering.
 * - No giant binary blobs inlined into contracts.
 */
export interface ExternalClearanceSceneV1 {
  id: string;
  propertyId: string;
  sourceSessionId: string;
  kind: 'external_flue_clearance';
  /** Optional raw capture evidence assets. All fields are external URLs. */
  evidence: {
    /** Preview photograph of the flue area. */
    previewImageUrl?: string;
    /** URL of the scene mesh/model for optional 3D view. */
    modelUrl?: string;
    /** URL of the raw point cloud blob (evidence only — not for rendering). */
    pointCloudUrl?: string;
  };
  /** The tagged flue terminal position. */
  flueTerminal?: {
    position3D?: Vec3;
    /** Outward direction of the terminal opening. */
    normal?: Vec3;
    heightAboveGroundM?: number;
  };
  /** Tagged obstacles and openings close to the flue terminal. */
  nearbyFeatures: ClearanceFeature[];
  /** Engineer-captured or derived distance measurements. */
  measurements: ClearanceMeasurement[];
  /** Compliance outcome derived from structured measurements and tagged features. */
  compliance?: {
    /** Regulatory standard reference (e.g. "BS 6798:2014 Table 1"). */
    standardRef?: string;
    /** Human-readable warning strings for distances that are close to limits. */
    warnings?: string[];
    /** Overall pass / fail. Absent when insufficient measurements are present. */
    pass?: boolean;
  };
}
