/**
 * LiveSectionPage — wrapper for each live output section.
 *
 * Routes to the correct section panel based on the `section` prop.
 * Each panel re-mounts existing components (GlassBoxPanel, ConstraintsGrid, etc.)
 * with data derived from the engine result — nothing is rewritten here.
 */
import type { FullEngineResult } from '../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../ui/fullSurvey/FullSurveyModelV1';
import type { LiveSection } from './LiveHubPage';
import CurrentSituationSection from './sections/CurrentSituationSection';
import EvidenceConfidenceSection from './sections/EvidenceConfidenceSection';
import PhysicsConstraintsSection from './sections/PhysicsConstraintsSection';
import GeochemistrySection from './sections/GeochemistrySection';
import GlassBoxSection from './sections/GlassBoxSection';

interface Props {
  section: LiveSection;
  result: FullEngineResult;
  input: FullSurveyModelV1;
  onBack: () => void;
}

const SECTION_TITLES: Record<LiveSection, string> = {
  current: '🏠 Current System',
  water: '💧 Water Power & Concurrency',
  usage: '👥 Customer Usage Model',
  evidence: '🔬 Evidence & Confidence',
  constraints: '⚖️ Physics Constraints',
  chemistry: '🧪 Geochemical Analysis',
  glassbox: '🔭 Glass Box',
};

export default function LiveSectionPage({ section, result, input, onBack }: Props) {
  return (
    <div className="live-section">
      {/* ── Section header ───────────────────────────────────────────── */}
      <div className="live-section__header">
        <button
          className="live-section__back-btn"
          onClick={onBack}
          aria-label="Back to hub"
        >
          ← Hub
        </button>
        <h2 className="live-section__title">{SECTION_TITLES[section]}</h2>
      </div>

      {/* ── Section body ─────────────────────────────────────────────── */}
      <div className="live-section__body">
        {section === 'current' && <CurrentSituationSection result={result} />}
        {section === 'water' && <LiveWaterSection result={result} />}
        {section === 'usage' && <LiveUsageSection result={result} input={input} />}
        {section === 'evidence' && <EvidenceConfidenceSection result={result} />}
        {section === 'constraints' && <PhysicsConstraintsSection result={result} />}
        {section === 'chemistry' && <GeochemistrySection result={result} input={input} />}
        {section === 'glassbox' && <GlassBoxSection result={result} />}
      </div>
    </div>
  );
}

// ─── /live/water ──────────────────────────────────────────────────────────────
// DHW water power & concurrency analysis — sourced from combiDhwV1 engine result.

