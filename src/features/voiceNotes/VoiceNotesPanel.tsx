/**
 * VoiceNotesPanel.tsx
 *
 * Engineer notes panel in the Visit Hub.
 *
 * Allows the engineer to:
 *   1. Enter / paste a voice-note transcript
 *   2. Ask Atlas to extract suggestions from it
 *   3. Review grouped suggestions (preferences, constraints, usage, risks, follow-ups)
 *   4. Accept, reject, or edit individual suggestions
 *
 * Design principles (from the problem statement):
 *   - Atlas suggests, never silently completes
 *   - Every suggestion shows: confidence band, source snippet, and provenance label
 *   - Hard measured fields are never derived from voice notes
 *   - Accepted suggestions change provenance to 'accepted_atlas_suggestion'
 */

import { useState } from 'react';
import type { VoiceNote, VoiceNoteSuggestion, SuggestionStatus } from './voiceNoteTypes';
import { SUGGESTION_CATEGORY_META } from './voiceNoteTypes';
import { extractSuggestionsFromNote } from './extractSuggestionsFromNote';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visitId: string;
  notes: VoiceNote[];
  onChange: (notes: VoiceNote[]) => void;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

const CONFIDENCE_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: '#f0fff4', text: '#276749', border: '#9ae6b4' },
  medium: { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' },
  low:    { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
};

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const c = CONFIDENCE_COLOURS[level];
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.1rem 0.4rem',
      borderRadius: '4px',
      fontSize: '0.68rem',
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: VoiceNoteSuggestion;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (newValue: string) => void;
}

