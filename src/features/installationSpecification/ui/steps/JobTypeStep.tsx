/**
 * JobTypeStep.tsx
 *
 * Derived specification path step — shows the job type derived from the
 * current and proposed heat-source / hot-water selections, together with
 * the specific items Atlas will ask for on subsequent steps.
 *
 * No user input is required — the surveyor reviews the path and taps Next.
 *
 * When either system is still unknown the step shows a "needs review" banner
 * prompting the surveyor to go back and complete the earlier steps.
 */

import type { QuoteJobClassificationV1, QuoteJobType } from '../../calculators/quotePlannerTypes';
import type {
  UiCurrentHeatSourceLabel,
  UiProposedHeatSourceLabel,
  UiProposedHotWaterLabel,
} from '../installationSpecificationUiTypes';

/** Human-readable specification path display strings. */
const JOB_TYPE_DISPLAY: Record<QuoteJobType, string> = {
  like_for_like:            'Like-for-like heat-source replacement',
  relocation:               'Heat-source relocation',
  conversion:               'System conversion',
  stored_hot_water_upgrade: 'Stored hot-water upgrade',
  low_carbon_conversion:    'Heat-pump conversion',
  needs_review:             'Needs technical review',
};

/** Human-readable display label for a current heat-source selection. */
const CURRENT_HEAT_SOURCE_DISPLAY: Record<UiCurrentHeatSourceLabel, string> = {
  combi_boiler:     'Combination boiler',
  regular_boiler:   'Regular boiler',
  system_boiler:    'System boiler',
  storage_combi:    'Storage combi',
  heat_pump:        'Heat pump',
  warm_air:         'Warm air unit',
  back_boiler:      'Back boiler',
  direct_electric:  'Direct electric heating',
  other_heat_source: 'Other heat source',
  none:             'no existing heat source',
};

/** Human-readable display label for a proposed heat-source selection. */
const PROPOSED_HEAT_SOURCE_DISPLAY: Record<UiProposedHeatSourceLabel, string> = {
  combi_boiler:   'Combination boiler',
  regular_boiler: 'Regular boiler',
  system_boiler:  'System boiler',
  storage_combi:  'Storage combi',
  heat_pump:      'Heat pump',
  other_approved: 'Other approved specification',
};

/** Human-readable display label for a proposed hot-water selection. */
const PROPOSED_HOT_WATER_DISPLAY: Record<UiProposedHotWaterLabel, string> = {
  retain_existing:       'retain existing cylinder',
  vented_cylinder:       'vented cylinder',
  unvented_cylinder:     'unvented cylinder',
  mixergy_or_stratified: 'Mixergy / stratified cylinder',
  thermal_store:         'thermal store',
  heat_pump_cylinder:    'heat-pump cylinder',
  no_stored_hot_water:   'no stored hot water',
};

// ─── Narrowing logic ──────────────────────────────────────────────────────────

