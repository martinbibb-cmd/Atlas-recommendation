/**
 * sessionCaptureImporter.ts
 *
 * Primary import entry point for SessionCaptureV1 payloads.
 *
 * SessionCaptureV1 is the canonical handoff format produced by Atlas Scan iOS.
 * This module is the mirror of importScanBundle but for the new contract.
 *
 * Pipeline:
 *   unknown input
 *   → validateSessionCapture  (structural / type check)
 *   → deriveSessionReview     (evidence inventory, missing fields, readiness)
 *   → SessionCaptureImportResult
 *
 * Architecture rules:
 *   - Raw SessionCaptureV1 types do NOT spread beyond this boundary.
 *   - Callers receive only the validated capture + typed review summary.
 *   - No floor-plan, recommendation, or simulation state is touched here.
 *   - Upload to R2 / D1 is the caller's responsibility (see SessionCaptureImportFlow.tsx).
 */

import { validateSessionCapture } from '@atlas/contracts';
import type {
  SessionCaptureV1,
  PhotoV1,
  ObjectV1,
  SessionRoomV1,
} from '@atlas/contracts';

// ─── Review types ─────────────────────────────────────────────────────────────

/**
 * A single piece of evidence extracted from a SessionCaptureV1.
 * Used to drive the import review screen and to populate engineer / customer
 * output sections.
 */
export interface CaptureEvidenceItem {
  /** Discriminant for the evidence kind. */
  kind: 'photo' | 'note' | 'room' | 'object' | 'transcript';
  /** Stable identifier referencing the source entity. */
  ref: string;
  /** Human-readable label for display. */
  label: string;
  /** Optional room context. */
  roomId?: string;
  /** Optional object context. */
  objectId?: string;
  /**
   * Whether this item is safe to surface in customer-facing outputs.
   *
   * Only photos scoped at 'session' or 'room' level, and the session
   * summary / transcript are considered customer-safe.  Object-level
   * engineer notes are engineer-only.
   */
  customerSafe: boolean;
}

/**
 * Derived review data — produced by deriveSessionReview() from a validated
 * SessionCaptureV1.  Drives the import review screen without leaking the raw
 * capture type to the UI layer.
 */
export interface SessionCaptureReview {
  /** Stable session identifier. */
  sessionId: string;
  /** Property address from capture metadata, if present. */
  address?: string;
  /** Session lifecycle status. */
  status: SessionCaptureV1['status'];
  /** ISO-8601 session start timestamp. */
  startedAt: string;
  /** ISO-8601 session completion timestamp, if present. */
  completedAt?: string;
  /** Device / app metadata, if present. */
  device?: { model?: string; appVersion?: string };

  // ── Evidence counts ─────────────────────────────────────────────────────
  roomCount: number;
  objectCount: number;
  photoCount: number;
  noteCount: number;
  hasTranscript: boolean;
  transcriptStatus?: 'pending' | 'processing' | 'complete';

  // ── Readiness signals ────────────────────────────────────────────────────
  /** Fields present in the contract but absent from this capture. */
  missingFields: string[];
  /**
   * Human-readable strings describing items that need engineer review
   * before the capture can be used in outputs.
   */
  verificationRequired: string[];

