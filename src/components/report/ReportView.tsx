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
 *  System summary
 *  Operating point / water performance
 *  Behaviour timeline summary
 *  Key limiters / constraints
 *  Verdict / recommendation
 *  Assumptions / red flags
 *
 * Printed output is print-first, not a screenshot of the interactive console.
 * Interactive chrome is hidden via @media print (see reportPrint.css).
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import {
  checkCompleteness,
  buildReportSections,
  type SystemSummarySection,
  type OperatingPointSection,
  type BehaviourSummarySection,
  type KeyLimitersSection,
  type VerdictSection,
  type AssumptionsSection,
  type ReportSection,
} from './reportSections.model';
import ReportCompletenessBanner from './ReportCompletenessBanner';
import './reportPrint.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  output: EngineOutputV1;
  /** Called when the user clicks the back button on screen. Defaults to window.history.back(). */
  onBack?: () => void;
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
        <span className="rv-verdict__confidence">Confidence: {section.confidenceLevel}</span>
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

// ─── Section dispatcher ───────────────────────────────────────────────────────

function RenderSection({ section }: { section: ReportSection }) {
  switch (section.id) {
    case 'system_summary':
      return <SystemSummarySection section={section} />;
    case 'operating_point':
      return <OperatingPointSection section={section} />;
    case 'behaviour_summary':
      return <BehaviourSummarySection section={section} />;
    case 'key_limiters':
      return <KeyLimitersSection section={section} />;
    case 'verdict':
      return <VerdictSection section={section} />;
    case 'assumptions':
      return <AssumptionsSection section={section} />;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportView({ output, onBack }: Props) {
  const completeness = checkCompleteness(output);

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  }

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
          <h1 className="rv-doc-header__title">System Report</h1>
          <p className="rv-doc-header__sub">Heating system assessment — technical report</p>
        </div>
        <div className="rv-doc-header__meta">
          <div>Confidence: {confidenceLevel}</div>
          <div>Recommendation: {output.recommendation.primary}</div>
        </div>
      </header>

      {/* ── Completeness banner (if partial) ──────────────────────────────── */}
      {completeness.isPartial && (
        <ReportCompletenessBanner missingOptional={completeness.missingOptional} />
      )}

      {/* ── Report sections ───────────────────────────────────────────────── */}
      {sections.map(section => (
        <RenderSection key={section.id} section={section} />
      ))}

    </div>
  );
}
