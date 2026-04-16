import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';
import type { AtlasSpatialPatchV1 } from '../state/spatialTwin.types';

export function applyLocalSpatialPatch(
  model: SpatialTwinModelV1,
  patch: AtlasSpatialPatchV1,
): SpatialTwinModelV1 {
  const { entityId, entityKind, operation, payload } = patch;

  switch (entityKind) {
    case 'room': {
      const rooms = model.spatial.rooms.map((r) => {
        if (r.roomId !== entityId) return r;
        if (operation === 'set_label' && typeof payload['label'] === 'string') {
          return { ...r, label: payload['label'] };
        }
        if (operation === 'set_status' && typeof payload['status'] === 'string') {
          return { ...r, status: payload['status'] as 'draft' | 'complete' };
        }
        if (operation === 'soft_remove') {
          return { ...r, status: 'draft' as const };
        }
        return r;
      });
      return { ...model, spatial: { ...model.spatial, rooms } };
    }

    case 'emitter': {
      const emitters = model.spatial.emitters.map((e) => {
        if (e.emitterId !== entityId) return e;
        if (operation === 'set_label') return e;
        return e;
      });
      return { ...model, spatial: { ...model.spatial, emitters } };
    }

    case 'heatSource': {
      const heatSources = model.heatSources.map((h) => {
        if (h.heatSourceId !== entityId) return h;
        if (operation === 'set_label' && typeof payload['label'] === 'string') {
          return { ...h, label: payload['label'] };
        }
        if (operation === 'set_status' && typeof payload['status'] === 'string') {
          return { ...h, status: payload['status'] as 'existing' | 'proposed' | 'removed' | 'unchanged' };
        }
        if (operation === 'set_certainty' && typeof payload['certainty'] === 'string') {
          return { ...h, certainty: payload['certainty'] as 'confirmed' | 'probable' | 'inferred' | 'unknown' };
        }
        if (operation === 'attach_evidence' && typeof payload['evidenceId'] === 'string') {
          return { ...h, evidenceIds: [...h.evidenceIds, payload['evidenceId']] };
        }
        if (operation === 'soft_remove') {
          return { ...h, status: 'removed' as const };
        }
        return h;
      });
      return { ...model, heatSources };
    }

    case 'store': {
      const stores = model.stores.map((s) => {
        if (s.storeId !== entityId) return s;
        if (operation === 'set_label' && typeof payload['label'] === 'string') {
          return { ...s, label: payload['label'] };
        }
        if (operation === 'soft_remove') {
          return { ...s, status: 'removed' as const };
        }
        return s;
      });
      return { ...model, stores };
    }

    case 'pipeRun': {
      const pipeRuns = model.pipeRuns.map((p) => {
        if (p.pipeRunId !== entityId) return p;
        if (operation === 'set_label' && typeof payload['label'] === 'string') {
          return { ...p, label: payload['label'] };
        }
        if (operation === 'set_geometry' && Array.isArray(payload['route'])) {
          return { ...p, route: payload['route'] as Array<{ x: number; y: number }> };
        }
        if (operation === 'soft_remove') {
          return { ...p, status: 'removed' as const };
        }
        return p;
      });
      return { ...model, pipeRuns };
    }

    case 'control': {
      const controls = model.controls.map((c) => {
        if (c.controlId !== entityId) return c;
        if (operation === 'set_label' && typeof payload['label'] === 'string') {
          return { ...c, label: payload['label'] };
        }
        if (operation === 'soft_remove') {
          return { ...c, status: 'removed' as const };
        }
        return c;
      });
      return { ...model, controls };
    }

    case 'zone':
    case 'opening':
    case 'boundary':
      // Structural changes: return model unchanged for now
      return model;

    default:
      return model;
  }
}
