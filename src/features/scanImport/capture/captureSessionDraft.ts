/**
 * captureSessionDraft.ts
 *
 * Internal mutable draft state for building a SessionCaptureV2 capture on-device.
 *
 * CaptureSessionDraft is the in-memory / in-form representation of a capture
 * session that has not yet been exported.  When the engineer is ready to
 * export, call exportDraftAsSessionCaptureV2() to produce the canonical V2
 * payload.
 *
 * Rules:
 *   - No ScanJob, ScanBundleV1, PropertyScanSession, ExportBuilder, or
 *     AtlasSync references are allowed here.
 *   - All fields write directly into CaptureSessionDraft.
 *   - Photos are tracked as local object URLs (browser) or file-system URIs
 *     (native); raw audio is never stored — only text transcripts.
 *   - Full wireframe / floor plan is optional; photo-only jobs are valid.
 */

import type { SessionCaptureV2, ObjectPinType } from '../contracts/sessionCaptureV2';

// ─── Draft types ──────────────────────────────────────────────────────────────

/** A room captured during the session draft. */
export interface DraftRoomScan {
  roomId: string;
  label: string;
  /** Whether the room scan is still in progress or has been completed. */
  status: 'active' | 'complete';
  floorIndex?: number;
  /** Estimated floor area in m². */
  areaM2?: number;
}

/** A photo captured during the session draft. */
export interface DraftPhoto {
  photoId: string;
  /** Local object URL (from FileReader / URL.createObjectURL) or file URI. */
  uri: string;
  capturedAt: string;
  scope: 'session' | 'room' | 'object';
  roomId?: string;
  objectPinId?: string;
  tags?: string[];
}

/**
 * A voice note stored as a text transcript only.
 * Raw audio is never stored or transmitted.
 */
export interface DraftVoiceNote {
  voiceNoteId: string;
  roomId?: string;
  createdAt: string;
  /** Transcript text — the only form of voice note content. */
  transcript: string;
}

/** An object pin placed during the session draft. */
export interface DraftObjectPin {
  pinId: string;
  objectType: ObjectPinType;
  /** Room the pin is attached to, if any. */
  roomId?: string;
  /** Optional display label (e.g. "Worcester Bosch 30i"). */
  label?: string;
  /** Photo IDs linked to this pin. */
  photoIds: string[];
  metadata?: Record<string, unknown>;
}

/** A floor-plan snapshot captured during the session draft. */
export interface DraftFloorPlanSnapshot {
  snapshotId: string;
  uri: string;
  capturedAt: string;
  floorIndex?: number;
}

/**
 * CaptureSessionDraft
 *
 * The complete in-memory state of an on-device capture session before export.
 * Every capture module writes into this struct; exportDraftAsSessionCaptureV2
 * converts it to the canonical V2 payload.
 */
