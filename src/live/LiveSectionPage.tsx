/**
 * LiveSectionPage — wrapper for each live output section.
 *
 * Routes to the correct section panel based on the `section` prop,
 * mounting each body inside LiveSectionShell so every page shares
 * the sticky VerdictStrip and a consistent back-to-hub header.
 */
import type { FullEngineResult } from '../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../ui/fullSurvey/FullSurveyModelV1';
import type { LiveSection } from './LiveHubPage';
import LiveSectionShell from '../components/live/LiveSectionShell';
import PhysicsConstraintsPanel from '../components/hub/panels/PhysicsConstraintsPanel';
import CurrentSituationSection from '../components/live/sections/CurrentSituationSection';
import EvidenceConfidenceSection from '../components/live/sections/EvidenceConfidenceSection';
import PhysicsConstraintsSection from '../components/live/sections/PhysicsConstraintsSection';
import GeochemistrySection from '../components/live/sections/GeochemistrySection';
import GlassBoxSection from '../components/live/sections/GlassBoxSection';

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
    <LiveSectionShell
      title={SECTION_TITLES[section]}
      onBack={onBack}
      result={result}
    >
      {section === 'current' && <CurrentSituationSection result={result} />}
      {section === 'water' && <PhysicsConstraintsPanel result={result} input={input} />}
      {section === 'usage' && <LiveUsageSection result={result} input={input} />}
      {section === 'evidence' && <EvidenceConfidenceSection result={result} />}
      {section === 'constraints' && (
        <>
          {/* Card A: Water power & concurrency */}
          <PhysicsConstraintsPanel result={result} input={input} />
          {/* Card B: Constraint cards list */}
          <PhysicsConstraintsSection result={result} />
        </>
      )}
      {section === 'chemistry' && <GeochemistrySection result={result} input={input} />}
      {section === 'glassbox' && <GlassBoxSection result={result} />}
    </LiveSectionShell>
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

  // Determine whether the minimum usage inputs are present.
  const hasOccupancy = input.occupancyCount != null;
  const hasBathrooms = input.bathroomCount != null;
  const hasMissingInputs = !hasOccupancy || !hasBathrooms;

  return (
    <>
      {hasMissingInputs && (
        <div
          className="result-section"
          style={{
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                background: '#f59e0b',
                color: '#fff',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Missing inputs
            </span>
            <span style={{ fontSize: '0.9rem', color: '#92400e', fontWeight: 600 }}>
              Usage model incomplete
            </span>
          </div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#78350f' }}>
            {!hasOccupancy && !hasBathrooms
              ? 'Occupant count and bathroom count are required for usage modelling.'
              : !hasOccupancy
              ? 'Occupant count is required for usage modelling.'
              : 'Bathroom count is required for usage modelling.'}
          </p>
          <button
            className="cta-btn"
            style={{
              background: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.4rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => {/* CTA: prompt surveyor to add usage schedule */}}
          >
            Add usage schedule
          </button>
        </div>
      )}

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
