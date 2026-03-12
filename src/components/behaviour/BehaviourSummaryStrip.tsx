/**
 * BehaviourSummaryStrip.tsx
 *
 * Horizontal strip of three compact summary cards below the primary timeline panel:
 *   1. Operating Point — key measured flow/pressure values
 *   2. Active Limiters — top constraints sorted by severity
 *   3. Verdict        — concise decision card
 *
 * Collapses to a single column on narrow screens (tablet portrait / mobile).
 */
import type { LimitersV1, VerdictV1 } from '../../contracts/EngineOutputV1';
import OperatingPointCard from './OperatingPointCard';
import ActiveLimitersCard from './ActiveLimitersCard';
import VerdictCard from './VerdictCard';

interface Props {
  limiters?: LimitersV1;
  verdict?: VerdictV1;
}

export default function BehaviourSummaryStrip({ limiters, verdict }: Props) {
  return (
    <div className="behaviour-console__summary-strip">
      <OperatingPointCard limiters={limiters} />
      <ActiveLimitersCard limiters={limiters} />
      <VerdictCard verdict={verdict} />
    </div>
  );
}
