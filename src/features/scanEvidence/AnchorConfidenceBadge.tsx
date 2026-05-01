/**
 * AnchorConfidenceBadge.tsx
 *
 * Inline badge showing the confidence tier for an anchored evidence item.
 *
 * The tier is derived from QA flag severity against the entity or session:
 *   high    — no warn or error QA flags
 *   medium  — at least one warn-severity flag (no errors)
 *   low     — at least one error-severity flag
 */

import type { AnchorConfidenceTier } from './scanEvidenceSelectors';

// ─── Badge config ─────────────────────────────────────────────────────────────

const CONFIG: Record<
  AnchorConfidenceTier,
  { label: string; bg: string; color: string; border: string }
> = {
  high: {
    label: '● High confidence',
    bg: '#f0fdf4',
    color: '#166534',
    border: '#86efac',
  },
  medium: {
    label: '● Medium confidence',
    bg: '#fffbeb',
    color: '#92400e',
    border: '#fcd34d',
  },
  low: {
    label: '● Low confidence',
    bg: '#fef2f2',
    color: '#991b1b',
    border: '#fca5a5',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export interface AnchorConfidenceBadgeProps {
  tier: AnchorConfidenceTier;
}

export function AnchorConfidenceBadge({ tier }: AnchorConfidenceBadgeProps) {
  const cfg = CONFIG[tier];
  return (
    <span
      data-testid={`anchor-confidence-badge-${tier}`}
      style={{
        display: 'inline-block',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        padding: '0.1rem 0.5rem',
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        verticalAlign: 'middle',
      }}
    >
      {cfg.label}
    </span>
  );
}
