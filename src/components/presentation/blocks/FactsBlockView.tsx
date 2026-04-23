/**
 * FactsBlockView.tsx — Renders a FactsBlock as a data-card page.
 *
 * Layout:
 *   icon ring → title → outcome → facts grid → supporting points
 *
 * Rules:
 *   - All fact labels and values come directly from block.facts.
 *   - No math or re-derivation of values here.
 */

import type { FactsBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: FactsBlock;
}

export function FactsBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  return (
    <article className="customer-deck__block customer-deck__block--facts" aria-label={block.title}>
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

        {/* Facts grid */}
        {block.facts.length > 0 && (
          <dl className="customer-deck__facts-grid" aria-label="Key facts">
            {block.facts.map((fact) => (
              <div key={fact.label} className="customer-deck__fact-item">
                <dt className="customer-deck__fact-label">{fact.label}</dt>
                <dd className="customer-deck__fact-value">{String(fact.value)}</dd>
              </div>
            ))}
          </dl>
        )}

        {block.supportingPoints && block.supportingPoints.length > 0 && (
          <ul className="customer-deck__supporting-points" aria-label="Supporting context">
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
