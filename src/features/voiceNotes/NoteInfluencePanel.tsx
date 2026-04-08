/**
 * NoteInfluencePanel.tsx
 *
 * Renders a provenance panel showing which accepted voice-note suggestions
 * influenced the current recommendation.
 *
 * Design principles:
 *  - Only accepted (non-overridden) suggestions appear as active influences.
 *  - Direct survey-field updates and advisory-only items are shown in separate
 *    groups so engineers can distinguish hard-engine inputs from context.
 *  - Overridden items are shown muted at the bottom for audit purposes.
 *  - No unaccepted / suggested note content is ever surfaced here.
 */

import type { NoteInfluenceSummary, NoteInfluenceItem } from '../../lib/advice/buildNoteInfluenceSummary';
import { SUGGESTION_CATEGORY_META } from './voiceNoteTypes';

// ─── Confidence badge ─────────────────────────────────────────────────────────

const CONFIDENCE_COLOUR: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: '#f0fff4', text: '#276749', border: '#9ae6b4' },
  medium: { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' },
  low:    { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
};

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const c = CONFIDENCE_COLOUR[level];
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

// ─── Influence type badge ─────────────────────────────────────────────────────

function InfluenceTypeBadge({ type }: { type: 'direct' | 'advisory' }) {
  const isDirect = type === 'direct';
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.1rem 0.35rem',
      borderRadius: '4px',
      fontSize: '0.65rem',
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
      background: isDirect ? '#ebf8ff' : '#f7fafc',
      color:      isDirect ? '#2b6cb0' : '#4a5568',
      border:     `1px solid ${isDirect ? '#bee3f8' : '#e2e8f0'}`,
    }}>
      {isDirect ? 'Applied to survey' : 'Advisory context'}
    </span>
  );
}

// ─── Single influence row ─────────────────────────────────────────────────────

interface InfluenceRowProps {
  item: NoteInfluenceItem;
  muted?: boolean;
}

function InfluenceRow({ item, muted = false }: InfluenceRowProps) {
  const catMeta = SUGGESTION_CATEGORY_META.find(m => m.key === item.category);

  return (
    <div
      data-testid={`note-influence-item-${item.sourceSuggestionId}`}
      style={{
        padding: '0.6rem 0.7rem',
        borderRadius: '6px',
        border: muted ? '1px solid #e2e8f0' : '1.5px solid #bee3f8',
        background: muted ? '#f9fafb' : '#ebf8ff',
        opacity: muted ? 0.65 : 1,
        marginBottom: '0.45rem',
      }}
    >
      {/* ── Explanation sentence ── */}
      <p style={{
        margin: '0 0 0.35rem',
        fontSize: '0.82rem',
        fontWeight: muted ? 400 : 500,
        color: muted ? '#718096' : '#1a202c',
        fontStyle: muted ? 'italic' : 'normal',
        textDecoration: muted ? 'line-through' : 'none',
        lineHeight: 1.45,
      }}>
        {catMeta?.emoji ?? '📝'} {item.explanation}
        {muted && (
          <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
            {' '}(No longer active — overridden manually)
          </span>
        )}
      </p>

      {/* ── Meta row: badges + target field ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
        <InfluenceTypeBadge type={item.influenceType} />
        <ConfidenceBadge level={item.confidence} />
        {muted && (
          <span
            aria-label="This suggestion was overridden by a manually-entered value"
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: '#718096',
              background: '#f7fafc',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
            }}
          >
            Overridden manually
          </span>
        )}
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.7rem',
          color: '#a0aec0',
          fontFamily: 'monospace',
        }}>
          {item.targetField}
        </span>
      </div>

      {/* ── Source snippet (when available) ── */}
      {item.sourceSnippet && (
        <div style={{
          marginTop: '0.35rem',
          padding: '0.25rem 0.4rem',
          background: '#f7fafc',
          borderLeft: '2px solid #bee3f8',
          borderRadius: '0 4px 4px 0',
        }}>
          <span style={{ fontSize: '0.72rem', color: '#718096', fontStyle: 'italic' }}>
            &ldquo;{item.sourceSnippet}&rdquo;
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Group block ──────────────────────────────────────────────────────────────

interface GroupProps {
  title: string;
  description: string;
  items: NoteInfluenceItem[];
  muted?: boolean;
}

function InfluenceGroup({ title, description, items, muted = false }: GroupProps) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <p style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: '#4a5568',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        margin: '0 0 0.2rem',
      }}>
        {title}
      </p>
      <p style={{
        fontSize: '0.73rem',
        color: '#718096',
        margin: '0 0 0.45rem',
        fontStyle: 'italic',
      }}>
        {description}
      </p>
      {items.map(item => (
        <InfluenceRow key={item.sourceSuggestionId} item={item} muted={muted} />
      ))}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  summary: NoteInfluenceSummary;
}

/**
 * NoteInfluencePanel
 *
 * Renders the full note-influence provenance panel for the recommendation hub.
 * Shows:
 *   1. Direct survey-field updates (active influences, engine-visible).
 *   2. Advisory context items (captured but not hard engine inputs).
 *   3. Overridden items (muted, for audit only).
 *
 * Returns null if there is no active or overridden influence to display.
 */
export function NoteInfluencePanel({ summary }: Props) {
  const hasAnything =
    summary.hasActiveInfluence || summary.overridden.length > 0;

  if (!hasAnything) return null;

  const directCount   = summary.direct.length;
  const advisoryCount = summary.advisory.length;
  const totalActive   = directCount + advisoryCount;

  return (
    <div
      data-testid="note-influence-panel"
      style={{
        margin: '0 0 1.5rem',
        border: '1.5px solid #bee3f8',
        borderRadius: '8px',
        background: '#f0f8ff',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        padding: '0.65rem 0.9rem',
        background: '#ebf8ff',
        borderBottom: '1px solid #bee3f8',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.85rem' }}>🗒️</span>
        <span style={{
          fontWeight: 700,
          fontSize: '0.8rem',
          color: '#2b6cb0',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        }}>
          Influenced by accepted notes
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.72rem',
          color: '#4a90d9',
          fontWeight: 600,
        }}>
          {totalActive} active
          {summary.overridden.length > 0
            ? ` · ${summary.overridden.length} overridden`
            : ''}
        </span>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '0.75rem 0.9rem 0.4rem' }}>
        <p style={{
          fontSize: '0.75rem',
          color: '#4a5568',
          margin: '0 0 0.75rem',
          fontStyle: 'italic',
        }}>
          The following accepted engineer notes shaped this recommendation.
          Survey-applied items updated engine inputs directly; advisory items
          are captured context and did not change hard engine fields.
        </p>

        {/* Group 1: Applied to survey (direct engine inputs) */}
        <InfluenceGroup
          title="Applied to survey"
          description="These items updated survey fields and directly influenced the engine result."
          items={summary.direct}
        />

        {/* Group 2: Advisory context only */}
        <InfluenceGroup
          title="Advisory context"
          description="These items are captured context only — they did not change hard engine inputs."
          items={summary.advisory}
        />

        {/* Group 3: Overridden (audit only) */}
        <InfluenceGroup
          title="Overridden (audit)"
          description="These items were applied from notes but later superseded by a manually-entered value. They are no longer active influences."
          items={summary.overridden}
          muted={true}
        />
      </div>
    </div>
  );
}
