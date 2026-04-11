/**
 * HandoffSummaryCard.tsx
 *
 * Header and capture-summary section of the handoff arrival page.
 *
 * Shows:
 *   - property title / address
 *   - source badge ("From Atlas Scan")
 *   - capture timestamp
 *   - capture counts: rooms, objects, photos, voice notes, notes, extracted facts
 */

import type { HandoffDisplayModel } from '../../features/handoff/types/handoffDisplay.types';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 11,
      fontWeight: 600,
      color: '#6366f1',
      background: '#eef2ff',
      border: '1px solid #c7d2fe',
      borderRadius: 4,
      padding: '2px 8px',
      letterSpacing: 0.3,
    }}>
      📡 From Atlas Scan
    </span>
  );
}

function CaptureStatItem({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: 72,
    }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface HandoffSummaryCardProps {
  model: HandoffDisplayModel;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HandoffSummaryCard({ model }: HandoffSummaryCardProps) {
  const formattedDate = model.capturedAt
    ? new Date(model.capturedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            {model.title}
          </h1>
          {model.subtitle && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', textTransform: 'capitalize' }}>
              {model.subtitle}
            </p>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Ref: {model.reference}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <SourceBadge />
          {formattedDate && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Captured {formattedDate}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '12px 0' }} />

      {/* Capture counts */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <CaptureStatItem label="Rooms"         value={model.roomCount} />
        <CaptureStatItem label="System objects" value={model.objectCount} />
        <CaptureStatItem label="Photos"         value={model.photoCount} />
        <CaptureStatItem label="Voice notes"    value={model.voiceNoteCount} />
        <CaptureStatItem label="Notes"          value={model.noteCount} />
        <CaptureStatItem label="Extracted facts" value={model.extractedFactCount} />
      </div>
    </div>
  );
}
