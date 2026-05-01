/**
 * ReviewStatusBadge.tsx
 *
 * Inline badge rendering the engineer's review decision for a captured item.
 *
 *   confirmed — green    — item has been reviewed and accepted
 *   pending   — amber    — item has not yet been reviewed (default for LiDAR pins)
 *   rejected  — red      — item has been explicitly rejected
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewStatus = 'confirmed' | 'pending' | 'rejected';

// ─── Badge config ─────────────────────────────────────────────────────────────

const CONFIG: Record<
  ReviewStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  confirmed: {
    label: 'Confirmed',
    bg: '#f0fdf4',
    color: '#166534',
    border: '#86efac',
  },
  pending: {
    label: 'Pending',
    bg: '#fffbeb',
    color: '#92400e',
    border: '#fcd34d',
  },
  rejected: {
    label: 'Rejected',
    bg: '#fef2f2',
    color: '#991b1b',
    border: '#fca5a5',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export interface ReviewStatusBadgeProps {
  status: ReviewStatus;
}

export function ReviewStatusBadge({ status }: ReviewStatusBadgeProps) {
  const cfg = CONFIG[status];
  return (
    <span
      data-testid={`review-status-badge-${status}`}
      style={{
        display: 'inline-block',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        padding: '0.1rem 0.45rem',
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
