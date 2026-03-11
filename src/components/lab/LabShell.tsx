import { useState } from 'react';
import ExplainersHubPage from '../../explainers/ExplainersHubPage';
import LabHomeLink from './LabHomeLink';
import LabConfidenceStrip, { type ConfidenceStripData } from './LabConfidenceStrip';
import './lab.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type LabTab = 'summary' | 'physics' | 'visual';

interface Props {
  onHome: () => void;
}

// ─── Placeholder context ──────────────────────────────────────────────────────
// These values are static stand-ins for UI development. A future PR will wire
// them to engine output: current system from survey/stepper, candidate systems
// from the recommendation engine, and confidence from the scoring module.

/** Fallback current system label — replaced by engine/stepper context in a later PR. */
const PLACEHOLDER_CURRENT_SYSTEM = 'Gas Combi';

/** Confidence level label shown in the context row badge. Replaced by engine output. */
const PLACEHOLDER_CONFIDENCE = 'Medium';

// ─── Confidence strip data ────────────────────────────────────────────────────
// Static stand-ins reusing the same uncertainty themes surfaced by explanation
// hints. A future PR will derive these from engine evidence buckets.

const PLACEHOLDER_CONFIDENCE_STRIP: ConfidenceStripData = {
  measured: [
    'Current system type',
    'Bathroom count',
    'Simultaneous outlets',
    'Occupancy count',
  ],
  inferred: [
    'DHW demand (from occupancy pattern)',
    'Cylinder suitability baseline',
    'Storage regime default (not explicitly confirmed)',
  ],
  missing: [
    'Emitter output verification',
    'Flow temperature confirmation',
    'Cylinder siting / routing confirmation',
  ],
  nextStep: 'Complete a Full Survey to confirm compatibility and tighten recommendation confidence.',
};

/**
 * Headline verdict shown in the verdict strip.
 * Replaced by the engine's top recommendation string in a later PR.
 */
const PLACEHOLDER_VERDICT = {
  system: 'ASHP with unvented cylinder',
  note:   'Meets heat and hot water demand with lowest operating cost. Requires emitter check before installation.',
};

// ─── Normalized comparison headings ───────────────────────────────────────────

const COMPARISON_HEADINGS = [
  { key: 'heat',    label: 'Heat performance' },
  { key: 'dhw',     label: 'Hot water performance' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'longevity',   label: 'Longevity' },
  { key: 'disruption',  label: 'Disruption' },
  { key: 'control',     label: 'Control' },
  { key: 'eco',         label: 'Eco / operating behaviour' },
  { key: 'future',      label: 'Future compatibility' },
] as const;

type HeadingKey = typeof COMPARISON_HEADINGS[number]['key'];

interface CandidateExplanation {
  suits: string;
  struggles: string;
  changes: string;
  /** Optional context-aware hint surfacing missing or estimated inputs. Shown below the main suits text. */
  suitsHint?: string;
  /** Optional context-aware hint surfacing missing or estimated inputs. Shown below the main struggles text. */
  strugglesHint?: string;
  /** Optional context-aware hint surfacing missing or estimated inputs. Shown below the main changes text. */
  changesHint?: string;
}

interface CandidateSystem {
  id: string;
  label: string;
  rows: Record<HeadingKey, string>;
  explanation: CandidateExplanation;
}

// Fallback candidate data — replaced by engine-computed recommendations in a
// future PR once the comparison engine provides per-system structured output.
const CANDIDATE_SYSTEMS: CandidateSystem[] = [
  {
    id: 'gas_system',
    label: 'Gas System + Cylinder',
    rows: {
      heat:        'Adequate for most UK heat losses. Flow temps 65–70 °C support standard radiators.',
      dhw:         'Stored supply; reheat time ~30–45 min depending on cylinder size.',
      reliability: 'Mature technology with established supply chain and servicing.',
      longevity:   'Boiler lifespan 12–15 years typical; cylinder 20–25 years.',
      disruption:  'Cylinder installation requires space and pipework changes.',
      control:     'S-plan or Y-plan zone control. Smart thermostat compatible.',
      eco:         'Efficiency peaks when condensing; reduced cycling with stored supply.',
      future:      'Gas grid uncertainty post-2035. Hydrogen-ready boilers emerging.',
    },
    explanation: {
      suits:       'Strong on-demand hot water resilience, familiar controls, and proven compatibility with existing radiator systems at standard flow temperatures.',
      suitsHint:   'Hot water demand estimated from occupancy count. Cylinder sizing not yet confirmed.',
      struggles:   'Higher carbon pathway as gas prices and grid carbon intensity work against it long-term. Requires cylinder space and dedicated pipework changes.',
      changes:     'Confirm cylinder siting, primary routing, and zoning/control layout before proceeding.',
      changesHint: 'Cylinder siting and primary routing are currently assumed. A full survey is required to confirm.',
    },
  },
  {
    id: 'ashp',
    label: 'ASHP',
    rows: {
      heat:        'Best at low flow temps (35–50 °C). May require emitter upgrades on older homes.',
      dhw:         'Stored supply via dedicated cylinder. COP drops at high DHW temps.',
      reliability: 'Fewer combustion components; outdoor unit exposed to weather.',
      longevity:   'Compressor lifespan 15–20 years with annual maintenance.',
      disruption:  'Significant: outdoor unit, cylinder, revised controls, emitter check.',
      control:     'Weather compensation standard. Smart integration widely supported.',
      eco:         'Lowest carbon per kWh at current grid mix. COP 2.5–4.5 typical.',
      future:      'Eligible for BUS grant. Aligned with Future Homes Standard trajectory.',
    },
    explanation: {
      suits:          'Meets heat demand efficiently at low flow temperature with strong seasonal efficiency. Carbon intensity drops further as the grid decarbonises, improving long-term operating cost.',
      struggles:      'Performance depends on emitter adequacy — undersized radiators force higher flow temperatures and reduce COP. DHW temperature lifts also reduce seasonal efficiency.',
      strugglesHint:  'Emitter adequacy has not been verified in this survey. Performance estimate assumes adequate radiator output.',
      changes:        'Confirm emitter output, flow temperatures, and cylinder strategy before installation. Emitter upgrade may be required.',
      changesHint:    'Emitter output and flow temperature data are currently estimated. A full survey is required to confirm compatibility.',
    },
  },
];

