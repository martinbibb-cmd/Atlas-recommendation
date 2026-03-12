/**
 * ActiveLimitersCard.tsx
 *
 * Condensed view of active system limiters — severity-sorted, top 3 shown.
 * Each row is metric-led: badge → name → observed value. No paragraph walls.
 *
 * Full constraint detail remains available in the engineer section.
 */
import type { LimitersV1, LimiterV1, LimiterSeverity } from '../../contracts/EngineOutputV1';
import { AtlasPanel } from '../ui/AtlasPanel';
import { SeverityBadge } from '../ui/SeverityBadge';

interface Props {
  limiters?: LimitersV1;
}

const SEVERITY_ORDER: Record<LimiterSeverity, number> = { fail: 0, warn: 1, info: 2 };

const BADGE_LEVEL: Record<'fail' | 'warn', 'danger' | 'warning'> = {
  fail: 'danger',
  warn: 'warning',
};

const BADGE_LABEL: Record<LimiterSeverity, string> = {
  fail: 'Fail',
  warn: 'Warn',
  info: 'Info',
};

function LimiterRow({ limiter }: { limiter: LimiterV1 }) {
  const severity = limiter.severity;
  return (
    <div className="limiter-row">
      {severity !== 'info' ? (
        <SeverityBadge level={BADGE_LEVEL[severity]} label={BADGE_LABEL[severity]} />
      ) : (
        <span className="atlas-badge atlas-badge--info">{BADGE_LABEL[severity]}</span>
      )}
      <span className="limiter-row__title">{limiter.title}</span>
      <span className="atlas-mono limiter-row__metric">
        {limiter.observed.value} {limiter.observed.unit}
      </span>
    </div>
  );
}

export default function ActiveLimitersCard({ limiters }: Props) {
  const sorted = [...(limiters?.limiters ?? [])]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 3);

  const failCount = sorted.filter(l => l.severity === 'fail').length;
  const warnCount = sorted.filter(l => l.severity === 'warn').length;

  const subtitle =
    failCount > 0
      ? `${failCount} fail${failCount > 1 ? 's' : ''}${warnCount > 0 ? `, ${warnCount} warn${warnCount > 1 ? 's' : ''}` : ''}`
      : warnCount > 0
      ? `${warnCount} warning${warnCount > 1 ? 's' : ''}`
      : 'None active';

  return (
    <AtlasPanel className="behaviour-console__kpi">
      <div className="panel-title">
        Active limiters
        <span className="behaviour-console__subtle" style={{ marginLeft: 8, fontWeight: 400 }}>
          {subtitle}
        </span>
      </div>
      {sorted.length === 0 ? (
        <div className="behaviour-console__subtle">No active constraints</div>
      ) : (
        sorted.map(l => <LimiterRow key={l.id} limiter={l} />)
      )}
    </AtlasPanel>
  );
}
