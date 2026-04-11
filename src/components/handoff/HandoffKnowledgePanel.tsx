/**
 * HandoffKnowledgePanel.tsx
 *
 * Knowledge summary panel for the handoff arrival page.
 *
 * Shows the confirmed / review / missing status for each knowledge domain:
 *   - Household
 *   - Usage pattern
 *   - Current system
 *   - Priorities
 *   - Constraints
 *
 * The status buckets come from HandoffDisplayModel.knowledge, derived
 * by buildHandoffDisplayModel() — not read directly from AtlasPropertyV1.
 */

import type { HandoffDisplayModel, KnowledgeStatus } from '../../features/handoff/types/handoffDisplay.types';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<KnowledgeStatus, { label: string; color: string; bg: string; border: string }> = {
  confirmed: { label: 'Confirmed', color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
  review:    { label: 'Review',    color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  missing:   { label: 'Missing',   color: '#6b7280', bg: '#f8fafc', border: '#e2e8f0' },
};

function StatusBadge({ status }: { status: KnowledgeStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 600,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 4,
      padding: '1px 7px',
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Knowledge row ────────────────────────────────────────────────────────────

function KnowledgeRow({
  label,
  description,
  status,
}: {
  label: string;
  description: string;
  status: KnowledgeStatus;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{description}</p>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface HandoffKnowledgePanelProps {
  model: HandoffDisplayModel;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HandoffKnowledgePanel({ model }: HandoffKnowledgePanelProps) {
  const { knowledge } = model;

  const rows: { label: string; description: string; status: KnowledgeStatus }[] = [
    {
      label:       'Household',
      description: 'Adult count, children, occupant profile',
      status:      knowledge.household,
    },
    {
      label:       'Usage pattern',
      description: 'Occupancy schedule, hot-water demand, bathroom count',
      status:      knowledge.usage,
    },
    {
      label:       'Current system',
      description: 'Boiler family, DHW type, rated output, install year',
      status:      knowledge.currentSystem,
    },
    {
      label:       'Priorities',
      description: 'Customer-stated upgrade or comfort priorities',
      status:      knowledge.priorities,
    },
    {
      label:       'Constraints',
      description: 'Installation access, budget, or technical constraints',
      status:      knowledge.constraints,
    },
  ];

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '16px 24px',
      marginBottom: 16,
    }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
        What Atlas Mind understands
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>
        Knowledge derived from the handoff and previous capture sessions.
      </p>

      <div>
        {rows.map(row => (
          <KnowledgeRow key={row.label} {...row} />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        {(Object.keys(STATUS_CONFIG) as KnowledgeStatus[]).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <StatusBadge status={s} />
          </div>
        ))}
      </div>
    </div>
  );
}