function LiveWaterSection({ result }: { result: FullEngineResult }) {
  const { combiDhwV1 } = result;
  const combiRisk = combiDhwV1.verdict.combiRisk;
  const riskColour =
    combiRisk === 'fail' ? '#e53e3e' : combiRisk === 'warn' ? '#d69e2e' : '#38a169';

  return (
    <>
      <div className="result-section">
        <h3>DHW Combi Verdict</h3>
        <div
          style={{
            padding: '0.75rem 1rem',
            background: combiRisk === 'fail' ? '#fff5f5'
              : combiRisk === 'warn' ? '#fffaf0'
              : '#f0fff4',
            border: `1px solid ${riskColour}40`,
            borderRadius: '8px',
            color: riskColour,
            fontWeight: 700,
            fontSize: '1rem',
          }}
        >
          {combiRisk === 'fail' ? '❌ Combi fails DHW concurrency check'
            : combiRisk === 'warn' ? '⚠️ Combi has borderline DHW concurrency'
            : '✅ Combi passes DHW concurrency check'}
        </div>
      </div>

      {/* Capacity metrics */}
      <div className="result-section">
        <h3>Capacity Metrics</h3>
        <div className="metric-row">
          <span className="metric-label">Nominal peak DHW output</span>
          <span className="metric-value">{combiDhwV1.maxQtoDhwKw.toFixed(1)} kW</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Derated peak output (after scale penalty)</span>
          <span className={`metric-value ${combiDhwV1.dhwCapacityDeratePct > 0 ? 'warning' : 'ok'}`}>
            {combiDhwV1.maxQtoDhwKwDerated.toFixed(1)} kW
          </span>
        </div>
        {combiDhwV1.dhwCapacityDeratePct > 0 && (
          <div className="metric-row">
            <span className="metric-label">Scale derate applied</span>
            <span className="metric-value warning">
              {(combiDhwV1.dhwCapacityDeratePct * 100).toFixed(1)}%
            </span>
          </div>
        )}
        {combiDhwV1.dhwRequiredKw !== null && (
          <div className="metric-row">
            <span className="metric-label">DHW heat required (measured flow)</span>
            <span
              className={`metric-value ${
                combiDhwV1.dhwRequiredKw > combiDhwV1.maxQtoDhwKwDerated ? 'warning' : 'ok'
              }`}
            >
              {combiDhwV1.dhwRequiredKw.toFixed(1)} kW
            </span>
          </div>
        )}
        {combiDhwV1.deliveredFlowLpm !== null && (
          <div className="metric-row">
            <span className="metric-label">Deliverable flow at derated output</span>
            {/* deliveredFlowLpm is only non-null when there IS a shortfall — always a warning */}
            <span className="metric-value warning">
              {combiDhwV1.deliveredFlowLpm.toFixed(1)} L/min
            </span>
          </div>
        )}
        {combiDhwV1.morningOverlapProbability !== null && (
          <div className="metric-row">
            <span className="metric-label">Morning overlap probability</span>
            <span
              className={`metric-value ${
                combiDhwV1.morningOverlapProbability > 0.3 ? 'warning' : 'ok'
              }`}
            >
              {(combiDhwV1.morningOverlapProbability * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Flags */}
      {combiDhwV1.flags.length > 0 && (
        <div className="result-section">
          <h3>Active Flags</h3>
          <ul style={{ margin: 0, padding: '0 0 0 1.25rem', lineHeight: 1.8 }}>
            {combiDhwV1.flags.map(flag => (
              <li key={flag.id} style={{ fontSize: '0.9rem', color: '#2d3748' }}>
                <strong>{flag.title}:</strong> {flag.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assumptions */}
      {combiDhwV1.assumptions.length > 0 && (
        <div className="result-section">
          <h3>Assumptions</h3>
          <ul style={{ margin: 0, padding: '0 0 0 1.25rem', lineHeight: 1.8 }}>
            {combiDhwV1.assumptions.map((a, i) => (
              <li key={i} style={{ fontSize: '0.85rem', color: '#718096' }}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// ─── /live/usage ──────────────────────────────────────────────────────────────
// Customer usage model — occupancy, stored DHW sizing, demand pattern.

function LiveUsageSection({
  result,
  input,
}: {
  result: FullEngineResult;
  input: FullSurveyModelV1;
}) {
  const { storedDhwV1 } = result;
  const storedRisk = storedDhwV1.verdict.storedRisk;

  return (
    <>
      <div className="result-section">
        <h3>Occupancy Profile</h3>
        <div className="metric-row">
          <span className="metric-label">Occupants</span>
          <span className="metric-value">{input.occupancyCount ?? '—'}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Bathrooms</span>
          <span className="metric-value">{input.bathroomCount ?? '—'}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Occupancy signature</span>
          <span className="metric-value">
            {input.occupancySignature === 'professional' ? 'Professional (away 08:00–17:00)'
              : input.occupancySignature === 'steady_home' ? 'Steady Home (retired / family)'
              : input.occupancySignature === 'shift_worker' ? 'Shift Worker (irregular)'
              : input.occupancySignature ?? '—'}
          </span>
        </div>
      </div>

      <div className="result-section">
        <h3>Stored DHW Verdict</h3>
        <div
          style={{
            padding: '0.75rem 1rem',
            background: storedRisk === 'warn' ? '#fffaf0' : '#f0fff4',
            border: `1px solid ${storedRisk === 'warn' ? '#f6ad5540' : '#48bb7840'}`,
            borderRadius: '8px',
            color: storedRisk === 'warn' ? '#d69e2e' : '#38a169',
            fontWeight: 700,
            fontSize: '1rem',
          }}
        >
          {storedRisk === 'warn'
            ? '⚠️ Stored system has sizing or space concerns'
            : '✅ Stored system sizing is suitable'}
        </div>
        {storedDhwV1.recommended && (
          <div style={{ marginTop: '0.75rem' }}>
            <div className="metric-row">
              <span className="metric-label">Recommended type</span>
              <span className="metric-value">{storedDhwV1.recommended.type}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Volume band</span>
              <span className="metric-value">{storedDhwV1.recommended.volumeBand}</span>
            </div>
          </div>
        )}
      </div>

      {storedDhwV1.flags.length > 0 && (
        <div className="result-section">
          <h3>Active Flags</h3>
          <ul style={{ margin: 0, padding: '0 0 0 1.25rem', lineHeight: 1.8 }}>
            {storedDhwV1.flags.map(flag => (
              <li key={flag.id} style={{ fontSize: '0.9rem', color: '#2d3748' }}>
                <strong>{flag.title}:</strong> {flag.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
