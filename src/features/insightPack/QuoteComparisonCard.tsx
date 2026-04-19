/**
 * QuoteComparisonCard.tsx — Section 1: Quotes overview.
 * Shows each submitted quote as a clean summary card.
 * No judgement at this stage — that comes in Ratings and BestAdvice panels.
 */

import type { QuoteInsight, BestAdvice } from './insightPack.types';
import './QuoteComparisonCard.css';

interface Props {
  quotes: QuoteInsight[];
  bestAdvice: BestAdvice;
}

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  combi:   'Combination boiler — on-demand hot water',
  system:  'System boiler with unvented cylinder',
  regular: 'Regular boiler with tank-fed hot water',
  ashp:    'Air source heat pump',
};

export default function QuoteComparisonCard({ quotes, bestAdvice }: Props) {
  return (
    <div className="quote-comparison" data-testid="quote-comparison-card">
      <h2 className="quote-comparison__heading">What you were quoted</h2>
      <p className="quote-comparison__sub">
        A summary of each quote — ratings and analysis follow in the next sections.
      </p>
      <div className="quote-comparison__grid">
        {quotes.map(({ quote }) => {
          const isRecommended = quote.id === bestAdvice.recommendedQuoteId;
          return (
            <div
              key={quote.id}
              className={`quote-card${isRecommended ? ' quote-card--recommended' : ''}`}
              data-testid={`quote-card-${quote.id}`}
            >
              <div className="quote-card__label">
                {quote.label}
                {isRecommended && (
                  <span className="quote-card__recommended-badge" style={{ marginLeft: '0.5rem' }}>
                    Atlas pick
                  </span>
                )}
              </div>
              <div className="quote-card__type">
                {SYSTEM_TYPE_LABELS[quote.systemType] ?? quote.systemType}
              </div>
              {quote.heatSourceKw != null && (
                <div className="quote-card__kw">
                  Heat source: {quote.heatSourceKw} kW
                </div>
              )}
              {quote.cylinder != null && (
                <div className="quote-card__cylinder">
                  Cylinder: {quote.cylinder.volumeL}L{' '}
                  {quote.cylinder.type === 'mixergy' ? 'Mixergy (stratified)' : 'standard'}
                </div>
              )}
              {quote.includedUpgrades.length > 0 ? (
                <div className="quote-card__upgrades">
                  ✓ {quote.includedUpgrades.join(', ')}
                </div>
              ) : (
                <div className="quote-card__upgrades--none">No upgrades included</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
