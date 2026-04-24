/**
 * IncludedScopeBlockView.tsx — Renders an IncludedScopeBlock listing what is covered.
 *
 * Layout:
 *   icon ring → title → outcome → items checklist → supporting points
 *
 * PR13 — Items are QuoteScopeItem[]. Compliance items are shown with a requirement
 * marker rather than a tick, and do not receive a customerBenefit callout.
 *
 * Rules:
 *   - Items come directly from block.items — no filtering or reordering here.
 *   - Compliance items use a neutral "Requirement" label, not a benefit framing.
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
              <li key={item.id} className="customer-deck__scope-item">
                {item.category === 'compliance' ? (
                  <>
                    <span className="customer-deck__scope-tick" aria-hidden="true">📋</span>
                    {item.label}
                    <span className="customer-deck__scope-requirement" aria-label="Regulatory requirement">
                      {' '}(Requirement)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="customer-deck__scope-tick" aria-hidden="true">✓</span>
                    {item.label}
                    {item.customerBenefit && (
                      <span className="customer-deck__scope-benefit">
                        {' — '}{item.customerBenefit}
                      </span>
                    )}
                  </>
                )}
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
