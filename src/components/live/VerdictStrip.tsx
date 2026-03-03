/**
 * VerdictStrip — reusable sticky verdict bar for the Live Output surface.
 *
 * Renders the Combi / Stored / Recommendation chips in a sticky dark header.
 * Optionally renders a back navigation button when `onBack` is provided.
 *
 * Sticky CSS: position: sticky; top: 0; z-index: 20 (via live-hub CSS classes).
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import '../../live/LiveHubPage.css';

interface Props {
  result: FullEngineResult;
  onBack?: () => void;
  backLabel?: string;
}

export default function VerdictStrip({ result, onBack, backLabel = '← Back' }: Props) {
  const { engineOutput } = result;
  const combiVerdict = result.combiDhwV1.verdict.combiRisk;
  const storedVerdict = result.storedDhwV1.verdict.storedRisk;

  return (
    <div className="live-hub__verdict-strip">
      <div className="live-hub__verdict-strip-inner">
        {onBack && (
          <button
            className="live-hub__back-btn"
            onClick={onBack}
            aria-label="Back"
          >
            {backLabel}
          </button>
        )}
        <div className="live-hub__verdict-chips">
          <div className={`live-hub__verdict-chip live-hub__verdict-chip--${combiVerdict}`}>
            <span className="live-hub__verdict-label">Combi</span>
            <span className="live-hub__verdict-value">
              {combiVerdict === 'fail' ? '❌ Not suitable'
                : combiVerdict === 'warn' ? '⚠️ Caution'
                : '✅ Viable'}
            </span>
          </div>
          <div className={`live-hub__verdict-chip live-hub__verdict-chip--${storedVerdict}`}>
            <span className="live-hub__verdict-label">Stored</span>
            <span className="live-hub__verdict-value">
              {storedVerdict === 'warn' ? '⚠️ Caution' : '✅ Viable'}
            </span>
          </div>
          <div className="live-hub__verdict-chip live-hub__verdict-chip--recommendation">
            <span className="live-hub__verdict-label">Recommendation</span>
            <span className="live-hub__verdict-value live-hub__verdict-value--recommendation">
              {engineOutput.recommendation.primary}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