  // ── Evidence lists ────────────────────────────────────────────────────────
  /** Evidence items safe to surface in customer-facing outputs. */
  customerSafeEvidence: CaptureEvidenceItem[];
  /** All evidence items (engineer view). */
  engineerEvidence: CaptureEvidenceItem[];
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface SessionCaptureImportSuccess {
  status: 'success';
  capture: SessionCaptureV1;
  review: SessionCaptureReview;
  warnings: [];
}

export interface SessionCaptureImportSuccessWithWarnings {
  status: 'success_with_warnings';
  capture: SessionCaptureV1;
  review: SessionCaptureReview;
  warnings: string[];
}

export interface SessionCaptureImportRejected {
  status: 'rejected_invalid';
  errors: string[];
}

export type SessionCaptureImportResult =
  | SessionCaptureImportSuccess
  | SessionCaptureImportSuccessWithWarnings
  | SessionCaptureImportRejected;

// ─── Evidence derivation ──────────────────────────────────────────────────────

function buildEvidenceItems(capture: SessionCaptureV1): CaptureEvidenceItem[] {
  const items: CaptureEvidenceItem[] = [];

  // Rooms
  for (const room of capture.rooms) {
    items.push({
      kind: 'room',
      ref: room.roomId,
      label: room.label || `Room ${items.length + 1}`,
      roomId: room.roomId,
      customerSafe: true,
    });
  }

  // Objects
  for (const obj of capture.objects) {
    items.push({
      kind: 'object',
      ref: obj.objectId,
      label: formatObjectLabel(obj),
      roomId: obj.roomId,
      customerSafe: false, // engineer-only: contains technical object details
    });
  }

  // Photos
  for (const photo of capture.photos) {
    // Photos at session or room scope are customer-safe.
    // Photos scoped to a specific object carry potentially sensitive
    // technical detail (data plates, condition shots) — engineer-only.
    const customerSafe = photo.scope === 'session' || photo.scope === 'room';
    items.push({
      kind: 'photo',
      ref: photo.photoId,
      label: formatPhotoLabel(photo, capture.rooms),
      roomId: photo.roomId,
      objectId: photo.objectId,
      customerSafe,
    });
  }

  // Note markers
  for (const note of capture.notes) {
    items.push({
      kind: 'note',
      ref: note.markerId,
      label: note.text ?? 'Note',
      roomId: note.roomId,
      customerSafe: false, // engineer field notes are not customer-safe by default
    });
  }

  // Transcript (if available)
  const transcription = capture.audio.transcription;
  if (transcription?.text) {
    items.push({
      kind: 'transcript',
      ref: 'transcript',
      label: 'Session transcript',
      customerSafe: false, // raw transcript is engineer-only; summarised copy may be surfaced separately
    });
  }

  return items;
}

function formatObjectLabel(obj: ObjectV1): string {
  const typeLabel = obj.type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (obj.metadata?.subtype) {
    return `${typeLabel} (${obj.metadata.subtype})`;
  }
  return typeLabel;
}

function formatPhotoLabel(photo: PhotoV1, rooms: SessionRoomV1[]): string {
  if (photo.scope === 'object') return `Photo — object evidence`;
  if (photo.scope === 'room') {
    const room = rooms.find((r) => r.roomId === photo.roomId);
    return room ? `Photo — ${room.label}` : 'Photo — room';
  }
  return 'Photo — session';
}

// ─── Missing / verification signals ──────────────────────────────────────────

function deriveMissingFields(capture: SessionCaptureV1): string[] {
  const missing: string[] = [];
  if (!capture.property?.address && !capture.property?.postcode) {
    missing.push('Property address not recorded');
  }
  if (!capture.completedAt) {
    missing.push('Session not yet marked as complete');
  }
  if (capture.rooms.length === 0) {
    missing.push('No rooms captured');
  }
  return missing;
}

function deriveVerificationRequired(
  capture: SessionCaptureV1,
  rooms: SessionRoomV1[],
): string[] {
  const items: string[] = [];

  // Rooms that are not in 'complete' status
  const incompleteRooms = rooms.filter((r) => r.status !== 'complete');
  if (incompleteRooms.length > 0) {
    const labels = incompleteRooms.map((r) => r.label || r.roomId).join(', ');
    items.push(`${incompleteRooms.length} room(s) not marked complete: ${labels}`);
  }

  // Objects without any photos
  const objectsWithoutPhotos = capture.objects.filter(
    (o) => o.photoIds.length === 0,
  );
  if (objectsWithoutPhotos.length > 0) {
    items.push(
      `${objectsWithoutPhotos.length} object(s) have no photos attached`,
    );
  }

  // Transcript pending or processing
  const transcription = capture.audio.transcription;
  if (
    transcription?.status === 'pending' ||
    transcription?.status === 'processing'
  ) {
    items.push('Transcript not yet available — audio processing in progress');
  }

  return items;
}

// ─── Review builder ───────────────────────────────────────────────────────────

function deriveSessionReview(capture: SessionCaptureV1): SessionCaptureReview {
  const evidenceItems = buildEvidenceItems(capture);
  const missingFields = deriveMissingFields(capture);
  const verificationRequired = deriveVerificationRequired(
    capture,
    capture.rooms,
  );

  return {
    sessionId: capture.sessionId,
    address: capture.property?.address
      ? [capture.property.address, capture.property.postcode]
          .filter(Boolean)
          .join(', ')
      : undefined,
    status: capture.status,
    startedAt: capture.startedAt,
    completedAt: capture.completedAt,
    device: capture.device,
    roomCount: capture.rooms.length,
    objectCount: capture.objects.length,
    photoCount: capture.photos.length,
    noteCount: capture.notes.length,
    hasTranscript: !!capture.audio.transcription?.text,
    transcriptStatus: capture.audio.transcription?.status,
    missingFields,
    verificationRequired,
    customerSafeEvidence: evidenceItems.filter((e) => e.customerSafe),
    engineerEvidence: evidenceItems,
  };
}

// ─── Warning derivation ───────────────────────────────────────────────────────

function deriveWarnings(
  capture: SessionCaptureV1,
  missingFields: string[],
): string[] {
  const warnings: string[] = [...missingFields];

  if (capture.status !== 'ready' && capture.status !== 'synced') {
    warnings.push(
      `Session status is '${capture.status}' — capture may be incomplete`,
    );
  }

  // Orphan photos: objectId references an unknown object
  const objectIds = new Set(capture.objects.map((o) => o.objectId));
  const orphanPhotos = capture.photos.filter(
    (p) => p.scope === 'object' && p.objectId && !objectIds.has(p.objectId),
  );
  if (orphanPhotos.length > 0) {
    warnings.push(
      `${orphanPhotos.length} photo(s) reference objects not in this capture`,
    );
  }

  return warnings;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * importSessionCapture — the primary entry point for ingesting a
 * SessionCaptureV1 payload into Atlas Mind.
 *
 * Accepts any unknown value (e.g. parsed JSON from a file or network response)
 * and returns a SessionCaptureImportResult.
 *
 * Usage:
 *   const result = importSessionCapture(parsedJson);
 *   switch (result.status) {
 *     case 'success':
 *     case 'success_with_warnings':
 *       // use result.capture and result.review
 *       break;
 *     case 'rejected_invalid':
 *       // handle result.errors
 *       break;
 *   }
 */
export function importSessionCapture(input: unknown): SessionCaptureImportResult {
  // 1. Structural validation via @atlas/contracts
  const validationResult = validateSessionCapture(input);
  if (!validationResult.ok) {
    return { status: 'rejected_invalid', errors: validationResult.errors };
  }

  const capture = validationResult.session;

  // 2. Derive review data (evidence inventory, missing fields, readiness)
  const review = deriveSessionReview(capture);

  // 3. Derive warnings
  const warnings = deriveWarnings(capture, review.missingFields);

  // 4. Return typed result
  if (warnings.length === 0) {
    return { status: 'success', capture, review, warnings: [] };
  }

  return { status: 'success_with_warnings', capture, review, warnings };
}

/**
 * isSessionCaptureJson — heuristic test to detect whether an unknown parsed
 * JSON value is likely a SessionCaptureV1 payload (as opposed to a ScanBundleV1
 * or other JSON).
 *
 * Used by ReceiveScanPage to route incoming .json files to the correct flow
 * without running a full validation pass first.
 */
export function isSessionCaptureJson(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    obj['version'] === '1.0' &&
    typeof obj['sessionId'] === 'string' &&
    obj['sessionId'].length > 0 &&
    Array.isArray(obj['rooms']) &&
    Array.isArray(obj['photos'])
  );
}