// ─── Summary tab ──────────────────────────────────────────────────────────────

function SummaryTab() {
  return (
    <div className="lab-summary">
      <div className="lab-summary__grid">
        {CANDIDATE_SYSTEMS.map(system => (
          <div key={system.id} className="lab-summary__card">
            <div className="lab-summary__card-title">{system.label}</div>
            <dl className="lab-summary__dl">
              {COMPARISON_HEADINGS.map(h => (
                <div key={h.key} className="lab-summary__row">
                  <dt className="lab-summary__dt">{h.label}</dt>
                  <dd className="lab-summary__dd">{system.rows[h.key]}</dd>
                </div>
              ))}
            </dl>
            <div className="lab-summary__explanation">
              <div className="lab-summary__explanation-block lab-summary__explanation-block--suits">
                <span className="lab-summary__explanation-label">Why it suits</span>
                <p className="lab-summary__explanation-text">{system.explanation.suits}</p>
                {system.explanation.suitsHint && (
                  <p className="lab-summary__explanation-hint">{system.explanation.suitsHint}</p>
                )}
              </div>
              <div className="lab-summary__explanation-block lab-summary__explanation-block--struggles">
                <span className="lab-summary__explanation-label">Why it struggles</span>
                <p className="lab-summary__explanation-text">{system.explanation.struggles}</p>
                {system.explanation.strugglesHint && (
                  <p className="lab-summary__explanation-hint">{system.explanation.strugglesHint}</p>
                )}
              </div>
              <div className="lab-summary__explanation-block lab-summary__explanation-block--changes">
                <span className="lab-summary__explanation-label">What would need to change</span>
                <p className="lab-summary__explanation-text">{system.explanation.changes}</p>
                {system.explanation.changesHint && (
                  <p className="lab-summary__explanation-hint">{system.explanation.changesHint}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Visual tab ───────────────────────────────────────────────────────────────

function VisualTab() {
  return (
    <div className="lab-visual-stub">
      <div className="lab-visual-stub__icon" aria-hidden="true">📈</div>
      <p className="lab-visual-stub__title">Visual view coming in a future update.</p>
      <p className="lab-visual-stub__body">
        This tab will show the day painter, DHW behaviour visuals, comfort graphs, and simple
        comparison charts that prove a specific physics point.
      </p>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function LabShell({ onHome }: Props) {
  const [activeTab, setActiveTab] = useState<LabTab>('summary');

  const TAB_LABELS: Record<LabTab, string> = {
    summary: 'Summary',
    physics: 'Physics',
    visual:  'Visual',
  };

  return (
    <div className="lab-wrap">

      {/* ── Branded header ─────────────────────────────────────────────────── */}
      <header className="lab-header">
        <LabHomeLink onHome={onHome} />
        <div className="lab-title">
          <div className="lab-brand" aria-label="Atlas">ATLAS</div>
          <h1 className="lab-h1">System Lab</h1>
          <p className="lab-subtitle">Compare heating systems using real operating constraints.</p>
        </div>
      </header>

      {/* ── Context row ────────────────────────────────────────────────────── */}
      <div className="lab-context-row" aria-label="Comparison context">
        <span className="lab-context-label">Current:</span>
        <span className="lab-context-chip lab-context-chip--current">{PLACEHOLDER_CURRENT_SYSTEM}</span>
        <span className="lab-context-label">Comparing:</span>
        {CANDIDATE_SYSTEMS.map(s => (
          <span key={s.id} className="lab-context-chip">{s.label}</span>
        ))}
        <span className="lab-confidence-badge">Confidence: {PLACEHOLDER_CONFIDENCE}</span>
      </div>

      {/* ── Headline verdict strip ─────────────────────────────────────────── */}
      <div className="lab-verdict-strip" role="status" aria-label="Headline verdict">
        <span className="lab-verdict-strip__label">Best overall fit:</span>
        <span className="lab-verdict-strip__value">{PLACEHOLDER_VERDICT.system}</span>
        <span className="lab-verdict-strip__note">
          {PLACEHOLDER_VERDICT.note}
        </span>
      </div>

      {/* ── Confidence + assumptions strip ─────────────────────────────────── */}
      <LabConfidenceStrip data={PLACEHOLDER_CONFIDENCE_STRIP} />

      {/* ── Top-level tabs ─────────────────────────────────────────────────── */}
      <div className="lab-tabs" role="tablist" aria-label="Lab views">
        {(Object.keys(TAB_LABELS) as LabTab[]).map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`lab-tab${activeTab === tab ? ' lab-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="lab-tab-content" role="tabpanel">
        {activeTab === 'summary' && <SummaryTab />}
        {activeTab === 'physics' && <ExplainersHubPage />}
        {activeTab === 'visual'  && <VisualTab />}
      </div>

    </div>
  );
}
