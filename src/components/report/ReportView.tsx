/**
 * ReportView.tsx
 *
 * Unified printable report surface.
 *
 * Built from EngineOutputV1 — the same truth used by the Behaviour Console
 * and the full survey path.
 *
 * Structure
 * ──────────
 *  Report header
 *  Completeness banner (if partial)
 *
 *  Customer summary (decision-first):
 *    System summary       – best-fit system + why it suits
 *    Key trade-off        – likely upgrades and engineering concerns
 *    Operating point      – peak DHW conditions
 *    Behaviour summary    – 24-hour timeline summary
 *    Key limiters         – hard/soft physical constraints
 *    Future path          – next step + upgrade sensitivities
 *    Verdict              – full verdict with confidence
 *
 *  Technical summary (engineer-facing):
 *    System architecture  – installation topology and requirements
 *    Stored hot water     – DHW logic for stored systems
 *    Risks and enablers   – cross-option sensitivity map
 *    Assumptions          – modelling assumptions and red flags
 *
 *  Appendix (optional deep detail):
 *    Physics trace        – trimmed 24-hour active-step trace
 *    Engineering notes    – must-have and nice-to-have installation items
 *
 * Printed output is print-first, not a screenshot of the interactive console.
 * Interactive chrome is hidden via @media print (see reportPrint.css).
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import {
  checkCompleteness,
  buildReportSections,
  type SystemSummarySection,
  type KeyTradeOffSection,
  type OperatingPointSection,
  type BehaviourSummarySection,
  type KeyLimitersSection,
  type FuturePathSection,
  type VerdictSection,
  type SystemArchitectureSection,
  type StoredHotWaterSection,
  type RisksEnablersSection,
  type AssumptionsSection,
  type PhysicsTraceSection,
  type EngineeringNotesSection,
  type ReportSection,
} from './reportSections.model';
import ReportCompletenessBanner from './ReportCompletenessBanner';
import './reportPrint.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Engine output to render. Pass null to show a graceful "no data" state. */
  output: EngineOutputV1 | null;
  /** Called when the user clicks the back button on screen. Defaults to window.history.back(). */
  onBack?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Section renderers ────────────────────────────────────────────────────────

