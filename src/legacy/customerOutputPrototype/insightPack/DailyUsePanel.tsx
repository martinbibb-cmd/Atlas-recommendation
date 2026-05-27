/**
 * DailyUsePanel.tsx — Section 2: What that means day-to-day.
 * Translates system spec into lived-experience statements derived from the engine.
 * Pure presentation — all data from QuoteInsight.dailyUse.
 */

import type { QuoteInsight } from './insightPack.types';
import './DailyUsePanel.css';

interface Props {
  quotes: QuoteInsight[];
  /**
   * When provided, the matching quote is shown first with a
   * "Recommended option" badge — used in customer-pack mode to
   * give the recommended system clear visual priority.
   */
  recommendedQuoteId?: string;
}

const SCENARIO_ICONS: Record<string, string> = {
  simultaneous_draw: '🚿',
  pressure:          '💧',
  recovery:          '⏱️',
  efficiency:        '⚡',
  general:           '🏠',
};

export default function DailyUsePanel({ quotes, recommendedQuoteId }: Props) {
  // When a recommended quote is specified, render it first and badge it.
  const orderedQuotes = recommendedQuoteId
    ? [
        ...quotes.filter(q => q.quote.id === recommendedQuoteId),
        ...quotes.filter(q => q.quote.id !== recommendedQuoteId),
      ]
    : quotes;

  return (
    <div className="daily-use" data-testid="daily-use-panel">
      <h2 className="daily-use__heading">What that means day-to-day</h2>
      <p className="daily-use__sub">
        Here's what that means for you in everyday use.
      </p>

      {orderedQuotes.map(({ quote, dailyUse }) => {
        const isRecommended = quote.id === recommendedQuoteId;
        return (
          <div
            key={quote.id}
            className={`daily-use__quote-block${isRecommended ? ' daily-use__quote-block--recommended' : ''}`}
          >
            <div className="daily-use__quote-header">
              <span className="daily-use__quote-label">{quote.label}</span>
              {isRecommended && (
                <span className="daily-use__rec-badge" aria-label="Recommended option">
                  ✓ Recommended
                </span>
              )}
            </div>
            {dailyUse.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                No daily-use data available for this system type.
              </p>
            ) : (
              <ul className="daily-use__list">
                {dailyUse.map((item, i) => (
                  <li key={i} className="daily-use__item">
                    <span className="daily-use__item-icon">
                      {SCENARIO_ICONS[item.scenario] ?? '🏠'}
                    </span>
                    <span>{item.statement}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
