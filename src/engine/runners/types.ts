/**
 * types.ts — PR3: Canonical intermediate result shape for topology-aware family runners.
 *
 * `FamilyRunnerResult` is the output contract shared by all four family runners.
 * It groups module outputs into semantic buckets (hydraulic, dhw, heating, efficiency,
 * lifecycle, advisories) so that the question "which family is responsible for this
 * behaviour?" has a clear answer in code.
 *
 * Design rules:
 *   - `topology` carries the PR1 topology contract and implicitly identifies the family.
 *   - `dhw.kind` is the canonical discriminant for DHW ownership: 'direct_combi' for the
 *     combi runner, 'stored' for all hydronic runners.
 *   - `dhw.sourcePath` identifies which runner populated the envelope (e.g. 'combi_runner').
 *   - Fields owned by the combi runner are absent (undefined) in hydronic runners.
 *   - Fields owned by stored-system runners are absent in the combi runner.
 *   - Common fields (hydraulic, heating, efficiency, lifecycle, advisories) are always present.
 *
 * Backward-compat note:
 *   `runEngine()` maps this result back to the legacy `FullEngineResultCore` shape.
 *   From PR3 onward, `runEngine()` only backfills DHW fields that are valid for the
 *   selected family — cross-family fallback paths have been removed.
 */

import type {
  NormalizerOutput,
  HydraulicResult,
  HydraulicModuleV1Result,
  SludgeVsScaleResult,
  PressureAnalysis,
  CwsSupplyV1Result,
  CombiDhwV1Result,
  StoredDhwV1Result,
  MixergyResult,
  MixergyLegacyResult,
  LifestyleResult,
  CombiStressResult,
  HeatPumpRegimeModuleV1Result,
  SystemOptimizationResult,
  CondensingStateResult,
  CondensingRuntimeResult,
  SedbukResultV1,
  BoilerSizingResultV1,
  BoilerEfficiencyModelV1,
  MetallurgyEdgeResult,
  SpecEdgeResult,
  LegacyInfrastructureResult,
  FabricModelV1Result,
  SmartTopUpResult,
  SolarBoostResult,
  RedFlagResult,
  BomItem,
  GridFlexResult,
} from '../schema/EngineInputV2_3';
import type { SystemTopology } from '../topology/SystemTopology';

/**
 * Canonical DHW result envelope for a topology-aware family runner.
 *
 * `kind` is the primary discriminant:
 *   - 'direct_combi' — the combi runner populated this envelope; `combiDhwV1` is present,
 *     `storedDhwV1`, `mixergy`, and `mixergyLegacy` must be absent.
 *   - 'stored'        — a hydronic runner populated this envelope; `storedDhwV1` is present,
 *     `combiDhwV1` must be absent.
 *
 * `sourcePath` is a human-readable label identifying the runner that created this envelope.
 * It is intended for defensive assertions and debug output only — do not use it for
 * branching logic in downstream modules.
 */
export interface DhwResultEnvelope {
  /** Family discriminant — which DHW path was used. */
  readonly kind: 'direct_combi' | 'stored';
  /** Runner that produced this envelope (debug/assertion label). */
  readonly sourcePath: string;
  /** Owned by the combi runner; `undefined` in hydronic runners. */
  readonly combiDhwV1?: CombiDhwV1Result;
  /** Owned by stored-system runners; `undefined` in the combi runner. */
  readonly storedDhwV1?: StoredDhwV1Result;
  /** Owned by stored-system runners when a Mixergy cylinder is present. */
  readonly mixergy?: MixergyResult;
  /** Mixergy legacy settings; present when `dhwTankType === 'mixergy'`. */
  readonly mixergyLegacy?: MixergyLegacyResult;
}

/**
 * Canonical intermediate result returned by each topology-aware family runner.
 *
 * Fields tagged "owned by combi runner" are populated exclusively by
 * `runCombiSystemModel` and will be `undefined` in hydronic runners.
 *
 * Fields tagged "owned by stored-system runners" are populated by
 * `runRegularStoredSystemModel`, `runSystemStoredSystemModel`, and
 * `runHeatPumpStoredSystemModel`; they will be `undefined` in the combi runner.
 */
export interface FamilyRunnerResult {
  /**
   * PR1 topology contract.  The `appliance.family` field identifies which runner
   * produced this result; `drawOff` is present only for the combi runner.
   */
  readonly topology: SystemTopology;

  /** Normalizer output (input pre-processing, including unit normalisation). */
  readonly normalizer: NormalizerOutput;

  /** Hydraulic and water-supply analysis (common — present in all runners). */
  readonly hydraulic: {
    readonly safety: HydraulicResult;
    readonly v1: HydraulicModuleV1Result;
    readonly sludgeVsScale: SludgeVsScaleResult;
    readonly pressureAnalysis: PressureAnalysis;
    readonly cwsSupplyV1: CwsSupplyV1Result;
  };

  /**
   * DHW result envelope.
   * `dhw.kind` is the canonical discriminant: 'direct_combi' for the combi runner,
   * 'stored' for all hydronic runners.  Only family-valid fields are populated;
   * cross-family fields are always `undefined`.
   */
  readonly dhw: DhwResultEnvelope;

  /** Heating, demand, and heat-source regime (common — present in all runners). */
  readonly heating: {
    readonly lifestyle: LifestyleResult;
    /** Owned by the combi runner; `undefined` in hydronic runners. */
    readonly combiStress?: CombiStressResult;
    readonly heatPumpRegime: HeatPumpRegimeModuleV1Result;
  };

  /** Plant efficiency and thermal model (common — present in all runners). */
  readonly efficiency: {
    readonly systemOptimization: SystemOptimizationResult;
    readonly condensingState: CondensingStateResult;
    readonly condensingRuntime: CondensingRuntimeResult;
    readonly sedbukV1?: SedbukResultV1;
    readonly sizingV1?: BoilerSizingResultV1;
    readonly boilerEfficiencyModelV1?: BoilerEfficiencyModelV1;
  };

  /** Lifecycle, material, and infrastructure analysis (common — present in all runners). */
  readonly lifecycle: {
    readonly metallurgyEdge: MetallurgyEdgeResult;
    readonly specEdge: SpecEdgeResult;
    readonly legacyInfrastructure: LegacyInfrastructureResult;
    readonly fabricModelV1?: FabricModelV1Result;
    readonly smartTopUp?: SmartTopUpResult;
    readonly solarBoost?: SolarBoostResult;
  };

  /** Advisory flags, BOM, and demand-side outputs (common — present in all runners). */
  readonly advisories: {
    readonly redFlags: RedFlagResult;
    readonly bomItems: BomItem[];
    readonly gridFlex?: GridFlexResult;
  };
}
