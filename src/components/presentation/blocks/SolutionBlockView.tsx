/**
 * SolutionBlockView.tsx — Renders a SolutionBlock as the recommended-system page.
 *
 * Layout:
 *   green accent icon ring → title → outcome → supporting points
 *
 * Rules:
 *   - Green tone signals the positive recommendation.
 *   - No recommendation re-derivation — all content from block.
 */

import type { SolutionBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: SolutionBlock;
}

export function SolutionBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  return (
    <article className="customer-deck__block customer-deck__block--solution" aria-label={block.title}>
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
          <ul className="customer-deck__supporting-points" aria-label="Why this works">
            {block.supportingPoints.slice(0, 3).map((point) => (
              <li key={point} className="customer-deck__supporting-point customer-deck__supporting-point--green">
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
