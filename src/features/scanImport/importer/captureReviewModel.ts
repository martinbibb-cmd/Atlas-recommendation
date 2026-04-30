/**
 * captureReviewModel.ts
 *
 * Standalone view model for a reviewed SessionCaptureV2 capture.
 *
 * Unlike SessionCaptureV2Review (which exposes evidence counts and routing
 * information for the import review screen), CaptureReviewModel normalises
 * the full captured evidence arrays into a form that is safe to pass to
 * engineer handoff builders, customer proof builders, and the Capture Review
 * screen — without leaking raw SessionCaptureV2 contract types beyond the
 * scanImport feature boundary.
 *
 * Shape mirrors the capture review model shape described in the problem spec:
 *   visitReference, sessionId, capturedAt, exportedAt, deviceModel,
 *   rooms, photos, objectPins, voiceNotes, floorPlanSnapshots,
 *   qaFlags, evidenceWarnings
 */

import type {
  SessionCaptureV2,
  RoomScanV2,
  PhotoV2,
  VoiceNoteV2,
  ObjectPinV2,
  FloorPlanSnapshotV2,
  QaFlagV2,
} from '../contracts/sessionCaptureV2';

// ─── Review status ────────────────────────────────────────────────────────────

/**
 * Per-item review decision made by the engineer on the Capture Review Screen.
 *
 *   confirmed — engineer has reviewed and accepted this item as trusted.
 *   pending   — item has not yet been reviewed (default for LiDAR-inferred pins
 *               and QA flags).
 *   rejected  — engineer has explicitly rejected this item; it will not appear
 *               in any downstream output.
 */
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected';

// ─── View-model types ─────────────────────────────────────────────────────────

/** Normalised room item for the review model. */
export interface ReviewRoom {
  roomId: string;
  label: string;
  status: 'active' | 'complete';
  floorIndex?: number;
  areaM2?: number;
}

/** Normalised photo item for the review model. */
export interface ReviewPhoto {
  photoId: string;
  /** Device-local or asset-store URI. */
  uri: string;
  capturedAt: string;
  scope: 'session' | 'room' | 'object';
  roomId?: string;
  objectPinId?: string;
  tags?: string[];
  /**
   * Whether this photo is safe to surface in customer-facing outputs based on
   * its scope.  true for session and room scope; false for object scope.
   * This is an immutable, scope-derived property.
   */
  customerSafe: boolean;
  /**
   * Engineer's explicit decision to include this photo in the customer report.
   * Defaults to `customerSafe` (i.e. session/room photos start as included).
   * The engineer can toggle this during review.
   */
  includeInCustomerReport: boolean;
  /**
   * Review status for this photo.
   * Manual (non-LiDAR) photos default to 'confirmed'.
   */
  reviewStatus: ReviewStatus;
}

/** Normalised voice note item for the review model. */
export interface ReviewVoiceNote {
  voiceNoteId: string;
  roomId?: string;
  createdAt: string;
  /**
   * Transcript text only — raw audio is never present in V2 payloads.
   * Absent when the audio was not transcribed before export.
   */
  transcript?: string;
}

/** Normalised object pin item for the review model. */
export interface ReviewObjectPin {
  pinId: string;
  objectType: string;
  roomId?: string;
  label?: string;
  /** IDs of photos linked to this pin. */
  photoIds: string[];
  metadata?: Record<string, unknown>;
  /**
   * True when the pin was inferred by LiDAR and has not been manually
   * confirmed by the engineer.  These items must not be surfaced as
   * confirmed truth in any output.
   */
  needsConfirmation: boolean;
  /**
   * Review status for this pin.
   * LiDAR-inferred pins default to 'pending'; manual pins default to
   * 'confirmed'.
   */
  reviewStatus: ReviewStatus;
}

/** Normalised floor-plan snapshot item for the review model. */
export interface ReviewFloorPlanSnapshot {
  snapshotId: string;
  uri: string;
  capturedAt: string;
  floorIndex?: number;
  /**
   * Engineer's explicit decision to include this floor plan in the customer
   * report.  Defaults to true.
   */
  includeInCustomerReport: boolean;
  /**
   * Review status for this snapshot.
   * Defaults to 'confirmed'.
   */
  reviewStatus: ReviewStatus;
}

/** Normalised QA flag item for the review model. */
export interface ReviewQaFlag {
  code: string;
  severity: 'info' | 'warn' | 'error';
  message?: string;
  entityId?: string;
}

/**
 * CaptureReviewModel
 *
 * Normalised view model produced by buildCaptureReviewModel().
 *
 * Contains full evidence arrays (not just counts) with customer-safety
 * signals and per-item review statuses already applied.  The raw
 * SessionCaptureV2 types do not escape beyond this boundary.
 *
 * The review status of each item is mutable — the engineer updates items
 * on the Capture Review Screen.  Call deriveReviewWarnings(model) at any
 * point to get up-to-date warnings reflecting the current review state.
 */
export interface CaptureReviewModel {
  // ── Identity ──────────────────────────────────────────────────────────────
  sessionId: string;
  visitReference?: string;
  capturedAt: string;
  exportedAt: string;
  deviceModel: string;
  address?: string;

