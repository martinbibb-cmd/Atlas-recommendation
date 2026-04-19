/**
 * CoverHeroCard.tsx — Screen 1: "Your home, your options"
 *
 * Sets the scene. Large hero card, minimal text.
 * Pure presentation — no physics logic.
 */

import type { BestAdvice, QuoteInsight } from './insightPack.types';
import './CoverHeroCard.css';

interface Props {
  quotes: QuoteInsight[];
  bestAdvice: BestAdvice;
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

export default function CoverHeroCard({ quotes, bestAdvice, propertyTitle, date }: Props) {
  const bestQuote = quotes.find(q => q.quote.id === bestAdvice.recommendedQuoteId);
  const displayDate = date
    ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

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
        <h1 className="cover-hero__headline">
          Your heating and hot water options
        </h1>
        <p className="cover-hero__subline">
          Clear advice based on how your home works
        </p>
      </div>

      {/* Summary chips */}
      <div className="cover-hero__chips">
        {quotes[0] && (
          <div className="cover-chip cover-chip--neutral">
            <span className="cover-chip__label">Current system</span>
            <span className="cover-chip__value">
              {SYSTEM_TYPE_SHORT[quotes[0].quote.systemType] ?? quotes[0].quote.systemType}
            </span>
          </div>
        )}

        <div className="cover-chip cover-chip--neutral">
          <span className="cover-chip__label">Options reviewed</span>
          <span className="cover-chip__value">{quotes.length}</span>
        </div>

        {bestQuote && (
          <div className="cover-chip cover-chip--recommended">
            <span className="cover-chip__label">Atlas best fit</span>
            <span className="cover-chip__value">
              {SYSTEM_TYPE_SHORT[bestQuote.quote.systemType] ?? bestQuote.quote.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
