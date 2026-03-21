/**
 * PortalSimulatorPanel.tsx
 *
 * PR9 — Read-only portal simulator panel.
 *
 * Presents a scenario-switching view of real-world behaviour cards for the
 * customer portal.  The panel is customer-facing and read-only: no engine
 * mutation, no survey editing, no technical controls.
 *
 * Behaviour data comes from the existing PresentationBehaviourCard[] produced
 * by buildRealWorldBehaviourCards.  The panel surfaces a curated set of
 * scenarios and allows the customer to switch between them.
 *
 * When the customer has diverged from the Atlas recommendation, both the
 * recommended and chosen option outcomes are shown side-by-side.
 *
 * Rules:
 *   - Presentation layer only — no engine changes.
 *   - Reuses existing realWorldBehaviours data.
 *   - No Math.random().
 *   - Terminology per docs/atlas-terminology.md.
 */

import { useState } from 'react';
import type { PresentationBehaviourCard } from '../../lib/behaviour/buildRealWorldBehaviourCards';
import {
  BEHAVIOUR_OUTCOME_LABEL,
  BEHAVIOUR_LIMITING_FACTOR_LABEL,
  EXPLAINER_LINK_LABEL,
  EXPLAINER_LINK_ARIA,
  PORTAL_SIMULATOR_HEADING,
  PORTAL_SIMULATOR_INTRO,
} from '../../lib/copy/customerCopy';
import { getExplainerIdForLimitingFactor } from '../../lib/explainers/getRelevantExplainers';
import { EDUCATIONAL_EXPLAINERS } from '../../explainers/educational/content';
import './PortalSimulatorPanel.css';

// ─── Scenario definitions ─────────────────────────────────────────────────────

/**
 * Curated set of portal scenarios, in the order they are presented.
 * Scenario IDs match the engine's RealWorldBehaviourModule output.
 */
const PORTAL_SCENARIOS: ReadonlyArray<{ label: string; scenarioId: string }> = [
  { label: 'Shower + kitchen tap', scenarioId: 'shower_and_tap' },
  { label: 'Two hot outlets',      scenarioId: 'two_showers' },
  { label: 'Bath fill',            scenarioId: 'bath_filling' },
  { label: 'Busy periods',         scenarioId: 'peak_household' },
];

// ─── Outcome visual identifiers ───────────────────────────────────────────────

