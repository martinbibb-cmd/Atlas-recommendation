/**
 * VisitReplayPanel.tsx
 *
 * Engineer portal — Visit Replay surface.
 *
 * Shows a second engineer (or the original engineer reviewing the visit) a
 * faithful replay of the note-driven reasoning behind the recommendation:
 *
 *   1. Voice notes — verbatim transcripts with timestamps and suggestion counts.
 *   2. Decision trail — how accepted suggestions influenced the survey and
 *      recommendation, grouped into direct / advisory / overridden using the
 *      same buildNoteInfluenceSummary builder as RecommendationHub.
 *
 * Design principles:
 *   - Do NOT reimplement logic — reuse buildNoteInfluenceSummary and
 *     NoteInfluencePanel so the output is identical to RecommendationHub.
 *   - Only surface provenance === 'accepted_atlas_suggestion' (enforced by
 *     buildNoteInfluenceSummary and NoteInfluencePanel).
 *   - Never surface unaccepted suggestions — show only what was accepted and
 *     applied.
 *   - sourceSnippet is shown on every item so the reasoning is traceable.
 *   - Overridden items are clearly labelled (a11y-compliant).
 *   - Returns null when there is nothing to show.
 */

import { useState } from 'react';
import type { VoiceNote, AppliedNoteSuggestion } from '../../features/voiceNotes/voiceNoteTypes';
import { SUGGESTION_CATEGORY_META } from '../../features/voiceNotes/voiceNoteTypes';
import { buildNoteInfluenceSummary } from '../../lib/advice/buildNoteInfluenceSummary';
import { NoteInfluencePanel } from '../../features/voiceNotes/NoteInfluencePanel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNoteDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── VoiceNote transcript card ────────────────────────────────────────────────

function NoteCard({ note }: { note: VoiceNote }) {
  const [expanded, setExpanded] = useState(false);
  const acceptedCount = note.suggestions.filter(s => s.status === 'accepted').length;
  const totalCount    = note.suggestions.length;

  return (
    <article
      aria-label={`Voice note recorded ${formatNoteDate(note.createdAt)}`}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        background: '#fff',
        marginBottom: '0.65rem',
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: '#f7fafc',
          border: 'none',
          borderBottom: expanded ? '1px solid #e2e8f0' : 'none',
          cursor: 'pointer',
          textAlign: 'left' as const,
        }}
      >
        <span aria-hidden="true">🎙️</span>
        <span style={{ fontSize: '0.78rem', color: '#4a5568', fontWeight: 600 }}>
          {formatNoteDate(note.createdAt)}
        </span>
        <span style={{
          fontSize: '0.7rem',
          color: '#718096',
          marginLeft: 'auto',
        }}>
          {totalCount} suggestion{totalCount !== 1 ? 's' : ''}
          {totalCount > 0 && ` (${acceptedCount} accepted)`}
          {' '}{expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Transcript */}
      {expanded && (
        <div style={{ padding: '0.6rem 0.75rem' }}>
          <p style={{
            margin: 0,
            fontSize: '0.78rem',
            color: '#2d3748',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {note.transcript || <em style={{ color: '#a0aec0' }}>No transcript</em>}
          </p>

          {/* Accepted suggestions from this note */}
          {acceptedCount > 0 && (
            <div style={{ marginTop: '0.6rem' }}>
              <div style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#2b6cb0',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.04em',
                marginBottom: '0.3rem',
              }}>
                Accepted suggestions from this note
              </div>
              {note.suggestions
                .filter(s => s.status === 'accepted')
                .map(s => {
                  const catMeta = SUGGESTION_CATEGORY_META.find(m => m.key === s.category);
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.4rem',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '5px',
                        border: '1px solid #bee3f8',
                        background: '#ebf8ff',
                        marginBottom: '0.3rem',
                        fontSize: '0.76rem',
                      }}
                    >
                      <span aria-hidden="true" style={{ flexShrink: 0 }}>{catMeta?.emoji ?? '📝'}</span>
                      <div>
                        <span style={{ fontWeight: 600, color: '#2c5282' }}>{s.label}</span>
                        {s.sourceSnippet && (
                          <span style={{ color: '#4a5568', marginLeft: '0.3rem' }}>
                            — "{s.sourceSnippet}"
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Voice notes for this visit. */
  voiceNotes: VoiceNote[];
  /** Applied note suggestions (from fullSurvey.appliedNoteSuggestions). */
  appliedNoteSuggestions: AppliedNoteSuggestion[];
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * VisitReplayPanel
 *
 * Engineer portal surface for understanding note-driven reasoning.
 *
 * Shows:
 *   1. Voice notes — verbatim transcripts with timestamps and accepted suggestions.
 *   2. Decision trail — NoteInfluencePanel using buildNoteInfluenceSummary so the
 *      output is identical to what RecommendationHub shows.
 *
 * Returns null when there are no voice notes and no applied suggestions.
 */
export function VisitReplayPanel({ voiceNotes, appliedNoteSuggestions }: Props) {
  const hasNotes   = voiceNotes.length > 0;
  const hasApplied = appliedNoteSuggestions.length > 0;

  if (!hasNotes && !hasApplied) return null;

  // Build the influence summary using the canonical builder — the same
  // function used by RecommendationHub, guaranteeing consistency.
  const influenceSummary = buildNoteInfluenceSummary(appliedNoteSuggestions);
  const hasInfluence =
    influenceSummary.direct.length > 0 ||
    influenceSummary.advisory.length > 0 ||
    influenceSummary.overridden.length > 0;

  return (
    <section
      data-testid="visit-replay-panel"
      aria-label="Visit replay — note influence"
      style={{
        border: '1.5px solid #e2e8f0',
        borderRadius: '10px',
        background: '#f8fafc',
        padding: '1rem 1.1rem',
        marginBottom: '1.5rem',
      }}
    >
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
        paddingBottom: '0.6rem',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>📼</span>
        <h3 style={{
          margin: 0,
          fontSize: '0.9rem',
          fontWeight: 700,
          color: '#1a202c',
        }}>
          Visit replay
        </h3>
        <span style={{
          fontSize: '0.72rem',
          color: '#718096',
          fontWeight: 500,
        }}>
          Note-driven reasoning trail
        </span>
      </div>

      {/* Voice notes section */}
      {hasNotes && (
        <div style={{ marginBottom: hasInfluence ? '1.25rem' : 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.6rem',
          }}>
            <span aria-hidden="true">🎙️</span>
            <h4 style={{
              margin: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              color: '#4a5568',
            }}>
              Voice notes ({voiceNotes.length})
            </h4>
          </div>

          {voiceNotes.map(note => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}

      {/* Note influence summary — reuses the same NoteInfluencePanel
          as RecommendationHub for guaranteed consistency. */}
      {hasInfluence && (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.6rem',
          }}>
            <span aria-hidden="true">⚡</span>
            <h4 style={{
              margin: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              color: '#4a5568',
            }}>
              Decision trail
            </h4>
          </div>
          <NoteInfluencePanel summary={influenceSummary} />
        </div>
      )}

      {/* Fallback when notes exist but nothing was applied yet */}
      {hasNotes && !hasInfluence && (
        <p style={{
          margin: 0,
          fontSize: '0.76rem',
          color: '#a0aec0',
          fontStyle: 'italic',
        }}>
          No accepted suggestions have been applied to this survey yet.
        </p>
      )}
    </section>
  );
}