  // ── Evidence arrays ───────────────────────────────────────────────────────
  rooms: ReviewRoom[];
  photos: ReviewPhoto[];
  voiceNotes: ReviewVoiceNote[];
  objectPins: ReviewObjectPin[];
  floorPlanSnapshots: ReviewFloorPlanSnapshot[];
  qaFlags: ReviewQaFlag[];

  // ── Derived ───────────────────────────────────────────────────────────────
  /**
   * Human-readable warnings about capture quality or missing evidence,
   * computed at model-build time from the raw capture.
   *
   * For dynamic review-state warnings (e.g. "Unconfirmed LiDAR objects"),
   * call deriveReviewWarnings(model) instead.
   */
  evidenceWarnings: string[];

  /**
   * Photo IDs safe to surface in customer-facing outputs, based on scope.
   * Note: buildCustomerProofFromV2 further filters by reviewStatus and
   * includeInCustomerReport before including photos in the proof.
   */
  customerSafePhotoIds: string[];
  customerSafeFloorPlanIds: string[];

  /** True when at least one voice note has a non-empty transcript. */
  hasTranscript: boolean;
}

// ─── LiDAR inference detection ────────────────────────────────────────────────

/**
 * Returns true if the object pin's metadata indicates it was inferred by
 * LiDAR and has not been manually confirmed.
 *
 * Convention: `metadata.inferredByLidar === true` marks a LiDAR-inferred pin.
 */
