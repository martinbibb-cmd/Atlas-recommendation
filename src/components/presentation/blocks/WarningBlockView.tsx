/**
 * WarningBlockView.tsx — Renders a WarningBlock as an advisory page.
 *
 * Layout:
 *   severity-coloured icon ring → title → outcome → supporting points
 *
 * Severity mapping:
 *   info      → blue
 *   advisory  → amber
 *   important → red
 *
 * Rules:
 *   - Severity determines accent colour; no other logic.
 *   - All copy from block — no new text generated here.
 */

import type { WarningBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

const SEVERITY_ACCENT: Record<WarningBlock['severity'], string> = {
  info:      '#3b82f6',
  advisory:  '#f59e0b',
  important: '#ef4444',
};

/**
 * Customer-facing severity labels: advisory tone, not alarming.
 * "Good to know" for low-stakes info, "Something to consider" for advisory,
 * "Plan ahead" for important items — decision-useful, not panic-inducing.
 */
const SEVERITY_LABEL: Record<WarningBlock['severity'], string> = {
  info:      'Good to know',
  advisory:  'Something to consider',
  important: 'Plan ahead',
};

interface Props {
  block: WarningBlock;
}

export function WarningBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);
  const accentColor = SEVERITY_ACCENT[block.severity];

  return (
    <article
      className={`customer-deck__block customer-deck__block--warning customer-deck__block--warning-${block.severity}`}
      aria-label={`${SEVERITY_LABEL[block.severity]}: ${block.title}`}
    >
      <div
        className="customer-deck__visual-ring customer-deck__visual-ring--small"
        style={{ background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)` }}
        aria-label={visual.ariaLabel}
        role="img"
      >
        <span className="customer-deck__visual-icon customer-deck__visual-icon--small" aria-hidden="true">
          {visual.icon}
        </span>
      </div>

      <div className="customer-deck__block-body">
        <div className="customer-deck__advisory-body">
          <span
            className="customer-deck__severity-badge"
            style={{ background: accentColor }}
            aria-label={`Severity: ${SEVERITY_LABEL[block.severity]}`}
          >
            {SEVERITY_LABEL[block.severity]}
          </span>
          <h2 className="customer-deck__title" style={{ marginTop: '0.65rem' }}>{block.title}</h2>
          <p className="customer-deck__outcome">{block.outcome}</p>

          {block.supportingPoints && block.supportingPoints.length > 0 && (
            <ul className="customer-deck__supporting-points" aria-label="Details">
              {block.supportingPoints.slice(0, 3).map((point) => (
                <li key={point} className="customer-deck__supporting-point">
                  <span className="customer-deck__point-marker" aria-hidden="true">→</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
