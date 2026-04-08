/**
 * NoteInfluencePanel.tsx
 *
 * Renders a NoteInfluenceSummary in the engineer UI — used in both
 * RecommendationHub and the engineer portal visit replay (VisitReplayPanel).
 *
 * Design principles:
 *   - Never surfaces unaccepted suggestions.
 *   - direct / advisory / overridden are visually distinct sections.
 *   - sourceSnippet is displayed so every explanation can be traced back to
 *     the engineer's own words ("because the engineer said this…").
 *   - Overridden items are clearly marked with aria-label for screen readers.
 *   - Confidence shapes badge colour and (via buildNoteInfluenceSummary)
 *     phrasing strength.
 *   - Returns null when there is nothing to show, so the caller does not need
 *     to guard against an empty summary.
 */

import { useState } from 'react';
import type { NoteInfluenceSummary, NoteInfluenceItem } from '../../lib/advice/buildNoteInfluenceSummary';
import { SUGGESTION_CATEGORY_META } from './voiceNoteTypes';

// ─── Confidence badge ─────────────────────────────────────────────────────────

const CONFIDENCE_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: '#f0fff4', text: '#276749', border: '#9ae6b4' },
  medium: { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' },
  low:    { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
};

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const c = CONFIDENCE_COLOURS[level];
  return (
    <span
      aria-label={`${level} confidence`}
      style={{
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
      }}
    >
      {level}
    </span>
  );
}

// ─── Single influence item row ────────────────────────────────────────────────

function InfluenceRow({
  item,
  showInfluenceType = false,
}: {
  item: NoteInfluenceItem;
  showInfluenceType?: boolean;
}) {
  const catMeta = SUGGESTION_CATEGORY_META.find(m => m.key === item.category);

  return (
    <div
      style={{
        padding: '0.6rem 0.75rem',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
        background: '#fff',
        marginBottom: '0.5rem',
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.35rem',
        marginBottom: '0.3rem',
      }}>
        {catMeta && (
          <span style={{ fontSize: '0.85rem' }} aria-hidden="true">
            {catMeta.emoji}
          </span>
        )}
        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1a202c' }}>
          {item.label}
        </span>
        <ConfidenceBadge level={item.confidence} />
        {showInfluenceType && (
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: item.influenceType === 'direct' ? '#276749' : '#6b46c1',
            background: item.influenceType === 'direct' ? '#f0fff4' : '#faf5ff',
            padding: '0.1rem 0.35rem',
            borderRadius: '4px',
            border: `1px solid ${item.influenceType === 'direct' ? '#9ae6b4' : '#d6bcfa'}`,
            textTransform: 'uppercase' as const,
          }}>
            {item.influenceType}
          </span>
        )}
      </div>

      {/* Explanation */}
      <p style={{ margin: '0 0 0.3rem', fontSize: '0.78rem', color: '#4a5568', lineHeight: 1.5 }}>
        {item.explanation}
      </p>

      {/* Source snippet */}
      {item.sourceSnippet && (
        <blockquote style={{
          margin: '0.3rem 0 0',
          padding: '0.3rem 0.6rem',
          borderLeft: '3px solid #bee3f8',
          background: '#ebf8ff',
          borderRadius: '0 4px 4px 0',
          fontSize: '0.74rem',
          color: '#2c5282',
          fontStyle: 'italic',
        }}>
          "{item.sourceSnippet}"
        </blockquote>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function InfluenceSection({
  title,
  icon,
  items,
  accent,
  showInfluenceType,
  isOverridden,
}: {
  title: string;
  icon: string;
  items: NoteInfluenceItem[];
  accent: string;
  showInfluenceType?: boolean;
  isOverridden?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label={title}
      style={{
        marginBottom: '1rem',
        opacity: isOverridden ? 0.65 : 1,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        marginBottom: '0.5rem',
      }}>
        <span aria-hidden="true">{icon}</span>
        <h4 style={{
          margin: 0,
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          color: accent,
        }}>
          {title}
        </h4>
        <span style={{
          fontSize: '0.68rem',
          color: '#718096',
          marginLeft: 'auto',
        }}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {items.map(item => (
        <div
          key={item.sourceSuggestionId}
          style={isOverridden ? {
            position: 'relative',
          } : undefined}
        >
          {isOverridden && (
            <div
              role="note"
              aria-label="This influence was overridden by a manually-entered value"
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: '#718096',
                background: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                padding: '0.1rem 0.35rem',
                display: 'inline-block',
                marginBottom: '0.2rem',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.03em',
              }}
            >
              Overridden by manual entry
            </div>
          )}
          <div style={isOverridden ? { textDecoration: 'line-through', opacity: 0.7 } : undefined}>
            <InfluenceRow item={item} showInfluenceType={showInfluenceType} />
          </div>
        </div>
      ))}
    </section>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  summary: NoteInfluenceSummary;
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * NoteInfluencePanel
 *
 * Renders a NoteInfluenceSummary as a collapsible panel, grouped into:
 *   - Direct influences (engine inputs affected)
 *   - Advisory context (accepted but no engine field)
 *   - Overridden items (audit trail)
 *
 * Returns null if the summary has no items in any group.
 */
export function NoteInfluencePanel({ summary }: Props) {
  const [expanded, setExpanded] = useState(true);

  const totalCount = summary.direct.length + summary.advisory.length + summary.overridden.length;
  if (totalCount === 0) return null;

  return (
    <div
      data-testid="note-influence-panel"
      style={{
        border: '1.5px solid #bee3f8',
        borderRadius: '8px',
        background: '#f7fbff',
        overflow: 'hidden',
        marginBottom: '1.25rem',
      }}
    >
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.65rem 0.85rem',
          background: '#ebf8ff',
          border: 'none',
          borderBottom: expanded ? '1px solid #bee3f8' : 'none',
          cursor: 'pointer',
          textAlign: 'left' as const,
        }}
      >
        <span aria-hidden="true">🗒️</span>
        <span style={{
          fontWeight: 700,
          fontSize: '0.8rem',
          color: '#2b6cb0',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        }}>
          Note influence summary
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.72rem',
          color: '#4a90d9',
          fontWeight: 600,
        }}>
          {summary.direct.length > 0 && `${summary.direct.length} direct`}
          {summary.direct.length > 0 && summary.advisory.length > 0 && ' · '}
          {summary.advisory.length > 0 && `${summary.advisory.length} advisory`}
          {summary.overridden.length > 0 && ` · ${summary.overridden.length} overridden`}
          {' '}
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Panel body */}
      {expanded && (
        <div style={{ padding: '0.75rem 0.85rem 0.4rem' }}>
          <p style={{
            fontSize: '0.74rem',
            color: '#4a5568',
            fontStyle: 'italic',
            margin: '0 0 0.75rem',
          }}>
            How accepted engineer notes influenced this recommendation.
            Direct items affected engine inputs; advisory items are context only.
          </p>

          <InfluenceSection
            title="Direct influences"
            icon="⚡"
            items={summary.direct}
            accent="#276749"
          />

          <InfluenceSection
            title="Advisory context"
            icon="📋"
            items={summary.advisory}
            accent="#6b46c1"
            showInfluenceType
          />

          <InfluenceSection
            title="Overridden (audit trail)"
            icon="🔄"
            items={summary.overridden}
            accent="#718096"
            isOverridden
          />
        </div>
      )}
    </div>
  );
}
