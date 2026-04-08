/**
 * AcceptedSuggestionsReview.tsx
 *
 * Shows the set of note-derived values that have been accepted by the engineer
 * and applied to the current survey model.
 *
 * Design principles:
 *  - Every applied value is visibly marked as "Accepted from note" so the
 *    survey remains auditable.
 *  - Overridden values (superseded by manual measurement) are shown in a
 *    muted state.
 *  - Engineers can see confidence bands and the originating category.
 *  - No editing here — changes must go through the VoiceNotesPanel.
 */

import type { AppliedNoteSuggestion } from './voiceNoteTypes';
import { SUGGESTION_CATEGORY_META } from './voiceNoteTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  applied: AppliedNoteSuggestion[];
}

// ─── Confidence badge colours ─────────────────────────────────────────────────

const CONFIDENCE_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: '#f0fff4', text: '#276749', border: '#9ae6b4' },
  medium: { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' },
  low:    { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
};

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const c = CONFIDENCE_COLOURS[level];
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.1rem 0.35rem',
      borderRadius: '4px',
      fontSize: '0.65rem',
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {level} confidence
    </span>
  );
}

// ─── Single applied value row ─────────────────────────────────────────────────

function AppliedRow({ item }: { item: AppliedNoteSuggestion }) {
  const catMeta = SUGGESTION_CATEGORY_META.find(m => m.key === item.category);
  const isOverridden = !!item.overriddenByManual;

  return (
    <div
      data-testid={`applied-suggestion-${item.targetField}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.55rem 0.65rem',
        borderRadius: '6px',
        border: isOverridden ? '1px solid #e2e8f0' : '1.5px solid #bee3f8',
        background: isOverridden ? '#f9fafb' : '#ebf8ff',
        opacity: isOverridden ? 0.6 : 1,
        marginBottom: '0.4rem',
      }}
    >
      {/* Category emoji */}
      <span style={{ fontSize: '0.85rem', lineHeight: '1.5', flexShrink: 0 }}>
        {catMeta?.emoji ?? '📝'}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Label + provenance tag */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.2rem' }}>
          <span style={{
            fontWeight: 600,
            fontSize: '0.82rem',
            color: isOverridden ? '#718096' : '#1a202c',
            textDecoration: isOverridden ? 'line-through' : 'none',
          }}>
            {item.label}
          </span>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: '#2b6cb0',
            background: '#bee3f8',
            padding: '0.1rem 0.35rem',
            borderRadius: '4px',
            letterSpacing: '0.03em',
            textTransform: 'uppercase' as const,
          }}>
            Accepted from note
          </span>
          {isOverridden && (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: '#718096',
              background: '#f7fafc',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
            }}>
              Overridden manually
            </span>
          )}
          <ConfidenceBadge level={item.confidence} />
        </div>

        {/* Applied value */}
        <div style={{ fontSize: '0.78rem', color: '#4a5568' }}>
          <span style={{ color: '#718096' }}>Applied: </span>
          <code style={{
            background: '#f7fafc',
            padding: '0.05rem 0.3rem',
            borderRadius: '3px',
            fontSize: '0.78rem',
            color: '#2d3748',
          }}>
            {item.appliedValue}
          </code>
          <span style={{ color: '#a0aec0', marginLeft: '0.35rem', fontSize: '0.72rem' }}>
            → {item.targetField}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * AcceptedSuggestionsReview
 *
 * Renders a collapsible panel listing all note-derived values that have been
 * accepted by the engineer and applied to the current survey model.
 *
 * Returns null if there are no applied suggestions to show.
 */
export function AcceptedSuggestionsReview({ applied }: Props) {
  if (!applied || applied.length === 0) return null;

  const activeCount = applied.filter(a => !a.overriddenByManual).length;

  return (
    <div
      data-testid="accepted-suggestions-review"
      style={{
        margin: '0 0 1.25rem',
        border: '1.5px solid #bee3f8',
        borderRadius: '8px',
        background: '#f0f8ff',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        padding: '0.6rem 0.85rem',
        background: '#ebf8ff',
        borderBottom: '1px solid #bee3f8',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.85rem' }}>📋</span>
        <span style={{
          fontWeight: 700,
          fontSize: '0.8rem',
          color: '#2b6cb0',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        }}>
          Values from accepted notes
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.72rem',
          color: '#4a90d9',
          fontWeight: 600,
        }}>
          {activeCount} active{applied.length > activeCount ? ` · ${applied.length - activeCount} overridden` : ''}
        </span>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '0.65rem 0.85rem 0.4rem' }}>
        <p style={{
          fontSize: '0.75rem',
          color: '#4a5568',
          margin: '0 0 0.6rem',
          fontStyle: 'italic',
        }}>
          These values were accepted from engineer notes. They are not measured
          facts — manually-entered values will take precedence.
        </p>

        {applied.map(item => (
          <AppliedRow key={item.sourceSuggestionId} item={item} />
        ))}
      </div>
    </div>
  );
}
