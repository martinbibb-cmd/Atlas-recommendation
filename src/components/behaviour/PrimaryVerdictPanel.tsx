/**
 * PrimaryVerdictPanel.tsx
 *
 * Displays the centralised VerdictV1 object: title, status badge, reasons,
 * confidence level and surfaced assumptions.
 *
 * All data comes from the single `verdict` prop — this panel must never
 * re-derive the verdict.
 */
import { useState } from 'react';
import type { VerdictV1, AssumptionV1 } from '../../contracts/EngineOutputV1';

interface Props {
  verdict: VerdictV1;
}

const STATUS_STYLES: Record<VerdictV1['status'], { bg: string; text: string; label: string }> = {
  good:    { bg: '#c6f6d5', text: '#276749', label: 'Recommended' },
  caution: { bg: '#fef3c7', text: '#92400e', label: 'Caution' },
  fail:    { bg: '#fed7d7', text: '#9b2c2c', label: 'Not Suitable' },
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high:   '🟢 High confidence',
  medium: '🟡 Medium confidence',
  low:    '🔴 Low confidence',
};

const GROUP_LABELS: Record<NonNullable<AssumptionV1['group']>, string> = {
  'missing-data': 'Missing survey data',
  'defaults':     'Defaults applied',
  'derived':      'Derived values',
};

/** Chip for a single assumption. */
function AssumptionChip({ a }: { a: AssumptionV1 }) {
  return (
    <span
      title={a.detail}
      style={{
        background: a.severity === 'warn' ? '#fef3c7' : '#ebf8ff',
        border: `1px solid ${a.severity === 'warn' ? '#f59e0b' : '#90cdf4'}`,
        borderRadius: 4,
        padding: '2px 7px',
        fontSize: 11,
        color: a.severity === 'warn' ? '#92400e' : '#2b6cb0',
        cursor: a.detail ? 'help' : 'default',
      }}
    >
      {a.severity === 'warn' ? '⚠ ' : 'ℹ '}{a.title}
    </span>
  );
}

/** Renders assumptions grouped by their `group` field when there are 4+ chips. */
function AssumptionsSection({ assumptions, borderColor }: { assumptions: AssumptionV1[]; borderColor: string }) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  if (assumptions.length === 0) return null;

  // If < 4 assumptions, render flat chips (no grouping overhead)
  if (assumptions.length < 4) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {assumptions.map(a => <AssumptionChip key={a.id} a={a} />)}
      </div>
    );
  }

  // Group assumptions
  const grouped: Record<string, AssumptionV1[]> = {};
  const ungrouped: AssumptionV1[] = [];
  for (const a of assumptions) {
    if (a.group) {
      grouped[a.group] = grouped[a.group] ?? [];
      grouped[a.group].push(a);
    } else {
      ungrouped.push(a);
    }
  }

  const hasGroups = Object.keys(grouped).length > 0;

  if (!hasGroups) {
    // All ungrouped — flat chips
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {assumptions.map(a => <AssumptionChip key={a.id} a={a} />)}
      </div>
    );
  }

  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Render grouped sections */}
      {(Object.keys(grouped) as Array<NonNullable<AssumptionV1['group']>>).map(group => {
        const items = grouped[group];
        const isOpen = expandedGroups[group] ?? false;
        return (
          <div key={group}>
            <button
              onClick={() => toggleGroup(group)}
              style={{
                background: 'none',
                border: `1px solid ${borderColor}44`,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                cursor: 'pointer',
                color: '#4a5568',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              aria-expanded={isOpen}
            >
              {isOpen ? '▾' : '▸'} {GROUP_LABELS[group]} ({items.length})
            </button>
            {isOpen && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, paddingLeft: 8 }}>
                {items.map(a => <AssumptionChip key={a.id} a={a} />)}
              </div>
            )}
          </div>
        );
      })}
      {/* Ungrouped chips inline */}
      {ungrouped.map(a => <AssumptionChip key={a.id} a={a} />)}
    </div>
  );
}

export default function PrimaryVerdictPanel({ verdict }: Props) {
  const style = STATUS_STYLES[verdict.status];

  return (
    <div
      className="verdict-panel"
      style={{
        background: style.bg,
        border: `2px solid ${style.text}`,
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 20,
      }}
    >
      {/* Status badge + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span
          style={{
            background: style.text,
            color: '#fff',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {style.label}
        </span>
        <h2 style={{ margin: 0, color: style.text, fontSize: 20 }}>{verdict.title}</h2>
      </div>

      {/* Comparison context line */}
      {verdict.context === 'comparison' && verdict.comparedTechnologies && (
        <div
          style={{
            fontSize: 13,
            color: style.text,
            opacity: 0.85,
            marginBottom: 12,
            paddingLeft: 2,
          }}
        >
          {verdict.primaryReason
            ? `Decision context: ${verdict.primaryReason}`
            : `Compared against: ${verdict.comparedTechnologies.join(', ')} — see Active Limiters below`}
        </div>
      )}

      {/* Reasons */}
      {verdict.reasons.length > 0 && (
        <ul style={{ margin: '0 0 14px', paddingLeft: 20, color: style.text }}>
          {verdict.reasons.map((reason, i) => (
            <li key={i} style={{ marginBottom: 4, fontSize: 14 }}>{reason}</li>
          ))}
        </ul>
      )}

      {/* Confidence + assumptions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          borderTop: `1px solid ${style.text}44`,
          paddingTop: 12,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: style.text }}>
            {CONFIDENCE_LABELS[verdict.confidence.level] ?? verdict.confidence.level}
          </span>
          {verdict.confidence.reasons.length > 0 && (
            <span style={{ fontSize: 12, color: style.text, marginLeft: 6, opacity: 0.8 }}>
              — {verdict.confidence.reasons[0]}
            </span>
          )}
        </div>

        {verdict.assumptionsUsed.length > 0 && (
          <AssumptionsSection assumptions={verdict.assumptionsUsed} borderColor={style.text} />
        )}
      </div>
    </div>
  );
}
