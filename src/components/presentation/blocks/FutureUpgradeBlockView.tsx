/**
 * FutureUpgradeBlockView.tsx — Renders a FutureUpgradeBlock as future-pathways page.
 *
 * Layout:
 *   purple-accent icon ring → title → outcome → paths list → supporting points
 *
 * Rules:
 *   - All paths come directly from block.paths — no filtering or reordering.
 *   - Tone is optimistic and forward-looking.
 */

import type { FutureUpgradeBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: FutureUpgradeBlock;
}

export function FutureUpgradeBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  return (
    <article className="customer-deck__block customer-deck__block--future-upgrade" aria-label={block.title}>
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

        {block.paths.length > 0 && (
          <ul className="customer-deck__paths-list" aria-label="Future upgrade options">
            {block.paths.map((path) => (
              <li key={path} className="customer-deck__path-item">
                <span className="customer-deck__point-marker" aria-hidden="true">→</span>
                {path}
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
