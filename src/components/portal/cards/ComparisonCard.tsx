/**
 * ComparisonCard.tsx — Renders a single scenario comparison card for the
 * "Compare other options" tab.
 *
 * Layout:
 *   recommended badge (when applicable) → system title → fit summary
 *   → strengths → constraints
 *
 * Rules:
 *   - No recommendation logic — isRecommended comes from the model.
 *   - Recommended card is visually primary; alternatives are subordinate.
 *   - All text from ComparisonCard model fields.
 */

import type { ComparisonCard as ComparisonCardModel } from '../../../engine/modules/buildPortalViewModel';
import './ComparisonCard.css';

interface Props {
  card: ComparisonCardModel;
}

export function ComparisonCard({ card }: Props) {
  return (
    <article
      className={`comparison-card${card.isRecommended ? ' comparison-card--recommended' : ''}`}
      aria-label={card.isRecommended ? `${card.title} — recommended` : card.title}
    >
      {card.isRecommended && (
        <span className="comparison-card__badge" aria-label="Atlas recommendation">
          ✓ Recommended
        </span>
      )}
      <h3 className="comparison-card__title">{card.title}</h3>
      <p className="comparison-card__summary">{card.summary}</p>

      {card.strengths.length > 0 && (
        <section className="comparison-card__section" aria-label="Strengths">
          <p className="comparison-card__section-label">Strengths</p>
          <ul className="comparison-card__list">
            {card.strengths.map((s) => (
              <li key={s} className="comparison-card__list-item comparison-card__list-item--strength">
                <span className="comparison-card__marker" aria-hidden="true">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.constraints.length > 0 && (
        <section className="comparison-card__section" aria-label="Constraints">
          <p className="comparison-card__section-label">Constraints</p>
          <ul className="comparison-card__list">
            {card.constraints.map((c) => (
              <li key={c} className="comparison-card__list-item comparison-card__list-item--constraint">
                <span className="comparison-card__marker" aria-hidden="true">→</span>
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
