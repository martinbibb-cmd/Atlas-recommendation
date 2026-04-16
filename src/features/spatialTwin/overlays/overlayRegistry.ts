import type { SpatialTwinFeatureState } from '../state/spatialTwin.types';

export interface OverlayRenderMetadata {
  entityColors: Record<string, string>;
  legendItems: Array<{ color: string; label: string }>;
}

export interface SpatialTwinOverlay {
  id: string;
  label: string;
  isAvailable(state: SpatialTwinFeatureState): boolean;
  getMetadata(state: SpatialTwinFeatureState): OverlayRenderMetadata;
}

const overlays: SpatialTwinOverlay[] = [];

export function registerOverlay(overlay: SpatialTwinOverlay): void {
  overlays.push(overlay);
}

export function getOverlay(id: string): SpatialTwinOverlay | undefined {
  return overlays.find((o) => o.id === id);
}

export function getAllOverlays(): SpatialTwinOverlay[] {
  return [...overlays];
}
