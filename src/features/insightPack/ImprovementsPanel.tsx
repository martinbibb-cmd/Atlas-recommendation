/**
 * ImprovementsPanel.tsx — Section 6: Improve each option (selling layer).
 * Shows physics-grounded upgrades per quote with measurable impact.
 */

import type { QuoteInsight, Improvement } from './insightPack.types';
import './ImprovementsPanel.css';

interface Props {
  quotes: QuoteInsight[];
}

const IMPACT_ICONS: Record<Improvement['impact'], string> = {
  performance: '⚡',
  efficiency:  '♻️',
  longevity:   '🔧',
};

const IMPACT_LABELS: Record<Improvement['impact'], string> = {
  performance: 'Performance',
  efficiency:  'Efficiency',
  longevity:   'Longevity',
};

export default function ImprovementsPanel({ quotes }: Props) {
  return (
    <div className="improvements" data-testid="improvements-panel">
      <h2 className="improvements__heading">How to improve each option</h2>
      <p className="improvements__sub">
        Physics-grounded upgrades with measurable impact — every recommendation has a documented reason.
      </p>

      {quotes.map(({ quote, improvements }) => (
        <div key={quote.id} className="improvements__quote-block">
          <div className="improvements__quote-label">{quote.label}</div>

          {improvements.length === 0 ? (
            <p className="improvements__none">✅ No additional improvements identified based on current survey data.</p>
          ) : (
            improvements.map((imp, i) => (
              <div key={i} className="improvement-card" data-testid={`improvement-${imp.impact}`}>
                <div className="improvement-card__header">
                  <span>{IMPACT_ICONS[imp.impact]}</span>
                  <span className="improvement-card__title">{imp.title}</span>
                  <span className={`improvement-card__impact improvement-card__impact--${imp.impact}`}>
                    {IMPACT_LABELS[imp.impact]}
                  </span>
                </div>
                <div className="improvement-card__explanation">{imp.explanation}</div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
