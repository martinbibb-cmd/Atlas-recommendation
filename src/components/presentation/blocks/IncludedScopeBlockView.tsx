/**
 * IncludedScopeBlockView.tsx — Renders an IncludedScopeBlock listing what is covered.
 *
 * Layout:
 *   icon ring → title → outcome → items checklist → supporting points
 *
 * Rules:
 *   - Items come directly from block.items — no filtering or reordering here.
 */

import type { IncludedScopeBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: IncludedScopeBlock;
}

export function IncludedScopeBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  return (
    <article className="customer-deck__block customer-deck__block--included-scope" aria-label={block.title}>
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

        {block.items.length > 0 && (
          <ul className="customer-deck__scope-list" aria-label="What is included">
            {block.items.map((item) => (
              <li key={item} className="customer-deck__scope-item">
                <span className="customer-deck__scope-tick" aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        )}

        {block.supportingPoints && block.supportingPoints.length > 0 && (
          <ul className="customer-deck__supporting-points" aria-label="Additional notes">
            {block.supportingPoints.slice(0, 3).map((point) => (
              <li key={point} className="customer-deck__supporting-point">
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
