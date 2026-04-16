import type { SessionCaptureV1 } from '@atlas/contracts';
import type {
  SpatialTwinModelV1,
  SpatialHeatSourceV1,
  SpatialStoreV1,
  SpatialEvidenceMarkerV1,
  SpatialControlV1,
} from '../state/spatialTwin.types';
import type { SpatialTwinImportResult } from './spatialTwinImport.types';
import type {
  AtlasRoomV1,
  AtlasThermalZoneV1,
  AtlasEmitterV1,
} from '../../atlasSpatial/atlasSpatialModel.types';

export function buildInitialSpatialTwinFromCapture(
  session: SessionCaptureV1,
  propertyId: string,
): SpatialTwinImportResult {
  if (session == null || typeof session !== 'object') {
    return { status: 'failed', warnings: [], error: 'Session capture is null or invalid.' };
  }
  if (typeof session.sessionId !== 'string' || session.sessionId.trim() === '') {
    return { status: 'failed', warnings: [], error: 'Session capture has no sessionId.' };
  }

  const warnings: string[] = [];

  // ── Rooms ──────────────────────────────────────────────────────────────────
  const rooms: AtlasRoomV1[] = (session.rooms ?? []).map((r, idx) => ({
    roomId: r.roomId ?? `room-${idx}`,
    label: r.label ?? `Room ${idx + 1}`,
    status: 'draft' as const,
    roomType: 'other',
    zoneIds: [`zone-${r.roomId ?? idx}`],
  }));

  // ── Zones — one per room ───────────────────────────────────────────────────
  const zones: AtlasThermalZoneV1[] = rooms.map((room) => ({
    zoneId: `zone-${room.roomId}`,
    roomId: room.roomId,
    label: `${room.label} – zone`,
    emitterIds: [],
  }));

  // ── Emitters from detected objects ────────────────────────────────────────
  const emitters: AtlasEmitterV1[] = [];
  let emitterCounter = 0;

  // ── Heat sources ──────────────────────────────────────────────────────────
  const heatSources: SpatialHeatSourceV1[] = [];
  let heatSourceCounter = 0;

  // ── Stores ────────────────────────────────────────────────────────────────
  const stores: SpatialStoreV1[] = [];
  let storeCounter = 0;

  // ── Controls ──────────────────────────────────────────────────────────────
  const controls: SpatialControlV1[] = [];
  let controlCounter = 0;

  for (const obj of session.objects ?? []) {
    const objRoomId = obj.roomId;
    switch (obj.type) {
      case 'radiator': {
        const emitterId = `emitter-${emitterCounter++}`;
        const zone = zones.find((z) => z.roomId === objRoomId);
        emitters.push({
          emitterId,
          objectId: obj.objectId,
          roomId: objRoomId ?? '',
          zoneId: zone?.zoneId,
          type: 'radiator',
        });
        if (zone != null) {
          zone.emitterIds = [...zone.emitterIds, emitterId];
        }
        break;
      }
      case 'boiler':
        heatSources.push({
          heatSourceId: `hs-${heatSourceCounter++}`,
          label: obj.metadata?.subtype === 'system' ? 'System Boiler' : 'Combi Boiler',
          type:
            obj.metadata?.subtype === 'system'
              ? 'system_boiler'
              : obj.metadata?.subtype === 'heat_pump'
                ? 'heat_pump'
                : 'combi_boiler',
          roomId: objRoomId,
          status: 'existing',
          certainty: 'probable',
          evidenceIds: obj.photoIds ?? [],
        });
        break;
      case 'cylinder':
        stores.push({
          storeId: `store-${storeCounter++}`,
          label: 'Hot Water Cylinder',
          type: 'cylinder',
          roomId: objRoomId,
          status: 'existing',
          certainty: 'probable',
          evidenceIds: obj.photoIds ?? [],
        });
        break;
      case 'thermostat':
        controls.push({
          controlId: `ctrl-${controlCounter++}`,
          label: 'Thermostat',
          type: 'thermostat',
          roomId: objRoomId,
          status: 'existing',
          certainty: 'probable',
          evidenceIds: obj.photoIds ?? [],
        });
        break;
      default:
        break;
    }
  }

  // ── Evidence markers from photos ──────────────────────────────────────────
  const evidenceMarkers: SpatialEvidenceMarkerV1[] = [];
  let evidenceCounter = 0;

  for (const photo of session.photos ?? []) {
    evidenceMarkers.push({
      evidenceId: `ev-${evidenceCounter++}`,
      kind: 'photo',
      label: `Photo ${evidenceCounter}`,
      roomId: photo.roomId,
      entityId: photo.objectId,
      sourceRef: photo.photoId,
    });
  }

  // ── Evidence markers from note markers ─────────────────────────────────────
  for (const note of session.notes ?? []) {
    evidenceMarkers.push({
      evidenceId: `ev-${evidenceCounter++}`,
      kind: 'note',
      label: note.text ?? `Note ${evidenceCounter}`,
      roomId: note.roomId,
      sourceRef: note.markerId,
    });
  }

  if (rooms.length === 0) {
    warnings.push('No rooms found in session capture — spatial model will be empty.');
  }

  const model: SpatialTwinModelV1 = {
    version: '1.0',
    propertyId,
    sourceSessionId: session.sessionId,
    spatial: {
      version: '1.0',
      propertyId,
      sourceSessionId: session.sessionId,
      rooms,
      zones,
      emitters,
      openings: [],
      boundaries: [],
    },
    heatSources,
    stores,
    controls,
    pipeRuns: [],
    evidenceMarkers,
  };

  const status = warnings.length > 0 ? 'success_with_warnings' : 'success';
  return { status, model, warnings };
}
