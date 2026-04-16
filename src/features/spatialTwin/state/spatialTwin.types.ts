import type { AtlasSpatialModelV1 } from '../../atlasSpatial/atlasSpatialModel.types';

export type SpatialTwinMode = 'current' | 'proposed' | 'compare';

export type SpatialTwinLeftRailSection =
  | 'house'
  | 'currentSystem'
  | 'proposedSystem'
  | 'evidence'
  | 'overlays'
  | 'compare'
  | 'physicsTrace';

export type SpatialTwinImportState = 'idle' | 'loading' | 'ready' | 'failed';

export interface AtlasSpatialPatchV1 {
  patchId: string;
  entityId: string;
  entityKind:
    | 'room'
    | 'zone'
    | 'emitter'
    | 'opening'
    | 'boundary'
    | 'heatSource'
    | 'store'
    | 'pipeRun'
    | 'control';
  operation:
    | 'set_label'
    | 'set_role'
    | 'set_status'
    | 'set_certainty'
    | 'attach_evidence'
    | 'set_geometry'
    | 'add_entity'
    | 'soft_remove'
    | 'set_construction';
  payload: Record<string, unknown>;
  appliedAt: string;
  sourceMode: SpatialTwinMode;
}

export type EntityCertainty = 'confirmed' | 'probable' | 'inferred' | 'unknown';

export type EntityStatus = 'existing' | 'proposed' | 'removed' | 'unchanged';

export interface SpatialHeatSourceV1 {
  heatSourceId: string;
  label: string;
  type: 'combi_boiler' | 'system_boiler' | 'heat_pump' | 'back_boiler' | 'other';
  roomId?: string;
  status: EntityStatus;
  certainty: EntityCertainty;
  evidenceIds: string[];
  outputKw?: number;
  proposedOutputKw?: number;
}

export interface SpatialStoreV1 {
  storeId: string;
  label: string;
  type: 'cylinder' | 'thermal_store' | 'buffer' | 'other';
  roomId?: string;
  status: EntityStatus;
  certainty: EntityCertainty;
  evidenceIds: string[];
  capacityLitres?: number;
}

export interface SpatialControlV1 {
  controlId: string;
  label: string;
  type: 'thermostat' | 'programmer' | 'smart_control' | 'zone_valve' | 'trvs' | 'other';
  roomId?: string;
  status: EntityStatus;
  certainty: EntityCertainty;
  evidenceIds: string[];
}

export interface SpatialPipeRunV1 {
  pipeRunId: string;
  label: string;
  diameterMm?: number;
  route: Array<{ x: number; y: number }>;
  status: EntityStatus;
  certainty: EntityCertainty;
  evidenceIds: string[];
}

export interface SpatialEvidenceMarkerV1 {
  evidenceId: string;
  kind: 'photo' | 'transcript' | 'object_pin' | 'note';
  label: string;
  roomId?: string;
  entityId?: string;
  position?: { x: number; y: number };
  sourceRef?: string;
}

export interface SpatialTwinModelV1 {
  version: '1.0';
  propertyId: string;
  sourceSessionId?: string;
  spatial: AtlasSpatialModelV1;
  heatSources: SpatialHeatSourceV1[];
  stores: SpatialStoreV1[];
  controls: SpatialControlV1[];
  pipeRuns: SpatialPipeRunV1[];
  evidenceMarkers: SpatialEvidenceMarkerV1[];
}

export interface SpatialTwinFeatureState {
  visitId: string;
  sourceSessionId?: string;
  model: SpatialTwinModelV1 | null;
  patchHistory: AtlasSpatialPatchV1[];
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  mode: SpatialTwinMode;
  activeLeftRailSection: SpatialTwinLeftRailSection;
  activeOverlayIds: string[];
  importState: SpatialTwinImportState;
  dirty: boolean;
  lastError?: string;
}

export interface SpatialTwinDeltaSummary {
  addedEntities: Array<{ kind: string; label: string }>;
  removedEntities: Array<{ kind: string; label: string }>;
  changedEntities: Array<{ kind: string; label: string; change: string }>;
  totalChanges: number;
}
