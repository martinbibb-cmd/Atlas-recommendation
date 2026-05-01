/**
 * ScanTranscriptPanel.tsx
 *
 * Engineer-facing panel listing voice-note transcripts from a SessionCaptureV2.
 *
 * Only voice notes with a non-empty transcript are shown.  Notes without a
 * transcript (audio not transcribed before export) are counted but not rendered
 * individually — the engineer is informed of the total number of untranscribed
 * notes.
 *
 * Viewer only — read-only, no mutations, no engine calls.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import { selectTranscripts, selectVoiceNotes } from './scanEvidenceSelectors';
import type { VoiceNoteV2 } from './scanEvidenceSelectors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Transcript entry ─────────────────────────────────────────────────────────

function TranscriptEntry({ note }: { note: VoiceNoteV2 }) {
  return (
    <div
      data-testid={`scan-transcript-entry-${note.voiceNoteId}`}
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        padding: '0.65rem 0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
          {formatDateTime(note.createdAt)}
        </span>
        {note.roomId && (
          <span style={{
            fontSize: '0.68rem',
            padding: '0.05rem 0.4rem',
            borderRadius: 3,
            background: '#f0f9ff',
            color: '#0369a1',
            border: '1px solid #bae6fd',
          }}>
            {note.roomId}
          </span>
        )}
      </div>

      {/* Transcript text */}
      <p style={{
        margin: 0,
        fontSize: '0.85rem',
        color: '#374151',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {note.transcript}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanTranscriptPanelProps {
  capture: SessionCaptureV2;
}

export function ScanTranscriptPanel({ capture }: ScanTranscriptPanelProps) {
  const allNotes = selectVoiceNotes(capture);
  const transcribed = selectTranscripts(capture);
  const untranscribed = allNotes.length - transcribed.length;

  if (allNotes.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
        No voice notes captured.
      </p>
    );
  }

  return (
    <div data-testid="scan-transcript-panel">
      {/* Untranscribed notice */}
      {untranscribed > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 6,
          padding: '0.5rem 0.75rem',
          marginBottom: '0.75rem',
          fontSize: '0.78rem',
          color: '#92400e',
        }}>
          <span>ℹ️</span>
          <span>
            {untranscribed} voice note{untranscribed !== 1 ? 's' : ''} without a transcript
            (audio was not transcribed before export).
          </span>
        </div>
      )}

      {/* Transcribed entries */}
      {transcribed.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
          No transcripts available.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {transcribed.map((note) => (
            <TranscriptEntry key={note.voiceNoteId} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
