/**
 * VisitReplayPanel.tsx
 *
 * Engineer portal visit replay surface.
 *
 * Lets a second engineer (or the original engineer on a return visit) understand
 * exactly what data was captured during the site survey and how accepted
 * voice-note suggestions shaped the recommendation.
 *
 * Sections:
 *   1. Survey snapshot   — property info (postcode, bedrooms, bathrooms)
 *   2. Voice notes       — captured transcripts with accepted/rejected counts
 *   3. Note decision trail — accepted/advisory/overridden influence summary
 *                            using buildNoteInfluenceSummary (identical to
 *                            RecommendationHub output — no duplicate logic).
 *
 * Design rules:
 *   - Do NOT re-implement buildNoteInfluenceSummary or NoteInfluencePanel logic.
 *   - Only surface provenance === 'accepted_atlas_suggestion' in the decision trail.
 *   - Clearly separate advisory context from direct survey-field updates.
 *   - sourceSnippet must appear on every influence item (delegated to NoteInfluencePanel).
 *   - Overridden items must be marked with accessible labelling (delegated to NoteInfluencePanel).
 */

import { useState } from 'react';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { VoiceNote } from '../../features/voiceNotes/voiceNoteTypes';
import { SUGGESTION_CATEGORY_META } from '../../features/voiceNotes/voiceNoteTypes';
import { buildNoteInfluenceSummary } from '../../lib/advice/buildNoteInfluenceSummary';
import { NoteInfluencePanel } from '../../features/voiceNotes/NoteInfluencePanel';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * The full survey model for this visit, or null if not yet loaded.
   * Cast from workingPayloadRef.current — safe per the same pattern used in
   * VisitHubPage for the portal URL generation.
   */
  survey: FullSurveyModelV1 | null;
  /** Voice notes captured during or before this visit. */
  voiceNotes: VoiceNote[];
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────

interface SectionProps {
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}

