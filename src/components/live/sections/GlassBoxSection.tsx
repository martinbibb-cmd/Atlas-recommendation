/**
 * GlassBoxSection — raw physics transparency panel.
 *
 * Re-mounts GlassBoxPanel as-is so every calculation detail is
 * visible without modification.
 *
 * Extracted from LiveSectionPage so it can be composed inside
 * LiveSectionShell independently of the section routing layer.
 */
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';
import GlassBoxPanel from '../../visualizers/GlassBoxPanel';

interface Props {
  result: FullEngineResult;
}

export default function GlassBoxSection({ result }: Props) {
  return (
    <div className="result-section">
      <p
        className="description"
        style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#718096' }}
      >
        Every visual outcome is a deterministic result of the home's hydraulic and
        thermodynamic constraints. Inspect the normalised data, the full calculation
        trace, or the interactive visual outcome.
      </p>
      <GlassBoxPanel results={result} />
    </div>
  );
}
