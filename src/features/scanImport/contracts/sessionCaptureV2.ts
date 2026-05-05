/**
 * sessionCaptureV2.ts
 *
 * Type definitions and validator for the SessionCaptureV2 contract.
 *
 * SessionCaptureV2 is the next-generation canonical handoff produced by
 * Atlas Scan iOS.  It supersedes SessionCaptureV1 with cleaner field
 * naming, explicit voice-note transcript support (no raw audio), object
 * pins as first-class evidence, floor-plan snapshots, and QA flags.
 *
 * These types live locally until the shared @atlas/contracts package is
 * updated to own and export them.  When that migration happens, this file
 * should become a re-export shim (mirroring scanContracts.ts).
 *
 * Validation note: the validator is intentionally bespoke (no runtime
 * schema library) to keep the dependency footprint identical to the V1
 * approach used in @atlas/contracts.
 */

// ─── Supporting types ─────────────────────────────────────────────────────────

/** Lifecycle status of the overall session. */
export type SessionStatusV2 = 'active' | 'review' | 'ready' | 'synced';

// ─── Fabric capture types (optional — introduced by Atlas Scan 2.x) ───────────

/** Orientation of a fabric boundary element. */
export type BoundaryTypeV1 = 'external' | 'internal' | 'party' | 'unknown';

/** Category of a fabric opening element. */
export type OpeningTypeV1 =
  | 'door'
  | 'window'
  | 'patio'
  | 'rooflight'
  | 'open_arch';

/** Engineer review state for a fabric element. */
export type FabricReviewStatusV1 = 'confirmed' | 'pending' | 'rejected';

/**
 * A single boundary element within a room's fabric capture.
 */
export interface FabricBoundaryV1 {
  /** Stable boundary identifier within the room. */
  boundaryId: string;
  /** Orientation / adjacency classification. */
  type: BoundaryTypeV1;
  /** Measured length in metres. */
  lengthM?: number;
  /** Measured height in metres. */
  heightM?: number;
  /** Material description (e.g. "solid brick", "timber frame"). */
  material?: string;
  /** Engineer review state. Absent means not yet reviewed (treat as pending). */
  reviewStatus?: FabricReviewStatusV1;
}

/**
 * A single opening (door, window, etc.) within a room's fabric capture.
 */
export interface FabricOpeningV1 {
  /** Stable opening identifier within the room. */
  openingId: string;
  /** Opening category. */
  type: OpeningTypeV1;
  /** Measured width in metres. */
  widthM?: number;
  /** Measured height in metres. */
  heightM?: number;
  /** Frame / glazing material description. */
  material?: string;
  /** Boundary that this opening pierces, if linked. */
  linkedBoundaryId?: string;
  /** Engineer review state. Absent means not yet reviewed (treat as pending). */
  reviewStatus?: FabricReviewStatusV1;
}

/**
 * Floor-plan fabric data for a single room, produced by Atlas Scan 2.x.
 *
 * This is engineer-internal data until the heat-loss pipeline explicitly
 * consumes it.  Do not feed it into heat-loss calculations or customer
 * outputs until that integration is in place.
 */
export interface FloorPlanFabricCaptureV1 {
  /** Owning room identifier — matches a RoomScanV2.roomId when present. */
  roomId?: string;
  /** Human-readable room name — may differ from the RoomScanV2 label. */
  roomName?: string;
  /** Measured floor area in m². */
  floorAreaM2?: number;
  /** Measured ceiling height in metres. */
  ceilingHeightM?: number;
  /** Measured perimeter length in metres. */
  perimeterM?: number;
  /** Boundary elements making up the room envelope. */
  boundaries?: FabricBoundaryV1[];
  /** Openings (doors, windows, etc.) within the room envelope. */
  openings?: FabricOpeningV1[];
}

// ─── Hazard observation types (optional — introduced by Atlas Scan 2.x) ───────

/** High-level category for a hazard observation. */
export type HazardCategoryV1 =
  | 'asbestos_suspected'
  | 'electrical'
  | 'structural'
  | 'gas'
  | 'water_damage'
  | 'other';

/** Severity of a hazard observation. */
export type HazardSeverityV1 = 'low' | 'medium' | 'high' | 'blocking';

/** Engineer review state for a hazard observation. */
export type HazardReviewStatusV1 = 'confirmed' | 'pending' | 'rejected';

/**
 * A single hazard observation captured during the session.
 *
 * Filtering rules:
 *   - Engineer view: confirmed and pending hazards are surfaced.
 *   - Rejected hazards: retained as audit evidence (shown with audit-only marker).
 *   - Customer portal / deck / PDF: must never show hazard detail.
 */
