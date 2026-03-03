/**
 * PhysicsConstraintsSection — limiter cards from the engine's constraint list.
 *
 * Renders ConstraintsGrid when limiters are present, or a safe fallback
 * when no constraint data is available.
 *
 * Extracted from LiveSectionPage so it can be composed inside
 * LiveSectionShell alongside the DHW concurrency panel.
 */
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';
import ConstraintsGrid from '../../../ui/panels/ConstraintsGrid';

interface Props {
  result: FullEngineResult;
}

export default function PhysicsConstraintsSection({ result }: Props) {
  const { engineOutput } = result;

  if (!engineOutput.limiters || engineOutput.limiters.limiters.length === 0) {
    return (
      <div className="result-section">
        <p style={{ color: '#718096' }}>No constraint data available for this result.</p>
      </div>
    );
  }

  return (
    <div className="result-section">
      <ConstraintsGrid limiters={engineOutput.limiters} />
    </div>
  );
}
