/**
 * VerdictStrip — sticky top-anchor showing combi + stored verdicts.
 *
 * Reusable across LiveHubPage and LiveSectionShell so every surface
 * shows the same diagnostic headline at a glance.
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';

interface Props {
  result: FullEngineResult | null;
  onOpenCombi?: () => void;
  onOpenStored?: () => void;
  onOpenConstraints?: () => void;
}

export default function VerdictStrip({ result, onOpenCombi, onOpenStored, onOpenConstraints }: Props) {
  if (!result) return null;

  const combiRisk = result.combiDhwV1?.verdict.combiRisk ?? 'pass';
  const storedRisk = result.storedDhwV1?.verdict.storedRisk ?? 'pass';
  const limiters = result.engineOutput.limiters;
  const topConstraint = limiters?.limiters.find(l => l.severity === 'fail' || l.severity === 'warn');
  const constraintSummary = topConstraint
    ? `${topConstraint.severity === 'fail' ? 'Something to be aware of' : 'Worth checking'} — ${topConstraint.title}`
    : 'No known limitations';

  return (
    <div className="verdict-strip">
      <button className={`verdict-tile verdict-tile--${combiRisk}`} onClick={onOpenCombi}>
        <h3 className="verdict-tile__label">Combi</h3>
        <span className={`verdict-tile__pill verdict-tile__pill--${combiRisk}`}>
          {combiRisk === 'fail' ? '❌ Limited in this setup'
            : combiRisk === 'warn' ? '⚠️ Caution'
            : '✅ Viable'}
        </span>
      </button>

      <button className={`verdict-tile verdict-tile--${storedRisk ?? 'pass'}`} onClick={onOpenStored}>
        <h3 className="verdict-tile__label">Stored (Unvented)</h3>
        <span className={`verdict-tile__pill verdict-tile__pill--${storedRisk ?? 'pass'}`}>
          {storedRisk === 'warn' ? '⚠️ Caution' : '✅ Viable'}
        </span>
      </button>

      <button className="verdict-tile verdict-tile--info" onClick={onOpenConstraints}>
        <h3 className="verdict-tile__label">Constraints</h3>
        <span className="verdict-tile__pill verdict-tile__pill--info">
          {constraintSummary}
        </span>
      </button>
    </div>
  );
}
