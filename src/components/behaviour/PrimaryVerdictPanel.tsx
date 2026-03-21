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
import { VERDICT_STATUS_LABEL } from '../../lib/copy/customerCopy';

interface Props {
  verdict: VerdictV1;
}

const STATUS_META: Record<VerdictV1['status'], { label: string }> = {
  good:    { label: VERDICT_STATUS_LABEL.good },
  caution: { label: VERDICT_STATUS_LABEL.caution },
  fail:    { label: VERDICT_STATUS_LABEL.fail },
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
      className={`atlas-chip atlas-chip--${a.severity === 'warn' ? 'warn' : 'info'}`}
    >
      {a.severity === 'warn' ? '⚠ ' : 'ℹ '}{a.title}
    </span>
  );
}

/** Renders assumptions grouped by their `group` field when there are 4+ chips. */
function AssumptionsSection({ assumptions }: { assumptions: AssumptionV1[] }) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  if (assumptions.length === 0) return null;

  // If < 4 assumptions, render flat chips (no grouping overhead)
  if (assumptions.length < 4) {
    return (
      <div className="bvp-assumption-flat">
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
      <div className="bvp-assumption-flat">
        {assumptions.map(a => <AssumptionChip key={a.id} a={a} />)}
      </div>
    );
  }

  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="bvp-assumption-group">
      {/* Render grouped sections */}
      {(Object.keys(grouped) as Array<NonNullable<AssumptionV1['group']>>).map(group => {
        const items = grouped[group];
        const isOpen = expandedGroups[group] ?? false;
        return (
          <div key={group}>
            <button
              className="bvp-group-toggle"
              onClick={() => toggleGroup(group)}
              aria-expanded={isOpen}
            >
              {isOpen ? '▾' : '▸'} {GROUP_LABELS[group]} ({items.length})
            </button>
            {isOpen && (
              <div className="bvp-group-chips">
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
  const meta = STATUS_META[verdict.status];

  return (
    <div className={`bvp-panel bvp-panel--${verdict.status}`}>
      {/* Status badge + title */}
      <div className="bvp-title-row">
        <span className={`atlas-badge atlas-badge--${verdict.status === 'good' ? 'success' : verdict.status === 'caution' ? 'warning' : 'danger'}`}>
          {meta.label}
        </span>
        <h2 className="bvp-title">{verdict.title}</h2>
      </div>

      {/* Comparison context line */}
      {verdict.context === 'comparison' && verdict.comparedTechnologies && (
        <div className="bvp-context">
          {verdict.primaryReason
            ? `Decision context: ${verdict.primaryReason}`
            : `Compared against: ${verdict.comparedTechnologies.join(', ')} — see Active Limiters below`}
        </div>
      )}

      {/* Reasons */}
      {verdict.reasons.length > 0 && (
        <ul className="bvp-reasons">
          {verdict.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}

      {/* Confidence + assumptions */}
      <div className="bvp-footer">
        <div>
          <span className="bvp-confidence">
            {CONFIDENCE_LABELS[verdict.confidence.level] ?? verdict.confidence.level}
          </span>
          {verdict.confidence.reasons.length > 0 && (
            <span className="bvp-confidence-detail">
              — {verdict.confidence.reasons[0]}
            </span>
          )}
        </div>

        {verdict.assumptionsUsed.length > 0 && (
          <AssumptionsSection assumptions={verdict.assumptionsUsed} />
        )}
      </div>
    </div>
  );
}
