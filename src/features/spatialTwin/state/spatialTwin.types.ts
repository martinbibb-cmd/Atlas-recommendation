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

export type SpatialTwinViewDimension = '2d' | '3d';

export interface SpatialTwinFeatureState {
  visitId: string;
  sourceSessionId?: string;
  model: SpatialTwinModelV1 | null;
  patchHistory: AtlasSpatialPatchV1[];
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  mode: SpatialTwinMode;
  viewDimension: SpatialTwinViewDimension;
  activeLeftRailSection: SpatialTwinLeftRailSection;
  activeOverlayIds: string[];
  importState: SpatialTwinImportState;
  dirty: boolean;
  lastError?: string;

  // ── Scenario branching ─────────────────────────────────────────────────────

  /** Saved design scenarios layered on the base model. */
  scenarios: SpatialTwinScenarioV1[];
  /**
   * Full ordered patch objects for each scenario, keyed by scenarioId.
   * Apply these in order on top of `model` to project any given scenario.
   */
  patchesByScenario: Record<string, AtlasSpatialPatchV1[]>;
  /** Currently active/viewed scenario ID (null → base model view). */
  activeScenarioId: string | null;
}

export interface SpatialTwinDeltaSummary {
  addedEntities: Array<{ kind: string; label: string }>;
  removedEntities: Array<{ kind: string; label: string }>;
  changedEntities: Array<{ kind: string; label: string; change: string }>;
  totalChanges: number;
}

// ─── Scenario branching ───────────────────────────────────────────────────────

/**
 * The intent that categorises a design scenario.
 *
 * best_fit            — recommended system, best overall match.
 * low_disruption      — minimises installation disruption.
 * budget              — lowest upfront cost path.
 * future_ready        — heat-pump pathway or future-upgrade strategy.
 * hot_water_priority  — optimised for DHW performance.
 * custom              — engineer-defined option without a preset tag.
 */
export type ScenarioIntent =
  | 'best_fit'
  | 'low_disruption'
  | 'budget'
  | 'future_ready'
  | 'hot_water_priority'
  | 'custom';

/**
 * A named design option layered on top of the base SpatialTwinModelV1.
 *
 * Each scenario stores only the IDs of the patches that belong to it.
 * The full patch objects are stored in `patchesByScenario` keyed by scenarioId
 * so that patches can be replayed on demand without duplicating the base model.
 */
export interface SpatialTwinScenarioV1 {
  scenarioId: string;
  name: string;
  description?: string;
  intent: ScenarioIntent;

  /** Ordered list of patch IDs belonging to this scenario. */
  patchIds: string[];

  createdAt: string;
  updatedAt: string;

  /** True when this scenario has been promoted as the recommended design. */
  isRecommended?: boolean;
  /** True when the customer has actively selected this option. */
  isSelectedByUser?: boolean;
  /** When false the scenario is hidden from the generated report. */
  includeInReport?: boolean;
}

/**
 * Scenario-aware extension of the spatial twin feature state.
 *
 * baseModel is the canonical captured/edited property truth.
 * Each scenario's view is baseModel + its own patches replayed in order.
 */
export interface SpatialTwinScenarioStateV1 {
  baseModel: SpatialTwinModelV1;
  scenarios: SpatialTwinScenarioV1[];
  /** Full patch objects keyed by scenarioId. */
  patchesByScenario: Record<string, AtlasSpatialPatchV1[]>;
  activeScenarioId: string | null;
}
