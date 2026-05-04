/**
 * BoilerSelector.tsx
 *
 * Three-level hardware selection UI (Notes-Elite style brand-first flow).
 *
 * Level 1 — Brand Grid: tap a manufacturer logo to select a brand.
 * Level 2 — Series List: filtered list of series for the selected brand.
 * Level 3 — Spec Table: kW output and H×W×D dimensions for the selected series.
 *
 * The engineer taps through the three levels to confirm cupboard fit and
 * select the specific model for the quote.
 *
 * Design rules:
 *   - Pure presentational shell — no engine calls, no recommendation logic.
 *   - The selected modelId (or null) is communicated via `onModelSelect`.
 *   - Level 2 and 3 show a "← Back" breadcrumb to return to the previous level.
 *   - Does not output customer-facing copy.
 */

import { useState } from 'react';
import {
  getBrandsFromDB,
  getSeriesForBrand,
  getModelsForSeries,
} from '../../hardware/BoilerDatabase';
import type {
  BoilerBrandEntry,
  BoilerSeriesEntry,
  BoilerModelEntry,
} from '../../hardware/BoilerDatabase';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BoilerSelectorProps {
  /**
   * Currently selected model (brandId + seriesId + modelId), or null.
   * When provided, the matching row in the spec table is highlighted.
   */
  selectedModelId?: string | null;
  /**
   * Called when the engineer selects a model from the spec table.
   * Passes the full model entry so the caller can record make/model metadata.
   */
  onModelSelect: (
    brand: BoilerBrandEntry,
    series: BoilerSeriesEntry,
    model: BoilerModelEntry,
  ) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoilerSelector({ selectedModelId, onModelSelect }: BoilerSelectorProps) {
  const [selectedBrand, setSelectedBrand]   = useState<BoilerBrandEntry | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<BoilerSeriesEntry | null>(null);

  const brands = getBrandsFromDB();

  // ── Level 3: Spec table ─────────────────────────────────────────────────────
  if (selectedBrand != null && selectedSeries != null) {
    const models = getModelsForSeries(selectedBrand.brandId, selectedSeries.seriesId);

    return (
      <div className="boiler-selector" data-testid="boiler-selector-level3">
        <nav className="boiler-selector__breadcrumb" aria-label="Boiler selector breadcrumb">
          <button
            type="button"
            className="boiler-selector__back"
            onClick={() => setSelectedSeries(null)}
          >
            ← {selectedBrand.brandName}
          </button>
          <span className="boiler-selector__breadcrumb-sep" aria-hidden="true"> / </span>
          <span className="boiler-selector__breadcrumb-current">{selectedSeries.seriesName}</span>
        </nav>

        <h3 className="boiler-selector__heading">{selectedSeries.seriesName}</h3>
        <p className="boiler-selector__desc">{selectedSeries.seriesDescription}</p>

        <table className="boiler-selector__spec-table" aria-label={`${selectedSeries.seriesName} models`}>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Output (kW)</th>
              <th scope="col">H × W × D (mm)</th>
              <th scope="col"><span className="sr-only">Select</span></th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => {
              const isSelected = model.modelId === selectedModelId;
              return (
                <tr
                  key={model.modelId}
                  className={`boiler-selector__model-row${isSelected ? ' boiler-selector__model-row--selected' : ''}`}
                  data-testid={`boiler-model-row-${model.modelId}`}
                  aria-selected={isSelected}
                >
                  <td>{model.modelName}</td>
                  <td className="boiler-selector__kw">{model.outputKw} kW</td>
                  <td className="boiler-selector__dims">
                    {model.heightMm} × {model.widthMm} × {model.depthMm}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`boiler-selector__select-btn${isSelected ? ' boiler-selector__select-btn--selected' : ''}`}
                      aria-label={`Select ${model.modelName}`}
                      onClick={() => onModelSelect(selectedBrand, selectedSeries, model)}
                    >
                      {isSelected ? '✓ Selected' : 'Select'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Level 2: Series list ────────────────────────────────────────────────────
  if (selectedBrand != null) {
    const seriesList = getSeriesForBrand(selectedBrand.brandId);

    return (
      <div className="boiler-selector" data-testid="boiler-selector-level2">
        <nav className="boiler-selector__breadcrumb" aria-label="Boiler selector breadcrumb">
          <button
            type="button"
            className="boiler-selector__back"
            onClick={() => setSelectedBrand(null)}
          >
            ← Brands
          </button>
          <span className="boiler-selector__breadcrumb-sep" aria-hidden="true"> / </span>
          <span className="boiler-selector__breadcrumb-current">{selectedBrand.brandName}</span>
        </nav>

        <h3 className="boiler-selector__heading">{selectedBrand.brandName} — Choose a series</h3>

        <ul className="boiler-selector__series-list" aria-label={`${selectedBrand.brandName} series`}>
          {seriesList.map((series) => (
            <li key={series.seriesId} className="boiler-selector__series-item">
              <button
                type="button"
                className="boiler-selector__series-btn"
                aria-label={`Select ${series.seriesName}`}
                data-testid={`boiler-series-${series.seriesId}`}
                onClick={() => setSelectedSeries(series)}
              >
                <span className="boiler-selector__series-name">{series.seriesName}</span>
                <span className="boiler-selector__series-desc">{series.seriesDescription}</span>
                <span className="boiler-selector__series-chevron" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ── Level 1: Brand grid ─────────────────────────────────────────────────────
  return (
    <div className="boiler-selector" data-testid="boiler-selector-level1">
      <h3 className="boiler-selector__heading">Choose a manufacturer</h3>

      <div className="boiler-selector__brand-grid" role="list" aria-label="Boiler manufacturers">
        {brands.map((brand) => (
          <button
            key={brand.brandId}
            type="button"
            role="listitem"
            className="boiler-selector__brand-tile"
            aria-label={`Select ${brand.brandName}`}
            data-testid={`boiler-brand-${brand.brandId}`}
            onClick={() => setSelectedBrand(brand)}
          >
            {brand.logoPath != null ? (
              <img
                src={brand.logoPath}
                alt={brand.brandName}
                className="boiler-selector__brand-logo"
              />
            ) : (
              <span className="boiler-selector__brand-name">{brand.brandName}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
