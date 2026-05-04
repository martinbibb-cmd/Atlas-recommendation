/**
 * CurrentSystemSummaryStep.tsx
 *
 * Step 1 of the Installation Specification: "Current system from canonical survey".
 *
 * Read-only display of the existing installation, drawn from the canonical
 * survey.  No data is collected here.  The surveyor is shown what Atlas
 * already knows and offered a "Correct canonical survey" action to fix any
 * errors at source.
 *
 * Design rules:
 *   - No tiles, no user selection — always canAdvance = true in the stepper.
 *   - "Correct canonical survey" calls onCorrectSurvey; it does not silently
 *     edit specification data.
 *   - Missing fields show "Missing from canonical survey — Add to survey",
 *     never "Unknown".
 *   - Does not collect, ask about, or recollect current system data.
 */

import type {
  CanonicalCurrentSystemSummary,
  UiCurrentHeatSourceLabel,
  UiCurrentHotWaterLabel,
  UiCurrentPrimaryCircuitLabel,
} from '../installationSpecificationUiTypes';

// ─── Display label maps ───────────────────────────────────────────────────────

const HEAT_SOURCE_DISPLAY: Record<UiCurrentHeatSourceLabel, string> = {
  combi_boiler:    'Combination boiler',
  regular_boiler:  'Regular boiler',
  system_boiler:   'System boiler',
  storage_combi:   'Storage combi',
  heat_pump:       'Heat pump',
  warm_air:        'Warm air unit',
  back_boiler:     'Back boiler',
  direct_electric: 'Direct electric',
  other_heat_source: 'Other heat source',
  none:            'None identified',
};

const HOT_WATER_DISPLAY: Record<UiCurrentHotWaterLabel, string> = {
  no_cylinder:          'No cylinder — on-demand hot water',
  vented_cylinder:      'Vented cylinder',
  unvented_cylinder:    'Unvented cylinder',
  thermal_store:        'Thermal store',
  mixergy_or_stratified: 'Mixergy / stratified cylinder',
  integrated_store:     'Integrated store',
  other_hot_water:      'Other arrangement',
};

const PRIMARY_CIRCUIT_DISPLAY: Record<UiCurrentPrimaryCircuitLabel, string> = {
  open_vented_primary:  'Open vented primary',
  sealed_primary:       'Sealed primary',
  needs_technical_review: 'Needs technical review',
};

// ─── Missing field notice ─────────────────────────────────────────────────────

function MissingField({ label }: { label: string }) {
  return (
    <span className="spec-summary__missing" data-testid={`missing-${label}`}>
      Missing from canonical survey —{' '}
      <span className="spec-summary__missing-action">Add to survey</span>
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CurrentSystemSummaryStepProps {
  /**
   * Current system data from the canonical survey.
   * When null or fields are absent, the step shows "Missing from canonical survey".
   */
  summary: CanonicalCurrentSystemSummary | null;
  /**
   * Called when the surveyor taps "Correct canonical survey".
   * Should navigate back to the survey flow — must not edit spec data silently.
   */
  onCorrectSurvey?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CurrentSystemSummaryStep({
  summary,
  onCorrectSurvey,
}: CurrentSystemSummaryStepProps) {
  const heatSourceLabel = summary?.heatSource != null
    ? HEAT_SOURCE_DISPLAY[summary.heatSource]
    : null;

  const hotWaterLabel = summary?.hotWater != null
    ? HOT_WATER_DISPLAY[summary.hotWater]
    : null;

  const primaryCircuitLabel = summary?.primaryCircuit != null
    ? PRIMARY_CIRCUIT_DISPLAY[summary.primaryCircuit]
    : null;

  return (
    <>
      <h2 className="qp-step-heading">Current system from canonical survey</h2>
      <p className="qp-step-subheading">
        Atlas has the following current installation from the canonical survey.
        This is read-only. To correct any errors, use the button below to return
        to the survey.
      </p>

      <div className="spec-summary-card" data-testid="canonical-summary-card">
        <dl className="spec-summary__list">
          <div className="spec-summary__row">
            <dt className="spec-summary__label">Heat source</dt>
            <dd className="spec-summary__value" data-testid="summary-heat-source">
              {heatSourceLabel ?? <MissingField label="heat-source" />}
            </dd>
          </div>

          <div className="spec-summary__row">
            <dt className="spec-summary__label">Hot water</dt>
            <dd className="spec-summary__value" data-testid="summary-hot-water">
              {hotWaterLabel ?? <MissingField label="hot-water" />}
            </dd>
          </div>

          <div className="spec-summary__row">
            <dt className="spec-summary__label">Primary circuit</dt>
            <dd className="spec-summary__value" data-testid="summary-primary-circuit">
              {primaryCircuitLabel ?? <MissingField label="primary-circuit" />}
            </dd>
          </div>

          {summary?.boilerLocation != null && (
            <div className="spec-summary__row">
              <dt className="spec-summary__label">Heat-source location</dt>
              <dd className="spec-summary__value" data-testid="summary-boiler-location">
                {summary.boilerLocation}
              </dd>
            </div>
          )}

          {summary?.cylinderLocation != null && (
            <div className="spec-summary__row">
              <dt className="spec-summary__label">Cylinder / store location</dt>
              <dd className="spec-summary__value" data-testid="summary-cylinder-location">
                {summary.cylinderLocation}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <button
        type="button"
        className="spec-correct-survey-btn"
        data-testid="correct-survey-btn"
        onClick={onCorrectSurvey}
      >
        Correct canonical survey
      </button>
    </>
  );
}
