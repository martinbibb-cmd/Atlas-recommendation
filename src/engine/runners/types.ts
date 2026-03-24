/**
 * types.ts — PR2: Canonical intermediate result shape for topology-aware family runners.
 *
 * `FamilyRunnerResult` is the output contract shared by all four family runners.
 * It groups module outputs into semantic buckets (hydraulic, dhw, heating, efficiency,
 * lifecycle, advisories) so that the question "which family is responsible for this
 * behaviour?" has a clear answer in code.
 *
 * Design rules:
 *   - `topology` carries the PR1 topology contract and implicitly identifies the family.
 *   - Fields owned by the combi runner are marked with comments; they are absent (undefined)
 *     in hydronic runners.
 *   - Fields owned by stored-system runners are marked similarly; they are absent in the
 *     combi runner.
 *   - Common fields (hydraulic, heating, efficiency, lifecycle, advisories) are always present.
 *
 * Backward-compat note:
 *   `runEngine()` maps this result back to the legacy `FullEngineResultCore` shape.
 *   Fields not populated by the chosen runner are computed in `runEngine()` as fallbacks
 *   so that existing callers do not break.  Those fallbacks will be removed in later PRs
 *   as callers migrate to the runner-level result.
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
   * DHW module results.
   * Ownership is family-specific; only the correct runner populates each field.
   */
  readonly dhw: {
    /** Owned by the combi runner; `undefined` in hydronic runners. */
    readonly combiDhwV1?: CombiDhwV1Result;
    /** Owned by stored-system runners; `undefined` in the combi runner. */
    readonly storedDhwV1?: StoredDhwV1Result;
    /** Owned by stored-system runners when a Mixergy cylinder is present. */
    readonly mixergy?: MixergyResult;
    /** Mixergy legacy settings; present when `dhwTankType === 'mixergy'`. */
    readonly mixergyLegacy?: MixergyLegacyResult;
  };

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
