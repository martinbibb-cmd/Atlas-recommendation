/**
 * buildHandoffFromV2Capture.ts
 *
 * Wires a validated SessionCaptureV2 capture into Atlas Mind engineer and
 * customer-facing output structures.
 *
 * Two export paths:
 *   1. buildEngineerHandoffFromV2 — full evidence: rooms, object pins, photos,
 *      voice-note transcripts, QA flags.  For engineer-only surfaces.
 *   2. buildCustomerProofFromV2   — reviewed/safe subset only: rooms, room/
 *      session-scope photos, floor-plan snapshots, and a "captured on site"
 *      statement.  Does NOT expose raw QA flags, low-confidence inferred
 *      objects, unreviewed LiDAR guesses, or voice-note transcripts.
 *
 * Architecture rules:
 *   - Do NOT import raw SessionCaptureV2 types outside scanImport boundary.
 *     Use CaptureReviewModel as the input type.
 *   - Do NOT silently upgrade confidence on LiDAR-inferred pins.
 *   - Do NOT expose object-scope photos to the customer proof.
 *   - Do NOT invent geometry or synthesise missing fields.
 */

import type { CaptureReviewModel, ReviewObjectPin, ReviewStatus } from '../importer/captureReviewModel';

// ─── Engineer handoff types ───────────────────────────────────────────────────

/** A single line item in the engineer handoff evidence list. */
export interface EngineerHandoffItem {
  /** Discriminant for downstream rendering. */
  kind: 'room' | 'photo' | 'object_pin' | 'voice_note' | 'floor_plan' | 'qa_flag';
  /** Stable identifier referencing the source entity. */
  ref: string;
  /** Human-readable display title. */
  title: string;
  /** Room context, where applicable. */
  roomId?: string;
  /**
   * Confidence signal for this item.
   *   'confirmed'  — manually placed or reviewed by engineer.
   *   'inferred'   — LiDAR-derived; requires engineer review before use as fact.
   *   'review'     — QA flag or incomplete state.
   */
  confidence: 'confirmed' | 'inferred' | 'review';
  /**
   * The engineer's review decision for this item (where applicable).
   * Rooms and QA flags do not carry a reviewStatus.
   */
  reviewStatus?: ReviewStatus;
}

/** Engineer handoff output produced from a V2 capture. */
export interface EngineerHandoffFromV2 {
  sessionId: string;
  visitReference?: string;
  capturedAt: string;
  deviceModel: string;
  address?: string;
  items: EngineerHandoffItem[];
  /** Any evidence warnings surfaced at import time. */
  warnings: string[];
}

// ─── Customer proof types ─────────────────────────────────────────────────────

/**
 * A safe evidence item visible in the customer-facing proof.
 *
 * Only confirmed, reviewed items are included.
 */
export interface CustomerProofItem {
  kind: 'room' | 'photo' | 'floor_plan';
  ref: string;
  title: string;
}

/** Customer-facing proof produced from a V2 capture. */
export interface CustomerProofFromV2 {
  sessionId: string;
  visitReference?: string;
  capturedAt: string;
  address?: string;
  /**
   * Simple statement confirming the survey took place.
   * Example: "Captured on site — 22 Birchwood Avenue, Guildford on 15 Apr 2026."
   */
  capturedOnSiteStatement: string;
  items: CustomerProofItem[];
}

// ─── Engineer handoff builder ─────────────────────────────────────────────────

