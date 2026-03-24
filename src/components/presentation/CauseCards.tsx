/**
 * CauseCards.tsx — Presentation Layer v1.
 *
 * Shows the top 2–3 limiters translated into human language.
 * Data source: LimiterLedger (PR8).
 *
 * The severest limiters are shown first (hard_stop → limit → warning → info).
 * Each card shows one headline sentence and an optional detail line.
 *
 * Copy is sourced from limiterHumanLanguage.ts — never raw limiter titles.
 * Accepts optional HouseholdContext to tailor copy to how this home is used.
 * Accepts optional activeLimiterId to highlight the card linked to a clicked
 * timeline event ("wow" interaction).
 */

import type { LimiterLedger } from '../../engine/limiter/LimiterLedger';
import type { PresentationMode } from './presentationTypes';
import { getLimiterHumanCopy, type HouseholdContext } from './limiterHumanLanguage';
import './CauseCards.css';

// ─── Severity sort order ──────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  hard_stop: 0,
  limit:     1,
  warning:   2,
  info:      3,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  limiterLedger: LimiterLedger;
  mode: PresentationMode;
  /** Maximum number of cause cards to show. Defaults to 3. */
  maxCards?: number;
  /** Household context used to tailor copy to how this home is actually used. */
  householdContext?: HouseholdContext;
  /**
   * When set, the cause card whose limiter ID matches will be visually
   * highlighted — linking it to a clicked event in the timeline strip.
   */
  activeLimiterId?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CauseCards({
  limiterLedger,
  mode,
  maxCards = 3,
  householdContext,
  activeLimiterId,
}: Props) {
  const isProposed = mode === 'proposed';

  // Sort by severity and take top N
  const topLimiters = [...limiterLedger.entries]
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
    )
    .slice(0, maxCards);

  if (topLimiters.length === 0) {
    return (
      <section className="cause-cards" aria-label="Why this happens">
        <p className="cause-cards__heading">
          {isProposed ? 'Why this works for your home' : 'Why this happens'}
        </p>
        <p className="cause-cards__empty">
          {isProposed
            ? 'This system has no significant constraints in your home.'
            : 'No significant issues identified.'}
        </p>
      </section>
    );
  }

  return (
    <section className="cause-cards" aria-label={isProposed ? 'Why this system works' : 'Why this happens'}>
      <p className="cause-cards__heading">
        {isProposed ? 'Why this works for your home' : 'Why this happens'}
      </p>
      <div className="cause-cards__list">
        {topLimiters.map((entry) => {
          const copy = getLimiterHumanCopy(entry.id, householdContext);
          const isActive = activeLimiterId != null && activeLimiterId === entry.id;
          const baseClass = isProposed ? 'improvement' : entry.severity;
          return (
            <div
              key={entry.id}
              data-limiter-id={entry.id}
              className={[
                'cause-card',
                `cause-card--${baseClass}`,
                isActive ? 'cause-card--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="article"
              aria-current={isActive ? 'true' : undefined}
            >
              <p className="cause-card__headline">{copy.headline}</p>
              {copy.detail && (
                <p className="cause-card__detail">{copy.detail}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