export interface HazardObservationCaptureV1 {
  /** Stable hazard identifier. */
  hazardId: string;
  /** High-level hazard category. */
  category: HazardCategoryV1;
  /** Severity level. */
  severity: HazardSeverityV1;
  /** Short engineer-facing title. */
  title: string;
  /** Optional engineer-facing description. */
  description?: string;
  /** Photo IDs that provide evidence for this hazard. */
  linkedPhotoIds?: string[];
  /** Object-pin IDs that relate to this hazard. */
  linkedObjectPinIds?: string[];
  /** Recommended or required action for the engineer. */
  actionRequired?: string;
  /** Engineer review state. Absent means not yet reviewed (treat as pending). */
  reviewStatus?: HazardReviewStatusV1;
}

/** A room as captured during the session. */
export interface RoomScanV2 {
  /** Stable room identifier. */
  roomId: string;
  /** Human-readable room label (e.g. "Utility Room"). */
  label: string;
  /** Capture completion status for this room. */
  status: 'active' | 'complete';
  /** Zero-based floor index (ground = 0). */
  floorIndex?: number;
  /** Measured or estimated floor area in m². */
  areaM2?: number;
}

/** Scope of a captured photo. */
export type PhotoScopeV2 = 'session' | 'room' | 'object';

/** A single captured photo linked to session, room, or object-pin evidence. */
export interface PhotoV2 {
  /** Stable photo identifier. */
  photoId: string;
  /** Device-local or asset-store URI. */
  uri: string;
  /** ISO-8601 timestamp when the photo was taken. */
  capturedAt: string;
  /** Scope determines customer-safety routing. */
  scope: PhotoScopeV2;
  /** Owning room, when scope is 'room' or 'object'. */
  roomId?: string;
  /** Owning object pin, when scope is 'object'. */
  objectPinId?: string;
  /** Optional engineer-facing tags (e.g. "data_plate", "condition"). */
  tags?: string[];
}

/**
 * A voice note with its transcript text.
 *
 * Raw audio is never transmitted or stored — only the transcript text
 * is included in the V2 payload.
 */
export interface VoiceNoteV2 {
  /** Stable voice-note identifier. */
  voiceNoteId: string;
  /** Room this note was recorded in, if applicable. */
  roomId?: string;
  /** ISO-8601 timestamp when the note was recorded. */
  createdAt: string;
  /**
   * Transcript text, if available.
   * Absent when the audio was not transcribed before export.
   */
  transcript?: string;
}

/** Type of captured object. */
export type ObjectPinType =
  | 'radiator'
  | 'boiler'
  | 'cylinder'
  | 'thermostat'
  | 'flue'
  | 'pipe'
  | 'consumer_unit'
  | 'gas_meter'
  | 'sink'
  | 'bath'
  | 'shower'
  | 'pipe_route'
  | 'other';

/**
 * A pinned object observed during the session.
 *
 * Object pins replace the V1 `objects` array.  Each pin has an explicit
 * location context (room) and links to its evidence photos.
 */
export interface ObjectPinV2 {
  /** Stable pin identifier. */
  pinId: string;
  /** Object category. */
  objectType: ObjectPinType;
  /** Room where the object was pinned, if recorded. */
  roomId?: string;
  /** Optional display label (e.g. "Worcester Bosch 30i"). */
  label?: string;
  /** Photo IDs linked to this pin. */
  photoIds: string[];
  /** Free-form metadata (subtype, notes, make/model, etc.). */
  metadata?: Record<string, unknown>;
}

/** A floor-plan snapshot captured by the surveyor. */
export interface FloorPlanSnapshotV2 {
  /** Stable snapshot identifier. */
  snapshotId: string;
  /** Device-local or asset-store URI. */
  uri: string;
  /** ISO-8601 timestamp when the snapshot was taken. */
  capturedAt: string;
  /** Zero-based floor index this snapshot covers. */
  floorIndex?: number;
}

/** Severity level for a QA flag. */
export type QaFlagSeverityV2 = 'info' | 'warn' | 'error';

/** A QA flag raised during capture or export. */
export interface QaFlagV2 {
  /** Machine-readable flag code (e.g. "LOW_PHOTO_COUNT"). */
  code: string;
  /** Severity used to gate import flow warnings. */
  severity: QaFlagSeverityV2;
  /** Human-readable description of the issue. */
  message?: string;
  /** ID of the entity the flag relates to, if applicable. */
  entityId?: string;
}

