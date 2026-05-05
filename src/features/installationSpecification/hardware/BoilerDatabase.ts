/**
 * BoilerDatabase.ts
 *
 * Hardware Selection catalogue used by the Hardware Selection Drill-Down UI.
 *
 * Structure:
 *   Brand → Series → Models (with kW output and W×D×H dimensions in mm).
 *
 * Data source:
 *   All model data is now derived from the shared hardware contracts layer at
 *   src/contracts/hardware/index.ts (backed by MasterRegistry.json).
 *   When @atlas/contracts ships a hardware sub-path, that import becomes a
 *   single-line re-export swap in src/contracts/hardware/index.ts.
 *
 * Design rules:
 *   - No engine calls, no mutations, no React dependencies.
 *   - Data is intentionally representative — actual manufacturer specs should
 *     be verified against the current product datasheet before use in quotes.
 *   - Dimensions are W×D×H in millimetres (matching ApplianceDimensionsV1).
 *   - `outputKw` is the nominal maximum DHW / heating output.
 */

import { MASTER_REGISTRY, MASTER_REGISTRY_BY_ID } from '../../../contracts/hardware';
import type { ApplianceDefinitionV1 } from '../../../contracts/hardware';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single boiler model with its rated output and physical dimensions. */
export interface BoilerModelEntry {
  /** Unique model identifier within the series. */
  readonly modelId: string;
  /** Display name shown in the spec table. */
  readonly modelName: string;
  /** Nominal heating / DHW output in kW. */
  readonly outputKw: number;
  /** Physical height in millimetres. */
  readonly heightMm: number;
  /** Physical width in millimetres. */
  readonly widthMm: number;
  /** Physical depth in millimetres. */
  readonly depthMm: number;
}

/** A series of boilers from a single brand (e.g. "Greenstar 4000"). */
export interface BoilerSeriesEntry {
  /** Unique series identifier within the brand. */
  readonly seriesId: string;
  /** Display name shown in the series list. */
  readonly seriesName: string;
  /** Short description shown below the series name. */
  readonly seriesDescription: string;
  /** Models within this series. */
  readonly models: readonly BoilerModelEntry[];
}

/** A boiler manufacturer brand. */
export interface BoilerBrandEntry {
  /** Unique brand identifier (slug). */
  readonly brandId: string;
  /** Display name shown in the brand grid. */
  readonly brandName: string;
  /**
   * Path to the brand logo asset (relative to public/).
   * Null when no logo asset is available.
   */
  readonly logoPath: string | null;
  /** Series offered by this brand. */
  readonly series: readonly BoilerSeriesEntry[];
}

// ─── Registry → UI adapter ────────────────────────────────────────────────────

/** Map an ApplianceDefinitionV1 to the flat BoilerModelEntry shape. */
function toModelEntry(def: ApplianceDefinitionV1): BoilerModelEntry {
  return {
    modelId:   def.modelId,
    modelName: def.modelName,
    outputKw:  def.outputKw,
    heightMm:  def.dimensions.heightMm,
    widthMm:   def.dimensions.widthMm,
    depthMm:   def.dimensions.depthMm,
  };
}

/**
 * Build the brand → series → model tree consumed by the Hardware Selection UI
 * from the flat MASTER_REGISTRY.  Insertion order from the JSON is preserved
 * so the brand grid and series lists appear in a predictable sequence.
 */
function buildBoilerModelsDB(): readonly BoilerBrandEntry[] {
  const brandMap = new Map<string, {
    brandId: string;
    brandName: string;
    logoPath: string | null;
    seriesMap: Map<string, { seriesId: string; seriesName: string; seriesDescription: string; models: BoilerModelEntry[] }>;
  }>();

  for (const def of MASTER_REGISTRY) {
    let brand = brandMap.get(def.brand);
    if (brand == null) {
      brand = {
        brandId:   def.brand,
        brandName: def.brandName,
        logoPath:  def.logoPath ?? null,
        seriesMap: new Map(),
      };
      brandMap.set(def.brand, brand);
    }

    let series = brand.seriesMap.get(def.seriesId);
    if (series == null) {
      series = {
        seriesId:          def.seriesId,
        seriesName:        def.seriesName,
        seriesDescription: def.seriesDescription ?? '',
        models:            [],
      };
      brand.seriesMap.set(def.seriesId, series);
    }

    series.models.push(toModelEntry(def));
  }

  return Array.from(brandMap.values()).map((b) => ({
    brandId:   b.brandId,
    brandName: b.brandName,
    logoPath:  b.logoPath,
    series: Array.from(b.seriesMap.values()).map((s) => ({
      seriesId:          s.seriesId,
      seriesName:        s.seriesName,
      seriesDescription: s.seriesDescription,
      models:            s.models,
    })),
  }));
}

// ─── Database ─────────────────────────────────────────────────────────────────

/**
 * BOILER_MODELS_DB
 *
 * Brand → series → model catalogue derived from the shared MasterRegistry.
 * Consumers that need physical dimensions or clearance rules should use the
 * MASTER_REGISTRY / MASTER_REGISTRY_BY_ID exports from the contracts layer
 * directly, which include the full ApplianceDefinitionV1 (with clearanceRules).
 */
export const BOILER_MODELS_DB: readonly BoilerBrandEntry[] = buildBoilerModelsDB();

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Returns all brands in the database (for Level 1 brand grid).
 */
export function getBrandsFromDB(): readonly BoilerBrandEntry[] {
  return BOILER_MODELS_DB;
}

/**
 * Returns all series for a given brandId (for Level 2 series list).
 * Returns an empty array if the brand is not found.
 */
export function getSeriesForBrand(brandId: string): readonly BoilerSeriesEntry[] {
  return BOILER_MODELS_DB.find((b) => b.brandId === brandId)?.series ?? [];
}

/**
 * Returns all models for a given brandId + seriesId (for Level 3 spec table).
 * Returns an empty array if the brand or series is not found.
 */
export function getModelsForSeries(brandId: string, seriesId: string): readonly BoilerModelEntry[] {
  const brand = BOILER_MODELS_DB.find((b) => b.brandId === brandId);
  if (brand == null) return [];
  return brand.series.find((s) => s.seriesId === seriesId)?.models ?? [];
}

/**
 * Looks up a specific model by brandId, seriesId, and modelId.
 * Returns undefined if not found.
 */
export function findBoilerModel(
  brandId: string,
  seriesId: string,
  modelId: string,
): BoilerModelEntry | undefined {
  return getModelsForSeries(brandId, seriesId).find((m) => m.modelId === modelId);
}

/**
 * Looks up a full ApplianceDefinitionV1 by modelId.
 * Includes clearanceRules and raw dimensions for use by BoilerSizingModule
 * and any future Ghost Box integration.
 * Returns undefined if the modelId is not in the registry.
 */
export { MASTER_REGISTRY_BY_ID as APPLIANCE_REGISTRY_BY_ID };
