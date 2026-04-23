/**
 * DailyUseCard.tsx — Renders a day-to-day outcome card for the "Daily-use demo" tab.
 *
 * Layout: title → outcomes list
 *
 * Rules:
 *   - No recommendation logic — content from DailyUseCard model.
 *   - Outcome items are concise; no paragraphs.
 *   - Simulator interaction hooks belong in PR5.
 */

import type { DailyUseCard as DailyUseCardModel } from '../../../engine/modules/buildPortalViewModel';
import './DailyUseCard.css';

interface Props {
  card: DailyUseCardModel;
}

export function DailyUseCard({ card }: Props) {
  return (
    <article className="daily-use-card" aria-label={card.title}>
      <h3 className="daily-use-card__title">{card.title}</h3>
      {card.outcomes.length > 0 ? (
        <ul className="daily-use-card__outcomes" aria-label="Day-to-day outcomes">
          {card.outcomes.map((outcome, idx) => (
            <li key={idx} className="daily-use-card__outcome">
              <span className="daily-use-card__marker" aria-hidden="true">✓</span>
              {outcome}
            </li>
          ))}
        </ul>
      ) : (
        <p className="daily-use-card__empty">No day-to-day outcomes available.</p>
      )}
    </article>
  );
}