// ─── Installation specification evidence types (optional — populated by Atlas Scan 2.x) ───

/**
 * Provenance of a scan-captured installation specification location candidate.
 *
 * scan_inferred — detected automatically (e.g. LiDAR / object detection);
 *                 not manually confirmed by the engineer during the scan.
 * scan_confirmed — engineer explicitly confirmed during the scan session.
 * manual          — added manually outside the scan flow.
 * unknown         — provenance cannot be determined.
 */
export type QuotePlannerLocationProvenance =
  | 'scan_inferred'
  | 'scan_confirmed'
  | 'manual'
  | 'unknown';

/**
 * Confidence in a scan-captured installation specification location.
 *
 * needs_verification — inferred or otherwise uncertain; must be reviewed before use.
 */
export type QuotePlannerLocationConfidence =
  | 'high'
  | 'medium'
  | 'low'
  | 'needs_verification';

/**
 * Kind / role of a candidate install location.
 */
export type QuotePlannerLocationKind =
  | 'proposed_boiler'
  | 'existing_boiler'
  | 'gas_meter'
  | 'flue_terminal'
  | 'cylinder'
  | 'other';

/**
 * A candidate install location captured during the scan session.
 *
 * Inferred locations (provenance `scan_inferred`) must not be automatically
 * promoted to confirmed in the installation specification.  The engineer must review them.
 */
export interface QuotePlannerCandidateLocationV1 {
  /** Stable identifier for this candidate location within the evidence set. */
  locationId: string;
  /** Role / kind of this install location. */
  kind: QuotePlannerLocationKind;
  /** How this location was identified. */
  provenance: QuotePlannerLocationProvenance;
  /** Confidence level — preserved verbatim from the scan output. */
  confidence: QuotePlannerLocationConfidence;
  /** Room context, if recorded during scan. */
  roomId?: string;
  /** Object pin that represents this location, if present. */
  linkedPinId?: string;
  /** Photo IDs linked to this location, if present. */
  linkedPhotoIds?: string[];
  /** Optional engineer-facing note captured during the scan. */
  notes?: string;
}

/**
 * Type of a candidate pipe or service route.
 */
export type QuotePlannerRouteType =
  | 'primary_flow_return'
  | 'gas_supply'
  | 'condensate'
  | 'cold_water_supply'
  | 'other';

/**
 * Confidence in a route captured during scan.
 *
 * Mirrors QuoteRouteConfidence from calculators/quotePlannerTypes but is declared here
 * independently to avoid a cross-feature import from the contracts layer.
 *
 * measured  — derived from a scan or scaled photo.
 * drawn     — engineer-drawn on a floor plan.
 * estimated — inferred from survey inputs; no direct measurement.
 */
export type QuotePlannerRouteConfidence = 'measured' | 'drawn' | 'estimated';

/**
 * A candidate pipe / service route captured during the scan session.
 *
 * Route lengths are NOT calculated here — do not fabricate lengths when
 * measurable coordinates or a scale factor are not available.
 */
export interface QuotePlannerCandidateRouteV1 {
  /** Stable identifier for this candidate route within the evidence set. */
  routeId: string;
  /** Service type this route carries. */
  routeType: QuotePlannerRouteType;
  /** Confidence in the route geometry / evidence. */
  confidence: QuotePlannerRouteConfidence;
  /** Object-pin IDs that trace this route, if present. */
  linkedPinIds?: string[];
  /** Optional engineer-facing note captured during the scan. */
  notes?: string;
}

/**
 * A candidate flue route captured during the scan session.
 */
export interface QuotePlannerCandidateFlueRouteV1 {
  /** Stable identifier for this candidate flue route within the evidence set. */
  flueRouteId: string;
  /** Confidence in the flue route geometry / evidence. */
  confidence: QuotePlannerRouteConfidence;
  /** Object-pin IDs that trace this flue route, if present. */
  linkedPinIds?: string[];
  /** Optional engineer-facing note captured during the scan. */
  notes?: string;
}

/**
 * Installation specification evidence block captured by Atlas Scan 2.x.
 *
 * Engineer-internal only — drives installation specification, not customer outputs.
 * Absent on older Scan 1.x payloads and sessions captured before the
 * installation specification feature was enabled.
 *
 * @note Interface name `QuotePlannerEvidenceV1` and field `quotePlannerEvidence` are kept
 * for iOS scan import backward compatibility. TODO: rename in a future migration.
 */
