/**
 * OverviewInsightCard.tsx
 *
 * Reusable image-first summary card for the "What We Know" overview page.
 *
 * Card shape (collapsed):
 *   [media area — 140 px tall, soft background]
 *   heading
 *   chips (2–3 strongest facts)
 *   one-liner summary
 *   [takeaway strip — visually distinct background]
 *
 * Card shape (expanded):
 *   heading + close button
 *   full detail content (supplied by caller)
 *
 * Rules:
 *   - No Math.random()
 *   - All strings supplied by the caller from canonical signals / PrioritiesState
 *   - mediaContent accepts any ReactNode — <img>, SVG, or a physics visual
 */

import type { ReactNode, KeyboardEvent } from 'react';
import './OverviewInsightCard.css';

function onCardKeyDown(event: KeyboardEvent<HTMLElement>, onToggle: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onToggle();
  }
}

export interface OverviewInsightCardProps {
  /** Card title shown below the media area */
  title: string;
  /** Up to 3 chips displayed below the title in collapsed state */
  chips: string[];
  /** Short one-line description sentence */
  summary: string;
  /** Short highlighted takeaway — the single most important insight */
  takeaway: string;
  /** Visual tone of the takeaway strip */
  tone?: 'neutral' | 'positive' | 'caution';
  /** Content for the fixed-height media area */
  mediaContent?: ReactNode;
  /** Optional CSS background colour override for the media area */
  mediaBg?: string;
  /** Whether this card is currently in expanded detail state */
  expanded: boolean;
  /** Toggle expand / collapse */
  onToggle: () => void;
  /** Full detail content shown when the card is expanded */
  detailContent?: ReactNode;
  /** Accessible label for the card button */
  ariaLabel?: string;
  /** Accessible label for the expanded detail region */
  detailAriaLabel?: string;
  /**
   * CSS colour-theme modifier class.
   * Should be one of: 'oic--house' | 'oic--home' | 'oic--system' | 'oic--priorities'
   */
  colorClass?: string;
}

export default function OverviewInsightCard({
  title,
  chips,
  summary,
  takeaway,
  tone = 'neutral',
  mediaContent,
  mediaBg,
  expanded,
  onToggle,
  detailContent,
  ariaLabel,
  detailAriaLabel,
  colorClass = '',
}: OverviewInsightCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`oic ${colorClass}${expanded ? ' oic--expanded' : ''}`}
      onClick={onToggle}
      onKeyDown={event => onCardKeyDown(event, onToggle)}
      aria-expanded={expanded}
      aria-label={ariaLabel ?? title}
    >
      {!expanded && (
        <>
          {/* ── Media area ── */}
          {mediaContent != null && (
            <div
              className="oic__media"
              style={mediaBg != null ? { background: mediaBg } : undefined}
              aria-hidden="true"
            >
              {mediaContent}
            </div>
          )}

          {/* ── Title ── */}
          <p className="oic__title">{title}</p>

          {/* ── Chips ── */}
          {chips.length > 0 && (
            <div className="oic__chips" aria-hidden="true">
              {chips.map((chip, i) => (
                <span key={i} className="oic__chip">{chip}</span>
              ))}
            </div>
          )}

          {/* ── Summary ── */}
          {summary !== '' && <p className="oic__summary">{summary}</p>}

          {/* ── Takeaway strip ── */}
          {takeaway !== '' && (
            <div className={`oic__takeaway oic__takeaway--${tone}`}>
              {takeaway}
            </div>
          )}
        </>
      )}

      {/* ── Expanded view ── */}
      {expanded && (
        <>
          <div className="oic__expanded-header">
            <span className="oic__expanded-title">{title}</span>
            <button
              type="button"
              className="oic__close"
              onClick={e => { e.stopPropagation(); onToggle(); }}
            >
              Close
            </button>
          </div>
          {detailContent != null && (
            <div className="oic__detail" role="region" aria-label={detailAriaLabel ?? `${title} details`}>
              {detailContent}
            </div>
          )}
        </>
      )}
    </div>
  );
}
