/**
 * PhysicsStoryPanel.tsx
 *
 * Physics Story Mode — vertical story panel.
 *
 * Renders a sequence of PhysicsStoryCards assembled by buildPhysicsStory.
 * Displayed when the advisor clicks "Show me why" on a results surface.
 *
 * Layout:
 *   - Header with title and close button
 *   - Vertical stack of story cards (top 3–5)
 *   - Empty state when no signals are triggered
 *
 * Rules:
 *   - No physics logic — all card content comes from buildPhysicsStory.
 *   - No Math.random().
 *   - All data sourced from EngineOutputV1 / EngineInputV2_3.
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { PhysicsStoryEngineInput } from '../../lib/story/buildPhysicsStory';
import { buildPhysicsStory } from '../../lib/story/buildPhysicsStory';
import PhysicsStoryCard from './PhysicsStoryCard';
import './PhysicsStory.css';

interface Props {
  engineOutput: EngineOutputV1;
  /**
   * Engine input — used to detect demand/fabric signals.
   * Optional; signals that rely on input data will not fire when absent.
   */
  input?: PhysicsStoryEngineInput;
  /** Called when the advisor closes the panel. */
  onClose: () => void;
  /**
   * Called when "Open explainer" is clicked on a card.
   * The explainerId from the card is passed through.
   */
  onOpenExplainer?: (explainerId: string) => void;
  /**
   * Called when "Show simulation" is clicked on a card.
   * The visualiserId from the card is passed through.
   */
  onShowSimulation?: (visualiserId: string) => void;
}

export default function PhysicsStoryPanel({
  engineOutput,
  input,
  onClose,
  onOpenExplainer,
  onShowSimulation,
}: Props) {
  const cards = buildPhysicsStory(engineOutput, input);

  return (
    <div
      className="psp"
      role="region"
      aria-label="Physics Story Mode — why this recommendation"
    >
      {/* Header */}
      <div className="psp__header">
        <div className="psp__header-text">
          <div className="psp__eyebrow">PHYSICS STORY MODE</div>
          <h2 className="psp__title">Why Atlas recommends this</h2>
          <p className="psp__subtitle">
            A short causal sequence — your home, the physics, and the fit.
          </p>
        </div>
        <button
          className="psp__close-btn"
          onClick={onClose}
          aria-label="Close Physics Story Mode"
        >
          ✕ Close
        </button>
      </div>

      {/* Card stack */}
      <div className="psp__cards" aria-label="Story cards">
        {cards.length === 0 ? (
          <div className="psp__empty" role="status">
            <p>No specific physics signals were triggered for this result.</p>
            <p>Review the engine output panels for more detail.</p>
          </div>
        ) : (
          cards.map(card => (
            <PhysicsStoryCard
              key={card.id}
              card={card}
              onOpenExplainer={onOpenExplainer}
              onShowSimulation={onShowSimulation}
            />
          ))
        )}
      </div>
    </div>
  );
}
