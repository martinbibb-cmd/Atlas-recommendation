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
import { SEVERITY_LABEL as CUSTOMER_SEVERITY_LABEL } from '../../lib/copy/customerCopy';

interface Props {
  limiters: LimitersV1;
}

const SEVERITY_LABEL: Record<LimiterSeverity, string> = CUSTOMER_SEVERITY_LABEL as Record<LimiterSeverity, string>;

const BADGE_VARIANT: Record<LimiterSeverity, string> = {
  fail: 'danger',
  warn: 'warning',
  info: 'info',
};

const CONFIDENCE_ICONS: Record<string, string> = {
  high:   '🟢',
  medium: '🟡',
  low:    '🔴',
};

function LimiterCard({ limiter }: { limiter: LimiterV1 }) {
  const badgeVariant = BADGE_VARIANT[limiter.severity];
  const cardMod = limiter.severity; // 'fail' | 'warn' | 'info'

  return (
    <div className={`lp-card lp-card--${cardMod}`}>
      {/* Title row */}
      <div className="lp-card__title-row">
        <span className={`atlas-badge atlas-badge--${badgeVariant}`}>
          {SEVERITY_LABEL[limiter.severity]}
        </span>
        <span className="lp-card__title">{limiter.title}</span>
      </div>

      {/* Observed vs limit */}
      <div className="atlas-measure-row">
        <div className="atlas-measure-box atlas-measure-box--observed">
          <div className="atlas-measure-box__label">Observed</div>
          <div className="atlas-measure-box__value atlas-num">
            {limiter.observed.value} {limiter.observed.unit}
          </div>
          <div className="atlas-measure-box__sublabel">{limiter.observed.label}</div>
        </div>
        <div className="atlas-measure-arrow">→</div>
        <div className="atlas-measure-box">
          <div className="atlas-measure-box__label">Limit</div>
          <div className="atlas-measure-box__value atlas-num">
            {limiter.limit.value} {limiter.limit.unit}
          </div>
          <div className="atlas-measure-box__sublabel">{limiter.limit.label}</div>
        </div>
      </div>

      {/* Impact */}
      <p className="lp-card__impact">{limiter.impact.summary}</p>
      {limiter.impact.detail && (
        <p className="lp-card__impact-detail">{limiter.impact.detail}</p>
      )}

      {/* Confidence + sources */}
      <div className="atlas-meta lp-card__meta">
        <span>{CONFIDENCE_ICONS[limiter.confidence] ?? '⚪'}</span>
        <span className="lp-card__confidence">{limiter.confidence} confidence</span>
        {limiter.sources.length > 0 && (
          <>
            <span>·</span>
            <span>
              {limiter.sources.map(s =>
                s.kind === 'measured' ? 'measured' : s.kind === 'assumed' ? 'estimated' : 'derived',
              ).join(', ')}
            </span>
            {limiter.sources[0]?.note && (
              <span title={limiter.sources[0].note} className="lp-card__note-icon">ℹ</span>
            )}
          </>
        )}
      </div>

      {/* Suggested fixes */}
      {limiter.suggestedFixes.length > 0 && (
        <div className="lp-card__fixes">
          {limiter.suggestedFixes.map(fix => (
            <button
              key={fix.id}
              className="lp-fix-btn"
              title={fix.deltaHint}
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
      <div className="atlas-panel atlas-panel--success">
        ✅ No active limiters — system is operating within all constraints.
      </div>
    );
  }

  return (
    <div className="lp-panel">
      <h3 className="lp-panel__heading">
        Active Limiters ({limiters.limiters.length})
      </h3>
      {limiters.limiters.map(limiter => (
        <LimiterCard key={limiter.id} limiter={limiter} />
      ))}
    </div>
  );
}
