/**
 * SpatialProofBlockView.tsx — Customer deck view for a SpatialProofBlock.
 *
 * Renders a simple plan-style card showing where the proposed work happens.
 * Keeps the language reassurance-first: no engineer detail, no assumed routes
 * presented as confirmed.
 *
 * Layout:
 *   icon ring → title → outcome sentence → confidence summary (max 3 items)
 *
 * Rules:
 *   - Max 3 supporting confidence points visible to the customer.
 *   - Icons are decorative only; meaning is carried by the text.
 *   - No engineer-only information (no confidence levels, pipe specs, etc.).
 *   - Confidence points that contain uncertainty cues ("assumed", "needs",
 *     "planned", "tbc") use a soft "≈" marker to visually signal
 *     they are indicative rather than confirmed — no alarmist language.
 */

import type { SpatialProofBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';
import { objectIcon } from './spatialProofUtils';

interface Props {
  block: SpatialProofBlock;
}

/** Returns true when a confidence-summary point contains uncertainty language. */
function isUncertain(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('assumed') ||
    lower.includes('needs') ||
    lower.includes('planned') ||
    lower.includes('tbc') ||
    lower.includes('to be confirmed') ||
    lower.includes('check')
  );
}

export function SpatialProofBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  return (
    <article
      className="customer-deck__block customer-deck__block--spatial-proof"
      aria-label={block.title}
    >
      <div
        className="customer-deck__visual-ring customer-deck__visual-ring--small"
        style={{ background: `radial-gradient(circle, ${visual.accentColor}22 0%, transparent 70%)` }}
        aria-label={visual.ariaLabel}
        role="img"
      >
        <span className="customer-deck__visual-icon customer-deck__visual-icon--small" aria-hidden="true">
          {visual.icon}
        </span>
      </div>

      <div className="customer-deck__block-body">
        <h2 className="customer-deck__title">{block.title}</h2>
        <p className="customer-deck__outcome">{block.outcome}</p>

        {/* Key object chips */}
        {block.keyObjects.length > 0 && (
          <ul className="spatial-proof__objects" aria-label="Proposed system components">
            {block.keyObjects.map((obj) => (
              <li key={obj} className="spatial-proof__object-chip">
                <span aria-hidden="true">{objectIcon(obj)}</span>
                {obj}
              </li>
            ))}
          </ul>
        )}

        {/* Confidence summary — max 3 items, reassurance-first.
            Uncertain items use a soft ≈ marker so they read as indicative
            rather than confirmed, without alarming language. */}
        {block.confidenceSummary.length > 0 && (
          <ul
            className="customer-deck__supporting-points"
            aria-label="Installation status"
          >
            {block.confidenceSummary.slice(0, 3).map((point) => (
              <li key={point} className="customer-deck__supporting-point">
                {isUncertain(point) ? (
                  <span className="customer-deck__point-marker customer-deck__point-marker--soft" aria-hidden="true">≈</span>
                ) : (
                  <span className="customer-deck__point-marker" aria-hidden="true">✓</span>
                )}
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
