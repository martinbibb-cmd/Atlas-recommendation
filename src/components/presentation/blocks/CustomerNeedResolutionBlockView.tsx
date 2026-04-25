/**
 * CustomerNeedResolutionBlockView.tsx
 *
 * Renders a CustomerNeedResolutionBlock as a personalised
 * "You told us → We're doing → So you get" table.
 *
 * Each row surfaces one survey-observed need with:
 *   - The customer's experience ("You told us…")
 *   - The action being taken ("We're doing…")
 *   - The benefit to the customer ("So you get…")
 *   - An optional evidence phrase in muted italic text beneath
 *     the need line, grounding the item in the customer's home.
 *
 * Rules:
 *   - Evidence phrase rendered in smaller, muted text below the need line.
 *   - No jargon; no raw metrics; no alarm language.
 *   - Capped at 4 items — 3 is optimal.
 *   - Confidence badge omitted from customer view (internal signal only).
 */

import type { CustomerNeedResolutionBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: CustomerNeedResolutionBlock;
}

export function CustomerNeedResolutionBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);
  const items = block.items.slice(0, 4); // max 4; 3 is optimal — 4 acceptable when all signals are direct

  return (
    <article
      className="customer-deck__block customer-deck__block--need-resolution"
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

        <div className="cnr-table" role="table" aria-label="What matters to you">
          {/* Column headers */}
          <div className="cnr-table__header" role="row" aria-hidden="true">
            <span className="cnr-table__col-label cnr-table__col-label--need">You told us</span>
            <span className="cnr-table__col-label cnr-table__col-label--action">We're doing</span>
            <span className="cnr-table__col-label cnr-table__col-label--outcome">So you get</span>
          </div>

          {items.map((item, i) => (
            <div
              key={i}
              className="cnr-table__row"
              role="row"
              data-testid="cnr-row"
            >
              {/* Need */}
              <div className="cnr-table__cell cnr-table__cell--need" role="cell">
                <span className="cnr-table__need-text">{item.need}</span>
                {item.evidence && (
                  <span className="cnr-table__evidence" aria-label="Evidence">
                    {item.evidence}
                  </span>
                )}
              </div>

              {/* Action */}
              <div className="cnr-table__cell cnr-table__cell--action" role="cell">
                <span className="cnr-table__action-marker" aria-hidden="true">→</span>
                {item.action}
              </div>

              {/* Outcome */}
              <div className="cnr-table__cell cnr-table__cell--outcome" role="cell">
                <span className="cnr-table__outcome-marker" aria-hidden="true">✓</span>
                {item.outcome}
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default CustomerNeedResolutionBlockView;
