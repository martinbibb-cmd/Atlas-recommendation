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
  FloorPlanFabricCaptureV1,
  FabricBoundaryV1,
  HazardObservationCaptureV1,
} from '../scanImport/contracts/sessionCaptureV2';

// Re-export contract types so viewer components only need to import from here.
export type {
  RoomScanV2,
  PhotoV2,
  VoiceNoteV2,
  ObjectPinV2,
  FloorPlanSnapshotV2,
  QaFlagV2,
  FloorPlanFabricCaptureV1,
  FabricBoundaryV1,
  HazardObservationCaptureV1,
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
  return pin.metadata?.inferredByLidar === true;
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

// ─── Fabric selectors ─────────────────────────────────────────────────────────

/**
 * Normalises the optional `floorPlanFabric` field to an array.
 * Returns an empty array when the field is absent.
 *
 * Use for the engineer evidence view — not for heat-loss or customer outputs.
 */
export function getFabricEvidenceSummary(
  capture: SessionCaptureV2,
): FloorPlanFabricCaptureV1[] {
  if (capture.floorPlanFabric === undefined) return [];
  return Array.isArray(capture.floorPlanFabric)
    ? capture.floorPlanFabric
    : [capture.floorPlanFabric];
}

/**
 * Returns confirmed boundaries across all fabric rooms.
 * A boundary is confirmed when its reviewStatus is explicitly 'confirmed'.
 */
export function getConfirmedFabricBoundaries(
  capture: SessionCaptureV2,
): FabricBoundaryV1[] {
  const rooms = getFabricEvidenceSummary(capture);
  const result: FabricBoundaryV1[] = [];
  for (const room of rooms) {
    if (room.boundaries) {
      for (const b of room.boundaries) {
        if (b.reviewStatus === 'confirmed') result.push(b);
      }
    }
  }
  return result;
}

/**
 * Returns customer-safe fabric evidence — currently always empty.
 *
 * Fabric data is engineer-internal until the heat-loss pipeline explicitly
 * consumes it.  This selector is the designated gate: downstream customer
 * outputs should call this function and receive nothing until the integration
 * lands.
 */
export function getCustomerSafeFabricEvidence(
  _capture: SessionCaptureV2,
): FloorPlanFabricCaptureV1[] {
  return [];
}

// ─── Hazard selectors ─────────────────────────────────────────────────────────

/**
 * Normalises the optional `hazardObservations` field to an array.
 * Returns an empty array when the field is absent.
 *
 * Engineer-internal only — never pass this to customer-facing components.
 */
export function getHazardEvidenceSummary(
  capture: SessionCaptureV2,
): HazardObservationCaptureV1[] {
  if (capture.hazardObservations === undefined) return [];
  return Array.isArray(capture.hazardObservations)
    ? capture.hazardObservations
    : [capture.hazardObservations];
}

/**
 * Returns true when the capture contains at least one non-rejected hazard
 * with severity 'blocking' or 'high'.
 *
 * A "blocking" hazard is one that should visually flag the engineer to take
 * action before proceeding.  Rejected hazards are excluded from this gate.
 *
 * Severity contract:
 *   'blocking' — always triggers the gate (replaces the former 'critical' value).
 *   'high'     — triggers the gate unconditionally.
 *   'medium' / 'low' — do not trigger the gate.
 */
export function hasBlockingHazard(capture: SessionCaptureV2): boolean {
  const hazards = getHazardEvidenceSummary(capture);
  return hazards.some(
    (h) =>
      h.reviewStatus !== 'rejected' &&
      (h.severity === 'blocking' || h.severity === 'high'),
  );
}

// ─── Fabric confidence signals ────────────────────────────────────────────────

/**
 * Returns a list of human-readable fabric confidence indicator strings for the
 * engineer view.  These are display-only signals derived from the presence and
 * content of floorPlanFabric records.
 *
 * Rules:
 *   - Never feeds into heat-loss or engine inputs.
 *   - Indicator strings show what Atlas captured, not what it calculated.
 *   - Engineer-internal: must not appear in customer-facing outputs.
 */
export function getFabricConfidenceSignals(capture: SessionCaptureV2): string[] {
  const rooms = getFabricEvidenceSummary(capture);
  if (rooms.length === 0) return [];

  const signals: string[] = [];

  const externalWallCount = rooms.reduce((acc, room) => {
    const ext = (room.boundaries ?? []).filter((b) => b.type === 'external');
    return acc + ext.length;
  }, 0);

  const windowCount = rooms.reduce((acc, room) => {
    const wins = (room.openings ?? []).filter((o) => o.type === 'window');
    return acc + wins.length;
  }, 0);

  const perimeterRooms = rooms.filter((r) => r.perimeterM !== undefined);

  if (externalWallCount > 0) {
    signals.push(
      `External wall${externalWallCount !== 1 ? 's' : ''} identified (${externalWallCount})`,
    );
  }

  if (windowCount > 0) {
    signals.push(`Window opening${windowCount !== 1 ? 's' : ''} detected (${windowCount})`);
  }

  if (perimeterRooms.length > 0) {
    signals.push(`Perimeter captured (${perimeterRooms.length} room${perimeterRooms.length !== 1 ? 's' : ''})`);
  }

  if (rooms.length > 0 && signals.length === 0) {
    signals.push(`Fabric data received (${rooms.length} room${rooms.length !== 1 ? 's' : ''})`);
  }

  return signals;
}

// ─── Hazard soft warnings ─────────────────────────────────────────────────────

/**
 * Returns a list of soft-warning strings for confirmed or pending hazards.
 * These are concise, action-oriented messages suitable for displaying in the
 * engineer pre-install view.
 *
 * Rules:
 *   - Rejected hazards are excluded.
 *   - No recommendation logic — display only.
 *   - Engineer-internal: must not appear in customer-facing outputs.
 */
export function getHazardSoftWarnings(capture: SessionCaptureV2): string[] {
  const hazards = getHazardEvidenceSummary(capture);
  return hazards
    .filter((h) => h.reviewStatus !== 'rejected')
    .map((h) => {
      if (h.category === 'asbestos_suspected') {
        return 'Suspected asbestos — specialist inspection required';
      }
      if (h.category === 'structural') {
        return 'Structural concern noted — verify before installation';
      }
      if (h.category === 'electrical') {
        return 'Electrical hazard recorded — check access and isolation';
      }
      if (h.category === 'gas') {
        return 'Gas safety concern recorded — engineer review required';
      }
      if (h.category === 'water_damage') {
        return 'Water damage noted — assess affected area before installation';
      }
      return h.actionRequired
        ? `Site observation: ${h.title} — ${h.actionRequired}`
        : `Site observation: ${h.title}`;
    });
}
