/**
 * PackShowroomStep.tsx
 *
 * Step 2 of the Atlas Installation Specification: "Quote Pack Showroom".
 *
 * Presents evidence-derived pack cards based on the canonical survey and
 * the Atlas engine recommendation.  The surveyor selects one pack as the
 * starting point for the quote, which pre-populates the proposed system
 * and hot-water selections for the remaining steps.
 *
 * Design rules:
 *   - Opening preamble shows what Atlas already knows (existing system +
 *     site conditions + engine recommendation).
 *   - Pack cards are derived from evidence — not a blank list of options.
 *   - The recommended pack ("Best advice") is visually highlighted.
 *   - Selecting a pack pre-populates proposed heat source and hot water.
 *   - A pack must be selected before the surveyor can advance.
 *   - Does not collect new survey data.
 *   - Does not alter recommendation decisions.
 */

import type {
  QuotePackCardV1,
  QuotePackKindV1,
  QuotePackShowroomContextV1,
  QuotePackDisruptionLevel,
} from '../../model/QuotePackV1';
import type {
  UiProposedHeatSourceLabel,
  UiProposedHotWaterLabel,
} from '../installationSpecificationUiTypes';
import type { EvidenceCaptureRef } from '../../../../features/scanEvidence/EvidenceProofLinkV1';
import { EvidenceExplainerCard } from '../../../../features/scanEvidence/EvidenceExplainerCard';

// ─── Disruption level display ─────────────────────────────────────────────────

const DISRUPTION_LABELS: Record<QuotePackDisruptionLevel, string> = {
  low:    'Low disruption',
  medium: 'Medium disruption',
  high:   'High disruption',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PackShowroomStepProps {
  /**
   * Evidence context for the showroom header.
   * Shows what Atlas already knows before presenting the packs.
   */
  showroomContext: QuotePackShowroomContextV1;

  /**
   * Pack cards to display.
   * Derived from survey + engine data by `buildDefaultQuotePacks`.
   */
  packCards: QuotePackCardV1[];

  /**
   * Currently selected pack kind.
   * Null when no pack has been selected yet.
   */
  selectedPackKind: QuotePackKindV1 | null;

  /**
   * Called when the surveyor selects a pack.
   * Receives the pack kind, proposed heat source, and proposed hot water.
   */
  onSelectPack: (
    packKind: QuotePackKindV1,
    proposedHeatSource: UiProposedHeatSourceLabel,
    proposedHotWater: UiProposedHotWaterLabel | null,
  ) => void;

  /**
   * Called when the user clicks a capture-point evidence pill.
   * Receives the capturePointId and storyboard card key so the caller can
   * navigate to the evidence viewer at that specific point.
   *
   * When absent, evidence pills are still rendered but are not clickable links.
   */
  onOpenEvidenceCapture?: (
    capturePointId: string,
    storyboardCardKey: EvidenceCaptureRef['storyboardCardKey'],
  ) => void;

  /**
   * When true, only confirmed (reviewed) evidence refs are shown in the
   * proof block.  Unresolved evidence is hidden entirely.
   * Defaults to false (engineer mode — all refs visible).
   */
  customerFacing?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PackShowroomStep({
  showroomContext,
  packCards,
  selectedPackKind,
  onSelectPack,
  onOpenEvidenceCapture,
  customerFacing = false,
}: PackShowroomStepProps) {
  return (
    <>
      <h2 className="qp-step-heading">Quote Pack Showroom</h2>
      <p className="qp-step-subheading">
        Select a pack as the starting point for this quote.
      </p>

      {/* ── Evidence preamble ──────────────────────────────────────────── */}
      <div className="pack-showroom__context" data-testid="pack-showroom-context">
        <p className="pack-showroom__context-summary">
          {showroomContext.existingSystemSummary}
        </p>

        {showroomContext.siteConditions.length > 0 && (
          <div className="pack-showroom__context-conditions">
            <span className="pack-showroom__context-label">Site conditions:</span>
            <ul className="pack-showroom__conditions-list">
              {showroomContext.siteConditions.map((condition, i) => (
                <li key={i}>{condition}</li>
              ))}
            </ul>
          </div>
        )}

        {showroomContext.recommendationReason != null && (
          <p className="pack-showroom__context-reason">
            <strong>Atlas recommendation: </strong>
            {showroomContext.recommendationReason}
          </p>
        )}
      </div>

      {/* ── Pack cards ─────────────────────────────────────────────────── */}
      <div className="pack-showroom__cards" role="radiogroup" aria-label="Select a quote pack">
        {packCards.map((card) => {
          const isSelected = selectedPackKind === card.kind;

          return (
            <div
              key={card.kind}
              className={[
                'pack-card',
                isSelected         ? 'pack-card--selected'    : '',
                card.isRecommended ? 'pack-card--recommended' : '',
              ].filter(Boolean).join(' ')}
              data-testid={`pack-card-${card.kind}`}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelectPack(card.kind, card.proposedHeatSource, card.proposedHotWater)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectPack(card.kind, card.proposedHeatSource, card.proposedHotWater);
                }
              }}
            >
              {card.isRecommended && (
                <span className="pack-card__recommended-badge">Atlas recommendation</span>
              )}

              <h3 className="pack-card__title">{card.title}</h3>

              <p className="pack-card__best-for">
                <strong>Best for: </strong>{card.bestFor}
              </p>

              <p className="pack-card__why">
                {card.whySuggested}
              </p>

              <ul className="pack-card__highlights">
                {card.includedHighlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>

              {card.warningsOrVerification.length > 0 && (
                <div className="pack-card__warnings">
                  <span className="pack-card__warnings-label">Needs verification:</span>
                  <ul>
                    {card.warningsOrVerification.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {card.evidenceProofLinks && card.evidenceProofLinks.length > 0 && (
                <EvidenceExplainerCard
                  links={card.evidenceProofLinks}
                  customerFacing={customerFacing}
                  onOpenCapturePoint={onOpenEvidenceCapture}
                />
              )}

              <div className="pack-card__footer">
                <span className="pack-card__disruption">
                  {DISRUPTION_LABELS[card.disruptionLevel]}
                </span>

                <button
                  type="button"
                  className={['pack-card__select-btn', isSelected ? 'pack-card__select-btn--active' : ''].filter(Boolean).join(' ')}
                  aria-label={`Use ${card.title} pack`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPack(card.kind, card.proposedHeatSource, card.proposedHotWater);
                  }}
                >
                  {isSelected ? '✓ Selected' : 'Use this pack'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedPackKind == null && (
        <p className="pack-showroom__no-selection-hint" role="status">
          Select a pack above to continue.
        </p>
      )}
    </>
  );
}
