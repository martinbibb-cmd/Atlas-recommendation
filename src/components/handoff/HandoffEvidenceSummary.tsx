/**
 * HandoffEvidenceSummary.tsx
 *
 * Evidence summary panel for the handoff arrival page.
 *
 * Shows what the Scan session captured:
 *   - photo count with tag breakdown
 *   - voice note count with transcript availability
 *   - text note count
 *   - QA flag count and blocking flag count
 *
 * Data is read from HandoffDisplayModel counts plus a minimal peek at the
 * raw evidence arrays via the atlasProperty prop (kept inside this component
 * only — not propagated to children).
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { HandoffDisplayModel } from '../../features/handoff/types/handoffDisplay.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface HandoffEvidenceSummaryProps {
  model: HandoffDisplayModel;
  atlasProperty: AtlasPropertyV1;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EvidenceRow({
  icon,
  label,
  count,
  detail,
}: {
  icon: string;
  label: string;
  count: number;
  detail?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '9px 0',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</p>
          {detail && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{detail}</p>
          )}
        </div>
      </div>
      <span style={{
        fontSize: 13,
        fontWeight: 700,
        color: count > 0 ? '#1e293b' : '#d1d5db',
        minWidth: 24,
        textAlign: 'right',
      }}>
        {count}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HandoffEvidenceSummary({ model, atlasProperty }: HandoffEvidenceSummaryProps) {
  const evidence = atlasProperty.evidence;

  // Photo tag breakdown
  const taggedPhotos   = evidence.photos.filter(p => p.tag).length;
  const photoDetail    = taggedPhotos > 0
    ? `${taggedPhotos} tagged`
    : undefined;

  // Voice note transcript availability
  const transcribedNotes = evidence.voiceNotes.filter(n => Boolean(n.transcript)).length;
  const voiceDetail      = evidence.voiceNotes.length > 0
    ? `${transcribedNotes} transcribed`
    : undefined;

  // QA flags
  const qaCount    = evidence.qaFlags.length;
  const blocking   = evidence.qaFlags.filter(f => f.severity === 'blocking' && !f.resolved).length;
  const qaDetail   = qaCount > 0
    ? blocking > 0
      ? `${blocking} blocking`
      : 'no blocking flags'
    : undefined;

  // Timeline events
  const eventCount = evidence.events.length;

  const totalEvidence =
    model.photoCount + model.voiceNoteCount + model.noteCount + qaCount;

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '16px 24px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
            Captured evidence
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            Evidence items collected during the Scan session
          </p>
        </div>
        <span style={{
          fontSize: 22,
          fontWeight: 700,
          color: totalEvidence > 0 ? '#6366f1' : '#d1d5db',
        }}>
          {totalEvidence}
        </span>
      </div>

      <EvidenceRow
        icon="📷"
        label="Photos"
        count={model.photoCount}
        detail={photoDetail}
      />
      <EvidenceRow
        icon="🎙️"
        label="Voice notes"
        count={model.voiceNoteCount}
        detail={voiceDetail}
      />
      <EvidenceRow
        icon="📝"
        label="Text notes"
        count={model.noteCount}
      />
      <EvidenceRow
        icon="🚩"
        label="QA flags"
        count={qaCount}
        detail={qaDetail}
      />
      <EvidenceRow
        icon="📋"
        label="Timeline events"
        count={eventCount}
      />
    </div>
  );
}
