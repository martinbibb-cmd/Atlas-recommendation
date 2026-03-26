/**
 * FitMapResultPage
 *
 * Dedicated post-survey framing step that shows the System Fit Map in a
 * light-card context, positioned in the journey as:
 *
 *   Survey → Fit Map (this page) → Presentation / Simulator
 *
 * Props are derived from the completed survey (EngineInputV2_3) so the
 * fit position is always grounded in real household data, not placeholders.
 */

import type { FitPosition } from '../../logic/fit-map/computeFitPosition';
import SystemFitMap from './SystemFitMap';
import './FitMapResultPage.css';

interface Props {
  fitPosition: FitPosition;
  /** Called when the user taps "Continue to workspace". */
  onContinue: () => void;
  /** Optional — called when the user wants to open the in-room presentation. */
  onOpenPresentation?: () => void;
  /** Optional — called when the user wants to review the full physics explainer. */
  onShowExplainer?: (system: FitPosition['nearestSystem']) => void;
}

export default function FitMapResultPage({ fitPosition, onContinue, onOpenPresentation, onShowExplainer }: Props) {
  return (
    <div className="fit-map-result-page">
      <div className="fit-map-result-page__card">
        <h1 className="fit-map-result-page__title">Where your home sits</h1>
        <p className="fit-map-result-page__subtitle">
          Based on your survey answers, here is how your household maps against
          the main system families. All systems can work — this shows which
          fits best.
        </p>

        <SystemFitMap fitPosition={fitPosition} onShowExplainer={onShowExplainer} />

        <div className="fit-map-result-page__actions">
          {onOpenPresentation != null && (
            <button
              className="fit-map-result-page__presentation-btn"
              onClick={onOpenPresentation}
              aria-label="Open in-room presentation"
            >
              ▶ Open in-room presentation
            </button>
          )}
          <button
            className="fit-map-result-page__continue"
            onClick={onContinue}
            aria-label="Continue to workspace"
          >
            Continue to workspace →
          </button>
        </div>
      </div>
    </div>
  );
}
