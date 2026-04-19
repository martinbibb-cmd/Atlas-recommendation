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
      <h2 className="best-advice__heading">Best advice</h2>
      <p className="best-advice__sub">
        One clear recommendation, derived from your home's physics — not a preference.
      </p>

      <div className="best-advice__rec-card">
        <p className="best-advice__rec-eyebrow">🎯 Atlas recommendation</p>
        <p className="best-advice__rec-text">{bestAdvice.recommendation}</p>
      </div>

      <div>
        <p className="best-advice__section-title">Because</p>
        <ul className="best-advice__list">
          {bestAdvice.because.map((reason, i) => (
            <li key={i} className="best-advice__list-item">
              <span>✓</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="best-advice__section-title">Avoids</p>
        <ul className="best-advice__list">
          {bestAdvice.avoids.map((avoid, i) => (
            <li key={i} className="best-advice__list-item best-advice__list-item--avoids">
              <span>✗</span>
              <span>{avoid}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
