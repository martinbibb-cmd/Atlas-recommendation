import type { SpatialTwinOverlay, OverlayRenderMetadata } from './overlayRegistry';
import type { SpatialTwinFeatureState } from '../state/spatialTwin.types';
import { registerOverlay } from './overlayRegistry';

// Pipe stress: flag pipe runs with unknown or small diameter
// diameterMm < 15 → potential sizing constraint
// diameterMm unknown → flag for review
export const pipeStressOverlay: SpatialTwinOverlay = {
  id: 'pipeStress',
  label: 'Pipe Stress',

  isAvailable(state: SpatialTwinFeatureState): boolean {
    return state.model != null && state.model.pipeRuns.length > 0;
  },

  getMetadata(state: SpatialTwinFeatureState): OverlayRenderMetadata {
    if (state.model == null) {
      return { entityColors: {}, legendItems: [] };
    }

    const entityColors: Record<string, string> = {};

    for (const pipe of state.model.pipeRuns) {
      if (pipe.diameterMm == null) {
        entityColors[pipe.pipeRunId] = '#fde68a'; // unknown — amber
      } else if (pipe.diameterMm < 15) {
        entityColors[pipe.pipeRunId] = '#fca5a5'; // constraint — red
      } else {
        entityColors[pipe.pipeRunId] = '#86efac'; // adequate — green
      }
    }

    return {
      entityColors,
      legendItems: [
        { color: '#fca5a5', label: 'Undersized (< 15 mm)' },
        { color: '#fde68a', label: 'Diameter unknown' },
        { color: '#86efac', label: 'Adequate sizing' },
      ],
    };
  },
};

registerOverlay(pipeStressOverlay);
