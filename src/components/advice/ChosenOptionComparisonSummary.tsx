/**
 * ChosenOptionComparisonSummary.tsx
 *
 * PR6 — Compact comparison panel for recommended vs chosen options.
 *
 * Shown only when the customer has diverged from the Atlas recommendation.
 * Presents each behaviour card that has both recommended and chosen notes
 * as a compact two-column comparison row.
 *
 * Rules:
 *   - presentation layer only: no engine/scoring changes.
 *   - renders nothing when fewer than 1 divergent behaviour card exists.
 *   - at most 4 comparison rows to keep the panel uncluttered.
 */

import type { PresentationBehaviourCard } from '../../lib/behaviour/buildRealWorldBehaviourCards';
import {
  COMPARISON_SUMMARY_INTRO,
} from '../../lib/copy/customerCopy';
import './ChosenOptionComparisonSummary.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Behaviour cards from the current recommendation. */
  behaviourCards: PresentationBehaviourCard[];
  /** Label for the recommended option (e.g. "Combi boiler"). */
  recommendedOptionLabel: string;
  /** Label for the customer-chosen option (e.g. "Unvented system"). */
  chosenOptionLabel: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Compact side-by-side comparison of how the recommended and chosen options
 * perform on the scenarios where they differ.
 *
 * Only renders when there are behaviour cards with both recommendedOptionNote
 * and chosenOptionNote populated (i.e. when customer has diverged).
 */
export default function ChosenOptionComparisonSummary({
  behaviourCards,
  recommendedOptionLabel,
  chosenOptionLabel,
}: Props) {
  // Filter to cards that have both notes (present only when customer has diverged)
  const divergentCards = behaviourCards
    .filter(c => c.recommendedOptionNote != null && c.chosenOptionNote != null)
    .slice(0, 4);

  if (divergentCards.length === 0) return null;

  return (
    <div
      className="comparison-summary"
      aria-label="Comparison summary: recommended vs chosen option"
      data-testid="chosen-option-comparison-summary"
    >
      <p className="comparison-summary__intro">{COMPARISON_SUMMARY_INTRO}</p>
      <div
        className="comparison-summary__grid"
        role="table"
        aria-label="Recommended vs chosen comparison"
      >
        {/* Column headers */}
        <div className="comparison-summary__header" role="row">
          <div className="comparison-summary__header-scenario" role="columnheader">
            Scenario
          </div>
          <div
            className="comparison-summary__header-rec"
            role="columnheader"
            aria-label={`Recommended: ${recommendedOptionLabel}`}
          >
            <span className="comparison-summary__badge comparison-summary__badge--rec">
              ✓ Recommended
            </span>
            {recommendedOptionLabel}
          </div>
          <div
            className="comparison-summary__header-chosen"
            role="columnheader"
            aria-label={`Chosen: ${chosenOptionLabel}`}
          >
            <span className="comparison-summary__badge comparison-summary__badge--chosen">
              Your choice
            </span>
            {chosenOptionLabel}
          </div>
        </div>

        {/* Comparison rows */}
        {divergentCards.map(card => (
          <div
            key={card.id}
            className={`comparison-summary__row comparison-summary__row--${card.outcome}`}
            role="row"
            data-testid={`comparison-row-${card.id}`}
          >
            <div
              className="comparison-summary__scenario"
              role="cell"
            >
              {card.title}
            </div>
            <div
              className="comparison-summary__rec-note"
              role="cell"
              aria-label={`${recommendedOptionLabel}: ${card.recommendedOptionNote}`}
            >
              {card.recommendedOptionNote}
            </div>
            <div
              className={`comparison-summary__chosen-note comparison-summary__chosen-note--${card.outcome}`}
              role="cell"
              aria-label={`${chosenOptionLabel}: ${card.chosenOptionNote}`}
            >
              {card.chosenOptionNote}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
