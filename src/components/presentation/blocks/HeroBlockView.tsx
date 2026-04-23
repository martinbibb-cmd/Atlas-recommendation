/**
 * HeroBlockView.tsx — Renders a HeroBlock as the opening deck page.
 *
 * Layout:
 *   large visual icon ring → title → outcome sentence → supporting points
 *
 * Rules:
 *   - No recommendation logic — all content from the block.
 *   - visualKey drives artwork selection via VisualRegistry.
 */

import type { HeroBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: HeroBlock;
}

export function HeroBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  return (
    <article className="customer-deck__block customer-deck__block--hero" aria-label={block.title}>
      {/* Large visual area */}
      <div
        className="customer-deck__visual-ring"
        style={{ background: `radial-gradient(circle, ${visual.accentColor}22 0%, transparent 70%)` }}
        aria-label={visual.ariaLabel}
        role="img"
      >
        <span className="customer-deck__visual-icon" aria-hidden="true">
          {visual.icon}
        </span>
      </div>

      {/* Text content */}
      <div className="customer-deck__block-body">
        <h1 className="customer-deck__title">{block.title}</h1>
        <p className="customer-deck__outcome">{block.outcome}</p>
        {block.supportingPoints && block.supportingPoints.length > 0 && (
          <ul className="customer-deck__supporting-points" aria-label="Key points">
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
