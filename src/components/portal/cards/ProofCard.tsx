/**
 * ProofCard.tsx — Renders a single proof card for the "Why Atlas chose this" tab.
 *
 * Layout: category badge → title → value sentence → optional supporting points
 *
 * Rules:
 *   - No recommendation logic — all content from the ProofCard model.
 *   - Short and card-based; no long paragraphs.
 */

import type { ProofCard as ProofCardModel } from '../../../engine/modules/buildPortalViewModel';
import './ProofCard.css';

interface Props {
  card: ProofCardModel;
}

export function ProofCard({ card }: Props) {
  return (
    <article className="proof-card" aria-label={card.title}>
      <p className="proof-card__title">{card.title}</p>
      <p className="proof-card__value">{card.value}</p>
      {card.supportingPoints && card.supportingPoints.length > 0 && (
        <ul className="proof-card__points" aria-label="Supporting details">
          {card.supportingPoints.slice(0, 3).map((point) => (
            <li key={point} className="proof-card__point">
              <span className="proof-card__point-marker" aria-hidden="true">→</span>
              {point}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
