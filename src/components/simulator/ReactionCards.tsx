/**
 * ReactionCards.tsx — Renders the outcome reaction cards for a simulated event.
 *
 * Each reaction card shows:
 *   - A title (short heading)
 *   - An outcome sentence
 *   - Optional supporting points
 *
 * Severity ('good' | 'mixed' | 'warning') drives the visual tone.
 *
 * Rules:
 *   - Pure presenter — content comes from DailyUseReaction[].
 *   - No recommendation logic.
 */

import type { DailyUseReaction } from '../../contracts/DailyUseSimulation';
import './ReactionCards.css';

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<DailyUseReaction['severity'], string> = {
  good:    '✓',
  mixed:   '~',
  warning: '!',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  reactions: DailyUseReaction[];
}

export function ReactionCards({ reactions }: Props) {
  if (reactions.length === 0) {
    return <p className="reaction-cards__empty">No outcomes for this event.</p>;
  }

  return (
    <div className="reaction-cards" role="list" aria-label="Outcomes">
      {reactions.map((reaction, idx) => (
        <article
          key={idx}
          className={`reaction-card reaction-card--${reaction.severity}`}
          role="listitem"
          aria-label={reaction.title}
        >
          <div className="reaction-card__header">
            <span
              className={`reaction-card__icon reaction-card__icon--${reaction.severity}`}
              aria-hidden="true"
            >
              {SEVERITY_ICON[reaction.severity]}
            </span>
            <h4 className="reaction-card__title">{reaction.title}</h4>
          </div>

          <p className="reaction-card__outcome">{reaction.outcome}</p>

          {reaction.supportingPoints && reaction.supportingPoints.length > 0 && (
            <ul className="reaction-card__points" aria-label="Supporting detail">
              {reaction.supportingPoints.map((point, i) => (
                <li key={i} className="reaction-card__point">
                  <span className="reaction-card__point-marker" aria-hidden="true">·</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}