export interface CaptureSessionDraft {
  /** Stable session identifier. */
  sessionId: string;
  /** Optional reference linking this session to a booking or job record. */
  visitReference?: string;
  /** ISO-8601 timestamp when the capture session started. */
  capturedAt: string;
  /** Device model string — defaults to 'web' in browser environments. */
  deviceModel: string;
  property?: {
    address?: string;
    postcode?: string;
  };
  roomScans: DraftRoomScan[];
  photos: DraftPhoto[];
  voiceNotes: DraftVoiceNote[];
  objectPins: DraftObjectPin[];
  floorPlanSnapshots: DraftFloorPlanSnapshot[];
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Creates a fresh empty CaptureSessionDraft with a new session ID. */
export function createEmptyCaptureSessionDraft(opts?: {
  visitReference?: string;
  address?: string;
  postcode?: string;
}): CaptureSessionDraft {
  return {
    sessionId: generateDraftId(),
    visitReference: opts?.visitReference,
    capturedAt: new Date().toISOString(),
    deviceModel: detectDeviceModel(),
    property:
      opts?.address || opts?.postcode
        ? { address: opts?.address, postcode: opts?.postcode }
        : undefined,
    roomScans: [],
    photos: [],
    voiceNotes: [],
    objectPins: [],
    floorPlanSnapshots: [],
  };
}

// ─── ID helpers ───────────────────────────────────────────────────────────────

function generateDraftId(): string {
  // Use crypto.randomUUID when available (all modern browsers), fall back
  // to a timestamp-based string for older environments.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Generates a stable ID for a new draft item (room, pin, note, etc.). */
export function generateItemId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function detectDeviceModel(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';
  return 'web';
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * exportDraftAsSessionCaptureV2
 *
 * Converts a CaptureSessionDraft to a valid SessionCaptureV2 payload.
 * The exportedAt timestamp is set to now so it reflects the export time.
 *
 * Photo URIs produced by URL.createObjectURL are not stable across page
 * reloads; this is acceptable for local JSON export — recipients should
 * treat the URI as a reference hint and not as a durable link.
 */
export function exportDraftAsSessionCaptureV2(
  draft: CaptureSessionDraft,
): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: draft.sessionId,
    visitReference: draft.visitReference,
    capturedAt: draft.capturedAt,
    exportedAt: new Date().toISOString(),
    deviceModel: draft.deviceModel,
    property: draft.property,
    roomScans: draft.roomScans.map((r) => ({
      roomId: r.roomId,
      label: r.label,
      status: r.status,
      floorIndex: r.floorIndex,
      areaM2: r.areaM2,
    })),
    photos: draft.photos.map((p) => ({
      photoId: p.photoId,
      uri: p.uri,
      capturedAt: p.capturedAt,
      scope: p.scope,
      roomId: p.roomId,
      objectPinId: p.objectPinId,
      tags: p.tags,
    })),
    voiceNotes: draft.voiceNotes.map((v) => ({
      voiceNoteId: v.voiceNoteId,
      roomId: v.roomId,
      createdAt: v.createdAt,
      transcript: v.transcript,
    })),
    objectPins: draft.objectPins.map((o) => ({
      pinId: o.pinId,
      objectType: o.objectType,
      roomId: o.roomId,
      label: o.label,
      photoIds: o.photoIds,
      metadata: o.metadata,
    })),
    floorPlanSnapshots: draft.floorPlanSnapshots.map((s) => ({
      snapshotId: s.snapshotId,
      uri: s.uri,
      capturedAt: s.capturedAt,
      floorIndex: s.floorIndex,
    })),
    qaFlags: [],
  };
}

// ─── Review helpers ───────────────────────────────────────────────────────────

/** Description of a missing recommended item. */
export interface CaptureReviewItem {
  type: 'missing' | 'warning' | 'ok';
  message: string;
}

/**
 * deriveReviewItems
 *
 * Returns a list of review notes for the draft capture session.
 * Used to drive the review blockers panel in VisitDetailView.
 */
export function deriveReviewItems(draft: CaptureSessionDraft): CaptureReviewItem[] {
  const items: CaptureReviewItem[] = [];

  // Evidence count summary
  const totalEvidence =
    draft.photos.length +
    draft.voiceNotes.length +
    draft.roomScans.length +
    draft.objectPins.length +
    draft.floorPlanSnapshots.length;

  if (totalEvidence === 0) {
    items.push({ type: 'missing', message: 'No evidence has been captured yet.' });
    return items;
  }

  if (draft.photos.length === 0) {
    items.push({ type: 'missing', message: 'No photos captured — at least one photo is recommended.' });
  }

  const hasBoilerPin = draft.objectPins.some((p) => p.objectType === 'boiler');
  if (!hasBoilerPin) {
    items.push({ type: 'missing', message: 'No boiler object pin — recommended for all heating jobs.' });
  }

  const incompleteRooms = draft.roomScans.filter((r) => r.status === 'active');
  if (incompleteRooms.length > 0) {
    items.push({
      type: 'warning',
      message: `${incompleteRooms.length} room scan(s) are still marked as active (not complete).`,
    });
  }

  const pinsWithoutRoom = draft.objectPins.filter(
    (p) => !p.roomId && draft.roomScans.length > 0,
  );
  if (pinsWithoutRoom.length > 0) {
    items.push({
      type: 'warning',
      message: `${pinsWithoutRoom.length} object pin(s) are not assigned to a room.`,
    });
  }

  if (items.length === 0) {
    items.push({ type: 'ok', message: 'Capture looks complete — ready to export.' });
  }

  return items;
}
