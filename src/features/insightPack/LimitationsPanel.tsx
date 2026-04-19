/**
 * LimitationsPanel.tsx — Section 3: Where each option struggles.
 * Shows physics-grounded limitations per quote.
 * Severity mapped from engine flags — nothing hidden.
 */

import type { QuoteInsight, SystemLimitation } from './insightPack.types';
import './LimitationsPanel.css';

interface Props {
  quotes: QuoteInsight[];
}

const SEVERITY_ICONS: Record<SystemLimitation['severity'], string> = {
  low:    'ℹ️',
  medium: '⚠️',
  high:   '🚫',
};

const CATEGORY_LABELS: Record<SystemLimitation['category'], string> = {
  hot_water:  'Hot water',
  heating:    'Heating',
  pressure:   'Pressure',
  efficiency: 'Efficiency',
};

export default function LimitationsPanel({ quotes }: Props) {
  return (
    <div className="limitations" data-testid="limitations-panel">
      <h2 className="limitations__heading">Where each option struggles</h2>
      <p className="limitations__sub">
        Physics-grounded constraints identified by the Atlas engine — no weaknesses hidden.
      </p>

      {quotes.map(({ quote, limitations }) => (
        <div key={quote.id} className="limitations__quote-block">
          <div className="limitations__quote-label">{quote.label}</div>

          {limitations.length === 0 ? (
            <p className="limitations__none">✅ No significant limitations identified for this home.</p>
          ) : (
            limitations
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return order[a.severity] - order[b.severity];
              })
              .map((lim, i) => (
                <div
                  key={i}
                  className={`limitation-item limitation-item--${lim.severity}`}
                  data-testid={`limitation-${lim.severity}`}
                >
                  <div className="limitation-item__header">
                    <span className="limitation-item__icon">
                      {SEVERITY_ICONS[lim.severity]}
                    </span>
                    <span className="limitation-item__message">{lim.message}</span>
                    <span className="limitation-item__category">
                      {CATEGORY_LABELS[lim.category]}
                    </span>
                  </div>
                  <div className="limitation-item__physics">{lim.physicsReason}</div>
                </div>
              ))
          )}
        </div>
      ))}
    </div>
  );
}