export interface QuotePlannerEvidenceV1 {
  /** Candidate install locations identified during the scan. */
  candidateLocations: QuotePlannerCandidateLocationV1[];
  /** Candidate pipe / service routes identified during the scan. */
  candidateRoutes: QuotePlannerCandidateRouteV1[];
  /** Candidate flue routes identified during the scan. */
  candidateFlueRoutes: QuotePlannerCandidateFlueRouteV1[];
}

// ─── External area scan types (optional — introduced by Atlas Scan 2.x) ──────

/** High-level category for an object pin in an external area scan. */
export type ExternalObjectPinType =
  | 'flue_terminal'
  | 'opening'
  | 'boundary'
  | 'obstruction'
  | 'other';

/** Engineer review state for an external area scan. */
export type ExternalScanReviewStatusV1 = 'confirmed' | 'pending' | 'rejected';

/**
 * An object pin captured within an external area scan.
 *
 * These pins record flue terminals, openings (e.g. air bricks, vents),
 * boundary features, and obstructions observed on the external elevation.
 */
export interface ExternalObjectPinV1 {
  /** Stable pin identifier within the external scan. */
  pinId: string;
  /** Object category. */
  objectType: ExternalObjectPinType;
  /** Optional display label (e.g. "Rear flue terminal"). */
  label?: string;
  /** Photo IDs linked to this pin. */
  photoIds?: string[];
}

/**
 * A measurement line captured within an external area scan.
 *
 * Used to record setback distances, clearance measurements, or flue heights
 * from LiDAR or manual measurement during the external survey.
 */
export interface ExternalMeasurementLineV1 {
  /** Stable line identifier within the external scan. */
  lineId: string;
  /** Short engineer-facing label (e.g. "Flue setback from opening"). */
  label?: string;
  /** Measured length in metres. */
  lengthM?: number;
  /** Optional engineer note about this measurement. */
  notes?: string;
}

/**
 * An external area scan capturing the external elevation of the property.
 *
 * Engineer-internal only — captures flue terminal evidence, clearance
 * measurements, and obstruction data for flue siting assessment.
 * Must not appear in customer portal, deck, or PDF outputs.
 *
 * No pass/fail flue calculation is performed here — this is evidence only.
 */
export interface ExternalAreaScanV1 {
  /** Stable identifier for this external scan. */
  scanId: string;
  /** Human-readable label (e.g. "Rear elevation"). */
  label?: string;
  /** ISO-8601 timestamp when this external scan was captured. */
  capturedAt: string;
  /** Engineer review state. Absent means not yet reviewed (treat as pending). */
  reviewStatus?: ExternalScanReviewStatusV1;
  /** Photo IDs captured during this external scan. */
  photoIds?: string[];
  /** Object pins observed during this external scan. */
  objectPins?: ExternalObjectPinV1[];
  /** Measurement lines recorded during this external scan. */
  measurementLines?: ExternalMeasurementLineV1[];
  /** Asset store ID of the point cloud produced by this external scan, if available. */
  pointCloudAssetId?: string;
}

// ─── Top-level contract ───────────────────────────────────────────────────────

/**
 * SessionCaptureV2 — the top-level capture contract for SessionCaptureV2
 * payloads produced by Atlas Scan iOS.
 *
 * Key changes from V1:
 *   - `version` field is "2.0"
 *   - `visitReference` (new) — links the session to a job/visit record
 *   - `capturedAt` / `exportedAt` replace startedAt / updatedAt / completedAt
 *   - `deviceModel` is a flat string (V1 had a nested `device` object)
 *   - `roomScans` replaces `rooms`
 *   - `voiceNotes` replaces `audio` — transcript text only, no raw audio
 *   - `objectPins` replaces `objects`
 *   - `floorPlanSnapshots` (new)
 *   - `qaFlags` (new)
 */
