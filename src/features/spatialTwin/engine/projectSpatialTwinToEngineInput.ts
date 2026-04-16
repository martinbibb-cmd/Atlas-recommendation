import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

export function projectSpatialTwinToEngineInput(
  spatial: SpatialTwinModelV1,
  survey: Partial<EngineInputV2_3>,
  mode: 'current' | 'proposed',
): Partial<EngineInputV2_3> {
  const result: Partial<EngineInputV2_3> = { ...survey };

  // ── Heat source → boiler type ─────────────────────────────────────────────
  const activeSources =
    mode === 'current'
      ? spatial.heatSources.filter(
          (h) => h.status === 'existing' || h.status === 'unchanged',
        )
      : spatial.heatSources.filter((h) => h.status !== 'removed');

  const primarySource = activeSources[0];
  if (primarySource != null) {
    const typeMap: Record<string, EngineInputV2_3['currentHeatSourceType']> = {
      combi_boiler: 'combi',
      system_boiler: 'system',
      heat_pump: 'ashp',
      back_boiler: 'regular',
      other: 'other',
    };
    result.currentHeatSourceType = typeMap[primarySource.type] ?? 'combi';
  }

  // ── Cylinder presence ─────────────────────────────────────────────────────
  const activeStores =
    mode === 'current'
      ? spatial.stores.filter((s) => s.status === 'existing' || s.status === 'unchanged')
      : spatial.stores.filter((s) => s.status !== 'removed');

  if (activeStores.length > 0) {
    const cylinder = activeStores.find((s) => s.type === 'cylinder');
    if (cylinder != null && result.dhwStorageRegime == null) {
      result.dhwStorageRegime = 'boiler_cylinder';
    }
  }

  // ── Emitter count ──────────────────────────────────────────────────────────
  const emitters = spatial.spatial.emitters;
  if (emitters.length > 0 && result.radiatorCount == null) {
    result.radiatorCount = emitters.filter((e) => e.type === 'radiator').length;
  }

  // ── Room count → occupancy heuristic ──────────────────────────────────────
  // Approximate ratio of bedroom-like rooms to total rooms in a UK home.
  // UK average: roughly 2 of 3–4 habitable rooms are bedrooms/reception rooms.
  // This is a coarse heuristic only; survey data takes precedence.
  const BEDROOM_TO_ROOM_RATIO = 0.6;
  const roomCount = spatial.spatial.rooms.length;
  if (roomCount > 0 && result.occupancyCount == null) {
    result.occupancyCount = Math.max(1, Math.round(roomCount * BEDROOM_TO_ROOM_RATIO));
  }

  return result;
}
