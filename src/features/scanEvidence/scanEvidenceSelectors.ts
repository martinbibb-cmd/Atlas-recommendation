/**
 * scanEvidenceSelectors.ts
 *
 * Pure data-selection helpers for the scan evidence viewer.
 *
 * All functions accept a validated SessionCaptureV2 and return plain arrays or
 * derived values.  No engine calls, no physics, no mutations.
 *
 * Design rules
 * ────────────
 * - Read-only: nothing here mutates the capture.
 * - No React dependencies — usable in selectors, tests, and non-React contexts.
 * - Pipe routes are a specialised subset of object pins (objectType === 'pipe_route')
 *   and are separated so that each viewer panel can focus on its own domain.
 */

import type {
  SessionCaptureV2,
  RoomScanV2,
  PhotoV2,
  VoiceNoteV2,
  ObjectPinV2,
  FloorPlanSnapshotV2,
  QaFlagV2,
} from '../scanImport/contracts/sessionCaptureV2';

// Re-export contract types so viewer components only need to import from here.
export type {
  RoomScanV2,
  PhotoV2,
  VoiceNoteV2,
  ObjectPinV2,
  FloorPlanSnapshotV2,
  QaFlagV2,
};

// ─── Derived types ────────────────────────────────────────────────────────────

/**
 * Counts for each evidence category in a SessionCaptureV2.
 * "transcripts" counts only voice notes that have non-empty transcript text.
 */
export interface ScanEvidenceCounts {
  rooms: number;
  photos: number;
  transcripts: number;
  objectPins: number;
  pipeRoutes: number;
  pointCloudAssets: number;
  qaFlags: number;
}

/**
 * The confidence tier derived from QA flag severity on an entity or the
 * overall session.  Used to drive the AnchorConfidenceBadge.
 */
export type AnchorConfidenceTier = 'high' | 'medium' | 'low';

// ─── LiDAR provenance ─────────────────────────────────────────────────────────

/**
 * Returns true when the object pin carries a metadata signal indicating it
 * was inferred by LiDAR and has not been manually confirmed.
 *
 * Convention: `metadata.inferredByLidar === true`.
 */
export function isLidarInferred(pin: ObjectPinV2): boolean {
  return pin.metadata?.['inferredByLidar'] === true;
}

// ─── Selectors ────────────────────────────────────────────────────────────────

/** All rooms in capture order. */
export function selectRooms(capture: SessionCaptureV2): RoomScanV2[] {
  return capture.roomScans;
}

/** All photos in capture order. */
export function selectPhotos(capture: SessionCaptureV2): PhotoV2[] {
  return capture.photos;
}

/**
 * Photos belonging to a specific room (scope 'room' or 'object' with matching
 * roomId).
 */
export function selectPhotosByRoom(
  capture: SessionCaptureV2,
  roomId: string,
): PhotoV2[] {
  return capture.photos.filter((p) => p.roomId === roomId);
}

/**
 * Photos linked to a specific object pin.
 */
export function selectPhotosByPin(
  capture: SessionCaptureV2,
  pinId: string,
): PhotoV2[] {
  return capture.photos.filter((p) => p.objectPinId === pinId);
}

/**
 * All voice notes in capture order.
 * Includes notes without transcript text (transcript may be absent).
 */
export function selectVoiceNotes(capture: SessionCaptureV2): VoiceNoteV2[] {
  return capture.voiceNotes;
}

/**
 * Voice notes that have a non-empty transcript.
 */
export function selectTranscripts(capture: SessionCaptureV2): VoiceNoteV2[] {
  return capture.voiceNotes.filter(
    (v) => typeof v.transcript === 'string' && v.transcript.trim().length > 0,
  );
}

/**
 * Object pins that are NOT pipe routes.
 * Pipe routes are surfaced separately via selectPipeRoutes().
 */
export function selectObjectPins(capture: SessionCaptureV2): ObjectPinV2[] {
  return capture.objectPins.filter((p) => p.objectType !== 'pipe_route');
}

/**
 * Object pins with objectType === 'pipe_route'.
 */
export function selectPipeRoutes(capture: SessionCaptureV2): ObjectPinV2[] {
  return capture.objectPins.filter((p) => p.objectType === 'pipe_route');
}

/**
 * Floor-plan snapshots — treated as point-cloud assets in the viewer because
 * they are the primary lidar-derived spatial artefacts exported by Atlas Scan.
 */
export function selectPointCloudAssets(
  capture: SessionCaptureV2,
): FloorPlanSnapshotV2[] {
  return capture.floorPlanSnapshots;
}

/** All QA flags. */
export function selectQaFlags(capture: SessionCaptureV2): QaFlagV2[] {
  return capture.qaFlags;
}

/** Evidence counts summary. */
export function selectEvidenceCounts(
  capture: SessionCaptureV2,
): ScanEvidenceCounts {
  return {
    rooms: capture.roomScans.length,
    photos: capture.photos.length,
    transcripts: selectTranscripts(capture).length,
    objectPins: selectObjectPins(capture).length,
    pipeRoutes: selectPipeRoutes(capture).length,
    pointCloudAssets: capture.floorPlanSnapshots.length,
    qaFlags: capture.qaFlags.length,
  };
}

// ─── Confidence derivation ────────────────────────────────────────────────────

/**
 * Derives the confidence tier for the overall session from its QA flags.
 *
 *   - 'low'    — any error-severity flag is present
 *   - 'medium' — any warn-severity flag is present (and no errors)
 *   - 'high'   — no warn or error flags
 */
export function deriveSessionConfidence(
  capture: SessionCaptureV2,
): AnchorConfidenceTier {
  if (capture.qaFlags.some((f) => f.severity === 'error')) return 'low';
  if (capture.qaFlags.some((f) => f.severity === 'warn')) return 'medium';
  return 'high';
}

/**
 * Derives the confidence tier for a specific entity (room, pin, snapshot)
 * by filtering QA flags whose entityId matches the supplied id.
 *
 * Falls back to 'high' when no matching flags are found.
 */
export function deriveEntityConfidence(
  capture: SessionCaptureV2,
  entityId: string,
): AnchorConfidenceTier {
  const relevant = capture.qaFlags.filter((f) => f.entityId === entityId);
  if (relevant.some((f) => f.severity === 'error')) return 'low';
  if (relevant.some((f) => f.severity === 'warn')) return 'medium';
  return 'high';
}
