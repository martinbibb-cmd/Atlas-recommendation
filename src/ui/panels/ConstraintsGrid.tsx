/**
 * ConstraintsGrid.tsx
 *
 * Renders LimitersV1 as a compact "Direct Constraints" grid.
 *
 * Replaces pass/fail tile summaries with a physics-domain grid where every row
 * shows the concrete observed measurement vs the physical limit, so advisors
 * and customers can see the physics without interpretation.
 *
 * Each row:
 *   - Constraint name + severity chip
 *   - Observed vs limit (with units)
 *   - Impact statement (1 line)
 *   - Fix suggestion chips
 *
 * The only "verdict" is a header summary derived from the highest severity
 * limiter: Good / Watch / Fix Required.
 *
 * UI contract: this component is purely presentational — all values come
 * directly from EngineOutputV1.limiters. No physics here.
 */
import type { LimitersV1, LimiterV1, LimiterSeverity } from '../../contracts/EngineOutputV1';

interface Props {
  limiters: LimitersV1;
}

// ── Severity styles ───────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<LimiterSeverity, { chip: string; text: string; label: string }> = {
  fail: { chip: '#e53e3e', text: '#9b2c2c', label: 'Fix Required' },
  warn: { chip: '#d69e2e', text: '#7b341e', label: 'Watch' },
  info: { chip: '#3182ce', text: '#2a4365', label: 'Info' },
};

// ── Summary verdict ───────────────────────────────────────────────────────────

function deriveVerdict(limiters: LimiterV1[]): {
  label: string;
  bg: string;
  border: string;
  text: string;
} {
  if (limiters.some(l => l.severity === 'fail')) {
    return { label: 'Fix Required', bg: '#fff5f5', border: '#fc8181', text: '#9b2c2c' };
  }
  if (limiters.some(l => l.severity === 'warn')) {
    return { label: 'Watch', bg: '#fffff0', border: '#f6e05e', text: '#7b341e' };
  }
  return { label: 'Good', bg: '#f0fff4', border: '#9ae6b4', text: '#276749' };
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ConstraintRow({ limiter }: { limiter: LimiterV1 }) {
  const s = SEVERITY_STYLES[limiter.severity];

  return (
    <tr
      style={{
        borderBottom: '1px solid #e2e8f0',
        verticalAlign: 'top',
      }}
    >
      {/* Name + severity */}
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              background: s.chip,
              color: '#fff',
              borderRadius: 4,
              padding: '1px 7px',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              flexShrink: 0,
            }}
          >
            {s.label}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#2d3748' }}>{limiter.title}</span>
        </div>
      </td>

      {/* Observed vs limit */}
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: s.text }}>
          {limiter.observed.value} {limiter.observed.unit}
        </span>
        <span style={{ fontSize: 12, color: '#718096', margin: '0 6px' }}>vs</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#2d3748' }}>
          {limiter.limit.value} {limiter.limit.unit}
        </span>
        <div style={{ fontSize: 10, color: '#a0aec0', marginTop: 2 }}>
          {limiter.observed.label}
        </div>
      </td>

      {/* Impact */}
      <td style={{ padding: '10px 12px', fontSize: 12, color: s.text, lineHeight: 1.5 }}>
        {limiter.impact.summary}
      </td>

      {/* Fix suggestions */}
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {limiter.suggestedFixes.map(fix => (
            <span
              key={fix.id}
              title={fix.deltaHint}
              style={{
                background: '#edf2f7',
                border: '1px solid #e2e8f0',
                borderRadius: 5,
                padding: '2px 9px',
                fontSize: 11,
                color: '#4a5568',
                cursor: fix.deltaHint ? 'help' : 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {fix.label}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function ConstraintsGrid({ limiters }: Props) {
  if (limiters.limiters.length === 0) {
    return (
      <div
        style={{
          background: '#f0fff4',
          border: '1px solid #9ae6b4',
          borderRadius: 10,
          padding: '14px 18px',
          fontSize: 13,
          color: '#276749',
        }}
      >
        ✅ No active constraints — system is operating within all physics limits.
      </div>
    );
  }

  const verdict = deriveVerdict(limiters.limiters);

  return (
    <div className="constraints-grid" style={{ marginBottom: 20 }}>
      {/* Summary verdict */}
      <div
        style={{
          background: verdict.bg,
          border: `1px solid ${verdict.border}`,
          borderRadius: '10px 10px 0 0',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: verdict.text,
          }}
        >
          Direct Constraints
        </span>
        <span
          style={{
            background: verdict.border,
            color: verdict.text,
            borderRadius: 5,
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {verdict.label}
        </span>
        <span style={{ fontSize: 11, color: '#718096', marginLeft: 'auto' }}>
          {limiters.limiters.length} constraint{limiters.limiters.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid table */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          overflow: 'hidden',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                background: '#f7fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Constraint
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Observed vs Limit
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Impact
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Suggested Fixes
              </th>
            </tr>
          </thead>
          <tbody>
            {limiters.limiters.map(limiter => (
              <ConstraintRow key={limiter.id} limiter={limiter} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
