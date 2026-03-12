/**
 * OperatingPointCard.tsx
 *
 * Compact summary card showing the key system operating-point measurements.
 * Reads the first available L/min, kPa, and m/s metrics from LimitersV1 so
 * the values are always engine-sourced — never re-derived in the UI.
 *
 * Layout: metric-first, helper text second. No prose explanations.
 */
import type { LimitersV1 } from '../../contracts/EngineOutputV1';
import { AtlasPanel } from '../ui/AtlasPanel';

interface Props {
  limiters?: LimitersV1;
}

export default function OperatingPointCard({ limiters }: Props) {
  const all = limiters?.limiters ?? [];

  const flowLimiter     = all.find(l => l.observed.unit === 'L/min');
  const pressureLimiter = all.find(l => l.observed.unit === 'kPa');
  const velocityLimiter = all.find(l => l.observed.unit === 'm/s');

  const hasData = flowLimiter ?? pressureLimiter ?? velocityLimiter;

  return (
    <AtlasPanel className="behaviour-console__kpi">
      <div className="panel-title">Operating point</div>
      {hasData ? (
        <>
          {flowLimiter && (
            <div className="atlas-mono">
              {flowLimiter.observed.value} {flowLimiter.observed.unit}
            </div>
          )}
          {pressureLimiter ? (
            // Convert kPa → bar (1 bar = 100 kPa). "dynamic" = pressure measured under flow.
            <div className="atlas-mono">
              {(pressureLimiter.observed.value / 100).toFixed(2)} bar dynamic
            </div>
          ) : velocityLimiter ? (
            <div className="atlas-mono">
              {velocityLimiter.observed.value} {velocityLimiter.observed.unit}
            </div>
          ) : null}
          <div className="behaviour-console__subtle op-card__subtle">
            Measured under flow
          </div>
        </>
      ) : (
        <div className="behaviour-console__subtle">No flow data available</div>
      )}
    </AtlasPanel>
  );
}
