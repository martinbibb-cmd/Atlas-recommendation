/**
 * PhysicsStoryCard.tsx
 *
 * Physics Story Mode — single story card.
 *
 * Renders one causal narrative card:
 *   • position badge (card number in the story)
 *   • title headline
 *   • summary body
 *   • evidence line (sourced from real engine/input values)
 *   • optional "Open explainer" action
 *   • optional "Show simulation" action
 *
 * Rules:
 *   - No physics logic here — all content is pre-built by buildPhysicsStory.
 *   - No Math.random() — text is deterministic.
 */

import type { PhysicsStoryCard as PhysicsStoryCardData } from '../../lib/story/buildPhysicsStory';

interface Props {
  card: PhysicsStoryCardData;
  onOpenExplainer?: (explainerId: string) => void;
  onShowSimulation?: (visualiserId: string) => void;
}

export default function PhysicsStoryCard({
  card,
  onOpenExplainer,
  onShowSimulation,
}: Props) {
  return (
    <div
      className="psc"
      aria-label={`Story card ${card.position}: ${card.title}`}
      role="article"
    >
      {/* Position badge */}
      <div className="psc__badge" aria-hidden="true">
        {card.position}
      </div>

      {/* Title */}
      <h3 className="psc__title">{card.title}</h3>

      {/* Summary body */}
      <p className="psc__summary">{card.summary}</p>

      {/* Evidence line — sourced from real engine/input values */}
      {card.evidenceLine != null && (
        <div className="psc__evidence" aria-label="Supporting evidence">
          <span className="psc__evidence-icon" aria-hidden="true">📊</span>
          <span className="psc__evidence-text">{card.evidenceLine}</span>
        </div>
      )}

      {/* Action row */}
      {(card.explainerId != null || card.visualiserId != null) && (
        <div className="psc__actions">
          {card.explainerId != null && onOpenExplainer != null && (
            <button
              className="psc__action-btn psc__action-btn--explainer"
              onClick={() => onOpenExplainer(card.explainerId!)}
              aria-label={`Open explainer for: ${card.title}`}
            >
              Open explainer
            </button>
          )}
          {card.visualiserId != null && onShowSimulation != null && (
            <button
              className="psc__action-btn psc__action-btn--sim"
              onClick={() => onShowSimulation(card.visualiserId!)}
              aria-label={`Show simulation for: ${card.title}`}
            >
              Show simulation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