export interface SessionCaptureV2 {
  /** Discriminant version — always "2.0". */
  version: '2.0';
  /** Stable session identifier (UUID or opaque string). */
  sessionId: string;
  /** Optional reference linking this session to a booking or job record. */
  visitReference?: string;
  /** ISO-8601 timestamp when the session capture began. */
  capturedAt: string;
  /** ISO-8601 timestamp when the session was exported from the device. */
  exportedAt: string;
  /** Device model string (e.g. "iPhone 15 Pro"). */
  deviceModel: string;
  /** Property address metadata. */
  property?: {
    address?: string;
    postcode?: string;
  };
  /** Rooms scanned during the session. */
  roomScans: RoomScanV2[];
  /** Photos captured during the session. */
  photos: PhotoV2[];
  /**
   * Voice notes with transcript text.
   * Raw audio is never included; only transcript text is present.
   */
  voiceNotes: VoiceNoteV2[];
  /** Object pins placed during the session. */
  objectPins: ObjectPinV2[];
  /** Floor-plan snapshots captured during the session. */
  floorPlanSnapshots: FloorPlanSnapshotV2[];
  /** QA flags raised during capture or export. */
  qaFlags: QaFlagV2[];
  /**
   * Floor-plan fabric data captured by Atlas Scan 2.x.
   *
   * Engineer-internal only — do not use for heat-loss or customer outputs
   * until the heat-loss pipeline integration is in place.
   *
   * May be a single object (one room) or an array (multi-room capture).
   * Old payloads from Atlas Scan 1.x will not include this field.
   */
  floorPlanFabric?: FloorPlanFabricCaptureV1 | FloorPlanFabricCaptureV1[];
  /**
   * Hazard observations captured by Atlas Scan 2.x.
   *
   * Engineer-internal only — never expose to customer portal, deck, or PDF.
   *
   * May be a single object or an array.
   * Old payloads from Atlas Scan 1.x will not include this field.
   */
  hazardObservations?:
    | HazardObservationCaptureV1
    | HazardObservationCaptureV1[];
  /**
   * Installation specification evidence captured by Atlas Scan 2.x.
   *
   * Engineer-internal only — drives installation specification, not customer outputs.
   * Absent on older Scan 1.x payloads and sessions captured before the
   * installation specification feature was enabled.
   *
   * @note Field name kept as `quotePlannerEvidence` for iOS backward compatibility.
   * TODO: rename to installationSpecificationEvidence in a future migration.
   *
   * Inferred / scan_inferred locations in candidateLocations must remain as
   * evidence until the engineer reviews them — do not auto-promote.
   */
  quotePlannerEvidence?: QuotePlannerEvidenceV1;
  /**
   * External area scans captured by Atlas Scan 2.x.
   *
   * Engineer-internal only — records flue terminal evidence, clearance
   * measurements, and obstruction data for flue siting assessment.
   * Must never appear in customer portal, deck, or PDF outputs.
   * No pass/fail flue calculation is performed from these records.
   *
   * May be a single object or an array.
   * Old payloads from Atlas Scan 1.x will not include this field.
   */
  externalAreaScans?: ExternalAreaScanV1 | ExternalAreaScanV1[];
}

/** Unvalidated incoming payload — used before structural validation. */
export type UnknownSessionCaptureV2 = Record<string, unknown>;

// ─── Validation result types ──────────────────────────────────────────────────

export interface SessionCaptureV2ValidationSuccess {
  ok: true;
  session: SessionCaptureV2;
}

export interface SessionCaptureV2ValidationFailure {
  ok: false;
  errors: string[];
}

export type SessionCaptureV2ValidationResult =
  | SessionCaptureV2ValidationSuccess
  | SessionCaptureV2ValidationFailure;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ─── Field-level validators ───────────────────────────────────────────────────

const VALID_ROOM_STATUSES = ['active', 'complete'] as const;

function validateRoomScanV2(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['roomId'])) errors.push(`${path}.roomId: must be a string`);
  if (!isString(value['label'])) errors.push(`${path}.label: must be a string`);
  if (!(VALID_ROOM_STATUSES as readonly string[]).includes(value['status'] as string)) {
    errors.push(`${path}.status: must be 'active' | 'complete'`);
  }
  return errors;
}

const VALID_PHOTO_SCOPES: PhotoScopeV2[] = ['session', 'room', 'object'];

function validatePhotoV2(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['photoId'])) errors.push(`${path}.photoId: must be a string`);
  if (!isString(value['uri'])) errors.push(`${path}.uri: must be a string`);
  if (!isString(value['capturedAt'])) errors.push(`${path}.capturedAt: must be a string`);
  if (!(VALID_PHOTO_SCOPES as string[]).includes(value['scope'] as string)) {
    errors.push(`${path}.scope: must be 'session' | 'room' | 'object'`);
  }
  return errors;
}

function validateVoiceNoteV2(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['voiceNoteId'])) errors.push(`${path}.voiceNoteId: must be a string`);
  if (!isString(value['createdAt'])) errors.push(`${path}.createdAt: must be a string`);
  return errors;
}

const VALID_OBJECT_PIN_TYPES: ObjectPinType[] = [
  'radiator', 'boiler', 'cylinder', 'thermostat', 'flue',
  'pipe', 'consumer_unit', 'gas_meter', 'sink', 'bath', 'shower', 'pipe_route', 'other',
];

