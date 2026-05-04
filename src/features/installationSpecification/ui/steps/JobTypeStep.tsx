/**
 * JobTypeStep.tsx
 *
 * Step 3 of the Installation Specification: derived specification path.
 *
 * Shows the job type derived from the current and proposed system selections,
 * together with the specific items Atlas will ask for on subsequent steps.
 *
 * No user input is required — the surveyor reviews the path and taps Next.
 *
 * When either system is still unknown the step shows a "needs review" banner
 * prompting the surveyor to go back and complete the earlier steps.
 */

import type { QuoteJobClassificationV1, QuoteJobType } from '../../calculators/quotePlannerTypes';
import type { UiCurrentSystemLabel, UiProposedSystemLabel } from '../installationSpecificationUiTypes';

/** Human-readable specification path display strings. */
const JOB_TYPE_DISPLAY: Record<QuoteJobType, string> = {
  like_for_like:            'Like-for-like boiler replacement',
  relocation:               'Boiler relocation',
  conversion:               'Conversion',
  stored_hot_water_upgrade: 'Stored hot-water upgrade',
  low_carbon_conversion:    'Heat-pump conversion',
  needs_review:             'Needs technical review',
};

/** Human-readable display label for a current-system selection. */
const CURRENT_SYSTEM_DISPLAY: Record<UiCurrentSystemLabel, string> = {
  combi:             'Combination boiler',
  system_boiler:     'System boiler + cylinder',
  regular_open_vent: 'Regular / open vent',
  storage_combi:     'Storage combi',
  thermal_store:     'Thermal store',
  heat_pump:         'Heat pump',
  warm_air:          'Warm air',
  unknown:           'an unconfirmed system',
};

/** Human-readable display label for a proposed-system selection. */
const PROPOSED_SYSTEM_DISPLAY: Record<UiProposedSystemLabel, string> = {
  combi:             'Combination boiler',
  system_boiler:     'System boiler + cylinder',
  regular_open_vent: 'Regular / open vent',
  heat_pump:         'Heat pump',
  unknown:           'an unconfirmed system',
};

// ─── Narrowing logic ──────────────────────────────────────────────────────────

/**
 * Return the list of specification items Atlas will ask for on subsequent
 * steps, derived from the current system, proposed system, and job type.
 */
function getNarrowingItems(
  current: UiCurrentSystemLabel | null,
  proposed: UiProposedSystemLabel | null,
  classification: QuoteJobClassificationV1,
): string[] {
  // Any → Heat pump always uses the heat-pump route list.
  if (proposed === 'heat_pump') {
    return [
      'Outdoor unit location',
      'Cylinder or buffer vessel location',
      'Hydraulic separation route',
      'Electrical supply route',
      'Condensate or drainage route if applicable',
    ];
  }

  // Regular / open vent → Combi (conversion with cylinder/tank removal)
  if (current === 'regular_open_vent' && proposed === 'combi') {
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

  // Combi → System boiler + cylinder (adding stored hot water)
  if (current === 'combi' && proposed === 'system_boiler') {
    return [
      'Boiler location',
      'Cylinder location',
      'Hot and cold water route',
      'Primary flow and return',
      'Discharge route',
      'Controls route',
      'Flue, condensate and gas',
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

  // Stored hot-water upgrade (e.g. combi → system boiler in general)
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

  // needs_review — no narrowing available
  return [];
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface JobTypeStepProps {
  /** Derived classification from `classifyQuoteJob`. */
  classification: QuoteJobClassificationV1;
  /** The current system selection — used in the context hint. */
  currentSystemLabel: UiCurrentSystemLabel | null;
  /** The proposed system selection — used in the context hint. */
  proposedSystemLabel: UiProposedSystemLabel | null;
}

export function JobTypeStep({
  classification,
  currentSystemLabel,
  proposedSystemLabel,
}: JobTypeStepProps) {
  const jobDisplay    = JOB_TYPE_DISPLAY[classification.jobType];
  const isNeedsReview = classification.jobType === 'needs_review';

  const currentDisplay =
    currentSystemLabel != null ? CURRENT_SYSTEM_DISPLAY[currentSystemLabel] : null;
  const proposedDisplay =
    proposedSystemLabel != null ? PROPOSED_SYSTEM_DISPLAY[proposedSystemLabel] : null;

  const narrowingItems = getNarrowingItems(
    currentSystemLabel,
    proposedSystemLabel,
    classification,
  );

  return (
    <>
      <h2 className="qp-step-heading">Specification path</h2>

      {currentDisplay != null && proposedDisplay != null && (
        <p className="qp-context-hint">
          Because you selected <strong>{currentDisplay}</strong> →{' '}
          <strong>{proposedDisplay}</strong>, Atlas has derived the specification path below.
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
              ? `Because you selected ${currentDisplay} → ${proposedDisplay}, Atlas will ask for:`
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
