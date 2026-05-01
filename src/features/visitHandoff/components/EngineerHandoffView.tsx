/**
 * EngineerHandoffView.tsx
 *
 * PR11 — Engineer-facing read-only visit review surface.
 *
 * Renders an EngineerVisitSummary in a compact, structured, scannable style.
 *
 * Sections:
 *   1. Rooms
 *   2. Key objects
 *   3. Proposed emitters
 *   4. Access notes
 *   5. Room plan notes
 *   6. Spec notes
 *   7. Field notes summary
 *   8. Completion metadata
 *
 * Design intent:
 *   - Dense but scannable
 *   - Structured sections, not prose blobs
 *   - Useful as a technical handoff check
 */

import type {
  EngineerVisitSummary,
  HandoffRoom,
  HandoffKeyObject,
  HandoffProposedEmitter,
  HandoffAccessNote,
} from '../types/visitHandoffPack';

// ─── Shared section primitives ────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '0.875rem',
      fontWeight: 700,
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      margin: '0 0 0.65rem 0',
      paddingBottom: '0.3rem',
      borderBottom: '1px solid #e2e8f0',
    }}>
      {children}
    </h2>
  );
}

function EmptyNote({ message }: { message: string }) {
  return (
    <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>
      {message}
    </p>
  );
}

function DataRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
      <span style={{ color: '#64748b', minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#1e293b' }}>{value}</span>
    </div>
  );
}

// ─── Room card ────────────────────────────────────────────────────────────────

function RoomCard({ room }: { room: HandoffRoom }) {
  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      padding: '0.6rem 0.85rem',
    }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b', marginBottom: '0.2rem' }}>
        {room.name}
        {room.areaM2 != null && (
          <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '0.4rem', fontSize: '0.8rem' }}>
            {room.areaM2} m²
          </span>
        )}
      </div>
      {room.notes && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>{room.notes}</p>
      )}
    </div>
  );
}

// ─── Key object card ──────────────────────────────────────────────────────────

function KeyObjectCard({ obj }: { obj: HandoffKeyObject }) {
  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      padding: '0.6rem 0.85rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
    }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{obj.type}</div>
      {obj.make && <DataRow label="Make / model" value={obj.make} />}
      {obj.installYear != null && <DataRow label="Install year" value={obj.installYear} />}
      {obj.condition && <DataRow label="Condition" value={obj.condition} />}
      {obj.notes && (
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#475569' }}>{obj.notes}</p>
      )}
    </div>
  );
}

// ─── Proposed emitter row ─────────────────────────────────────────────────────

function EmitterRow({ emitter }: { emitter: HandoffProposedEmitter }) {
  return (
    <tr>
      <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>
        {emitter.roomName}
      </td>
      <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>
        {emitter.emitterType}
      </td>
      <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>
        {emitter.outputWatts != null ? `${emitter.outputWatts} W` : '—'}
      </td>
      <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
        {emitter.notes ?? '—'}
      </td>
    </tr>
  );
}

// ─── Access note row ──────────────────────────────────────────────────────────

function AccessNoteRow({ note }: { note: HandoffAccessNote }) {
  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      fontSize: '0.85rem',
      paddingBottom: '0.5rem',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <span style={{ color: '#475569', minWidth: 140, flexShrink: 0, fontWeight: 500 }}>
        {note.location}
      </span>
      <span style={{ color: '#374151' }}>{note.note}</span>
    </div>
  );
}

// ─── Notes block ──────────────────────────────────────────────────────────────

function NotesBlock({ text }: { text: string }) {
  return (
    <p style={{
      margin: 0,
      fontSize: '0.875rem',
      color: '#374151',
      lineHeight: 1.65,
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      padding: '0.75rem 1rem',
      whiteSpace: 'pre-wrap',
    }}>
      {text}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface EngineerHandoffViewProps {
  summary: EngineerVisitSummary;
  completedAt: string;
  engineerName?: string;
}

export default function EngineerHandoffView({
  summary,
  completedAt,
  engineerName,
}: EngineerHandoffViewProps) {
  const formattedDate = (() => {
    try {
      return new Date(completedAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return completedAt;
    }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── ⚠ Recommendation mismatch warning (blocking banner) ──────────── */}
      {summary.recommendationMismatchWarning && (
        <div
          data-testid="engineer-handoff-mismatch-warning"
          role="alert"
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            background: '#fff7ed',
            border: '2px solid #f97316',
            borderRadius: 8,
            padding: '0.9rem 1.1rem',
          }}
        >
          <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '0.05rem' }}>⚠️</span>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 700, color: '#9a3412' }}>
              Recommendation mismatch — confirm before handoff
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#7c2d12', lineHeight: 1.6 }}>
              {summary.recommendationMismatchWarning}
            </p>
          </div>
        </div>
      )}

      {/* ── 1. Rooms ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Rooms</SectionHeader>
        {summary.rooms.length === 0 ? (
          <EmptyNote message="No rooms recorded." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
            {summary.rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Key objects ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Key objects</SectionHeader>
        {summary.keyObjects.length === 0 ? (
          <EmptyNote message="No key objects recorded." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {summary.keyObjects.map((obj, i) => (
              <KeyObjectCard key={i} obj={obj} />
            ))}
          </div>
        )}
      </section>

      {/* ── 3. Proposed emitters ────────────────────────────────────────── */}
      <section>
        <SectionHeader>Proposed emitters</SectionHeader>
        {summary.proposedEmitters.length === 0 ? (
          <EmptyNote message="No proposed emitters recorded." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
            }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Room</th>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</th>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Output</th>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {summary.proposedEmitters.map((emitter, i) => (
                  <EmitterRow key={i} emitter={emitter} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 4. Access notes ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Access notes</SectionHeader>
        {summary.accessNotes.length === 0 ? (
          <EmptyNote message="No access notes recorded." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {summary.accessNotes.map((note, i) => (
              <AccessNoteRow key={i} note={note} />
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Room plan notes ─────────────────────────────────────────── */}
      <section>
        <SectionHeader>Room plan notes</SectionHeader>
        {summary.roomPlanNotes ? (
          <NotesBlock text={summary.roomPlanNotes} />
        ) : (
          <EmptyNote message="No room plan notes recorded." />
        )}
      </section>

      {/* ── 6. Spec notes ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Spec notes</SectionHeader>
        {summary.specNotes ? (
          <NotesBlock text={summary.specNotes} />
        ) : (
          <EmptyNote message="No spec notes recorded." />
        )}
      </section>

      {/* ── 7. Field notes summary ─────────────────────────────────────── */}
      <section>
        <SectionHeader>Field notes</SectionHeader>
        {summary.fieldNotesSummary ? (
          <NotesBlock text={summary.fieldNotesSummary} />
        ) : (
          <EmptyNote message="No field notes available." />
        )}
      </section>

      {/* ── 8. Completion metadata ─────────────────────────────────────── */}
      <section>
        <SectionHeader>Completed at</SectionHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <DataRow label="Date / time" value={formattedDate} />
          {engineerName && <DataRow label="Engineer" value={engineerName} />}
        </div>
      </section>

    </div>
  );
}
