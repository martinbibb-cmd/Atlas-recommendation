import type { SpatialTwinOverlay, OverlayRenderMetadata } from './overlayRegistry';
import type { SpatialTwinFeatureState } from '../state/spatialTwin.types';
import { registerOverlay } from './overlayRegistry';

// Emitter adequacy: compare emitter count to room count
// Rooms without any emitters are flagged as inadequate
export const emitterAdequacyOverlay: SpatialTwinOverlay = {
  id: 'emitterAdequacy',
  label: 'Emitter Adequacy',

  isAvailable(state: SpatialTwinFeatureState): boolean {
    return state.model != null && state.model.spatial.rooms.length > 0;
  },

  getMetadata(state: SpatialTwinFeatureState): OverlayRenderMetadata {
    if (state.model == null) {
      return { entityColors: {}, legendItems: [] };
    }

    const entityColors: Record<string, string> = {};

    for (const room of state.model.spatial.rooms) {
      const zone = state.model.spatial.zones.find((z) => z.roomId === room.roomId);
      const hasEmitters = (zone?.emitterIds.length ?? 0) > 0;
      entityColors[room.roomId] = hasEmitters ? '#86efac' : '#fca5a5';
    }

    return {
      entityColors,
      legendItems: [
        { color: '#86efac', label: 'Emitters present' },
        { color: '#fca5a5', label: 'No emitters detected' },
      ],
    };
  },
};

registerOverlay(emitterAdequacyOverlay);
