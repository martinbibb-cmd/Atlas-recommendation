/**
 * VerdictStrip — sticky top-anchor showing combi + stored verdicts.
 *
 * Reusable across LiveHubPage and LiveSectionShell so every surface
 * shows the same diagnostic headline at a glance.
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';

interface Props {
  result: FullEngineResult | null;
}

export default function VerdictStrip({ result }: Props) {
  if (!result) return null;

  const combiRisk = result.combiDhwV1.verdict.combiRisk;
  const storedRisk = result.storedDhwV1.verdict.storedRisk;
  const limiters = result.engineOutput.limiters;
  const failCount = limiters
    ? limiters.limiters.filter(l => l.severity === 'fail').length
    : 0;
  const constraintSummary =
    failCount > 0
      ? `${failCount} constraint${failCount === 1 ? '' : 's'} failing`
      : 'No constraint violations';

  return (
    <div className="verdict-strip">
      <div className={`verdict-tile verdict-tile--${combiRisk}`}>
        <h3 className="verdict-tile__label">Combi</h3>
        <span className={`verdict-tile__pill verdict-tile__pill--${combiRisk}`}>
          {combiRisk === 'fail' ? '❌ Not suitable'
            : combiRisk === 'warn' ? '⚠️ Caution'
            : '✅ Viable'}
        </span>
      </div>

      <div className={`verdict-tile verdict-tile--${storedRisk ?? 'pass'}`}>
        <h3 className="verdict-tile__label">Stored (Unvented)</h3>
        <span className={`verdict-tile__pill verdict-tile__pill--${storedRisk ?? 'pass'}`}>
          {storedRisk === 'warn' ? '⚠️ Caution' : '✅ Viable'}
        </span>
      </div>

      <div className="verdict-tile verdict-tile--info">
        <h3 className="verdict-tile__label">Constraints</h3>
        <span className="verdict-tile__pill verdict-tile__pill--info">
          {constraintSummary}
        </span>
      </div>
    </div>
  );
}
