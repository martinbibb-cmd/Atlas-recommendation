/**
 * LimitationsPanel.tsx — Section 3: Where each option struggles.
 * Shows physics-grounded limitations per quote.
 * Severity mapped from engine flags — nothing hidden.
 *
 * In severeOnly mode (customer-pack): shows only high-severity limitations.
 * Low/medium constraints are omitted to keep the customer document focused.
 * Technical details (physicsReason) are also hidden in this mode.
 */

import type { QuoteInsight, SystemLimitation } from './insightPack.types';
import './LimitationsPanel.css';

interface Props {
  quotes: QuoteInsight[];
  /**
   * When true, renders only high-severity limitations per quote.
   * Low and medium constraints are omitted.  physicsReason strings
   * are also hidden — these belong in the technical pack only.
   * Used in customer-pack mode.  Defaults to false.
   */
  severeOnly?: boolean;
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

export default function LimitationsPanel({ quotes, severeOnly = false }: Props) {
  return (
    <div className="limitations" data-testid="limitations-panel">
      <h2 className="limitations__heading">
        {severeOnly ? 'Critical Constraints' : 'Where each option struggles'}
      </h2>
      <p className="limitations__sub">
        {severeOnly
          ? 'Critical physics constraints that affect this home — ask your engineer if any apply.'
          : 'Physics-grounded constraints identified by the Atlas engine — no weaknesses hidden.'}
      </p>

      {quotes.map(({ quote, limitations }) => {
        const visibleLimitations = severeOnly
          ? limitations.filter(l => l.severity === 'high')
          : limitations;

        return (
          <div key={quote.id} className="limitations__quote-block">
            <div className="limitations__quote-label">{quote.label}</div>

            {visibleLimitations.length === 0 ? (
              <p className="limitations__none">
                {severeOnly
                  ? '✅ No critical constraints identified.'
                  : '✅ No material constraints identified based on current survey data.'}
              </p>
            ) : (
              visibleLimitations
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
                    {!severeOnly && (
                      <div className="limitation-item__physics">{lim.physicsReason}</div>
                    )}
                  </div>
                ))
            )}
          </div>
        );
      })}
    </div>
  );
}