function validateObjectPinV2(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['pinId'])) errors.push(`${path}.pinId: must be a string`);
  if (!(VALID_OBJECT_PIN_TYPES as string[]).includes(value['objectType'] as string)) {
    errors.push(`${path}.objectType: must be one of ${VALID_OBJECT_PIN_TYPES.join(', ')}`);
  }
  if (!isArray(value['photoIds'])) {
    errors.push(`${path}.photoIds: must be an array`);
  } else {
    (value['photoIds'] as unknown[]).forEach((id, i) => {
      if (!isString(id)) errors.push(`${path}.photoIds[${i}]: must be a string`);
    });
  }
  return errors;
}

function validateFloorPlanSnapshotV2(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['snapshotId'])) errors.push(`${path}.snapshotId: must be a string`);
  if (!isString(value['uri'])) errors.push(`${path}.uri: must be a string`);
  if (!isString(value['capturedAt'])) errors.push(`${path}.capturedAt: must be a string`);
  return errors;
}

const VALID_QA_SEVERITIES: QaFlagSeverityV2[] = ['info', 'warn', 'error'];

function validateQaFlagV2(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['code'])) errors.push(`${path}.code: must be a string`);
  if (!(VALID_QA_SEVERITIES as string[]).includes(value['severity'] as string)) {
    errors.push(`${path}.severity: must be 'info' | 'warn' | 'error'`);
  }
  return errors;
}

// ─── Optional fabric / hazard validators ──────────────────────────────────────
// These only validate structure when the field is actually present.
// A missing field never produces an error (backwards-compatible with Scan 1.x).

const VALID_BOUNDARY_TYPES: BoundaryTypeV1[] = ['external', 'internal', 'party', 'unknown'];
const VALID_OPENING_TYPES: OpeningTypeV1[] = ['door', 'window', 'patio', 'rooflight', 'open_arch'];
const VALID_FABRIC_REVIEW_STATUSES: FabricReviewStatusV1[] = ['confirmed', 'pending', 'rejected'];

function validateFabricBoundaryV1(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['boundaryId'])) errors.push(`${path}.boundaryId: must be a string`);
  if (!(VALID_BOUNDARY_TYPES as string[]).includes(value['type'] as string)) {
    errors.push(`${path}.type: must be one of ${VALID_BOUNDARY_TYPES.join(', ')}`);
  }
  if (
    value['reviewStatus'] !== undefined &&
    !(VALID_FABRIC_REVIEW_STATUSES as string[]).includes(value['reviewStatus'] as string)
  ) {
    errors.push(`${path}.reviewStatus: must be 'confirmed' | 'pending' | 'rejected'`);
  }
  return errors;
}

function validateFabricOpeningV1(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['openingId'])) errors.push(`${path}.openingId: must be a string`);
  if (!(VALID_OPENING_TYPES as string[]).includes(value['type'] as string)) {
    errors.push(`${path}.type: must be one of ${VALID_OPENING_TYPES.join(', ')}`);
  }
  if (
    value['reviewStatus'] !== undefined &&
    !(VALID_FABRIC_REVIEW_STATUSES as string[]).includes(value['reviewStatus'] as string)
  ) {
    errors.push(`${path}.reviewStatus: must be 'confirmed' | 'pending' | 'rejected'`);
  }
  return errors;
}

function validateFloorPlanFabricCaptureV1(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (isArray(value['boundaries'])) {
    (value['boundaries'] as unknown[]).forEach((b, i) => {
      errors.push(...validateFabricBoundaryV1(b, `${path}.boundaries[${i}]`));
    });
  } else if (value['boundaries'] !== undefined) {
    errors.push(`${path}.boundaries: must be an array`);
  }
  if (isArray(value['openings'])) {
    (value['openings'] as unknown[]).forEach((o, i) => {
      errors.push(...validateFabricOpeningV1(o, `${path}.openings[${i}]`));
    });
  } else if (value['openings'] !== undefined) {
    errors.push(`${path}.openings: must be an array`);
  }
  return errors;
}

const VALID_HAZARD_CATEGORIES: HazardCategoryV1[] = [
  'asbestos_suspected', 'electrical', 'structural', 'gas', 'water_damage', 'other',
];
const VALID_HAZARD_SEVERITIES: HazardSeverityV1[] = ['low', 'medium', 'high', 'blocking'];
const VALID_HAZARD_REVIEW_STATUSES: HazardReviewStatusV1[] = ['confirmed', 'pending', 'rejected'];

