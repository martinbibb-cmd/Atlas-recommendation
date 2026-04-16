import type { SpatialTwinOverlay, OverlayRenderMetadata } from './overlayRegistry';
import type { SpatialTwinFeatureState } from '../state/spatialTwin.types';
import { registerOverlay } from './overlayRegistry';

/**
 * Room heat loss overlay.
 *
 * Colours rooms by a floor-area proxy band.  This is an indicative
 * visualisation aid — it does NOT compute real heat loss.  Accurate heat
 * loss derivation requires fabric U-values, exposed perimeter, window areas,
 * and external design temperature, none of which are guaranteed in the spatial
 * twin at this stage.  Use this overlay to spot rooms that may warrant closer
 * inspection, not as a physics result.
 *
 * Bands: small room (< 10 m²) → higher scrutiny (red); medium (10–20 m²) →
 * amber; large (≥ 20 m²) → green; unknown area → grey.
 */
function heatLossColor(floorAreaM2: number | undefined): string {
  if (floorAreaM2 == null) return '#e2e8f0';
  if (floorAreaM2 < 10) return '#fca5a5'; // small — higher scrutiny band
  if (floorAreaM2 < 20) return '#fde68a'; // medium
  return '#86efac';                         // large
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
        { color: '#fca5a5', label: 'Small room (< 10 m²) — review' },
        { color: '#fde68a', label: 'Medium room (10–20 m²)' },
        { color: '#86efac', label: 'Large room (> 20 m²)' },
        { color: '#e2e8f0', label: 'Area unknown' },
      ],
    };
  },
};

registerOverlay(roomHeatLossOverlay);
