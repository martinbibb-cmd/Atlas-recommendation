/**
 * CoverHeroCard.tsx — Screen 1: "Your home, your options"
 *
 * Sets the scene. Large hero card, minimal text.
 * Pure presentation — no physics logic.
 */

import type { BestAdvice, CurrentSystemSummary, QuoteInsight } from './insightPack.types';
import './CoverHeroCard.css';

interface Props {
  quotes: QuoteInsight[];
  bestAdvice: BestAdvice;
  /**
   * The currently-installed (pre-replacement) system from the canonical survey.
   * When absent, the cover chip shows "Not recorded".
   */
  currentSystem?: CurrentSystemSummary;
  /** Optional property or customer title, e.g. "42 Elm Street" */
  propertyTitle?: string;
  /** Optional ISO date string */
  date?: string;
}

const SYSTEM_TYPE_SHORT: Record<string, string> = {
  combi:   'Combination boiler',
  system:  'System boiler + cylinder',
  regular: 'Regular boiler + cylinder',
  ashp:    'Air source heat pump',
};

export default function CoverHeroCard({ quotes, bestAdvice, currentSystem, propertyTitle, date }: Props) {
  const bestQuote = quotes.find(q => q.quote.id === bestAdvice.recommendedQuoteId);
  const displayDate = date
    ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Derive the current system chip text from the canonical survey record
  const currentSystemLabel = currentSystem?.label
    ?? (currentSystem?.systemType ? (SYSTEM_TYPE_SHORT[currentSystem.systemType] ?? currentSystem.systemType) : null)
    ?? 'Not recorded';

  // Derive the recommended system label for the hero block.
  // Falls back to bestAdvice.recommendation (engine headline from AtlasDecisionV1)
  // when no quote matches — ensures the recommendation block is always shown
  // when the engine has a clear recommendation, even when no quotes were entered.
  const recommendedSystemLabel = bestQuote
    ? (SYSTEM_TYPE_SHORT[bestQuote.quote.systemType] ?? bestQuote.quote.label)
    : null;
  const displayRecommendation = recommendedSystemLabel ?? bestAdvice.recommendation ?? null;

  // First "because" reason used as a supporting tagline under the recommendation
  const primaryReason = bestAdvice.because[0] ?? null;

  return (
    <div className="cover-hero" data-testid="cover-hero-card">
      {/* Header */}
      <div className="cover-hero__header">
        {propertyTitle && (
          <p className="cover-hero__property">{propertyTitle}</p>
        )}
        <p className="cover-hero__date">{displayDate}</p>
      </div>

      {/* Hero copy */}
      <div className="cover-hero__body">
        <p className="cover-hero__eyebrow">Atlas Assessment</p>
        <h1 className="cover-hero__headline">
          Your heating and hot water options
        </h1>
        <p className="cover-hero__subline">
          Clear advice based on how your home works
        </p>
      </div>

      {/* Prominent recommendation block */}
      {displayRecommendation && (
        <div className="cover-hero__rec-block">
          <p className="cover-hero__rec-label">Atlas recommendation</p>
          <p className="cover-hero__rec-system">{displayRecommendation}</p>
          {primaryReason && (
            <p className="cover-hero__rec-reason">{primaryReason}</p>
          )}
        </div>
      )}

      {/* Summary chips */}
      <div className="cover-hero__chips">
        <div className="cover-chip cover-chip--neutral">
          <span className="cover-chip__label">Current system</span>
          <span className="cover-chip__value">{currentSystemLabel}</span>
        </div>

        <div className="cover-chip cover-chip--neutral">
          <span className="cover-chip__label">Options reviewed</span>
          <span className="cover-chip__value">{quotes.length}</span>
        </div>
      </div>

      {/* Narrative bridge — connects cover to the sections that follow */}
      <p className="cover-hero__bridge">
        Based on how your home uses heat and hot water, this is the system that will perform best day-to-day.
      </p>

      {/* Confidence anchor — reinforces that advice is data-driven */}
      <p className="cover-hero__confidence">
        This recommendation is based on measured heat loss, usage patterns, and system constraints in your home.
      </p>
    </div>
  );
}
