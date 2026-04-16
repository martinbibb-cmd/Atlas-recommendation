import type { SpatialTwinOverlay, OverlayRenderMetadata } from './overlayRegistry';
import type { SpatialTwinFeatureState } from '../state/spatialTwin.types';
import { registerOverlay } from './overlayRegistry';

// Heat loss bands based on floor area heuristic
// Small rooms (<10 m²) → high loss; medium rooms (<20 m²) → medium loss; large rooms (≥20 m²) → low loss
function heatLossColor(floorAreaM2: number | undefined): string {
  if (floorAreaM2 == null) return '#e2e8f0';
  if (floorAreaM2 < 10) return '#fca5a5'; // high loss — red band
  if (floorAreaM2 < 20) return '#fde68a'; // medium loss — amber
  return '#86efac';                         // low loss — green
}

export const roomHeatLossOverlay: SpatialTwinOverlay = {
  id: 'roomHeatLoss',
  label: 'Room Heat Loss',

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
      entityColors[room.roomId] = heatLossColor(zone?.floorAreaM2);
    }

    return {
      entityColors,
      legendItems: [
        { color: '#fca5a5', label: 'High heat loss (< 10 m²)' },
        { color: '#fde68a', label: 'Medium heat loss (10–20 m²)' },
        { color: '#86efac', label: 'Low heat loss (> 20 m²)' },
        { color: '#e2e8f0', label: 'Area unknown' },
      ],
    };
  },
};

registerOverlay(roomHeatLossOverlay);