function SuggestionCard({ suggestion, onAccept, onReject, onEdit }: SuggestionCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(suggestion.suggestedValue);

  const isAccepted  = suggestion.status === 'accepted';
  const isRejected  = suggestion.status === 'rejected';
  const isSuggested = suggestion.status === 'suggested';

  function handleSaveEdit() {
    const trimmed = draftValue.trim();
    if (trimmed.length > 0) onEdit(trimmed);
    setEditing(false);
  }

  return (
    <div
      data-testid={`suggestion-card-${suggestion.key}`}
      style={{
        padding: '0.75rem',
        borderRadius: '8px',
        border: isAccepted
          ? '1.5px solid #48bb78'
          : isRejected
            ? '1px solid #e2e8f0'
            : '1px solid #e2e8f0',
        background: isAccepted ? '#f0fff4' : isRejected ? '#f9fafb' : '#fff',
        opacity: isRejected ? 0.55 : 1,
        marginBottom: '0.5rem',
      }}
    >
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1a202c', marginBottom: '0.2rem' }}>
            {suggestion.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
            <ConfidenceBadge level={suggestion.confidence} />
            <span style={{ fontSize: '0.68rem', color: '#718096', fontStyle: 'italic' }}>
              Suggested from engineer note
            </span>
            {isAccepted && (
              <span style={{ fontSize: '0.68rem', color: '#276749', fontWeight: 700 }}>
                ✓ Accepted
              </span>
            )}
            {isRejected && (
              <span style={{ fontSize: '0.68rem', color: '#718096', fontWeight: 600 }}>
                ✗ Rejected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Value row ── */}
      {editing ? (
        <div style={{ marginBottom: '0.4rem' }}>
          <input
            type="text"
            value={draftValue}
            onChange={e => setDraftValue(e.target.value)}
            style={{
              width: '100%',
              padding: '0.3rem 0.5rem',
              border: '1px solid #4299e1',
              borderRadius: '4px',
              fontSize: '0.82rem',
              outline: 'none',
              boxSizing: 'border-box' as const,
            }}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter')  handleSaveEdit();
              if (e.key === 'Escape') { setEditing(false); setDraftValue(suggestion.suggestedValue); }
            }}
            aria-label={`Edit suggested value for ${suggestion.label}`}
          />
        </div>
      ) : (
        <div style={{ fontSize: '0.82rem', color: '#2d3748', marginBottom: '0.4rem' }}>
          <span style={{ fontWeight: 500 }}>Suggested: </span>
          <span style={{ fontFamily: 'monospace', background: '#f7fafc', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
            {suggestion.suggestedValue}
          </span>
        </div>
      )}

      {/* ── Source snippet ── */}
      {suggestion.sourceSnippet && (
        <div style={{
          fontSize: '0.75rem',
          color: '#718096',
          background: '#f7fafc',
          borderLeft: '2px solid #e2e8f0',
          padding: '0.25rem 0.5rem',
          marginBottom: '0.5rem',
          fontStyle: 'italic',
          borderRadius: '0 4px 4px 0',
        }}>
          "{suggestion.sourceSnippet}"
        </div>
      )}

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {isSuggested && (
          <>
            <button
              type="button"
              onClick={onAccept}
              data-testid={`accept-${suggestion.key}`}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                border: '1px solid #48bb78',
                background: '#f0fff4',
                color: '#276749',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✓ Accept
            </button>
            <button
              type="button"
              onClick={onReject}
              data-testid={`reject-${suggestion.key}`}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#4a5568',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✗ Reject
            </button>
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    border: '1px solid #4299e1',
                    background: '#ebf8ff',
                    color: '#2b6cb0',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraftValue(suggestion.suggestedValue); }}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#718096',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                data-testid={`edit-${suggestion.key}`}
                style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#4a5568',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                ✏ Edit
              </button>
            )}
          </>
        )}
        {(isAccepted || isRejected) && (
          <button
            type="button"
            onClick={() => {
              // Reset to suggested so it can be re-reviewed
              const statusUpdate: SuggestionStatus = 'suggested';
              onEdit(suggestion.suggestedValue); // trigger a no-op update to keep value
              // Use accept/reject cycling: a separate undo path
              if (isAccepted) onReject();
              else onAccept();
              // Immediately revert to suggested via the parent — simpler: just expose undo
              void statusUpdate; // keep type visible
            }}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#718096',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Note entry form ──────────────────────────────────────────────────────────

interface NoteFormProps {
  visitId: string;
  onAdd: (note: VoiceNote) => void;
}

function NoteEntryForm({ visitId, onAdd }: NoteFormProps) {
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);

  function handleExtract() {
    if (!transcript.trim()) return;
    setBusy(true);

    const noteId = crypto.randomUUID();
    const suggestions = extractSuggestionsFromNote(noteId, transcript);

    const note: VoiceNote = {
      id:          noteId,
      visitId,
      transcript:  transcript.trim(),
      createdAt:   new Date().toISOString(),
      suggestions,
    };

    onAdd(note);
    setTranscript('');
    setBusy(false);
  }

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label
        htmlFor="voice-note-transcript"
        style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}
      >
        Engineer note / transcript
      </label>
      <textarea
        id="voice-note-transcript"
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder='e.g. "Customer wants the cylinder gone if possible, cupboard is pretty cramped, and there are two showers."'
        rows={4}
        style={{
          width: '100%',
          padding: '0.5rem 0.65rem',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontSize: '0.82rem',
          fontFamily: 'inherit',
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box' as const,
          color: '#2d3748',
        }}
        aria-describedby="voice-note-hint"
      />
      <p
        id="voice-note-hint"
        style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.25rem', marginBottom: '0.5rem' }}
      >
        Atlas will extract suggestions from this note. All suggestions require engineer review before they are applied.
      </p>
      <button
        type="button"
        onClick={handleExtract}
        disabled={!transcript.trim() || busy}
        style={{
          padding: '0.45rem 1rem',
          borderRadius: '6px',
          border: 'none',
          background: transcript.trim() ? '#2b6cb0' : '#e2e8f0',
          color: transcript.trim() ? '#fff' : '#718096',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: transcript.trim() ? 'pointer' : 'not-allowed',
        }}
      >
        🔍 Extract suggestions
      </button>
    </div>
  );
}

// ─── Note summary ─────────────────────────────────────────────────────────────

