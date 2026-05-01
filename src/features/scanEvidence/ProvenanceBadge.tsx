/**
 * ProvenanceBadge.tsx
 *
 * Inline badge showing the provenance of a captured item.
 *
 *   LiDAR   — item was inferred by the LiDAR scanner and may require
 *             engineer confirmation before it is treated as ground truth.
 *   Manual  — item was manually placed or recorded by the engineer.
 */

// ─── Component ────────────────────────────────────────────────────────────────

export interface ProvenanceBadgeProps {
  isLidarInferred: boolean;
}

export function ProvenanceBadge({ isLidarInferred }: ProvenanceBadgeProps) {
  return isLidarInferred ? (
    <span
      data-testid="provenance-badge-lidar"
      style={{
        display: 'inline-block',
        fontSize: '0.68rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        padding: '0.1rem 0.45rem',
        borderRadius: 4,
        background: '#eff6ff',
        color: '#1e40af',
        border: '1px solid #bfdbfe',
        verticalAlign: 'middle',
      }}
    >
      LiDAR
    </span>
  ) : (
    <span
      data-testid="provenance-badge-manual"
      style={{
        display: 'inline-block',
        fontSize: '0.68rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        padding: '0.1rem 0.45rem',
        borderRadius: 4,
        background: '#f8fafc',
        color: '#475569',
        border: '1px solid #cbd5e1',
        verticalAlign: 'middle',
      }}
    >
      Manual
    </span>
  );
}
