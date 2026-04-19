/**
 * DailyUsePanel.tsx — Section 2: What that means day-to-day.
 * Translates system spec into lived-experience statements derived from the engine.
 * Pure presentation — all data from QuoteInsight.dailyUse.
 */

import type { QuoteInsight } from './insightPack.types';
import './DailyUsePanel.css';

interface Props {
  quotes: QuoteInsight[];
}

const SCENARIO_ICONS: Record<string, string> = {
  simultaneous_draw: '🚿',
  pressure:          '💧',
  recovery:          '⏱️',
  efficiency:        '⚡',
  general:           '🏠',
};

export default function DailyUsePanel({ quotes }: Props) {
  return (
    <div className="daily-use" data-testid="daily-use-panel">
      <h2 className="daily-use__heading">What that means day-to-day</h2>
      <p className="daily-use__sub">
        How each quoted system would feel in normal daily use, based on your home's survey data.
      </p>

      {quotes.map(({ quote, dailyUse }) => (
        <div key={quote.id} className="daily-use__quote-block">
          <div className="daily-use__quote-label">{quote.label}</div>
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
      ))}
    </div>
  );
}
