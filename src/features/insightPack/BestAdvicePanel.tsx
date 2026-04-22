/**
 * BestAdvicePanel.tsx — Section 5: Atlas best advice.
 * One clear recommendation with physics-grounded because / avoids lists.
 */

import type { BestAdvice } from './insightPack.types';
import './BestAdvicePanel.css';

interface Props {
  bestAdvice: BestAdvice;
}

export default function BestAdvicePanel({ bestAdvice }: Props) {
  return (
    <div className="best-advice" data-testid="best-advice-panel">
      <div className="best-advice__intro">
        <h2 className="best-advice__heading">Best advice</h2>
        <p className="best-advice__sub">
          One clear recommendation, derived from your home's physics — not a preference.
        </p>
      </div>

      <div className="best-advice__rec-card">
        <p className="best-advice__rec-eyebrow">🎯 Atlas recommendation</p>
        <p className="best-advice__rec-text">{bestAdvice.recommendation}</p>
      </div>

      {bestAdvice.because.length > 0 && (
        <div className="best-advice__section">
          <p className="best-advice__section-title">Why this works for your home</p>
          <ul className="best-advice__list">
            {bestAdvice.because.map((reason, i) => (
              <li key={i} className="best-advice__list-item best-advice__list-item--because">
                <span className="best-advice__item-icon" aria-hidden="true">✓</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bestAdvice.avoids.length > 0 && (
        <div className="best-advice__section">
          <p className="best-advice__section-title">What this avoids</p>
          <ul className="best-advice__list">
            {bestAdvice.avoids.map((avoid, i) => (
              <li key={i} className="best-advice__list-item best-advice__list-item--avoids">
                <span className="best-advice__item-icon" aria-hidden="true">✗</span>
                <span>{avoid}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
