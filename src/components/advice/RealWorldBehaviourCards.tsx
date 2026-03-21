/**
 * RealWorldBehaviourCards.tsx
 *
 * PR4 — Compact card renderer for real-world behaviour scenarios.
 * PR5 — Added "Learn why" inline links from limiting-factor cards.
 *
 * Renders a list of PresentationBehaviourCard items showing how the
 * recommended (and optionally customer-chosen) option would feel in daily use.
 *
 * Divergence comparison notes are shown only when isDivergent is true,
 * reusing the PR3 divergence state from DecisionSynthesisPage.
 *
 * When onOpenExplainer is provided, cards with a known limiting-factor
 * mapping display a lightweight "Learn why" link that opens the relevant
 * explainer in the overlay.
 */

import type { PresentationBehaviourCard } from '../../lib/behaviour/buildRealWorldBehaviourCards';
import {
  BEHAVIOUR_OUTCOME_LABEL,
  BEHAVIOUR_LIMITING_FACTOR_LABEL,
  EXPLAINER_LINK_LABEL,
  EXPLAINER_LINK_ARIA,
} from '../../lib/copy/customerCopy';
import { getExplainerIdForLimitingFactor } from '../../lib/explainers/getRelevantExplainers';
import { EDUCATIONAL_EXPLAINERS } from '../../explainers/educational/content';

// ─── Outcome visual identifiers ───────────────────────────────────────────────

const OUTCOME_ICON: Record<string, string> = {
  works_well:           '✓',
  works_with_limits:    '~',
  best_for_lighter_use: '◦',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  cards: PresentationBehaviourCard[];
  /**
   * True when the customer has actively chosen a different option from the
   * Atlas recommendation. When true, per-card comparison notes are shown.
   */
  isDivergent?: boolean;
  /** Label for the recommended option — used in comparison note headings. */
  recommendedOptionLabel?: string;
  /** Label for the customer-chosen option — used in comparison note headings. */
  chosenOptionLabel?: string;
  /**
   * Called when the user clicks a "Learn why" link on a card.
   * Receives the educational explainer ID to open in the overlay.
   * When absent, no "Learn why" links are rendered.
   */
  onOpenExplainer?: (explainerId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RealWorldBehaviourCards({
  cards,
  isDivergent = false,
  recommendedOptionLabel = 'Recommended option',
  chosenOptionLabel = 'Your chosen option',
  onOpenExplainer,
}: Props) {
  if (cards.length === 0) return null;

  return (
    <div
      className="behaviour-cards"
      role="list"
      aria-label="Real-world behaviour scenarios"
      data-testid="behaviour-cards"
    >
      {cards.map(card => {
        const explainerId = onOpenExplainer != null
          ? getExplainerIdForLimitingFactor(card.limitingFactor)
          : null;
        const explainerTitle = explainerId != null
          ? (EDUCATIONAL_EXPLAINERS.find(e => e.id === explainerId)?.title ?? explainerId)
          : null;

        return (
          <div
            key={card.id}
            className={`behaviour-card behaviour-card--${card.outcome}`}
            role="listitem"
            data-testid={`behaviour-card-${card.id}`}
          >
            {/* ── Card header: title + outcome badge ──────────────────────── */}
            <div className="behaviour-card__header">
              <span
                className={`behaviour-card__outcome-icon behaviour-card__outcome-icon--${card.outcome}`}
                aria-hidden="true"
              >
                {OUTCOME_ICON[card.outcome]}
              </span>
              <h3 className="behaviour-card__title">{card.title}</h3>
              <span
                className={`behaviour-card__outcome-badge behaviour-card__outcome-badge--${card.outcome}`}
                aria-label={`Outcome: ${BEHAVIOUR_OUTCOME_LABEL[card.outcome]}`}
              >
                {BEHAVIOUR_OUTCOME_LABEL[card.outcome]}
              </span>
            </div>

            {/* ── Main summary ─────────────────────────────────────────────── */}
            <p className="behaviour-card__summary">{card.summary}</p>

            {/* ── Limiting factor line + optional Learn why link ───────────── */}
            {card.limitingFactor != null &&
              BEHAVIOUR_LIMITING_FACTOR_LABEL[card.limitingFactor] != null && (
              <p className="behaviour-card__limiter">
                {BEHAVIOUR_LIMITING_FACTOR_LABEL[card.limitingFactor]}
                {explainerId != null && (
                  <>
                    {' '}
                    <button
                      className="behaviour-card__learn-why"
                      onClick={() => onOpenExplainer!(explainerId)}
                      aria-label={EXPLAINER_LINK_ARIA(explainerTitle!)}
                      data-testid={`behaviour-card-learn-why-${card.id}`}
                    >
                      {EXPLAINER_LINK_LABEL}
                    </button>
                  </>
                )}
              </p>
            )}

            {/* ── Divergence comparison notes ──────────────────────────────── */}
            {isDivergent &&
              (card.recommendedOptionNote != null || card.chosenOptionNote != null) && (
              <div
                className="behaviour-card__comparison"
                aria-label={`Comparison for ${card.title}`}
              >
                {card.recommendedOptionNote != null && (
                  <p className="behaviour-card__comparison-note behaviour-card__comparison-note--recommended">
                    <span className="behaviour-card__comparison-label">
                      {recommendedOptionLabel}:
                    </span>{' '}
                    {card.recommendedOptionNote}
                  </p>
                )}
                {card.chosenOptionNote != null && (
                  <p className="behaviour-card__comparison-note behaviour-card__comparison-note--chosen">
                    <span className="behaviour-card__comparison-label">
                      {chosenOptionLabel}:
                    </span>{' '}
                    {card.chosenOptionNote}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
