/**
 * BoilerDatabase.ts
 *
 * Static boiler model catalogue used by the Hardware Selection Drill-Down UI.
 *
 * Structure:
 *   Brand → Series → Models (with kW output and H×W×D dimensions in mm).
 *
 * Design rules:
 *   - No engine calls, no mutations, no React dependencies.
 *   - Data is intentionally representative — actual manufacturer specs should
 *     be verified against the current product datasheet before use in quotes.
 *   - Dimensions are H×W×D in millimetres.
 *   - `outputKw` is the nominal maximum DHW / heating output.
 */

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

// ─── Database ─────────────────────────────────────────────────────────────────

/**
 * BOILER_MODELS_DB
 *
 * Representative catalogue of boiler brands, series, and models.
 *
 * Brands included (per problem statement):
 *   Worcester Bosch, Vaillant, Ideal, Glow-worm, Viessmann.
 *
 * Note: specifications are representative. Verify against current datasheets
 * before using in a formal quote.
 */
export const BOILER_MODELS_DB: readonly BoilerBrandEntry[] = [
  // ── Worcester Bosch ─────────────────────────────────────────────────────────
  {
    brandId:   'worcester_bosch',
    brandName: 'Worcester Bosch',
    logoPath:  '/assets/logos/worcester-bosch.png',
    series: [
      {
        seriesId:          'greenstar_4000',
        seriesName:        'Greenstar 4000',
        seriesDescription: 'Wall-hung combi and system boiler range',
        models: [
          { modelId: 'gs4000_25kw', modelName: 'Greenstar 4000 25kW',   outputKw: 25, heightMm: 740, widthMm: 390, depthMm: 338 },
          { modelId: 'gs4000_30kw', modelName: 'Greenstar 4000 30kW',   outputKw: 30, heightMm: 740, widthMm: 390, depthMm: 338 },
          { modelId: 'gs4000_35kw', modelName: 'Greenstar 4000 35kW',   outputKw: 35, heightMm: 740, widthMm: 390, depthMm: 338 },
          { modelId: 'gs4000_40kw', modelName: 'Greenstar 4000 40kW',   outputKw: 40, heightMm: 740, widthMm: 390, depthMm: 338 },
        ],
      },
      {
        seriesId:          'greenstar_8000',
        seriesName:        'Greenstar 8000',
        seriesDescription: 'Premium wall-hung combi range with integrated controls',
        models: [
          { modelId: 'gs8000_30kw', modelName: 'Greenstar 8000 30kW',  outputKw: 30, heightMm: 800, widthMm: 440, depthMm: 360 },
          { modelId: 'gs8000_35kw', modelName: 'Greenstar 8000 35kW',  outputKw: 35, heightMm: 800, widthMm: 440, depthMm: 360 },
          { modelId: 'gs8000_40kw', modelName: 'Greenstar 8000 40kW',  outputKw: 40, heightMm: 800, widthMm: 440, depthMm: 360 },
        ],
      },
      {
        seriesId:          'greenstar_si',
        seriesName:        'Greenstar Si',
        seriesDescription: 'Compact wall-hung combi — ideal for small cupboards',
        models: [
          { modelId: 'gs_si_25kw',  modelName: 'Greenstar Si 25kW',    outputKw: 25, heightMm: 600, widthMm: 280, depthMm: 230 },
          { modelId: 'gs_si_30kw',  modelName: 'Greenstar Si 30kW',    outputKw: 30, heightMm: 600, widthMm: 280, depthMm: 230 },
        ],
      },
    ],
  },

  // ── Vaillant ─────────────────────────────────────────────────────────────────
  {
    brandId:   'vaillant',
    brandName: 'Vaillant',
    logoPath:  '/assets/logos/vaillant.png',
    series: [
      {
        seriesId:          'ecofit_pure',
        seriesName:        'ecoFIT pure',
        seriesDescription: 'Entry-level wall-hung combi and system boiler',
        models: [
          { modelId: 'ecofit_pure_25', modelName: 'ecoFIT pure 25kW',   outputKw: 25, heightMm: 720, widthMm: 380, depthMm: 338 },
          { modelId: 'ecofit_pure_30', modelName: 'ecoFIT pure 30kW',   outputKw: 30, heightMm: 720, widthMm: 380, depthMm: 338 },
          { modelId: 'ecofit_pure_35', modelName: 'ecoFIT pure 35kW',   outputKw: 35, heightMm: 720, widthMm: 380, depthMm: 338 },
        ],
      },
      {
        seriesId:          'ecofit_sustain',
        seriesName:        'ecoFIT sustain',
        seriesDescription: 'Hydrogen-blend ready wall-hung combi and system boiler',
        models: [
          { modelId: 'ecofit_sustain_25', modelName: 'ecoFIT sustain 25kW', outputKw: 25, heightMm: 740, widthMm: 440, depthMm: 350 },
          { modelId: 'ecofit_sustain_30', modelName: 'ecoFIT sustain 30kW', outputKw: 30, heightMm: 740, widthMm: 440, depthMm: 350 },
          { modelId: 'ecofit_sustain_35', modelName: 'ecoFIT sustain 35kW', outputKw: 35, heightMm: 740, widthMm: 440, depthMm: 350 },
        ],
      },
    ],
  },

  // ── Ideal ─────────────────────────────────────────────────────────────────────
  {
    brandId:   'ideal',
    brandName: 'Ideal',
    logoPath:  '/assets/logos/ideal.png',
    series: [
      {
        seriesId:          'logic_plus',
        seriesName:        'Logic+ Combi',
        seriesDescription: 'Value wall-hung combi boiler range',
        models: [
          { modelId: 'logic_plus_24', modelName: 'Logic+ Combi 24kW', outputKw: 24, heightMm: 690, widthMm: 385, depthMm: 280 },
          { modelId: 'logic_plus_30', modelName: 'Logic+ Combi 30kW', outputKw: 30, heightMm: 690, widthMm: 385, depthMm: 280 },
          { modelId: 'logic_plus_35', modelName: 'Logic+ Combi 35kW', outputKw: 35, heightMm: 690, widthMm: 385, depthMm: 280 },
        ],
      },
      {
        seriesId:          'vogue_max',
        seriesName:        'Vogue Max',
        seriesDescription: 'Premium ErP wall-hung combi and system range',
        models: [
          { modelId: 'vogue_max_26', modelName: 'Vogue Max 26kW',     outputKw: 26, heightMm: 730, widthMm: 430, depthMm: 345 },
          { modelId: 'vogue_max_32', modelName: 'Vogue Max 32kW',     outputKw: 32, heightMm: 730, widthMm: 430, depthMm: 345 },
          { modelId: 'vogue_max_38', modelName: 'Vogue Max 38kW',     outputKw: 38, heightMm: 730, widthMm: 430, depthMm: 345 },
        ],
      },
    ],
  },

  // ── Glow-worm ─────────────────────────────────────────────────────────────────
  {
    brandId:   'glow_worm',
    brandName: 'Glow-worm',
    logoPath:  '/assets/logos/glow-worm.png',
    series: [
      {
        seriesId:          'energy_plus',
        seriesName:        'Energy+ Combi',
        seriesDescription: 'Wall-hung combi boiler range with 10-year warranty available',
        models: [
          { modelId: 'energy_plus_25', modelName: 'Energy+ 25kW',     outputKw: 25, heightMm: 700, widthMm: 380, depthMm: 295 },
          { modelId: 'energy_plus_30', modelName: 'Energy+ 30kW',     outputKw: 30, heightMm: 700, widthMm: 380, depthMm: 295 },
          { modelId: 'energy_plus_35', modelName: 'Energy+ 35kW',     outputKw: 35, heightMm: 700, widthMm: 380, depthMm: 295 },
        ],
      },
      {
        seriesId:          'ultimate3_combi',
        seriesName:        'Ultimate3 Combi',
        seriesDescription: 'Premium wall-hung combi with stainless steel heat exchanger',
        models: [
          { modelId: 'ult3_25', modelName: 'Ultimate3 25kW',          outputKw: 25, heightMm: 730, widthMm: 390, depthMm: 330 },
          { modelId: 'ult3_30', modelName: 'Ultimate3 30kW',          outputKw: 30, heightMm: 730, widthMm: 390, depthMm: 330 },
        ],
      },
    ],
  },

  // ── Viessmann ─────────────────────────────────────────────────────────────────
  {
    brandId:   'viessmann',
    brandName: 'Viessmann',
    logoPath:  '/assets/logos/viessmann.png',
    series: [
      {
        seriesId:          'vitodens_050w',
        seriesName:        'Vitodens 050-W',
        seriesDescription: 'Entry wall-hung combi and system boiler with Lambda Pro combustion',
        models: [
          { modelId: 'vd050_24', modelName: 'Vitodens 050-W 24kW',    outputKw: 24, heightMm: 710, widthMm: 380, depthMm: 310 },
          { modelId: 'vd050_30', modelName: 'Vitodens 050-W 30kW',    outputKw: 30, heightMm: 710, widthMm: 380, depthMm: 310 },
          { modelId: 'vd050_35', modelName: 'Vitodens 050-W 35kW',    outputKw: 35, heightMm: 710, widthMm: 380, depthMm: 310 },
        ],
      },
      {
        seriesId:          'vitodens_100w',
        seriesName:        'Vitodens 100-W',
        seriesDescription: 'Wall-hung combi and system boiler with stainless-steel Inox-Radial heat exchanger',
        models: [
          { modelId: 'vd100_25', modelName: 'Vitodens 100-W 25kW',    outputKw: 25, heightMm: 760, widthMm: 420, depthMm: 340 },
          { modelId: 'vd100_32', modelName: 'Vitodens 100-W 32kW',    outputKw: 32, heightMm: 760, widthMm: 420, depthMm: 340 },
          { modelId: 'vd100_35', modelName: 'Vitodens 100-W 35kW',    outputKw: 35, heightMm: 760, widthMm: 420, depthMm: 340 },
        ],
      },
    ],
  },
] as const;

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
