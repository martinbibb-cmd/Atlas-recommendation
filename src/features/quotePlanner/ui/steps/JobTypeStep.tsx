/**
 * JobTypeStep.tsx
 *
 * Step 3 of the Quote Planner: derived job classification.
 *
 * Shows the job type derived from the current and proposed system selections.
 * No user input is required — the engineer reviews the classification and
 * taps Next to continue.
 *
 * When either system is still unknown the step shows a "needs review" banner
 * prompting the engineer to go back and complete the earlier steps.
 */

import type { QuoteJobClassificationV1, QuoteJobType } from '../../calculators/quotePlannerTypes';
import type { UiCurrentSystemLabel, UiProposedSystemLabel } from '../quotePlannerUiTypes';

/** Human-readable job type display strings. */
const JOB_TYPE_DISPLAY: Record<QuoteJobType, string> = {
  like_for_like:           'Like-for-like',
  relocation:              'Like-for-like relocation',
  conversion:              'Conversion',
  stored_hot_water_upgrade: 'Stored hot-water upgrade',
  low_carbon_conversion:   'Low-carbon conversion',
  needs_review:            'Needs review',
};

/** Human-readable display label for a current-system selection. */
const CURRENT_SYSTEM_DISPLAY: Record<UiCurrentSystemLabel, string> = {
  combi:             'Combi',
  system_boiler:     'System boiler',
  regular_open_vent: 'Regular / open vent',
  storage_combi:     'Storage combi',
  thermal_store:     'Thermal store',
  heat_pump:         'Heat pump',
  warm_air:          'Warm air',
  unknown:           'an unknown system',
};

/** Human-readable display label for a proposed-system selection. */
const PROPOSED_SYSTEM_DISPLAY: Record<UiProposedSystemLabel, string> = {
  combi:             'Combi',
  system_boiler:     'System boiler',
  regular_open_vent: 'Regular / open vent',
  heat_pump:         'Heat pump',
  unknown:           'an unknown system',
};

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
  const jobDisplay = JOB_TYPE_DISPLAY[classification.jobType];
  const isNeedsReview = classification.jobType === 'needs_review';

  const currentDisplay =
    currentSystemLabel != null ? CURRENT_SYSTEM_DISPLAY[currentSystemLabel] : null;
  const proposedDisplay =
    proposedSystemLabel != null ? PROPOSED_SYSTEM_DISPLAY[proposedSystemLabel] : null;

  return (
    <>
      <h2 className="qp-step-heading">Job classification</h2>
      {currentDisplay != null && proposedDisplay != null && (
        <p className="qp-context-hint">
          Because you chose <strong>{currentDisplay}</strong> →{' '}
          <strong>{proposedDisplay}</strong>, Atlas has classified this job for you.
        </p>
      )}
      <div
        className={`qp-classification${isNeedsReview ? ' qp-classification--needs-review' : ''}`}
      >
        <p className="qp-classification__label">Atlas job type</p>
        <p className="qp-classification__value">{jobDisplay}</p>
        <p className="qp-classification__rationale">{classification.rationale}</p>
      </div>
    </>
  );
}
