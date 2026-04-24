/**
 * PortalCtaBlockView.tsx — Renders a PortalCtaBlock as the final call-to-action page.
 *
 * Layout:
 *   icon ring → title → outcome → supporting points → CTA button
 *
 * Rules:
 *   - No routing logic here — the button calls onOpenPortal when provided.
 *   - All copy from block — no new text generated here.
 *   - When onOpenPortal is absent the button is omitted — no orphan disabled controls.
 */

import type { PortalCtaBlock } from '../../../contracts/VisualBlock';
import type { PortalLaunchContext } from '../../../contracts/PortalLaunchContext';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: PortalCtaBlock;
  /** Called when the user taps the CTA. Receives the block's launchContext (if set). */
  onOpenPortal?: (launchContext: PortalLaunchContext) => void;
}

export function PortalCtaBlockView({ block, onOpenPortal }: Props) {
  const visual = getVisualEntry(block.visualKey);

  function handleCta() {
    if (!onOpenPortal) return;
    if (!block.launchContext) {
      // launchContext must be set on the block for portal navigation to work.
      // This is a configuration error — the block was built without a scenario id.
      console.warn('PortalCtaBlock: launchContext is missing; portal CTA will not fire.');
      return;
    }
    onOpenPortal(block.launchContext);
  }

  return (
    <article className="customer-deck__block customer-deck__block--portal-cta" aria-label={block.title}>
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
          <button
            className="customer-deck__cta-button"
            type="button"
            onClick={handleCta}
            aria-label="Open your customer portal"
            title={!onOpenPortal ? 'Portal not available yet' : undefined}
            disabled={!onOpenPortal}
          >
            Open your portal →
          </button>
        </div>
      </div>
    </article>
  );
}
