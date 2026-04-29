/**
 * sessionCaptureV2Importer.ts
 *
 * Primary import entry point for SessionCaptureV2 payloads.
 *
 * SessionCaptureV2 is the next-generation canonical handoff format produced
 * by Atlas Scan iOS.  This module is the V2 mirror of sessionCaptureImporter.ts.
 *
 * Pipeline:
 *   unknown input
 *   → validateSessionCaptureV2  (structural / type check via local contracts)
 *   → deriveSessionV2Review     (evidence inventory, missing fields, readiness)
 *   → SessionCaptureV2ImportResult
 *
 * Architecture rules:
 *   - Raw SessionCaptureV2 types do NOT spread beyond this boundary.
 *   - Callers receive only the validated capture + typed review summary.
 *   - No floor-plan, recommendation, or simulation state is touched here.
 *   - Upload to R2 / D1 is the caller's responsibility.
 *
 * Evidence routing (V2):
 *   Customer-safe: rooms, session-scope photos, room-scope photos,
 *                  floor-plan snapshots.
 *   Engineer-only: object-scope photos, voice-note transcripts,
 *                  object pins, QA flags.
 */

import {
  validateSessionCaptureV2,
} from '../contracts/sessionCaptureV2';
import type {
  SessionCaptureV2,
  RoomScanV2,
  PhotoV2,
  VoiceNoteV2,
  ObjectPinV2,
  FloorPlanSnapshotV2,
  QaFlagV2,
} from '../contracts/sessionCaptureV2';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of characters shown when previewing a transcript in a label. */
const TRANSCRIPT_PREVIEW_MAX_LENGTH = 60;

// ─── Evidence item types ──────────────────────────────────────────────────────

/**
 * A single piece of evidence extracted from a SessionCaptureV2.
 * Used to drive the import review screen and populate engineer / customer
 * output sections.
 */
export interface CaptureEvidenceV2Item {
  /** Discriminant for the evidence kind. */
  kind: 'room' | 'photo' | 'voice_note' | 'object_pin' | 'floor_plan' | 'qa_flag';
  /** Stable identifier referencing the source entity. */
  ref: string;
  /** Human-readable label for display. */
  label: string;
  /** Optional room context. */
  roomId?: string;
  /** Optional object-pin context. */
  objectPinId?: string;
  /**
   * Whether this item is safe to surface in customer-facing outputs.
   *
   * Customer-safe: rooms, session/room-scope photos, floor-plan snapshots.
   * Engineer-only: object-scope photos, voice-note transcripts, object pins,
   *                QA flags.
   */
  customerSafe: boolean;
}

// ─── Review type ──────────────────────────────────────────────────────────────

/**
 * Derived review data produced by deriveSessionV2Review() from a validated
 * SessionCaptureV2.  Drives the import review screen without leaking raw
 * V2 types to the UI layer.
 */
export interface SessionCaptureV2Review {
  /** Stable session identifier. */
  sessionId: string;
  /** Optional visit/job reference. */
  visitReference?: string;
  /** Formatted property address, if present. */
  address?: string;
  /** ISO-8601 session start timestamp. */
  capturedAt: string;
  /** ISO-8601 export timestamp. */
  exportedAt: string;
  /** Device model string. */
  deviceModel: string;

