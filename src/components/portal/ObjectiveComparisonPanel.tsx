/**
 * ObjectiveComparisonPanel.tsx
 *
 * PR8 — Priority selector and comparison panel for the customer portal.
 *
 * Lets the customer tap a priority chip to see how the available options rank
 * for that priority, how the recommended option compares, and (when divergent)
 * how their chosen option compares.
 *
 * Rules:
 *   - Presentation layer only — no engine / scoring changes.
 *   - Calm, chip-based interaction; no dashboards or dense charts.
 *   - Recommendation remains visible and primary at all times.
 *   - All copy is from customerCopy.ts.
 */

import { useState } from 'react';
import type { ObjectiveComparisonView, ObjectivePriorityId } from '../../lib/advice/buildObjectiveComparison';
import { OBJECTIVE_PRIORITY_IDS } from '../../lib/advice/buildObjectiveComparison';
import {
  OBJECTIVE_COMPARISON_HEADING,
  OBJECTIVE_COMPARISON_INTRO,
  PRIORITY_CHIP_LABEL,
  PRIORITY_GOOD_FIT,
  PRIORITY_LESS_STRONG,
  OBJECTIVE_RECOMMENDED_LABEL,
  OBJECTIVE_CHOSEN_LABEL,
} from '../../lib/copy/customerCopy';
import './ObjectiveComparisonPanel.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * Pre-built comparison views keyed by priority ID.
   * Built by buildAllObjectiveComparisons() in CustomerPortalPage.
   */
  comparisonViews: Map<ObjectivePriorityId, ObjectiveComparisonView>;
  /** Label map from option ID → display label (e.g. 'combi' → 'Combi boiler'). */
  optionLabels: Record<string, string>;
  /** True when the customer has chosen a different option from the recommendation. */
  isDivergent?: boolean;
  /** Label of the recommended option — shown in notes heading. */
  recommendedOptionLabel?: string;
  /** Label of the chosen option — shown in notes heading (divergent only). */
  chosenOptionLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ObjectiveComparisonPanel({
  comparisonViews,
  optionLabels,
  isDivergent = false,
  recommendedOptionLabel = 'Recommended option',
  chosenOptionLabel = 'Your chosen option',
}: Props) {
  const [selectedPriority, setSelectedPriority] = useState<ObjectivePriorityId>(
    OBJECTIVE_PRIORITY_IDS[0],
  );

  const view = comparisonViews.get(selectedPriority);
  if (!view) return null;

  const bestOptionId = view.rankedOptionIds[0];
  const bestOptionLabel = optionLabels[bestOptionId] ?? bestOptionId;

  return (
    <div
      className="objective-comparison"
      data-testid="objective-comparison-panel"
    >
      <h2 className="objective-comparison__heading">{OBJECTIVE_COMPARISON_HEADING}</h2>
      <p className="objective-comparison__intro">{OBJECTIVE_COMPARISON_INTRO}</p>

      {/* ── Priority chip row ─────────────────────────────────────────────── */}
      <div
        className="objective-comparison__chips"
        role="tablist"
        aria-label="Select a priority"
        data-testid="priority-chip-row"
      >
        {OBJECTIVE_PRIORITY_IDS.map(id => (
          <button
            key={id}
            role="tab"
            aria-selected={id === selectedPriority}
            aria-controls={`priority-panel-${id}`}
            className={
              `objective-comparison__chip${id === selectedPriority ? ' objective-comparison__chip--active' : ''}`
            }
            onClick={() => setSelectedPriority(id)}
            data-testid={`priority-chip-${id}`}
          >
            {PRIORITY_CHIP_LABEL[id] ?? id}
          </button>
        ))}
      </div>

      {/* ── Comparison panel ──────────────────────────────────────────────── */}
      <div
        className="objective-comparison__panel"
        role="tabpanel"
        id={`priority-panel-${selectedPriority}`}
        aria-label={`Comparison for ${PRIORITY_CHIP_LABEL[selectedPriority]}`}
        data-testid="priority-comparison-content"
      >
        {/* Intro sentence */}
        <p className="objective-comparison__priority-intro">{view.intro}</p>

        {/* Best option callout */}
        {bestOptionId && (
          <div
            className="objective-comparison__best"
            aria-label={`Best option for ${view.title}`}
            data-testid="priority-best-option"
          >
            <span className="objective-comparison__best-label">
              Strongest here:
            </span>{' '}
            <span className="objective-comparison__best-option">
              {bestOptionLabel}
            </span>
          </div>
        )}

        {/* Good fit / less strong descriptions */}
        {PRIORITY_GOOD_FIT[selectedPriority] != null && (
          <p className="objective-comparison__good-fit">
            {PRIORITY_GOOD_FIT[selectedPriority]}
          </p>
        )}
        {PRIORITY_LESS_STRONG[selectedPriority] != null && (
          <p className="objective-comparison__less-strong">
            {PRIORITY_LESS_STRONG[selectedPriority]}
          </p>
        )}

        {/* ── Option notes ──────────────────────────────────────────────── */}
        {(view.recommendedOptionNote != null || (isDivergent && view.chosenOptionNote != null)) && (
          <div
            className="objective-comparison__notes"
            aria-label="How your options compare for this priority"
            data-testid="priority-option-notes"
          >
            {view.recommendedOptionNote != null && (
              <div
                className="objective-comparison__note objective-comparison__note--recommended"
                data-testid="priority-recommended-note"
              >
                <span className="objective-comparison__note-label">
                  {OBJECTIVE_RECOMMENDED_LABEL} ({recommendedOptionLabel}):
                </span>{' '}
                {view.recommendedOptionNote}
              </div>
            )}
            {isDivergent && view.chosenOptionNote != null && (
              <div
                className="objective-comparison__note objective-comparison__note--chosen"
                data-testid="priority-chosen-note"
              >
                <span className="objective-comparison__note-label">
                  {OBJECTIVE_CHOSEN_LABEL} ({chosenOptionLabel}):
                </span>{' '}
                {view.chosenOptionNote}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
