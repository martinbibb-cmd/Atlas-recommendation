/**
 * ProblemBlockView.tsx — Renders a ProblemBlock as a constraint-awareness page.
 *
 * Layout:
 *   warning icon ring → title → outcome → supporting points
 *
 * Rules:
 *   - Warm/amber tone signals a constraint, not a failure.
 *   - No new logic — all content from block.
 */

import type { ProblemBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: ProblemBlock;
}

export function ProblemBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  return (
    <article className="customer-deck__block customer-deck__block--problem" aria-label={block.title}>
      <div
        className="customer-deck__visual-ring"
        style={{ background: `radial-gradient(circle, ${visual.accentColor}33 0%, transparent 70%)` }}
        aria-label={visual.ariaLabel}
        role="img"
      >
        <span className="customer-deck__visual-icon" aria-hidden="true">
          {visual.icon}
        </span>
      </div>

      <div className="customer-deck__block-body">
        <h2 className="customer-deck__title">{block.title}</h2>
        <p className="customer-deck__outcome">{block.outcome}</p>

        {block.supportingPoints && block.supportingPoints.length > 0 && (
          <ul className="customer-deck__supporting-points" aria-label="What this means">
            {block.supportingPoints.slice(0, 3).map((point) => (
              <li key={point} className="customer-deck__supporting-point customer-deck__supporting-point--amber">
                <span className="customer-deck__point-marker" aria-hidden="true">→</span>
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
