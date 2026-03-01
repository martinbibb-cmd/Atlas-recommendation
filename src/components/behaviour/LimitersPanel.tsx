/**
 * LimitersPanel.tsx
 *
 * Renders LimitersV1 as a list of constraint cards, sorted by severity
 * (fail → warn → info).
 *
 * Each card shows:
 *   - Title + severity chip
 *   - Observed vs limit
 *   - Plain-language impact summary
 *   - Confidence + source
 *   - "Simulate fix" CTA (stub)
 */
import type { LimitersV1, LimiterV1, LimiterSeverity } from '../../contracts/EngineOutputV1';

interface Props {
  limiters: LimitersV1;
}

const SEVERITY_STYLES: Record<LimiterSeverity, { bg: string; border: string; chip: string; text: string; label: string }> = {
  fail: {
    bg: '#fff5f5', border: '#fc8181', chip: '#e53e3e',
    text: '#9b2c2c', label: 'Fail',
  },
  warn: {
    bg: '#fffff0', border: '#f6e05e', chip: '#d69e2e',
    text: '#7b341e', label: 'Warning',
  },
  info: {
    bg: '#ebf8ff', border: '#90cdf4', chip: '#3182ce',
    text: '#2a4365', label: 'Info',
  },
};

const CONFIDENCE_ICONS: Record<string, string> = {
  high:   '🟢',
  medium: '🟡',
  low:    '🔴',
};

function LimiterCard({ limiter }: { limiter: LimiterV1 }) {
  const s = SEVERITY_STYLES[limiter.severity];

  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 10,
        padding: '16px 18px',
        marginBottom: 12,
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span
          style={{
            background: s.chip,
            color: '#fff',
            borderRadius: 5,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {s.label}
        </span>
        <span style={{ fontWeight: 700, fontSize: 15, color: s.text }}>{limiter.title}</span>
      </div>

      {/* Observed vs limit */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            background: '#fff',
            border: `1px solid ${s.border}`,
            borderRadius: 6,
            padding: '6px 12px',
            minWidth: 100,
          }}
        >
          <div style={{ fontSize: 10, color: '#718096', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Observed
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: s.text }}>
            {limiter.observed.value} {limiter.observed.unit}
          </div>
          <div style={{ fontSize: 11, color: '#718096' }}>{limiter.observed.label}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 18, color: '#cbd5e0' }}>→</div>
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '6px 12px',
            minWidth: 100,
          }}
        >
          <div style={{ fontSize: 10, color: '#718096', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Limit
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2d3748' }}>
            {limiter.limit.value} {limiter.limit.unit}
          </div>
          <div style={{ fontSize: 11, color: '#718096' }}>{limiter.limit.label}</div>
        </div>
      </div>

      {/* Impact */}
      <p style={{ margin: '0 0 8px', fontSize: 13, color: s.text, lineHeight: 1.5 }}>
        {limiter.impact.summary}
      </p>
      {limiter.impact.detail && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#718096', lineHeight: 1.5 }}>
          {limiter.impact.detail}
        </p>
      )}

      {/* Confidence + sources */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
          fontSize: 12,
          color: '#718096',
        }}
      >
        <span>{CONFIDENCE_ICONS[limiter.confidence] ?? '⚪'}</span>
        <span style={{ textTransform: 'capitalize' }}>{limiter.confidence} confidence</span>
        {limiter.sources.length > 0 && (
          <>
            <span>·</span>
            <span>
              {limiter.sources.map(s =>
                s.kind === 'measured' ? 'measured' : s.kind === 'assumed' ? 'estimated' : 'derived',
              ).join(', ')}
            </span>
            {limiter.sources[0]?.note && (
              <span title={limiter.sources[0].note} style={{ cursor: 'help' }}>ℹ</span>
            )}
          </>
        )}
      </div>

      {/* Suggested fixes */}
      {limiter.suggestedFixes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {limiter.suggestedFixes.map(fix => (
            <button
              key={fix.id}
              title={fix.deltaHint}
              style={{
                background: '#fff',
                border: `1px solid ${s.border}`,
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 12,
                color: s.text,
                cursor: 'not-allowed',
                opacity: 0.7,
              }}
              disabled
              aria-label={`Simulate fix: ${fix.label}${fix.deltaHint ? ` — ${fix.deltaHint}` : ''}`}
            >
              ↪ {fix.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LimitersPanel({ limiters }: Props) {
  if (limiters.limiters.length === 0) {
    return (
      <div
        style={{
          background: '#f0fff4',
          border: '1px solid #9ae6b4',
          borderRadius: 10,
          padding: '16px 18px',
          marginBottom: 20,
          color: '#276749',
          fontSize: 14,
        }}
      >
        ✅ No active limiters — system is operating within all constraints.
      </div>
    );
  }

  return (
    <div className="limiters-panel" style={{ marginBottom: 20 }}>
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: 16,
          color: '#2d3748',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 8,
        }}
      >
        Active Limiters ({limiters.limiters.length})
      </h3>
      {limiters.limiters.map(limiter => (
        <LimiterCard key={limiter.id} limiter={limiter} />
      ))}
    </div>
  );
}