function isPinLidarInferred(pin: ObjectPinV2): boolean {
  return pin.metadata?.['inferredByLidar'] === true;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

function normaliseRooms(roomScans: RoomScanV2[]): ReviewRoom[] {
  return roomScans.map((r) => ({
    roomId: r.roomId,
    label: r.label,
    status: r.status,
    floorIndex: r.floorIndex,
    areaM2: r.areaM2,
  }));
}

function normalisePhotos(photos: PhotoV2[]): ReviewPhoto[] {
  return photos.map((p) => {
    const customerSafe = p.scope === 'session' || p.scope === 'room';
    return {
      photoId: p.photoId,
      uri: p.uri,
      capturedAt: p.capturedAt,
      scope: p.scope,
      roomId: p.roomId,
      objectPinId: p.objectPinId,
      tags: p.tags,
      customerSafe,
      includeInCustomerReport: customerSafe,
      reviewStatus: 'confirmed',
    };
  });
}

function normaliseVoiceNotes(voiceNotes: VoiceNoteV2[]): ReviewVoiceNote[] {
  return voiceNotes.map((v) => ({
    voiceNoteId: v.voiceNoteId,
    roomId: v.roomId,
    createdAt: v.createdAt,
    transcript: v.transcript,
  }));
}

function normaliseObjectPins(objectPins: ObjectPinV2[]): ReviewObjectPin[] {
  return objectPins.map((pin) => {
    const lidarInferred = isPinLidarInferred(pin);
    return {
      pinId: pin.pinId,
      objectType: pin.objectType,
      roomId: pin.roomId,
      label: pin.label,
      photoIds: pin.photoIds,
      metadata: pin.metadata,
      needsConfirmation: lidarInferred,
      reviewStatus: lidarInferred ? 'pending' : 'confirmed',
    };
  });
}

function normaliseFloorPlanSnapshots(snapshots: FloorPlanSnapshotV2[]): ReviewFloorPlanSnapshot[] {
  return snapshots.map((s) => ({
    snapshotId: s.snapshotId,
    uri: s.uri,
    capturedAt: s.capturedAt,
    floorIndex: s.floorIndex,
    includeInCustomerReport: true,
    reviewStatus: 'confirmed',
  }));
}

function normaliseQaFlags(qaFlags: QaFlagV2[]): ReviewQaFlag[] {
  return qaFlags.map((f) => ({
    code: f.code,
    severity: f.severity,
    message: f.message,
    entityId: f.entityId,
  }));
}

// ─── Evidence warning derivation ─────────────────────────────────────────────

function deriveEvidenceWarnings(capture: SessionCaptureV2): string[] {
  const warnings: string[] = [];

  // Missing property address
  if (!capture.property?.address && !capture.property?.postcode) {
    warnings.push('Property address not recorded');
  }

  // Missing visit reference
  if (!capture.visitReference) {
    warnings.push('Visit reference not set');
  }

  // No room scans at all
  if (capture.roomScans.length === 0) {
    warnings.push('No room scans captured');
  }

  // Incomplete room scans
  const incompleteRooms = capture.roomScans.filter((r) => r.status !== 'complete');
  if (incompleteRooms.length > 0) {
    const labels = incompleteRooms.map((r) => r.label || r.roomId).join(', ');
    warnings.push(`${incompleteRooms.length} room scan(s) not marked complete: ${labels}`);
  }

  // Object pins without photos
  const pinsWithoutPhotos = capture.objectPins.filter((p) => p.photoIds.length === 0);
  if (pinsWithoutPhotos.length > 0) {
    warnings.push(`${pinsWithoutPhotos.length} object pin(s) have no photos attached`);
  }

  // LiDAR-inferred pins need confirmation
  const lidarPins = capture.objectPins.filter(isPinLidarInferred);
  if (lidarPins.length > 0) {
    warnings.push(
      `${lidarPins.length} object pin(s) were inferred by LiDAR and require engineer confirmation`,
    );
  }

  // Orphan photos (reference a pin that doesn't exist)
  const pinIds = new Set(capture.objectPins.map((p) => p.pinId));
  const orphanPhotos = capture.photos.filter(
    (ph) => ph.scope === 'object' && ph.objectPinId !== undefined && !pinIds.has(ph.objectPinId),
  );
  if (orphanPhotos.length > 0) {
    warnings.push(`${orphanPhotos.length} photo(s) reference object pins not in this capture`);
  }

  // QA error flags
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

// ─── Dynamic review-state warnings ───────────────────────────────────────────

/**
 * deriveReviewWarnings — computes warnings based on the current review state
 * of items in a CaptureReviewModel.
 *
 * Unlike evidenceWarnings (computed once at import time from raw capture data),
 * these warnings reflect the engineer's current review decisions and should be
 * re-evaluated as items are confirmed or rejected on the Capture Review Screen.
 *
 * Covers:
 *   - "Unconfirmed LiDAR objects"         — LiDAR pins still pending/rejected
 *   - "No confirmed photos selected"      — no photos confirmed for customer report
 *   - "Floor plan not reviewed"           — any floor plan still pending/rejected
 *
 * Usage:
 *   const warnings = deriveReviewWarnings(model);
 */
export function deriveReviewWarnings(
  model: Pick<CaptureReviewModel, 'objectPins' | 'photos' | 'floorPlanSnapshots'>,
): string[] {
  const warnings: string[] = [];

  // Unconfirmed LiDAR objects
  const unconfirmedLidar = model.objectPins.filter(
    (p) => p.needsConfirmation && p.reviewStatus !== 'confirmed',
  );
  if (unconfirmedLidar.length > 0) {
    warnings.push(
      `Unconfirmed LiDAR objects: ${unconfirmedLidar.length} object pin(s) inferred by LiDAR require confirmation`,
    );
  }

  // No confirmed photos selected for customer report
  const hasConfirmedCustomerPhoto = model.photos.some(
    (p) => p.reviewStatus === 'confirmed' && p.includeInCustomerReport,
  );
  if (model.photos.length > 0 && !hasConfirmedCustomerPhoto) {
    warnings.push('No confirmed photos selected for customer report');
  }

  // Floor plan not reviewed
  const unconfirmedFloorPlans = model.floorPlanSnapshots.filter(
    (s) => s.reviewStatus !== 'confirmed',
  );
  if (unconfirmedFloorPlans.length > 0) {
    warnings.push(
      `Floor plan not reviewed: ${unconfirmedFloorPlans.length} floor plan snapshot(s) pending review`,
    );
  }

  return warnings;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildCaptureReviewModel — normalises a validated SessionCaptureV2 into a
 * CaptureReviewModel view model.
 *
 * Produces full evidence arrays (rooms, photos, objectPins, voiceNotes,
 * floorPlanSnapshots, qaFlags) along with customer-safety signals and
 * evidence warnings.
 *
 * The raw SessionCaptureV2 contract types do not escape this boundary —
 * callers receive only the normalised view model.
 *
 * Usage:
 *   const model = buildCaptureReviewModel(capture);
 *   // model.rooms, model.photos, model.objectPins, … are ready for use
 */
export function buildCaptureReviewModel(capture: SessionCaptureV2): CaptureReviewModel {
  const rooms = normaliseRooms(capture.roomScans);
  const photos = normalisePhotos(capture.photos);
  const voiceNotes = normaliseVoiceNotes(capture.voiceNotes);
  const objectPins = normaliseObjectPins(capture.objectPins);
  const floorPlanSnapshots = normaliseFloorPlanSnapshots(capture.floorPlanSnapshots);
  const qaFlags = normaliseQaFlags(capture.qaFlags);
  const evidenceWarnings = deriveEvidenceWarnings(capture);

  const customerSafePhotoIds = photos
    .filter((p) => p.customerSafe)
    .map((p) => p.photoId);

  const customerSafeFloorPlanIds = floorPlanSnapshots.map((s) => s.snapshotId);

  const hasTranscript = voiceNotes.some(
    (v) => typeof v.transcript === 'string' && v.transcript.length > 0,
  );

  const address = capture.property?.address
    ? [capture.property.address, capture.property.postcode].filter(Boolean).join(', ')
    : undefined;

  return {
    sessionId: capture.sessionId,
    visitReference: capture.visitReference,
    capturedAt: capture.capturedAt,
    exportedAt: capture.exportedAt,
    deviceModel: capture.deviceModel,
    address,
    rooms,
    photos,
    voiceNotes,
    objectPins,
    floorPlanSnapshots,
    qaFlags,
    evidenceWarnings,
    customerSafePhotoIds,
    customerSafeFloorPlanIds,
    hasTranscript,
  };
}