function validateHazardObservationCaptureV1(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['hazardId'])) errors.push(`${path}.hazardId: must be a string`);
  if (!(VALID_HAZARD_CATEGORIES as string[]).includes(value['category'] as string)) {
    errors.push(`${path}.category: must be one of ${VALID_HAZARD_CATEGORIES.join(', ')}`);
  }
  if (!(VALID_HAZARD_SEVERITIES as string[]).includes(value['severity'] as string)) {
    errors.push(`${path}.severity: must be one of ${VALID_HAZARD_SEVERITIES.join(', ')}`);
  }
  if (!isString(value['title'])) errors.push(`${path}.title: must be a string`);
  if (
    value['reviewStatus'] !== undefined &&
    !(VALID_HAZARD_REVIEW_STATUSES as string[]).includes(value['reviewStatus'] as string)
  ) {
    errors.push(`${path}.reviewStatus: must be 'confirmed' | 'pending' | 'rejected'`);
  }
  return errors;
}

// ─── External area scan validators ───────────────────────────────────────────

const VALID_EXTERNAL_OBJECT_PIN_TYPES: ExternalObjectPinType[] = [
  'flue_terminal', 'opening', 'boundary', 'obstruction', 'other',
];
const VALID_EXTERNAL_SCAN_REVIEW_STATUSES: ExternalScanReviewStatusV1[] = [
  'confirmed', 'pending', 'rejected',
];

function validateExternalObjectPinV1(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['pinId'])) errors.push(`${path}.pinId: must be a string`);
  if (!(VALID_EXTERNAL_OBJECT_PIN_TYPES as string[]).includes(value['objectType'] as string)) {
    errors.push(
      `${path}.objectType: must be one of ${VALID_EXTERNAL_OBJECT_PIN_TYPES.join(', ')}`,
    );
  }
  return errors;
}

function validateExternalMeasurementLineV1(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['lineId'])) errors.push(`${path}.lineId: must be a string`);
  return errors;
}

function validateExternalAreaScanV1(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['scanId'])) errors.push(`${path}.scanId: must be a string`);
  if (!isString(value['capturedAt'])) errors.push(`${path}.capturedAt: must be a string`);
  if (
    value['reviewStatus'] !== undefined &&
    !(VALID_EXTERNAL_SCAN_REVIEW_STATUSES as string[]).includes(value['reviewStatus'] as string)
  ) {
    errors.push(`${path}.reviewStatus: must be 'confirmed' | 'pending' | 'rejected'`);
  }
  if (value['objectPins'] !== undefined) {
    if (isArray(value['objectPins'])) {
      (value['objectPins'] as unknown[]).forEach((p, i) => {
        errors.push(...validateExternalObjectPinV1(p, `${path}.objectPins[${i}]`));
      });
    } else {
      errors.push(`${path}.objectPins: must be an array`);
    }
  }
  if (value['measurementLines'] !== undefined) {
    if (isArray(value['measurementLines'])) {
      (value['measurementLines'] as unknown[]).forEach((l, i) => {
        errors.push(...validateExternalMeasurementLineV1(l, `${path}.measurementLines[${i}]`));
      });
    } else {
      errors.push(`${path}.measurementLines: must be an array`);
    }
  }
  return errors;
}

