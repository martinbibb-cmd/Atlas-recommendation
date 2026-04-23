/**
 * DailyUseBlockView.tsx — Renders a DailyUseBlock as a day-in-the-life page.
 *
 * Layout:
 *   icon ring → title → outcome → examples list → supporting points
 *
 * Rules:
 *   - All examples come directly from block.examples — no new text generated here.
 *   - Keep tone warm and experiential, not technical.
 */

import type { DailyUseBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: DailyUseBlock;
}

export function DailyUseBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  return (
    <article className="customer-deck__block customer-deck__block--daily-use" aria-label={block.title}>
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

        {block.examples.length > 0 && (
          <ul className="customer-deck__examples" aria-label="Day-to-day examples">
            {block.examples.map((example) => (
              <li key={example} className="customer-deck__example-item">
                <span className="customer-deck__point-marker" aria-hidden="true">→</span>
                {example}
              </li>
            ))}
          </ul>
        )}

        {block.supportingPoints && block.supportingPoints.length > 0 && (
          <ul className="customer-deck__supporting-points" aria-label="Key details">
            {block.supportingPoints.slice(0, 3).map((point) => (
              <li key={point} className="customer-deck__supporting-point">
                <span className="customer-deck__point-marker" aria-hidden="true">✓</span>
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