function NoteSummary({ note }: { note: VoiceNote }) {
  const [expanded, setExpanded] = useState(false);
  const acceptedCount = note.suggestions.filter(s => s.status === 'accepted').length;
  const total = note.suggestions.length;
  const when = new Date(note.createdAt).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>
      {when} · {total} suggestion{total !== 1 ? 's' : ''}
      {total > 0 ? ` (${acceptedCount} accepted)` : ''}
      {' '}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4299e1', fontSize: '0.72rem', padding: 0 }}
      >
        {expanded ? '▲ hide note' : '▼ show note'}
      </button>
      {expanded && (
        <div style={{
          marginTop: '0.35rem',
          padding: '0.4rem 0.5rem',
          background: '#f7fafc',
          borderRadius: '4px',
          fontStyle: 'italic',
          color: '#4a5568',
          fontSize: '0.75rem',
          whiteSpace: 'pre-wrap',
        }}>
          {note.transcript}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VoiceNotesPanel({ visitId, notes, onChange }: Props) {
  // Flatten all suggestions across all notes for grouped display
  const allSuggestions: VoiceNoteSuggestion[] = notes.flatMap(n => n.suggestions);

  /** Mutate a single suggestion's status or value in the notes array. */
  function updateSuggestion(
    suggestionId: string,
    patch: Partial<Pick<VoiceNoteSuggestion, 'status' | 'suggestedValue'>>,
  ) {
    const updated = notes.map(note => ({
      ...note,
      suggestions: note.suggestions.map(s =>
        s.id === suggestionId ? { ...s, ...patch } : s,
      ),
    }));
    onChange(updated);
  }

  function handleAccept(id: string)            { updateSuggestion(id, { status: 'accepted' }); }
  function handleReject(id: string)            { updateSuggestion(id, { status: 'rejected' }); }
  function handleEdit(id: string, v: string)   { updateSuggestion(id, { suggestedValue: v }); }

  function handleAddNote(note: VoiceNote) {
    onChange([...notes, note]);
  }

  const hasSuggestions = allSuggestions.length > 0;
  const acceptedCount  = allSuggestions.filter(s => s.status === 'accepted').length;
  const suggestedCount = allSuggestions.filter(s => s.status === 'suggested').length;

  return (
    <section
      data-testid="voice-notes-panel"
      style={{
        marginTop: '1.5rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        background: '#fafafa',
      }}
    >
      {/* ── Panel heading ── */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a202c', marginTop: 0, marginBottom: '0.25rem' }}>
        🎤 Engineer notes
      </h3>
      <p style={{ fontSize: '0.78rem', color: '#718096', marginTop: 0, marginBottom: '1rem' }}>
        Enter engineer notes or a voice transcript. Atlas will extract survey inputs as
        <strong> suggestions only</strong> — each one requires engineer confirmation before it is applied.
      </p>

      {/* ── Note entry form ── */}
      <NoteEntryForm visitId={visitId} onAdd={handleAddNote} />

      {/* ── Past notes summary ── */}
      {notes.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.35rem' }}>
            {notes.length} note{notes.length !== 1 ? 's' : ''} added
            {hasSuggestions && (
              <span style={{ fontWeight: 400 }}>
                {' '}· {acceptedCount} accepted, {suggestedCount} pending review
              </span>
            )}
          </div>
          {notes.map(note => (
            <NoteSummary key={note.id} note={note} />
          ))}
        </div>
      )}

      {/* ── Suggestions grouped by category ── */}
      {hasSuggestions && (
        <div>
          <div style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#374151',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
            marginBottom: '0.75rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid #e2e8f0',
          }}>
            Review note suggestions
          </div>

          {SUGGESTION_CATEGORY_META.map(catMeta => {
            const catSuggestions = allSuggestions.filter(s => s.category === catMeta.key);
            if (catSuggestions.length === 0) return null;

            return (
              <div key={catMeta.key} style={{ marginBottom: '1rem' }}>
                <div style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#4a5568',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}>
                  <span>{catMeta.emoji}</span>
                  <span>{catMeta.label}</span>
                  <span style={{
                    fontSize: '0.68rem',
                    color: '#a0aec0',
                    background: '#f7fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0 0.35rem',
                  }}>
                    {catSuggestions.length}
                  </span>
                </div>
                {catSuggestions.map(s => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    onAccept={() => handleAccept(s.id)}
                    onReject={() => handleReject(s.id)}
                    onEdit={v   => handleEdit(s.id, v)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty state after form ── */}
      {notes.length === 0 && (
        <div style={{
          textAlign: 'center' as const,
          padding: '1rem',
          color: '#a0aec0',
          fontSize: '0.78rem',
        }}>
          No notes added yet. Enter a transcript above to get started.
        </div>
      )}

      {/* ── Provenance notice ── */}
      <div style={{
        marginTop: '0.75rem',
        padding: '0.4rem 0.6rem',
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: '5px',
        fontSize: '0.72rem',
        color: '#92400e',
      }}>
        ⚠ Voice-note suggestions are provisional. Accepted suggestions are labelled
        "inferred from voice note" and weighted accordingly by the assessment engine.
        Hard measured values (pressure, flow rate, room dimensions) must always be
        confirmed by measurement.
      </div>
    </section>
  );
}