function formatObjectPinTitle(pin: ReviewObjectPin): string {
  if (pin.label) return pin.label;
  return pin.objectType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const TRANSCRIPT_PREVIEW = 60;

/**
 * buildEngineerHandoffFromV2 — converts a CaptureReviewModel into an
 * EngineerHandoffFromV2 suitable for the engineer-facing handoff surface.
 *
 * Includes all captured evidence: rooms, object pins (with confidence),
 * photos, voice-note transcripts, floor-plan snapshots, and QA flags.
 *
 * LiDAR-inferred pins are included but marked with confidence 'inferred' so
 * the handoff surface can render them with the appropriate review caveat.
 * They are never presented as confirmed truth.
 *
 * @param model   A CaptureReviewModel produced by buildCaptureReviewModel().
 */
export function buildEngineerHandoffFromV2(model: CaptureReviewModel): EngineerHandoffFromV2 {
  const items: EngineerHandoffItem[] = [];

  // Rooms
  for (const room of model.rooms) {
    items.push({
      kind: 'room',
      ref: room.roomId,
      title: room.label || room.roomId,
      roomId: room.roomId,
      confidence: room.status === 'complete' ? 'confirmed' : 'review',
    });
  }

  // Object pins — LiDAR-inferred pins get 'inferred' confidence
  for (const pin of model.objectPins) {
    items.push({
      kind: 'object_pin',
      ref: pin.pinId,
      title: formatObjectPinTitle(pin),
      roomId: pin.roomId,
      confidence: pin.needsConfirmation ? 'inferred' : 'confirmed',
      reviewStatus: pin.reviewStatus,
    });
  }

  // Photos (all scopes — engineer sees all evidence)
  for (const photo of model.photos) {
    let title = 'Photo';
    if (photo.scope === 'object') {
      const pin = model.objectPins.find((p) => p.pinId === photo.objectPinId);
      title = pin ? `Photo — ${formatObjectPinTitle(pin)}` : 'Object photo';
    } else if (photo.scope === 'room') {
      const room = model.rooms.find((r) => r.roomId === photo.roomId);
      title = room ? `Photo — ${room.label}` : 'Room photo';
    } else {
      title = 'Photo — session overview';
    }
    items.push({
      kind: 'photo',
      ref: photo.photoId,
      title,
      roomId: photo.roomId,
      confidence: 'confirmed',
      reviewStatus: photo.reviewStatus,
    });
  }

  // Voice notes — transcript text only; raw audio never present in V2
  for (const vn of model.voiceNotes) {
    const title = vn.transcript
      ? `Voice note: ${vn.transcript.slice(0, TRANSCRIPT_PREVIEW)}${vn.transcript.length > TRANSCRIPT_PREVIEW ? '…' : ''}`
      : 'Voice note';
    items.push({
      kind: 'voice_note',
      ref: vn.voiceNoteId,
      title,
      roomId: vn.roomId,
      confidence: 'confirmed',
    });
  }

  // Floor-plan snapshots
  for (const snap of model.floorPlanSnapshots) {
    const title =
      snap.floorIndex !== undefined
        ? `Floor plan — floor ${snap.floorIndex}`
        : 'Floor plan snapshot';
    items.push({
      kind: 'floor_plan',
      ref: snap.snapshotId,
      title,
      confidence: 'confirmed',
      reviewStatus: snap.reviewStatus,
    });
  }

  // QA flags — engineer needs to see all error/warn flags
  for (const flag of model.qaFlags) {
    if (flag.severity === 'error' || flag.severity === 'warn') {
      items.push({
        kind: 'qa_flag',
        ref: flag.code,
        title: `QA ${flag.severity}: ${flag.message ?? flag.code}${flag.entityId ? ` (${flag.entityId})` : ''}`,
        confidence: 'review',
      });
    }
  }

  return {
    sessionId: model.sessionId,
    visitReference: model.visitReference,
    capturedAt: model.capturedAt,
    deviceModel: model.deviceModel,
    address: model.address,
    items,
    warnings: model.evidenceWarnings,
  };
}

// ─── Customer proof builder ───────────────────────────────────────────────────

/**
 * buildCustomerProofFromV2 — produces a safe, customer-facing proof of site
 * capture from a CaptureReviewModel.
 *
 * Only reviewed/safe evidence is included:
 *   - Rooms (confirmed complete rooms only)
 *   - Session and room-scope photos (by customerSafePhotoIds)
 *   - Floor-plan snapshots
 *
 * Explicitly excluded:
 *   - Raw QA flags (not shown to customers)
 *   - Object-scope photos (engineer evidence only)
 *   - Voice-note transcripts (field observations, not customer copy)
 *   - LiDAR-inferred object pins (unreviewed guesses, not confirmed truth)
 *
 * @param model   A CaptureReviewModel produced by buildCaptureReviewModel().
 */
export function buildCustomerProofFromV2(model: CaptureReviewModel): CustomerProofFromV2 {
  const items: CustomerProofItem[] = [];

  // Confirmed rooms only
  for (const room of model.rooms) {
    if (room.status === 'complete') {
      items.push({ kind: 'room', ref: room.roomId, title: room.label || room.roomId });
    }
  }

  // Customer-safe photos: confirmed + explicitly included in customer report
  for (const photo of model.photos) {
    if (photo.reviewStatus === 'confirmed' && photo.includeInCustomerReport) {
      items.push({ kind: 'photo', ref: photo.photoId, title: `Photo — ${photo.scope}` });
    }
  }

  // Floor-plan snapshots: confirmed + explicitly included in customer report
  for (const snap of model.floorPlanSnapshots) {
    if (snap.reviewStatus === 'confirmed' && snap.includeInCustomerReport) {
      const title =
        snap.floorIndex !== undefined
          ? `Floor plan — floor ${snap.floorIndex}`
          : 'Floor plan snapshot';
      items.push({ kind: 'floor_plan', ref: snap.snapshotId, title });
    }
  }

  const capturedDate = new Date(model.capturedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const capturedOnSiteStatement = model.address
    ? `Captured on site — ${model.address} on ${capturedDate}.`
    : `Captured on site on ${capturedDate}.`;

  return {
    sessionId: model.sessionId,
    visitReference: model.visitReference,
    capturedAt: model.capturedAt,
    address: model.address,
    capturedOnSiteStatement,
    items,
  };
}
