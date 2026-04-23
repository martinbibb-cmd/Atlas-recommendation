/**
 * PortalCtaBlockView.tsx — Renders a PortalCtaBlock as the final call-to-action page.
 *
 * Layout:
 *   icon ring → title → outcome → supporting points → CTA button
 *
 * Rules:
 *   - No routing logic here — the button renders a plain anchor.
 *   - All copy from block — no new text generated here.
 */

import type { PortalCtaBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: PortalCtaBlock;
}

export function PortalCtaBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  return (
    <article className="customer-deck__block customer-deck__block--portal-cta" aria-label={block.title}>
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

      <div className="customer-deck__block-body">
        <h2 className="customer-deck__title">{block.title}</h2>
        <p className="customer-deck__outcome">{block.outcome}</p>

        {block.supportingPoints && block.supportingPoints.length > 0 && (
          <ul className="customer-deck__supporting-points" aria-label="What you can do">
            {block.supportingPoints.slice(0, 3).map((point) => (
              <li key={point} className="customer-deck__supporting-point">
                <span className="customer-deck__point-marker" aria-hidden="true">✓</span>
                {point}
              </li>
            ))}
          </ul>
        )}

        <div className="customer-deck__cta-row">
          <button className="customer-deck__cta-button" type="button">
            View your report
          </button>
        </div>
      </div>
    </article>
  );
}
