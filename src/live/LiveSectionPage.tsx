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
import GlassBoxPanel from '../components/visualizers/GlassBoxPanel';
import ConstraintsGrid from '../ui/panels/ConstraintsGrid';
import {
  resolveNominalEfficiencyPct,
  computeCurrentEfficiencyPct,
  deriveErpClass,
} from '../engine/utils/efficiency';

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
        {section === 'current' && <LiveCurrentSection result={result} />}
        {section === 'water' && <LiveWaterSection result={result} />}
        {section === 'usage' && <LiveUsageSection result={result} input={input} />}
        {section === 'evidence' && <LiveEvidenceSection result={result} />}
        {section === 'constraints' && <LiveConstraintsSection result={result} />}
        {section === 'chemistry' && <LiveChemistrySection result={result} input={input} />}
        {section === 'glassbox' && <LiveGlassboxSection result={result} />}
      </div>
    </div>
  );
}

// ─── /live/current ────────────────────────────────────────────────────────────
// Current situation summary: eligibility, options headline, red flags.

function LiveCurrentSection({ result }: { result: FullEngineResult }) {
  const { engineOutput } = result;

  return (
    <>
      {/* Your situation */}
      {/* contextSummary exists and has bullets — map handles empty arrays gracefully */}
      {engineOutput.contextSummary && (
        <div className="result-section">
          <h3>Your Situation</h3>
          <ul className="context-summary-list">
            {engineOutput.contextSummary.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      {/* System eligibility */}
      <div className="result-section">
        <h3>🚩 System Eligibility</h3>
        <div className="verdict-grid">
          {engineOutput.eligibility.map(item => {
            const statusClass =
              item.status === 'rejected' ? 'rejected'
              : item.status === 'caution' ? 'flagged'
              : 'approved';
            const statusLabel =
              item.status === 'rejected' ? '❌ Rejected'
              : item.status === 'caution' ? '⚠️ Caution'
              : '✅ Viable';
            return (
              <div key={item.id} className={`verdict-item ${statusClass}`}>
                <div className="verdict-label">{item.label}</div>
                <div className="verdict-status">{statusLabel}</div>
              </div>
            );
          })}
        </div>
        {engineOutput.redFlags.length > 0 && (
          <ul className="red-flag-list" style={{ marginTop: '1rem' }}>
            {engineOutput.redFlags.map(flag => (
              <li key={flag.id} className={flag.severity === 'fail' ? 'reject' : 'flag'}>
                <strong>{flag.title}:</strong> {flag.detail}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Options summary */}
      {engineOutput.options && engineOutput.options.length > 0 && (
        <div className="result-section">
          <h3>🔍 Options at a Glance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {engineOutput.options.map(card => {
              const statusClass =
                card.status === 'rejected' ? 'rejected'
                : card.status === 'caution' ? 'caution'
                : 'viable';
              const statusLabel =
                card.status === 'rejected' ? '❌ Not suitable'
                : card.status === 'caution' ? '⚠️ Possible'
                : '✅ Suitable';
              return (
                <div key={card.id} className={`option-card option-card--${statusClass}`}>
                  <div className="option-card__title">
                    <span className="option-card__label">{card.label}</span>
                    <span className={`option-card__status option-card__status--${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="option-card__headline">{card.headline}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="result-section">
        <h3>📋 Recommendation</h3>
        <div
          className="recommendation-banner"
          style={{
            padding: '1rem 1.25rem',
            background: '#ebf8ff',
            border: '1px solid #90cdf4',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#2c5282',
          }}
        >
          {engineOutput.recommendation.primary}
        </div>
      </div>
    </>
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

// ─── /live/evidence ───────────────────────────────────────────────────────────
// Evidence & confidence table — exactly as rendered in Step 8.

const BADGE_ALPHA = '26'; // ~15% opacity hex suffix

function confidenceColour(confidence: string): string {
  if (confidence === 'high') return '#38a169';
  if (confidence === 'medium') return '#d69e2e';
  return '#e53e3e';
}

function sourceColour(source: string): string {
  if (source === 'measured') return '#3182ce';
  if (source === 'derived') return '#805ad5';
  if (source === 'assumed') return '#d69e2e';
  return '#718096';
}

function LiveEvidenceSection({ result }: { result: FullEngineResult }) {
  const { engineOutput } = result;

  if (!engineOutput.evidence || engineOutput.evidence.length === 0) {
    return (
      <div className="result-section">
        <p style={{ color: '#718096' }}>No evidence data available for this result.</p>
      </div>
    );
  }

  return (
    <div className="result-section">
      <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.75rem' }}>
        What the engine knows, how it knows it, and how confident it is.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Input</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Value</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Source</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Confidence</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Affects</th>
            </tr>
          </thead>
          <tbody>
            {engineOutput.evidence.map(item => {
              const cColour = confidenceColour(item.confidence);
              const sColour = sourceColour(item.source);
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#2d3748' }}>
                    {item.label}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{item.value}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: sColour + BADGE_ALPHA,
                        color: sColour,
                      }}
                    >
                      {item.source}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: cColour + BADGE_ALPHA,
                        color: cColour,
                      }}
                    >
                      {item.confidence}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#718096', fontSize: '0.75rem' }}>
                    {item.affectsOptionIds.join(', ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── /live/constraints ────────────────────────────────────────────────────────
// Physics constraints grid — exactly as rendered in Step 8.

function LiveConstraintsSection({ result }: { result: FullEngineResult }) {
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

// ─── /live/chemistry ──────────────────────────────────────────────────────────
// Geochemical analysis — water hardness, scale, efficiency decay.

function LiveChemistrySection({
  result,
  input,
}: {
  result: FullEngineResult;
  input: FullSurveyModelV1;
}) {
  const { normalizer } = result;
  const nominalEfficiencyPct = resolveNominalEfficiencyPct(input.currentBoilerSedbukPct);
  const currentEfficiencyPct = computeCurrentEfficiencyPct(
    nominalEfficiencyPct,
    normalizer.tenYearEfficiencyDecayPct,
  );

  return (
    <div className="result-section">
      <div className="metric-row">
        <span className="metric-label">Water Hardness</span>
        <span
          className={`metric-value ${normalizer.waterHardnessCategory === 'soft' ? 'ok' : 'warning'}`}
        >
          {normalizer.waterHardnessCategory.replace('_', ' ').toUpperCase()}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">CaCO₃ Level</span>
        <span className="metric-value">{normalizer.cacO3Level} mg/L</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Silica Level</span>
        <span className="metric-value">{normalizer.silicaLevel} mg/L</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Thermal Resistance Factor (Rf)</span>
        <span className="metric-value">{normalizer.scaleRf.toFixed(5)} m²K/W</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">10-Year Efficiency Decay</span>
        <span
          className={`metric-value ${normalizer.tenYearEfficiencyDecayPct > 8 ? 'warning' : 'ok'}`}
        >
          {normalizer.tenYearEfficiencyDecayPct.toFixed(1)}%
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Current Boiler Efficiency (post-decay)</span>
        <span className={`metric-value ${currentEfficiencyPct < 80 ? 'warning' : 'ok'}`}>
          {currentEfficiencyPct.toFixed(1)}% — ErP {deriveErpClass(currentEfficiencyPct) ?? 'n/a'}
        </span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Boiler ErP (from entered SEDBUK %)</span>
        <span className="metric-value">{deriveErpClass(nominalEfficiencyPct) ?? 'n/a'}</span>
      </div>
    </div>
  );
}

// ─── /live/glassbox ───────────────────────────────────────────────────────────
// Glass Box physics transparency panel — GlassBoxPanel re-mounted as-is.

function LiveGlassboxSection({ result }: { result: FullEngineResult }) {
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