function validateSessionCaptureV2Fields(raw: UnknownSessionCaptureV2): string[] {
  const errors: string[] = [];

  if (!isString(raw['sessionId'])) errors.push('sessionId: must be a string');
  if (!isString(raw['capturedAt'])) errors.push('capturedAt: must be a string');
  if (!isString(raw['exportedAt'])) errors.push('exportedAt: must be a string');
  if (!isString(raw['deviceModel'])) errors.push('deviceModel: must be a string');

  if (!isArray(raw['roomScans'])) {
    errors.push('roomScans: must be an array');
  } else {
    (raw['roomScans'] as unknown[]).forEach((r, i) => {
      errors.push(...validateRoomScanV2(r, `roomScans[${i}]`));
    });
  }

  if (!isArray(raw['photos'])) {
    errors.push('photos: must be an array');
  } else {
    (raw['photos'] as unknown[]).forEach((p, i) => {
      errors.push(...validatePhotoV2(p, `photos[${i}]`));
    });
  }

  if (!isArray(raw['voiceNotes'])) {
    errors.push('voiceNotes: must be an array');
  } else {
    (raw['voiceNotes'] as unknown[]).forEach((v, i) => {
      errors.push(...validateVoiceNoteV2(v, `voiceNotes[${i}]`));
    });
  }

  if (!isArray(raw['objectPins'])) {
    errors.push('objectPins: must be an array');
  } else {
    (raw['objectPins'] as unknown[]).forEach((o, i) => {
      errors.push(...validateObjectPinV2(o, `objectPins[${i}]`));
    });
  }

  if (!isArray(raw['floorPlanSnapshots'])) {
    errors.push('floorPlanSnapshots: must be an array');
  } else {
    (raw['floorPlanSnapshots'] as unknown[]).forEach((s, i) => {
      errors.push(...validateFloorPlanSnapshotV2(s, `floorPlanSnapshots[${i}]`));
    });
  }

  if (!isArray(raw['qaFlags'])) {
    errors.push('qaFlags: must be an array');
  } else {
    (raw['qaFlags'] as unknown[]).forEach((f, i) => {
      errors.push(...validateQaFlagV2(f, `qaFlags[${i}]`));
    });
  }

  // ── Optional: floorPlanFabric ─────────────────────────────────────────────
  if (raw['floorPlanFabric'] !== undefined) {
    if (isArray(raw['floorPlanFabric'])) {
      (raw['floorPlanFabric'] as unknown[]).forEach((f, i) => {
        errors.push(...validateFloorPlanFabricCaptureV1(f, `floorPlanFabric[${i}]`));
      });
    } else {
      errors.push(...validateFloorPlanFabricCaptureV1(raw['floorPlanFabric'], 'floorPlanFabric'));
    }
  }

  // ── Optional: hazardObservations ─────────────────────────────────────────
  if (raw['hazardObservations'] !== undefined) {
    if (isArray(raw['hazardObservations'])) {
      (raw['hazardObservations'] as unknown[]).forEach((h, i) => {
        errors.push(...validateHazardObservationCaptureV1(h, `hazardObservations[${i}]`));
      });
    } else {
      errors.push(
        ...validateHazardObservationCaptureV1(raw['hazardObservations'], 'hazardObservations'),
      );
    }
  }

  // ── Optional: externalAreaScans ───────────────────────────────────────────
  if (raw['externalAreaScans'] !== undefined) {
    if (isArray(raw['externalAreaScans'])) {
      (raw['externalAreaScans'] as unknown[]).forEach((s, i) => {
        errors.push(...validateExternalAreaScanV1(s, `externalAreaScans[${i}]`));
      });
    } else {
      errors.push(...validateExternalAreaScanV1(raw['externalAreaScans'], 'externalAreaScans'));
    }
  }

  return errors;
}

function assertIsSessionCaptureV2(value: unknown): asserts value is SessionCaptureV2 {
  if (!isObject(value)) {
    throw new Error('assertIsSessionCaptureV2: expected a non-null object');
  }
  const errors = validateSessionCaptureV2Fields(value);
  if (errors.length > 0) {
    throw new Error(
      `assertIsSessionCaptureV2: structural validation failed — ${errors.join('; ')}`,
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Supported version strings for SessionCaptureV2. */
export const SUPPORTED_SESSION_CAPTURE_V2_VERSIONS = ['2.0'] as const;

/**
 * validateSessionCaptureV2 — entry-point validator for an unknown incoming
 * SessionCaptureV2 payload.
 *
 * Returns `{ ok: true, session }` on success, or `{ ok: false, errors }`.
 *
 * Usage:
 *   const result = validateSessionCaptureV2(parsedJson);
 *   if (!result.ok) { handle result.errors; }
 *   // result.session is now typed as SessionCaptureV2
 */
export function validateSessionCaptureV2(input: unknown): SessionCaptureV2ValidationResult {
  if (!isObject(input)) {
    return { ok: false, errors: ['Session capture must be a non-null JSON object'] };
  }

  const raw = input as UnknownSessionCaptureV2;

  if (!isString(raw['version'])) {
    return { ok: false, errors: ['version: must be a string'] };
  }

  const isSupported = (SUPPORTED_SESSION_CAPTURE_V2_VERSIONS as readonly string[]).includes(
    raw['version'],
  );
  if (!isSupported) {
    return {
      ok: false,
      errors: [
        `version '${raw['version']}' is not supported by the V2 importer. ` +
          `Supported versions: ${SUPPORTED_SESSION_CAPTURE_V2_VERSIONS.join(', ')}`,
      ],
    };
  }

  const structuralErrors = validateSessionCaptureV2Fields(raw);
  if (structuralErrors.length > 0) {
    return { ok: false, errors: structuralErrors };
  }

  assertIsSessionCaptureV2(raw);
  return { ok: true, session: raw };
}
