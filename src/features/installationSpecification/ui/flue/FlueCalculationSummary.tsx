/**
 * FlueCalculationSummary.tsx
 *
 * Transparent display of the flue equivalent-length calculation result.
 *
 * Shows:
 *   - A line-by-line breakdown of physical and equivalent lengths.
 *   - The total equivalent length.
 *   - The manufacturer max allowance (or "not selected" if absent).
 *   - The remaining allowance.
 *   - The result badge (within allowance / exceeds / needs model check).
 *   - Any generic-estimate assumption notices.
 *
 * Design rules:
 *   - Pure presentational — receives a `QuoteFlueCalculationV1` from the parent.
 *   - Generic estimates must always be clearly labelled as such.
 *   - Does not output customer-facing copy.
 */

import type { QuoteFlueCalculationV1, QuoteFlueCalculationResult } from '../../calculators/quotePlannerTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FlueCalculationSummaryProps {
  /** The calculation to display. */
  calculation: QuoteFlueCalculationV1;
}

// ─── Result badge text / colour ───────────────────────────────────────────────

function resultLabel(result: QuoteFlueCalculationResult): string {
  switch (result) {
    case 'within_allowance':          return '✓ Within allowance';
    case 'exceeds_allowance':         return '✗ Exceeds allowance';
    case 'needs_model_specific_check': return '⚠ Needs model-specific check';
    case 'not_calculated':            return '— Not calculated';
  }
}

function resultModifier(result: QuoteFlueCalculationResult): string {
  switch (result) {
    case 'within_allowance':          return 'flue-calc-result--pass';
    case 'exceeds_allowance':         return 'flue-calc-result--fail';
    case 'needs_model_specific_check': return 'flue-calc-result--warn';
    case 'not_calculated':            return 'flue-calc-result--unknown';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlueCalculationSummary({ calculation }: FlueCalculationSummaryProps) {
  const {
    physicalLengthM,
    equivalentLengthM,
    maxEquivalentLengthM,
    remainingAllowanceM,
    result,
    calculationMode,
    assumptions,
  } = calculation;

  const isGenericEstimate = calculationMode === 'generic_estimate';

  return (
    <div className="flue-calc-summary" data-testid="flue-calc-summary">
      {/* Calculation mode banner */}
      {isGenericEstimate && (
        <p className="flue-calc-summary__mode-banner" role="note">
          Generic estimate — values are industry defaults, not manufacturer data.
          Verify against the boiler&apos;s flue installation guide.
        </p>
      )}

      {/* Breakdown table */}
      <dl className="flue-calc-breakdown" aria-label="Flue calculation breakdown">
        <div className="flue-calc-breakdown__row">
          <dt>Physical straight length</dt>
          <dd>{physicalLengthM.toFixed(1)} m</dd>
        </div>

        <div className="flue-calc-breakdown__row">
          <dt>Total equivalent length{isGenericEstimate ? ' (estimated)' : ''}</dt>
          <dd data-testid="flue-calc-equivalent">{equivalentLengthM.toFixed(1)} m</dd>
        </div>

        <div className="flue-calc-breakdown__row">
          <dt>Manufacturer max allowance</dt>
          <dd>
            {maxEquivalentLengthM !== null
              ? `${maxEquivalentLengthM.toFixed(1)} m`
              : 'Not selected yet'}
          </dd>
        </div>

        <div className="flue-calc-breakdown__row">
          <dt>Remaining allowance</dt>
          <dd>
            {remainingAllowanceM !== null
              ? `${remainingAllowanceM.toFixed(1)} m`
              : '—'}
          </dd>
        </div>
      </dl>

      {/* Result badge */}
      <div
        className={`flue-calc-result ${resultModifier(result)}`}
        role="status"
        aria-label={`Flue check result: ${resultLabel(result)}`}
        data-testid="flue-calc-result"
      >
        {resultLabel(result)}
      </div>

      {/* Assumption notices */}
      {assumptions.length > 0 && (
        <ul className="flue-calc-assumptions" aria-label="Calculation assumptions">
          {assumptions.map((note) => (
            <li key={note} className="flue-calc-assumption">
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
