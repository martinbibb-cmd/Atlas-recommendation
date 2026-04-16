/**
 * ScenarioSynthesisModel.ts — PR6: Scenario-aware synthesis types.
 *
 * Defines the derived types for running, ranking, and comparing design scenarios.
 *
 * Design rules:
 *   1. All types in this file are derived only — never canonical stored truth.
 *   2. ScenarioResultEnvelope is the unit of one scenario engine run.
 *   3. ScenarioSynthesisResult is the complete ranked output across all scenarios.
 *   4. ScenarioComparisonMatrix is the side-by-side view for portal/report surfaces.
 *   5. recommendedScenarioId and selectedScenarioId are always distinct concepts.
 *      - recommended: Atlas-suggested or engineer-promoted best-fit.
 *      - selected:    Customer-selected option (may differ from recommended).
 */

import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { SpatialTwinDeltaSummary } from '../state/spatialTwin.types';

// ─── Suitability ─────────────────────────────────────────────────────────────

/**
 * Suitability verdict for a design scenario as a whole.
 *
 *   recommended          — best overall fit for this property; Atlas suggests this.
 *   possible_with_caveats — feasible but has notable constraints or trade-offs.
 *   less_suited          — significant limiters; not the preferred choice.
 */
export type ScenarioSuitability =
  | 'recommended'
  | 'possible_with_caveats'
  | 'less_suited';

// ─── Per-scenario summary ─────────────────────────────────────────────────────

/**
 * Customer-safe and engineer-usable summary derived from one scenario engine run.
 *
 * This is a derived presentation surface — it is computed from EngineOutputV1
 * and must never be independently stored or edited.
 */
export interface ScenarioRecommendationSummary {
  /** The scenario this summary belongs to. */
  readonly scenarioId: string;
  /** One-line headline describing the recommended system for this scenario. */
  readonly headline: string;
  /** Primary physics-backed reason Atlas selected this scenario's configuration. */
  readonly primaryReason: string;
  /** Positive attributes of this scenario (up to 4). */
  readonly strengths: readonly string[];
  /** Known trade-offs or constraints the customer should be aware of. */
  readonly tradeoffs: readonly string[];
  /** Works that must be completed as part of this installation. */
  readonly requiredWork: readonly string[];
  /** Safety and compliance items required for this installation (e.g. G3, wiring). */
  readonly requiredSafetyAndCompliance: readonly string[];
  /** Likely upgrades that would further improve the outcome. */
  readonly upgrades: readonly string[];
  /** Suitability verdict for this scenario. */
  readonly suitability: ScenarioSuitability;
}

// ─── ScenarioResultEnvelope ───────────────────────────────────────────────────

/**
 * Derived bundle for one scenario: engine inputs, engine outputs, spatial diff,
 * and the human-readable recommendation summary.
 *
 * This is the unit of one complete scenario run — it is derived only and must
 * never be treated as canonical property truth.
 */
export interface ScenarioResultEnvelope {
  /** The scenario this envelope belongs to. */
  readonly scenarioId: string;
  /** Engine input used to produce this run. */
  readonly engineInput: EngineInputV2_3;
  /** Engine output produced by this run. */
  readonly engineOutput: EngineOutputV1;
  /** Spatial differences between this scenario and the base model. */
  readonly deltaSummary: SpatialTwinDeltaSummary;
  /** Human-readable recommendation summary derived from the engine output. */
  readonly summary: ScenarioRecommendationSummary;
}

// ─── Comparison matrix ────────────────────────────────────────────────────────

/**
 * A single row in the scenario comparison matrix.
 */
export interface ScenarioComparisonMatrixRow {
  /** Human-readable label for this comparison dimension. */
  readonly label: string;
  /** Value per scenario, keyed by scenarioId. */
  readonly values: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Side-by-side comparison of all included scenarios across key dimensions.
 *
 * Used by portal and report surfaces to render comparison cards and tables.
 */
export interface ScenarioComparisonMatrix {
  /** Ordered list of scenario IDs included in this matrix (ranked best-first). */
  readonly scenarioIds: readonly string[];
  /** Comparison rows — one per dimension. */
  readonly rows: readonly ScenarioComparisonMatrixRow[];
}

// ─── ScenarioSynthesisResult ──────────────────────────────────────────────────

/**
 * Complete synthesis result across all included design scenarios.
 *
 * Produced by `buildScenarioSynthesis`.
 * Derived only — not canonical stored truth.
 *
 * - `recommendedScenarioId` — Atlas-selected best-fit, or engineer-promoted.
 *   Null when no scenarios are included or all are unsuitable.
 * - `selectedScenarioId`    — Customer-selected option (may differ from recommended).
 *   Null when no scenario has been selected by the user.
 * - `rankedScenarioIds`     — All included scenarios ordered best-first.
 * - `comparisonMatrix`      — Side-by-side comparison for portal/report surfaces.
 * - `explanationsByScenario`— "Why Atlas suggested / did not suggest this" per scenario.
 * - `envelopes`             — Full per-scenario engine result bundles.
 */
export interface ScenarioSynthesisResult {
  readonly recommendedScenarioId: string | null;
  readonly selectedScenarioId: string | null;
  readonly rankedScenarioIds: readonly string[];
  readonly comparisonMatrix: ScenarioComparisonMatrix;
  readonly explanationsByScenario: Readonly<Record<string, string>>;
  readonly envelopes: readonly ScenarioResultEnvelope[];
}
