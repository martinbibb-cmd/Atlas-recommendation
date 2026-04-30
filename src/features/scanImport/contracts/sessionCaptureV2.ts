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