const OUTCOME_ICON: Record<string, string> = {
  works_well:           '✓',
  works_with_limits:    '~',
  best_for_lighter_use: '◦',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Behaviour cards produced by buildRealWorldBehaviourCards. */
  cards: PresentationBehaviourCard[];
  /**
   * True when the customer has chosen a different option from the Atlas
   * recommendation.  When true, per-scenario comparison notes are shown.
   */
  isDivergent: boolean;
  /** Label for the recommended option — used in comparison note headings. */
  recommendedOptionLabel: string;
  /** Label for the customer-chosen option — used in comparison note headings. */
  chosenOptionLabel: string;
  /**
   * Called when the user clicks a "Learn why" link.
   * Receives the educational explainer ID to open in the overlay.
   * When absent, no "Learn why" links are rendered.
   */
  onOpenExplainer?: (explainerId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalSimulatorPanel({
  cards,
  isDivergent,
  recommendedOptionLabel,
  chosenOptionLabel,
  onOpenExplainer,
}: Props) {
  // Build the scenario list from available cards, prioritising the curated set.
  type ScenarioEntry = { label: string; scenarioId: string; card: PresentationBehaviourCard };
  const scenarioCards: ScenarioEntry[] = PORTAL_SCENARIOS
    .map(s => ({ ...s, card: cards.find(c => c.id === s.scenarioId) }))
    .filter((s): s is ScenarioEntry => s.card != null);

  // Fall back to all available cards if none match the curated list.
  const displayCards: ScenarioEntry[] =
    scenarioCards.length > 0
      ? scenarioCards
      : cards.map(c => ({ label: c.title, scenarioId: c.id, card: c }));

  const [selectedIndex, setSelectedIndex] = useState(0);

  if (displayCards.length === 0) return null;

  const safeIndex = selectedIndex < displayCards.length ? selectedIndex : 0;
  const selected = displayCards[safeIndex];
  const card = selected.card;

  const explainerId =
    onOpenExplainer != null
      ? getExplainerIdForLimitingFactor(card.limitingFactor)
      : null;
  const explainerTitle =
    explainerId != null
      ? (EDUCATIONAL_EXPLAINERS.find(e => e.id === explainerId)?.title ?? explainerId)
      : null;

  return (
    <div className="portal-simulator" data-testid="portal-simulator">
      <h2 className="portal-simulator__heading">{PORTAL_SIMULATOR_HEADING}</h2>
      <p className="portal-simulator__intro">{PORTAL_SIMULATOR_INTRO}</p>

      {/* ── Scenario selector ─────────────────────────────────────────────── */}
      <div
        className="portal-simulator__selector"
        role="tablist"
        aria-label="Scenarios"
      >
        {displayCards.map((s, i) => (
          <button
            key={s.scenarioId}
            className={`portal-simulator__tab${i === safeIndex ? ' portal-simulator__tab--active' : ''}`}
            role="tab"
            aria-selected={i === safeIndex}
            aria-controls="portal-simulator-panel"
            onClick={() => setSelectedIndex(i)}
            data-testid={`portal-simulator-tab-${s.scenarioId}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Selected scenario detail ──────────────────────────────────────── */}
      <div
        className="portal-simulator__panel"
        id="portal-simulator-panel"
        role="tabpanel"
        aria-label={`${selected.label} scenario`}
        data-testid="portal-simulator-detail"
      >
        {/* Outcome badge */}
        <div className="portal-simulator__outcome">
          <span
            className={`portal-simulator__outcome-icon portal-simulator__outcome-icon--${card.outcome}`}
            aria-hidden="true"
          >
            {OUTCOME_ICON[card.outcome]}
          </span>
          <span
            className={`portal-simulator__outcome-badge portal-simulator__outcome-badge--${card.outcome}`}
          >
            {BEHAVIOUR_OUTCOME_LABEL[card.outcome]}
          </span>
        </div>

        {/* Summary */}
        <p className="portal-simulator__summary">{card.summary}</p>

        {/* Limiting factor + optional Learn why link */}
        {card.limitingFactor != null &&
          BEHAVIOUR_LIMITING_FACTOR_LABEL[card.limitingFactor] != null && (
          <p className="portal-simulator__limiter">
            {BEHAVIOUR_LIMITING_FACTOR_LABEL[card.limitingFactor]}
            {explainerId != null && (
              <>
                {' '}
                <button
                  className="portal-simulator__learn-why"
                  onClick={() => onOpenExplainer!(explainerId)}
                  aria-label={EXPLAINER_LINK_ARIA(explainerTitle!)}
                  data-testid={`portal-simulator-learn-why-${card.id}`}
                >
                  {EXPLAINER_LINK_LABEL}
                </button>
              </>
            )}
          </p>
        )}

        {/* Divergence comparison */}
        {isDivergent &&
          (card.recommendedOptionNote != null || card.chosenOptionNote != null) && (
          <div
            className="portal-simulator__comparison"
            aria-label={`Comparison for ${card.title}`}
          >
            {card.recommendedOptionNote != null && (
              <p className="portal-simulator__comparison-note portal-simulator__comparison-note--recommended">
                <span className="portal-simulator__comparison-label">
                  {recommendedOptionLabel}:
                </span>{' '}
                {card.recommendedOptionNote}
              </p>
            )}
            {card.chosenOptionNote != null && (
              <p className="portal-simulator__comparison-note portal-simulator__comparison-note--chosen">
                <span className="portal-simulator__comparison-label">
                  {chosenOptionLabel}:
                </span>{' '}
                {card.chosenOptionNote}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
