/**
 * GlassBoxSection — /live/glassbox
 *
 * Full physics transparency panel — GlassBoxPanel re-mounted as-is.
 * Every visual outcome is a deterministic result of the home's hydraulic
 * and thermodynamic constraints.
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import GlassBoxPanel from '../../components/visualizers/GlassBoxPanel';

interface Props {
  result: FullEngineResult;
}

export default function GlassBoxSection({ result }: Props) {
  return (
    <div className="result-section">
      <p className="description" style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#718096' }}>
        Every visual outcome is a deterministic result of the home's hydraulic and
        thermodynamic constraints. Inspect the normalised data, the full calculation
        trace, or the interactive visual outcome.
      </p>
      <GlassBoxPanel results={result} />
    </div>
  );
}