  // ── Evidence counts ──────────────────────────────────────────────────────
  roomCount: number;
  objectPinCount: number;
  photoCount: number;
  voiceNoteCount: number;
  /** True when at least one voice note has a non-empty transcript. */
  hasTranscript: boolean;
  floorPlanSnapshotCount: number;
  qaFlagCount: number;
  /** Number of QA flags with severity 'error'. */
  qaErrorCount: number;
  /** Number of QA flags with severity 'warn'. */
  qaWarnCount: number;

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
  customerSafeEvidence: CaptureEvidenceV2Item[];
  /** All evidence items (engineer view). */
  engineerEvidence: CaptureEvidenceV2Item[];
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface SessionCaptureV2ImportSuccess {
  status: 'success';
  capture: SessionCaptureV2;
  review: SessionCaptureV2Review;
  warnings: [];
}

export interface SessionCaptureV2ImportSuccessWithWarnings {
  status: 'success_with_warnings';
  capture: SessionCaptureV2;
  review: SessionCaptureV2Review;
  warnings: string[];
}

export interface SessionCaptureV2ImportRejected {
  status: 'rejected_invalid';
  errors: string[];
}

export type SessionCaptureV2ImportResult =
  | SessionCaptureV2ImportSuccess
  | SessionCaptureV2ImportSuccessWithWarnings
  | SessionCaptureV2ImportRejected;

// ─── Label helpers ────────────────────────────────────────────────────────────

function formatObjectPinLabel(pin: ObjectPinV2): string {
  if (pin.label) return pin.label;
  const typeLabel = pin.objectType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return typeLabel;
}

function formatPhotoV2Label(photo: PhotoV2, roomScans: RoomScanV2[]): string {
  if (photo.scope === 'object') return 'Photo — object evidence';
  if (photo.scope === 'room') {
    const room = roomScans.find((r) => r.roomId === photo.roomId);
    return room ? `Photo — ${room.label}` : 'Photo — room';
  }
  return 'Photo — session';
}

// ─── Evidence derivation ──────────────────────────────────────────────────────

function buildEvidenceItemsV2(capture: SessionCaptureV2): CaptureEvidenceV2Item[] {
  const items: CaptureEvidenceV2Item[] = [];

  // Rooms — always customer-safe
  for (let i = 0; i < capture.roomScans.length; i++) {
    const room = capture.roomScans[i];
    items.push({
      kind: 'room',
      ref: room.roomId,
      label: room.label || `Room ${i + 1}`,
      roomId: room.roomId,
      customerSafe: true,
    });
  }

  // Photos — session/room scope are customer-safe; object scope is engineer-only
  for (const photo of capture.photos) {
    const customerSafe = photo.scope === 'session' || photo.scope === 'room';
    items.push({
      kind: 'photo',
      ref: photo.photoId,
      label: formatPhotoV2Label(photo, capture.roomScans),
      roomId: photo.roomId,
      objectPinId: photo.objectPinId,
      customerSafe,
    });
  }

  // Voice notes — engineer-only (contain field observations)
  for (const vn of capture.voiceNotes) {
    items.push({
      kind: 'voice_note',
      ref: vn.voiceNoteId,
      label: vn.transcript
        ? `Voice note — ${vn.transcript.slice(0, TRANSCRIPT_PREVIEW_MAX_LENGTH)}${vn.transcript.length > TRANSCRIPT_PREVIEW_MAX_LENGTH ? '…' : ''}`
        : 'Voice note',
      roomId: vn.roomId,
      customerSafe: false,
    });
  }

  // Object pins — engineer-only (technical installation detail)
  for (const pin of capture.objectPins) {
    items.push({
      kind: 'object_pin',
      ref: pin.pinId,
      label: formatObjectPinLabel(pin),
      roomId: pin.roomId,
      customerSafe: false,
    });
  }

  // Floor-plan snapshots — customer-safe (overview images)
  for (const snapshot of capture.floorPlanSnapshots) {
    items.push({
      kind: 'floor_plan',
      ref: snapshot.snapshotId,
      label:
        snapshot.floorIndex !== undefined
          ? `Floor plan — floor ${snapshot.floorIndex}`
          : 'Floor plan snapshot',
      customerSafe: true,
    });
  }

  // QA flags — engineer-only
  for (const flag of capture.qaFlags) {
    items.push({
      kind: 'qa_flag',
      ref: flag.code,
      label: flag.message ?? flag.code,
      customerSafe: false,
    });
  }

  return items;
}

// ─── Missing / verification signals ──────────────────────────────────────────

function deriveMissingFieldsV2(capture: SessionCaptureV2): string[] {
  const missing: string[] = [];
  if (!capture.property?.address && !capture.property?.postcode) {
    missing.push('Property address not recorded');
  }
  if (!capture.visitReference) {
    missing.push('Visit reference not set');
  }
  if (capture.roomScans.length === 0) {
    missing.push('No room scans captured');
  }
  return missing;
}

function deriveVerificationRequiredV2(
  capture: SessionCaptureV2,
  roomScans: RoomScanV2[],
): string[] {
  const items: string[] = [];

  // Rooms not in 'complete' status
  const incompleteRooms = roomScans.filter((r) => r.status !== 'complete');
  if (incompleteRooms.length > 0) {
    const labels = incompleteRooms.map((r) => r.label || r.roomId).join(', ');
    items.push(`${incompleteRooms.length} room scan(s) not marked complete: ${labels}`);
  }

  // Object pins without photos
  const pinsWithoutPhotos = capture.objectPins.filter((p) => p.photoIds.length === 0);
  if (pinsWithoutPhotos.length > 0) {
    items.push(`${pinsWithoutPhotos.length} object pin(s) have no photos attached`);
  }

  // QA error-severity flags require verification
  const errorFlags = capture.qaFlags.filter((f) => f.severity === 'error');
  if (errorFlags.length > 0) {
    const codes = errorFlags.map((f) => f.code).join(', ');
    items.push(`${errorFlags.length} QA error flag(s) require review: ${codes}`);
  }

  return items;
}

// ─── Review builder ───────────────────────────────────────────────────────────

function deriveSessionV2Review(capture: SessionCaptureV2): SessionCaptureV2Review {
  const evidenceItems = buildEvidenceItemsV2(capture);
  const missingFields = deriveMissingFieldsV2(capture);
  const verificationRequired = deriveVerificationRequiredV2(capture, capture.roomScans);

  const hasTranscript = capture.voiceNotes.some(
    (vn) => typeof vn.transcript === 'string' && vn.transcript.length > 0,
  );

  const qaErrorCount = capture.qaFlags.filter((f) => f.severity === 'error').length;
  const qaWarnCount = capture.qaFlags.filter((f) => f.severity === 'warn').length;

  return {
    sessionId: capture.sessionId,
    visitReference: capture.visitReference,
    address: capture.property?.address
      ? [capture.property.address, capture.property.postcode]
          .filter(Boolean)
          .join(', ')
      : undefined,
    capturedAt: capture.capturedAt,
    exportedAt: capture.exportedAt,
    deviceModel: capture.deviceModel,
    roomCount: capture.roomScans.length,
    objectPinCount: capture.objectPins.length,
    photoCount: capture.photos.length,
    voiceNoteCount: capture.voiceNotes.length,
    hasTranscript,
    floorPlanSnapshotCount: capture.floorPlanSnapshots.length,
    qaFlagCount: capture.qaFlags.length,
    qaErrorCount,
    qaWarnCount,
    missingFields,
    verificationRequired,
    customerSafeEvidence: evidenceItems.filter((e) => e.customerSafe),
    engineerEvidence: evidenceItems,
  };
}

// ─── Warning derivation ───────────────────────────────────────────────────────

function deriveWarningsV2(
  capture: SessionCaptureV2,
  missingFields: string[],
): string[] {
  const warnings: string[] = [...missingFields];

  // Orphan photos: objectPinId references an unknown pin
  const pinIds = new Set(capture.objectPins.map((p) => p.pinId));
  const orphanPhotos = capture.photos.filter(
    (ph) =>
      ph.scope === 'object' && ph.objectPinId !== undefined && !pinIds.has(ph.objectPinId),
  );
  if (orphanPhotos.length > 0) {
    warnings.push(
      `${orphanPhotos.length} photo(s) reference object pins not in this capture`,
    );
  }

  // QA error flags are warnings at import time
  const errorFlags = capture.qaFlags.filter((f) => f.severity === 'error');
  for (const flag of errorFlags) {
    warnings.push(
      `QA error: ${flag.message ?? flag.code}${flag.entityId ? ` (${flag.entityId})` : ''}`,
    );
  }

  // QA warn flags
  const warnFlags = capture.qaFlags.filter((f) => f.severity === 'warn');
  for (const flag of warnFlags) {
    warnings.push(
      `QA warning: ${flag.message ?? flag.code}${flag.entityId ? ` (${flag.entityId})` : ''}`,
    );
  }

  return warnings;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * importSessionCaptureV2 — the primary entry point for ingesting a
 * SessionCaptureV2 payload into Atlas Mind.
 *
 * Accepts any unknown value (e.g. parsed JSON from a file or network response)
 * and returns a SessionCaptureV2ImportResult.
 *
 * Usage:
 *   const result = importSessionCaptureV2(parsedJson);
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
export function importSessionCaptureV2(input: unknown): SessionCaptureV2ImportResult {
  // 1. Structural validation via local V2 contracts
  const validationResult = validateSessionCaptureV2(input);
  if (!validationResult.ok) {
    return { status: 'rejected_invalid', errors: validationResult.errors };
  }

  const capture = validationResult.session;

  // 2. Derive review data (evidence inventory, missing fields, readiness)
  const review = deriveSessionV2Review(capture);

  // 3. Derive warnings
  const warnings = deriveWarningsV2(capture, review.missingFields);

  // 4. Return typed result
  if (warnings.length === 0) {
    return { status: 'success', capture, review, warnings: [] };
  }

  return { status: 'success_with_warnings', capture, review, warnings };
}

/**
 * isSessionCaptureV2Json — heuristic test to detect whether an unknown parsed
 * JSON value is likely a SessionCaptureV2 payload.
 *
 * Checks for the V2 version discriminant ("2.0") and the presence of the
 * V2-specific `roomScans` array (V1 uses `rooms`, ScanBundleV1 uses `bundleId`).
 *
 * Used by ReceiveScanPage to route incoming .json files to the correct flow
 * without running a full validation pass first.
 */
export function isSessionCaptureV2Json(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    obj['version'] === '2.0' &&
    typeof obj['sessionId'] === 'string' &&
    obj['sessionId'].length > 0 &&
    Array.isArray(obj['roomScans']) &&
    Array.isArray(obj['photos'])
  );
}

/**
 * buildEngineerEvidenceFromV2 — converts a validated SessionCaptureV2 into
 * an array of flat evidence strings suitable for display in the engineer
 * handoff view.
 *
 * Returns room labels, photo summaries, voice note transcripts (if present),
 * object pin labels, and QA flag messages.  All items are included — the
 * handoff layer is engineer-facing.
 */
export function buildEngineerEvidenceFromV2(
  capture: SessionCaptureV2,
): { kind: string; title: string; ref: string }[] {
  const items: { kind: string; title: string; ref: string }[] = [];

  for (const room of capture.roomScans) {
    items.push({ kind: 'capture', title: room.label || room.roomId, ref: room.roomId });
  }

  for (const photo of capture.photos) {
    const room = capture.roomScans.find((r) => r.roomId === photo.roomId);
    let title = 'Photo';
    if (photo.scope === 'object') title = 'Object photo';
    else if (photo.scope === 'room' && room) title = `Photo — ${room.label}`;
    else if (photo.scope === 'room') title = 'Room photo';
    items.push({ kind: 'photo', title, ref: photo.photoId });
  }

  for (const vn of capture.voiceNotes) {
    items.push({
      kind: 'note',
      title: vn.transcript
        ? `Voice note: ${vn.transcript.slice(0, TRANSCRIPT_PREVIEW_MAX_LENGTH)}${vn.transcript.length > TRANSCRIPT_PREVIEW_MAX_LENGTH ? '…' : ''}`
        : 'Voice note',
      ref: vn.voiceNoteId,
    });
  }

  for (const pin of capture.objectPins) {
    items.push({
      kind: 'capture',
      title: formatObjectPinLabel(pin),
      ref: pin.pinId,
    });
  }

  for (const flag of capture.qaFlags) {
    if (flag.severity === 'error' || flag.severity === 'warn') {
      items.push({ kind: 'note', title: `QA: ${flag.message ?? flag.code}`, ref: flag.code });
    }
  }

  return items;
}

// Re-export V2 types used by UI components to prevent spreading raw contracts
export type {
  SessionCaptureV2,
  RoomScanV2,
  PhotoV2,
  VoiceNoteV2,
  ObjectPinV2,
  FloorPlanSnapshotV2,
  QaFlagV2,
};

// Export constant for use by UI components that truncate transcripts
export { TRANSCRIPT_PREVIEW_MAX_LENGTH };