function SystemSummarySection({ section }: { section: SystemSummarySection }) {
  const statusLabel =
    section.verdictStatus === 'good'
      ? 'Good'
      : section.verdictStatus === 'caution'
        ? 'Caution'
        : section.verdictStatus === 'fail'
          ? 'Fail'
          : undefined;

  return (
    <section className="rv-section" aria-labelledby="rv-system-summary">
      <h2 className="rv-section__title" id="rv-system-summary">System summary</h2>
      <p className="rv-recommendation">{section.primary}</p>
      {section.secondary && (
        <p className="rv-recommendation--secondary">{section.secondary}</p>
      )}
      {section.verdictTitle && (
        <dl className="rv-dl" style={{ marginTop: '0.5rem' }}>
          <div className="rv-dl-row">
            <dt className="rv-dt">Assessment</dt>
            <dd className="rv-dd">{section.verdictTitle}</dd>
          </div>
          {statusLabel && (
            <div className="rv-dl-row">
              <dt className="rv-dt">Status</dt>
              <dd className="rv-dd">{statusLabel}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

function OperatingPointSection({ section }: { section: OperatingPointSection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-operating-point">
      <h2 className="rv-section__title" id="rv-operating-point">Operating point / water performance</h2>
      <dl className="rv-dl">
        <div className="rv-dl-row">
          <dt className="rv-dt">Peak DHW</dt>
          <dd className="rv-dd">
            {section.peakDhwKw !== null
              ? `${section.peakDhwKw.toFixed(1)} kW @ ${section.peakDhwTime}`
              : '—'}
          </dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Est. flow</dt>
          <dd className="rv-dd">
            {section.estimatedFlowLpm !== null
              ? `${section.estimatedFlowLpm} L/min`
              : '—'}
          </dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Pressure</dt>
          <dd className="rv-dd">
            {section.pressureBar !== null ? `${section.pressureBar} bar` : '—'}
          </dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">DHW events</dt>
          <dd className="rv-dd">
            {section.dhwEventSteps} active step{section.dhwEventSteps !== 1 ? 's' : ''}
          </dd>
        </div>
        {section.assumptionCount > 0 && (
          <div className="rv-dl-row">
            <dt className="rv-dt">Assumptions</dt>
            <dd className="rv-dd">
              {section.assumptionCount} applied
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function BehaviourSummarySection({ section }: { section: BehaviourSummarySection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-behaviour-summary">
      <h2 className="rv-section__title" id="rv-behaviour-summary">Behaviour timeline summary</h2>
      <dl className="rv-dl">
        <div className="rv-dl-row">
          <dt className="rv-dt">Appliance</dt>
          <dd className="rv-dd">{section.applianceName || '—'}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Resolution</dt>
          <dd className="rv-dd">{section.resolutionMins} min</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Data points</dt>
          <dd className="rv-dd">{section.totalPoints}</dd>
        </div>
        {section.peakDhwKw !== null && (
          <div className="rv-dl-row">
            <dt className="rv-dt">Peak DHW</dt>
            <dd className="rv-dd">{section.peakDhwKw.toFixed(1)} kW</dd>
          </div>
        )}
        {section.assumptionsUsed.length > 0 && (
          <div className="rv-dl-row">
            <dt className="rv-dt">Assumptions</dt>
            <dd className="rv-dd">{section.assumptionsUsed.join(', ')}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function KeyLimitersSection({ section }: { section: KeyLimitersSection }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-key-limiters">
      <h2 className="rv-section__title" id="rv-key-limiters">Key limiters / constraints</h2>
      {section.limiters.map(l => (
        <div key={l.id} className="rv-limiter">
          <span className={`rv-limiter__badge rv-limiter__badge--${l.severity}`}>
            {l.severity}
          </span>
          <div>
            <p className="rv-limiter__title">{l.title}</p>
            <p className="rv-limiter__detail">{l.detail}</p>
            {l.observed && (
              <p className="rv-limiter__detail">Observed: {l.observed}</p>
            )}
            {l.limit && (
              <p className="rv-limiter__detail">Limit: {l.limit}</p>
            )}
            {l.suggestedFix && (
              <p className="rv-limiter__fix">→ {l.suggestedFix}</p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function VerdictSection({ section }: { section: VerdictSection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-verdict">
      <h2 className="rv-section__title" id="rv-verdict">Verdict / recommendation</h2>
      <div className={`rv-verdict rv-verdict--${section.status}`} role="status" aria-label="Verdict">
        <div className="rv-verdict__label">
          {section.status === 'good'
            ? 'Recommended'
            : section.status === 'caution'
              ? 'Caution'
              : 'Does not meet criteria'}
        </div>
        <p className="rv-verdict__title">{section.title}</p>
        <div className="rv-verdict__confidence-block">
          <span className="rv-verdict__confidence-key">Confidence</span>
          <span className="rv-verdict__confidence">{capitalise(section.confidenceLevel)}</span>
        </div>
        {section.reasons.length > 0 && (
          <ul className="rv-verdict__reasons" aria-label="Verdict reasons">
            {section.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
        {section.primaryReason && (
          <p className="rv-verdict__primary-reason">{section.primaryReason}</p>
        )}
        {section.comparedTechnologies && section.comparedTechnologies.length > 0 && (
          <p className="rv-verdict__primary-reason">
            Compared against: {section.comparedTechnologies.join(', ')}
          </p>
        )}
      </div>
    </section>
  );
}

function AssumptionsSection({ section }: { section: AssumptionsSection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-assumptions">
      <h2 className="rv-section__title" id="rv-assumptions">Assumptions / notes</h2>
      {section.redFlags.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div className="rv-section__title" style={{ marginBottom: '0.4rem' }}>Flags</div>
          {section.redFlags.map(f => (
            <div key={f.id} className={`rv-redflag rv-redflag--${f.severity}`}>
              <p className="rv-redflag__title">{f.title}</p>
              <p className="rv-redflag__detail">{f.detail}</p>
            </div>
          ))}
        </div>
      )}
      {section.assumptions.length > 0 && (
        <div>
          {section.assumptions.map(a => (
            <div key={a.id} className="rv-assumption">
              <p className="rv-assumption__title">{a.title}</p>
              <p className="rv-assumption__detail">{a.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── New section renderers ─────────────────────────────────────────────────────

function KeyTradeOffSection({ section }: { section: KeyTradeOffSection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-key-trade-off">
      <h2 className="rv-section__title" id="rv-key-trade-off">Key trade-off</h2>
      <p className="rv-section__subtitle">{section.systemLabel}</p>
      {section.likelyUpgrades.length > 0 && (
        <div>
          <p className="rv-label">Likely upgrades required</p>
          <ul className="rv-bullet-list">
            {section.likelyUpgrades.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        </div>
      )}
      {section.engineeringBullets.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <p className="rv-label">Engineering considerations</p>
          <ul className="rv-bullet-list">
            {section.engineeringBullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function FuturePathSection({ section }: { section: FuturePathSection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-future-path">
      <h2 className="rv-section__title" id="rv-future-path">Next step / future path</h2>
      {section.enablers.length > 0 && (
        <div>
          <p className="rv-label rv-label--enabler">What would improve the outcome</p>
          <ul className="rv-bullet-list" aria-label="Enablers">
            {section.enablers.map((e, i) => (
              <li key={i}><strong>{e.lever}</strong> — {e.note}</li>
            ))}
          </ul>
        </div>
      )}
      {section.risks.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <p className="rv-label rv-label--risk">What would reduce the outcome</p>
          <ul className="rv-bullet-list" aria-label="Risks">
            {section.risks.map((r, i) => (
              <li key={i}><strong>{r.lever}</strong> — {r.note}</li>
            ))}
          </ul>
        </div>
      )}
      {section.pathways.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <p className="rv-label">Pathway options</p>
          {section.pathways.map((p, i) => (
            <div key={i} className="rv-pathway-item">
              <p className="rv-pathway-item__title">{p.title}</p>
              <p className="rv-pathway-item__rationale">{p.rationale}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SystemArchitectureSection({ section }: { section: SystemArchitectureSection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-system-architecture">
      <h2 className="rv-section__title" id="rv-system-architecture">System architecture</h2>
      <p className="rv-section__subtitle">{section.systemLabel}</p>
      {section.headline && (
        <p className="rv-architecture-headline">{section.headline}</p>
      )}
      {section.bullets.length > 0 && (
        <div>
          <p className="rv-label">Installation requirements</p>
          <ul className="rv-bullet-list">
            {section.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}
      {section.mustHave.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <p className="rv-label">Must-have conditions</p>
          <ul className="rv-bullet-list">
            {section.mustHave.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function StoredHotWaterSection({ section }: { section: StoredHotWaterSection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-stored-hot-water">
      <h2 className="rv-section__title" id="rv-stored-hot-water">Stored hot water</h2>
      <p className="rv-section__subtitle">{section.systemLabel}</p>
      {section.headline && (
        <p className="rv-stored-headline">{section.headline}</p>
      )}
      {section.bullets.length > 0 && (
        <ul className="rv-bullet-list">
          {section.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
    </section>
  );
}

function RisksEnablersSection({ section }: { section: RisksEnablersSection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-risks-enablers">
      <h2 className="rv-section__title" id="rv-risks-enablers">Risks and enablers</h2>
      {section.risks.length > 0 && (
        <div>
          <p className="rv-label rv-label--risk">Risks — inputs that could reduce suitability</p>
          <ul className="rv-bullet-list" aria-label="Risks">
            {section.risks.map((r, i) => (
              <li key={i}><strong>{r.lever}</strong> — {r.note}</li>
            ))}
          </ul>
        </div>
      )}
      {section.enablers.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <p className="rv-label rv-label--enabler">Enablers — inputs that could improve suitability</p>
          <ul className="rv-bullet-list" aria-label="Enablers">
            {section.enablers.map((e, i) => (
              <li key={i}><strong>{e.lever}</strong> — {e.note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PhysicsTraceSection({ section }: { section: PhysicsTraceSection }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-physics-trace">
      <h2 className="rv-section__title" id="rv-physics-trace">Physics trace (appendix)</h2>
      <p className="rv-section__subtitle">
        {section.applianceName} · {section.resolutionMins}-min steps ·{' '}
        {section.totalActiveSteps} active step{section.totalActiveSteps !== 1 ? 's' : ''}
      </p>
      {section.activePoints.length > 0 ? (
        <table className="rv-trace-table" aria-label="Physics trace">
          <thead>
            <tr>
              <th>Time</th>
              <th>Heat (kW)</th>
              <th>DHW (kW)</th>
              <th>Output (kW)</th>
              <th>Perf.</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {section.activePoints.map((p, i) => (
              <tr key={i}>
                <td>{p.t}</td>
                <td>{p.heatDemandKw.toFixed(1)}</td>
                <td>{p.dhwDemandKw.toFixed(1)}</td>
                <td>{p.applianceOutKw.toFixed(1)}</td>
                <td>
                  {p.performance !== null
                    ? p.performanceKind === 'eta'
                      ? `${(p.performance * 100).toFixed(0)}%`
                      : `COP ${p.performance.toFixed(2)}`
                    : '—'}
                </td>
                <td>{p.mode ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="rv-trace-empty">No active appliance steps in trace.</p>
      )}
    </section>
  );
}

function EngineeringNotesSection({ section }: { section: EngineeringNotesSection }) {
  return (
    <section className="rv-section" aria-labelledby="rv-engineering-notes">
      <h2 className="rv-section__title" id="rv-engineering-notes">Engineering notes (appendix)</h2>
      <p className="rv-section__subtitle">{section.systemLabel}</p>
      {section.mustHave.length > 0 && (
        <div>
          <p className="rv-label">Must-have installation requirements</p>
          <ul className="rv-bullet-list" aria-label="Must-have requirements">
            {section.mustHave.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}
      {section.niceToHave.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <p className="rv-label">Nice-to-have improvements</p>
          <ul className="rv-bullet-list" aria-label="Nice-to-have items">
            {section.niceToHave.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Section group headers ────────────────────────────────────────────────────

/** Section IDs that belong to the technical summary group. */
const TECHNICAL_SECTION_IDS = new Set([
  'system_architecture',
  'stored_hot_water',
  'risks_enablers',
  'assumptions',
]);

/** Section IDs that belong to the appendix group. */
const APPENDIX_SECTION_IDS = new Set([
  'physics_trace',
  'engineering_notes',
]);

// ─── Section dispatcher ───────────────────────────────────────────────────────

function RenderSection({ section }: { section: ReportSection }) {
  switch (section.id) {
    case 'system_summary':
      return <SystemSummarySection section={section} />;
    case 'key_trade_off':
      return <KeyTradeOffSection section={section} />;
    case 'operating_point':
      return <OperatingPointSection section={section} />;
    case 'behaviour_summary':
      return <BehaviourSummarySection section={section} />;
    case 'key_limiters':
      return <KeyLimitersSection section={section} />;
    case 'future_path':
      return <FuturePathSection section={section} />;
    case 'verdict':
      return <VerdictSection section={section} />;
    case 'system_architecture':
      return <SystemArchitectureSection section={section} />;
    case 'stored_hot_water':
      return <StoredHotWaterSection section={section} />;
    case 'risks_enablers':
      return <RisksEnablersSection section={section} />;
    case 'assumptions':
      return <AssumptionsSection section={section} />;
    case 'physics_trace':
      return <PhysicsTraceSection section={section} />;
    case 'engineering_notes':
      return <EngineeringNotesSection section={section} />;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportView({ output, onBack }: Props) {
  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  }

  // Guard: no engine output available (e.g. ?report=1 loaded without demo data).
  if (output === null) {
    return (
      <div className="rv-wrap">
        <div className="rv-toolbar" aria-hidden="false">
          <button className="rv-toolbar__back" onClick={handleBack}>← Back</button>
          <span className="rv-toolbar__label">System Report</span>
        </div>
        <div
          role="alert"
          style={{
            padding: '1.25rem',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: '8px',
            fontSize: '0.84rem',
            color: '#742a2a',
          }}
        >
          <strong>No data available</strong>
          <p style={{ margin: '0.4rem 0 0' }}>
            No engine output is available. Complete an assessment first to generate a report.
          </p>
        </div>
      </div>
    );
  }

  const completeness = checkCompleteness(output);

  // If essential data is missing, render a blocked state rather than a broken report.
  if (!completeness.isReportable) {
    return (
      <div className="rv-wrap">
        <div className="rv-toolbar" aria-hidden="false">
          <button className="rv-toolbar__back" onClick={handleBack}>← Back</button>
          <span className="rv-toolbar__label">System Report</span>
        </div>
        <div
          role="alert"
          style={{
            padding: '1.25rem',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: '8px',
            fontSize: '0.84rem',
            color: '#742a2a',
          }}
        >
          <strong>Report not available</strong>
          <p style={{ margin: '0.4rem 0 0' }}>
            Insufficient data to generate a report. The following essential
            inputs are missing:
          </p>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.25rem' }}>
            {completeness.missingEssential.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const sections = buildReportSections(output);
  const verdictSection = sections.find(s => s.id === 'verdict') as VerdictSection | undefined;
  const confidenceLevel = verdictSection?.confidenceLevel ?? '—';
  const generatedDate = formatCurrentDate();

  return (
    <div className="rv-wrap">

      {/* ── Screen toolbar (hidden on print) ─────────────────────────────── */}
      <div className="rv-toolbar" aria-hidden="false">
        <button className="rv-toolbar__back" onClick={handleBack}>← Back</button>
        <span className="rv-toolbar__label">System Report</span>
        <button className="rv-toolbar__print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── Document header ───────────────────────────────────────────────── */}
      <header className="rv-doc-header">
        <div>
          <div className="rv-doc-header__brand" aria-label="Atlas">ATLAS</div>
          <h1 className="rv-doc-header__title">Atlas Heating System Assessment</h1>
          <p className="rv-doc-header__sub">Generated from system model</p>
        </div>
        <div className="rv-doc-header__meta">
          <div>Generated: {generatedDate}</div>
          <div>Model version: EngineOutputV1</div>
          <div>Confidence: {confidenceLevel}</div>
        </div>
      </header>

      {/* ── Completeness banner (if partial) ──────────────────────────────── */}
      {completeness.isPartial && (
        <ReportCompletenessBanner missingOptional={completeness.missingOptional} />
      )}

      {/* ── Report sections (with group dividers) ─────────────────────────── */}
      {sections.map((section, idx) => {
        const prevSection = idx > 0 ? sections[idx - 1] : null;
        const isTechnicalStart =
          TECHNICAL_SECTION_IDS.has(section.id) &&
          (prevSection === null || !TECHNICAL_SECTION_IDS.has(prevSection.id));
        const isAppendixStart =
          APPENDIX_SECTION_IDS.has(section.id) &&
          (prevSection === null || !APPENDIX_SECTION_IDS.has(prevSection.id));

        return (
          <div key={section.id}>
            {isTechnicalStart && (
              <div className="rv-group-header" role="separator">
                Technical summary
              </div>
            )}
            {isAppendixStart && (
              <div className="rv-group-header rv-group-header--appendix" role="separator">
                Appendix
              </div>
            )}
            <RenderSection section={section} />
          </div>
        );
      })}

    </div>
  );
}