function CollapsibleSection({ title, badge, children, defaultOpen = true, testId }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      data-testid={testId}
      style={{
        marginBottom: '0.75rem',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.55rem 0.85rem',
          background: '#f7fafc',
          border: 'none',
          borderBottom: open ? '1px solid #e2e8f0' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#2d3748', flex: 1 }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#4a90d9',
            background: '#ebf8ff',
            padding: '0.1rem 0.4rem',
            borderRadius: '4px',
            border: '1px solid #bee3f8',
          }}>
            {badge}
          </span>
        )}
        <span
          aria-hidden="true"
          style={{ fontSize: '0.75rem', color: '#a0aec0', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div style={{ padding: '0.75rem 0.85rem' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Survey snapshot ──────────────────────────────────────────────────────────

function SurveySnapshot({ survey }: { survey: FullSurveyModelV1 | null }) {
  if (!survey) {
    return (
      <p style={{ fontSize: '0.82rem', color: '#718096', margin: 0, fontStyle: 'italic' }}>
        No survey data available.
      </p>
    );
  }

  const rows: Array<{ label: string; value: string | number | undefined | null }> = [
    { label: 'Postcode',   value: survey.postcode },
    { label: 'Bedrooms',   value: survey.bedrooms },
    { label: 'Bathrooms',  value: survey.bathroomCount },
    { label: 'Occupants',  value: survey.occupancyCount },
    { label: 'Wall type',  value: survey.building?.fabric?.wallType },
    { label: 'Boiler age', value: survey.currentBoilerAgeYears != null ? `${survey.currentBoilerAgeYears} yrs` : undefined },
  ].filter(r => r.value != null && r.value !== '');

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: '0.82rem', color: '#718096', margin: 0, fontStyle: 'italic' }}>
        Survey fields not yet populated.
      </p>
    );
  }

  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '0.4rem 1rem',
        margin: 0,
      }}
    >
      {rows.map(({ label, value }) => (
        <div key={label}>
          <dt style={{ fontSize: '0.68rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, margin: 0 }}>
            {label}
          </dt>
          <dd style={{ fontSize: '0.82rem', color: '#1a202c', fontWeight: 500, margin: '0.1rem 0 0' }}>
            {String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Voice note transcript card ───────────────────────────────────────────────

function VoiceNoteCard({ note }: { note: VoiceNote }) {
  const [expanded, setExpanded] = useState(false);

  const acceptedCount  = note.suggestions.filter(s => s.status === 'accepted').length;
  const rejectedCount  = note.suggestions.filter(s => s.status === 'rejected').length;
  const suggestedCount = note.suggestions.filter(s => s.status === 'suggested').length;
  const totalSuggestions = note.suggestions.length;

  const createdAt = (() => {
    try {
      return new Date(note.createdAt).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return note.createdAt;
    }
  })();

  // Group accepted suggestions by category for compact display
  const acceptedByCat = note.suggestions
    .filter(s => s.status === 'accepted')
    .reduce<Record<string, number>>((acc, s) => {
      acc[s.category] = (acc[s.category] ?? 0) + 1;
      return acc;
    }, {});

  return (
    <div
      data-testid={`visit-replay-note-${note.id}`}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        marginBottom: '0.5rem',
        overflow: 'hidden',
        background: '#fafafa',
      }}
    >
      {/* ── Note header ── */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`Toggle transcript for note recorded ${createdAt}`}
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.7rem',
          background: '#f7fafc',
          border: 'none',
          borderBottom: expanded ? '1px solid #e2e8f0' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>🎙️</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2d3748', flex: 1 }}>
          Note · {createdAt}
        </span>
        {totalSuggestions > 0 && (
          <span style={{ fontSize: '0.68rem', color: '#718096' }}>
            {acceptedCount > 0 && <span style={{ color: '#276749', fontWeight: 700, marginRight: '0.3rem' }}>✓ {acceptedCount} accepted</span>}
            {rejectedCount > 0 && <span style={{ color: '#991b1b', marginRight: '0.3rem' }}>{rejectedCount} rejected</span>}
            {suggestedCount > 0 && <span style={{ color: '#92400e' }}>{suggestedCount} pending</span>}
          </span>
        )}
        <span aria-hidden="true" style={{ fontSize: '0.72rem', color: '#a0aec0' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0.6rem 0.7rem' }}>
          {/* Transcript */}
          <p style={{
            fontSize: '0.8rem',
            color: '#4a5568',
            margin: '0 0 0.55rem',
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            background: '#f0f4f8',
            padding: '0.45rem 0.6rem',
            borderRadius: '4px',
            borderLeft: '3px solid #bee3f8',
          }}>
            {note.transcript?.trim() || <em style={{ color: '#a0aec0' }}>No transcript recorded.</em>}
          </p>

          {/* Accepted suggestion categories */}
          {Object.keys(acceptedByCat).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
              {Object.entries(acceptedByCat).map(([cat, count]) => {
                const meta = SUGGESTION_CATEGORY_META.find(m => m.key === cat);
                return (
                  <span
                    key={cat}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: '#f0fff4',
                      color: '#276749',
                      border: '1px solid #9ae6b4',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    {meta?.emoji ?? '📝'} {meta?.label ?? cat} ×{count}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Voice notes section ──────────────────────────────────────────────────────

function VoiceNotesSection({ notes }: { notes: VoiceNote[] }) {
  if (notes.length === 0) {
    return (
      <p style={{ fontSize: '0.82rem', color: '#718096', margin: 0, fontStyle: 'italic' }}>
        No voice notes captured for this visit.
      </p>
    );
  }
  return (
    <div>
      {notes.map(note => (
        <VoiceNoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}

// ─── Note decision trail ──────────────────────────────────────────────────────

function NoteDecisionTrail({ summary }: { summary: ReturnType<typeof buildNoteInfluenceSummary> }) {
  if (!summary.hasActiveInfluence && summary.overridden.length === 0) {
    return (
      <p style={{ fontSize: '0.82rem', color: '#718096', margin: 0, fontStyle: 'italic' }}>
        No accepted note suggestions have influenced this assessment.
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: '0.75rem', color: '#4a5568', margin: '0 0 0.75rem', fontStyle: 'italic' }}>
        The following shows exactly how accepted engineer notes shaped the survey assessment.
        Use it to understand or hand over the reasoning behind applied values.
      </p>
      <NoteInfluencePanel summary={summary} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * VisitReplayPanel
 *
 * Renders the full visit replay surface for the engineer portal.
 *
 * Collapsible by default so it does not clutter the Visit Hub when not needed.
 * When expanded it shows a complete picture of:
 *   1. Property snapshot (what was surveyed)
 *   2. Voice notes (what was said and captured)
 *   3. Note decision trail (how accepted notes influenced the recommendation)
 *
 * The note decision trail reuses buildNoteInfluenceSummary + NoteInfluencePanel
 * without any divergence from the RecommendationHub output — a second engineer
 * will see exactly the same influence summary as the recommendation surface.
 */
export function VisitReplayPanel({ survey, voiceNotes }: Props) {
  const [panelOpen, setPanelOpen] = useState(false);

  const appliedCount = survey?.fullSurvey?.appliedNoteSuggestions?.length ?? 0;
  const noteCount    = voiceNotes.length;
  const summary      = buildNoteInfluenceSummary(survey?.fullSurvey?.appliedNoteSuggestions);
  const activeInfluenceCount = summary.direct.length + summary.advisory.length;

  const headerBadge = [
    noteCount > 0 ? `${noteCount} note${noteCount !== 1 ? 's' : ''}` : null,
    appliedCount > 0 ? `${appliedCount} applied` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div
      data-testid="visit-replay-panel"
      style={{
        margin: '0 0 1.25rem',
        border: '1.5px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {/* ── Top-level toggle ── */}
      <button
        type="button"
        aria-expanded={panelOpen}
        aria-controls="visit-replay-body"
        onClick={() => setPanelOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.7rem 1rem',
          background: '#f7fafc',
          border: 'none',
          borderBottom: panelOpen ? '1.5px solid #e2e8f0' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.9rem' }}>🔍</span>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2d3748', flex: 1 }}>
          Visit Replay
        </span>
        {headerBadge && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#4a5568',
            background: '#f0f4f8',
            padding: '0.1rem 0.4rem',
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
          }}>
            {headerBadge}
          </span>
        )}
        {activeInfluenceCount > 0 && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#2b6cb0',
            background: '#ebf8ff',
            padding: '0.1rem 0.4rem',
            borderRadius: '4px',
            border: '1px solid #bee3f8',
          }}>
            {activeInfluenceCount} active influence{activeInfluenceCount !== 1 ? 's' : ''}
          </span>
        )}
        <span
          aria-hidden="true"
          style={{
            fontSize: '0.75rem',
            color: '#a0aec0',
            transition: 'transform 0.15s',
            transform: panelOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </button>

      {/* ── Expanded body ── */}
      {panelOpen && (
        <div id="visit-replay-body" style={{ padding: '0.85rem 1rem' }}>
          {/* Section 1: Survey snapshot */}
          <CollapsibleSection
            title="Survey snapshot"
            badge={survey ? 'Property data' : undefined}
            testId="visit-replay-survey-snapshot"
          >
            <SurveySnapshot survey={survey} />
          </CollapsibleSection>

          {/* Section 2: Voice notes */}
          <CollapsibleSection
            title="Voice notes"
            badge={noteCount > 0 ? `${noteCount} note${noteCount !== 1 ? 's' : ''}` : undefined}
            testId="visit-replay-voice-notes"
          >
            <VoiceNotesSection notes={voiceNotes} />
          </CollapsibleSection>

          {/* Section 3: Note decision trail */}
          <CollapsibleSection
            title="Note decision trail"
            badge={activeInfluenceCount > 0
              ? `${activeInfluenceCount} active`
              : summary.overridden.length > 0
                ? `${summary.overridden.length} overridden`
                : undefined}
            testId="visit-replay-decision-trail"
          >
            <NoteDecisionTrail summary={summary} />
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