function getNarrowingItems(
  currentHeatSource: UiCurrentHeatSourceLabel | null,
  proposedHeatSource: UiProposedHeatSourceLabel | null,
  proposedHotWater: UiProposedHotWaterLabel | null,
  classification: QuoteJobClassificationV1,
): string[] {
  // Any → Heat pump always uses the heat-pump route list.
  if (proposedHeatSource === 'heat_pump') {
    return [
      'Outdoor unit location',
      'Cylinder or buffer vessel location',
      'Hydraulic separation route',
      'Electrical supply route',
    ];
  }

  // Regular / open vent → Combi (conversion with cylinder/tank removal)
  if (
    (currentHeatSource === 'regular_boiler') &&
    proposedHeatSource === 'combi_boiler'
  ) {
    return [
      'Boiler target location',
      'Redundant cylinder and tank scope',
      'Hot and cold water route',
      'Heating flow and return alterations',
      'Gas route',
      'Flue route',
      'Condensate route',
    ];
  }

  // Combi → System boiler / regular boiler + cylinder (adding stored hot water)
  if (
    currentHeatSource === 'combi_boiler' &&
    (proposedHeatSource === 'system_boiler' || proposedHeatSource === 'regular_boiler')
  ) {
    return [
      'Boiler location',
      'Cylinder location',
      'Hot and cold water route',
      'Primary flow and return',
      'Discharge route (if unvented or Mixergy)',
      'Controls route',
      'Flue, condensate and gas',
    ];
  }

  // System/regular boiler → system/regular boiler, retaining cylinder
  if (
    (proposedHeatSource === 'system_boiler' || proposedHeatSource === 'regular_boiler') &&
    proposedHotWater === 'retain_existing'
  ) {
    return [
      'Boiler location',
      'Cylinder compatibility check',
      'Primary flow and return',
      'Flue route',
      'Condensate route',
      'Gas route',
    ];
  }

  // System/regular boiler → cylinder upgrade (Mixergy or unvented)
  if (
    (proposedHeatSource === 'system_boiler' || proposedHeatSource === 'regular_boiler') &&
    (proposedHotWater === 'mixergy_or_stratified' || proposedHotWater === 'unvented_cylinder')
  ) {
    return [
      'Boiler location',
      'New cylinder location',
      'Hot and cold water route',
      'Discharge route',
      'Primary flow and return',
      'Controls route',
      'Flue route',
      'Condensate route',
      'Gas route',
    ];
  }

  // Same family — like-for-like
  if (classification.jobType === 'like_for_like') {
    return [
      'Same location confirmed',
      'Flue route',
      'Condensate route',
      'Gas route',
    ];
  }

  // Same family — relocation
  if (classification.jobType === 'relocation') {
    return [
      'New boiler location',
      'Flue route',
      'Condensate route',
      'Gas route',
      'Primary pipework changes',
    ];
  }

  // Stored hot-water upgrade
  if (classification.jobType === 'stored_hot_water_upgrade') {
    return [
      'Boiler location',
      'Cylinder location',
      'Hot and cold water route',
      'Primary flow and return',
      'Discharge route',
    ];
  }

  // Generic conversion
  if (classification.jobType === 'conversion') {
    return [
      'Boiler target location',
      'Redundant equipment scope',
      'Heating flow and return',
      'Gas route',
      'Flue route',
      'Condensate route',
    ];
  }

  return [];
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface JobTypeStepProps {
  /** Derived classification from `classifyQuoteJob`. */
  classification: QuoteJobClassificationV1;
  /** The current heat-source selection — used in the context hint. */
  currentHeatSource: UiCurrentHeatSourceLabel | null;
  /** The proposed heat-source selection — used in the context hint. */
  proposedHeatSource: UiProposedHeatSourceLabel | null;
  /** The proposed hot-water selection — used in narrowing logic. */
  proposedHotWater: UiProposedHotWaterLabel | null;
}

export function JobTypeStep({
  classification,
  currentHeatSource,
  proposedHeatSource,
  proposedHotWater,
}: JobTypeStepProps) {
  const jobDisplay = JOB_TYPE_DISPLAY[classification.jobType];
  const isNeedsReview = classification.jobType === 'needs_review';

  const currentDisplay =
    currentHeatSource != null ? CURRENT_HEAT_SOURCE_DISPLAY[currentHeatSource] : null;
  const proposedDisplay =
    proposedHeatSource != null ? PROPOSED_HEAT_SOURCE_DISPLAY[proposedHeatSource] : null;
  const hotWaterDisplay =
    proposedHotWater != null ? PROPOSED_HOT_WATER_DISPLAY[proposedHotWater] : null;

  const narrowingItems = getNarrowingItems(
    currentHeatSource,
    proposedHeatSource,
    proposedHotWater,
    classification,
  );

  return (
    <>
      <h2 className="qp-step-heading">Specification path</h2>

      {currentDisplay != null && proposedDisplay != null && (
        <p className="qp-context-hint">
          Because you selected <strong>{currentDisplay}</strong> →{' '}
          <strong>{proposedDisplay}</strong>
          {hotWaterDisplay != null && (
            <> with <strong>{hotWaterDisplay}</strong></>
          )}
          , Atlas has derived the specification path below.
        </p>
      )}

      <div
        className={`qp-classification${isNeedsReview ? ' qp-classification--needs-review' : ''}`}
      >
        <p className="qp-classification__label">Specification path</p>
        <p className="qp-classification__value">{jobDisplay}</p>
        <p className="qp-classification__rationale">{classification.rationale}</p>
      </div>

      {narrowingItems.length > 0 && (
        <div className="spec-narrowing">
          <p className="spec-narrowing__heading">
            {currentDisplay != null && proposedDisplay != null
              ? `Atlas will ask for:`
              : 'Atlas will ask for:'}
          </p>
          <ul className="spec-narrowing__list">
            {narrowingItems.map((item) => (
              <li key={item} className="spec-narrowing__item">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
