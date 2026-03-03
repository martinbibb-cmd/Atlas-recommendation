/**
 * PhysicsConstraintsSection — /live/constraints
 *
 * Physics constraints grid — exactly as rendered in Step 8.
 * Delegates to the shared ConstraintsGrid panel component.
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import ConstraintsGrid from '../../ui/panels/ConstraintsGrid';

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
