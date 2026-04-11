/**
 * atlasPropertyAdapter.types.ts
 *
 * Local type helpers for the AtlasProperty adapter layer.
 *
 * These types live in Atlas Recommendation only — they are adapter-seam
 * utilities, not shared contracts.  They must not be pushed upstream into
 * @atlas/contracts, which owns only the canonical AtlasPropertyV1 shape.
 */

import type {
  AtlasPropertyV1,
  BuildingModelV1,
  HouseholdModelV1,
  CurrentSystemModelV1,
  EvidenceModelV1,
  DerivedModelV1,
} from '@atlas/contracts';

// ─── AtlasPropertyPatch ───────────────────────────────────────────────────────

/**
 * A partial AtlasPropertyV1 used as the output of adapter/patch functions.
 *
 * Sub-models that are required on AtlasPropertyV1 (building, household,
 * currentSystem, evidence) are made Partial here so that each adapter can
 * emit only the fields it has data for.
 *
 * Use mergeAtlasPropertyPatches() to combine multiple patches before passing
 * the result to a full AtlasPropertyV1 store.
 */
export type AtlasPropertyPatch = Partial<
  Omit<AtlasPropertyV1, 'building' | 'household' | 'currentSystem' | 'evidence' | 'derived'>
> & {
  building?: Partial<BuildingModelV1>;
  household?: Partial<HouseholdModelV1>;
  currentSystem?: Partial<CurrentSystemModelV1>;
  evidence?: Partial<EvidenceModelV1>;
  derived?: Partial<DerivedModelV1>;
};

// ─── EngineRunMeta ────────────────────────────────────────────────────────────

/**
 * Metadata about an engine run — passed alongside EngineOutputV1 to
 * engineRunToDerivedSnapshot() so the snapshot can carry run identifiers and
 * the inputs the engine consumed.
 */
export interface EngineRunMeta {
  /** Stable identifier for this engine run (e.g. UUID or ISO timestamp + hash). */
  runId: string;
  /** ISO-8601 timestamp of when the run completed. */
  ranAt?: string;
  /**
   * The engine input that was actually consumed.
   * Used to populate derived.heatLoss, derived.hydraulics, and
   * derived.engineInputSnapshot without requiring the snapshot to hold a full
   * EngineOutputV1 graph.
   */
  usedInput?: Record<string, unknown>;
}

// ─── AtlasPropertyCompletenessSummary ────────────────────────────────────────

/**
 * Completeness report produced by atlasPropertyCompletenessSummary().
 *
 * Allows UI and engine-bridge code to understand which sections have enough
 * data to proceed with simulation and which still need attention.
 */
export interface AtlasPropertyCompletenessSummary {
  /** Overall readiness — can the engine run with current data? */
  readyForSimulation: boolean;
  /** Per-section flags. */
  sections: {
    property: boolean;
    household: boolean;
    currentSystem: boolean;
    building: boolean;
    /** At least one derived heat-loss figure is present. */
    heatLoss: boolean;
    /** At least one hydraulic measurement is present. */
    hydraulics: boolean;
  };
  /** Fields that are missing and would improve simulation quality. */
  missingFields: string[];
  /** Fields that are present and give high confidence. */
  highConfidenceFields: string[];
}
