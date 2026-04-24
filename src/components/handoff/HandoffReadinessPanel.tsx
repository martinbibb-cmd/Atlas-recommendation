/**
 * HandoffReadinessPanel.tsx
 *
 * Readiness and warnings panel for the handoff arrival page.
 *
 * Shows:
 *   - overall readiness badge (ready / not ready)
 *   - missing critical fields (blocking)
 *   - missing recommended fields (advisory)
 *   - confidence warnings from the import boundary
 *   - spatial plan review summary (PR20)
 */

import type { HandoffDisplayModel } from '../../features/handoff/types/handoffDisplay.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface HandoffReadinessPanelProps {
  model: HandoffDisplayModel;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReadinessBadge({ ready }: { ready: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 13,
      fontWeight: 700,
      color: ready ? '#15803d' : '#b45309',
      background: ready ? '#f0fdf4' : '#fffbeb',
      border: `1px solid ${ready ? '#86efac' : '#fcd34d'}`,
      borderRadius: 5,
      padding: '4px 12px',
    }}>
      {ready ? '✓ Ready for simulation' : '⚠ Not ready for simulation'}
    </span>
  );
}

function IssueList({
  heading,
  items,
  colour,
}: {
  heading: string;
  items: string[];
  colour: string;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: colour }}>
        {heading}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Spatial review sub-panel ─────────────────────────────────────────────────

const SPATIAL_STATUS_COLOUR = {
  ready:          { text: '#15803d', bg: '#f0fdf4', border: '#86efac', icon: '✓' },
  needs_checking: { text: '#92400e', bg: '#fffbeb', border: '#fcd34d', icon: '⚠' },
  incomplete:     { text: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', icon: '✗' },
} as const;

function SpatialReviewSection({ model }: { model: HandoffDisplayModel }) {
  const { spatialReview } = model;
  const cfg = SPATIAL_STATUS_COLOUR[spatialReview.status];

  const actionItems = spatialReview.items.filter(
    (i) => i.status === 'missing' || i.status === 'needs_checking' || i.status === 'assumed',
  );

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#64748b' }}>
        Floor plan review
      </p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 6,
        padding: '6px 10px',
        marginBottom: actionItems.length > 0 ? 6 : 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.text }}>
          {cfg.icon} {spatialReview.statusLabel}
        </span>
      </div>

      {actionItems.length > 0 && (
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          {actionItems.map((item) => (
            <li key={item.key} style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>
              {item.label}
              {item.detail && (
                <span style={{ color: '#64748b' }}> — {item.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HandoffReadinessPanel({ model }: HandoffReadinessPanelProps) {
  const { readiness } = model;
  const hasIssues =
    readiness.missingCritical.length > 0 ||
    readiness.missingRecommended.length > 0 ||
    readiness.confidenceWarnings.length > 0;

  return (
    <div style={{
      background: readiness.readyForSimulation ? '#f0fdf4' : '#fffbeb',
      border: `1px solid ${readiness.readyForSimulation ? '#86efac' : '#fcd34d'}`,
      borderRadius: 10,
      padding: '16px 24px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasIssues ? 8 : 0 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
          Simulation readiness
        </h2>
        <ReadinessBadge ready={readiness.readyForSimulation} />
      </div>

      <IssueList
        heading="Missing required fields (blocking)"
        items={readiness.missingCritical}
        colour="#b91c1c"
      />
      <IssueList
        heading="Recommended fields (advisory)"
        items={readiness.missingRecommended}
        colour="#92400e"
      />
      <IssueList
        heading="Confidence notices"
        items={readiness.confidenceWarnings}
        colour="#6b7280"
      />

      {!hasIssues && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#166534' }}>
          All required fields are present. This property is ready for simulation.
        </p>
      )}

      {/* PR20: spatial plan review */}
      <SpatialReviewSection model={model} />
    </div>
  );
}
