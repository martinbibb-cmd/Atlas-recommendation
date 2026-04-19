/**
 * NextStepsCard.tsx — Screen 11: Next steps.
 *
 * Closes the deck cleanly with a chosen option summary and clear CTA.
 * Pure presentation — data from InsightPack.nextSteps.
 */

import type { NextSteps } from './insightPack.types';
import './NextStepsCard.css';

interface Props {
  nextSteps: NextSteps;
  onProceed?: () => void;
  onReview?: () => void;
}

function ItemList({ title, icon, items }: { title: string; icon: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="next-steps__section">
      <p className="next-steps__section-title">
        <span aria-hidden="true">{icon}</span> {title}
      </p>
      <ul className="next-steps__list">
        {items.map((item, i) => (
          <li key={`${item.slice(0, 30)}-${i}`} className="next-steps__list-item">
            <span aria-hidden="true">→</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NextStepsCard({ nextSteps, onProceed, onReview }: Props) {
  return (
    <div className="next-steps" data-testid="next-steps-card">
      <h2 className="next-steps__heading">Next steps</h2>

      {/* Chosen option highlight */}
      <div className="next-steps__chosen">
        <p className="next-steps__chosen-eyebrow">Recommended option</p>
        <p className="next-steps__chosen-label">{nextSteps.chosenOptionLabel}</p>
      </div>

      {/* What's included / optional / further improvements */}
      <ItemList title="What is included" icon="✓" items={nextSteps.included} />
      <ItemList title="Optional add-ons" icon="＋" items={nextSteps.optional} />
      <ItemList title="Would improve results further" icon="🚀" items={nextSteps.furtherImprovements} />

      {/* CTAs */}
      <div className="next-steps__ctas">
        {onProceed && (
          <button className="next-steps__cta next-steps__cta--primary" onClick={onProceed}>
            Proceed with this option
          </button>
        )}
        {onReview && (
          <button className="next-steps__cta next-steps__cta--secondary" onClick={onReview}>
            Review the options again
          </button>
        )}
      </div>
    </div>
  );
}
