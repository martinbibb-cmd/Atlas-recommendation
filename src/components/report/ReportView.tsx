/**
 * ReportView.tsx
 *
 * Unified printable report surface — five-page decision document.
 *
 * Structure
 * ──────────
 *  Report header
 *  Completeness banner (if partial)
 *
 *  Page 1 — decision_page     : constraint → consequence → system → why required
 *  Page 2 — daily_experience  : typical-day use scenarios
 *  Page 3 — what_changes      : required installation changes
 *  Page 4 — alternatives_page : one controlled alternative with trade-offs
 *  Page 5 — engineer_summary  : job-reference snapshot
 *
 * Printed output is print-first. Interactive chrome is hidden via @media print.
 */

import { useState, useEffect } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import { buildPortalUrl } from '../../lib/portal/portalUrl';
import { generatePortalToken } from '../../lib/portal/portalToken';
import {
  checkCompleteness,
  buildReportSections,
  type DecisionPageSection,
  type DailyExperienceSection,
  type WhatChangesSection,
  type AlternativesPageSection,
  type EngineerSummarySection,
  type ReportSection,
} from './reportSections.model';
import ReportCompletenessBanner from './ReportCompletenessBanner';
import ReportQrFooter from './ReportQrFooter';
import './reportPrint.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Engine output to render. Pass null to show a graceful "no data" state. */
  output: EngineOutputV1 | null;
  /** Called when the user clicks the back button on screen. Defaults to window.history.back(). */
  onBack?: () => void;
  /** Optional report reference used to generate the customer portal QR code. */
  reportReference?: string;
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

function DecisionPageRenderer({ section }: { section: DecisionPageSection }) {
  return (
    <section className="rv-section rv-decision-page" aria-labelledby="rv-decision-page">
      {/* Headline */}
      <div className={`rv-decision-headline rv-decision-headline--${section.verdictStatus}`}>
        <h2 className="rv-decision-headline__title" id="rv-decision-page">
          {section.headline}
        </h2>
      </div>

      {/* What we found */}
      {section.measuredFacts.length > 0 && (
        <div className="rv-decision-block">
          <p className="rv-label">What we found</p>
          <dl className="rv-dl">
            {section.measuredFacts.map((f, i) => (
              <div key={i} className="rv-dl-row">
                <dt className="rv-dt">{f.label}</dt>
                <dd className="rv-dd">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* What this means */}
      {section.consequence && (
        <div className="rv-decision-block">
          <p className="rv-label">What this means</p>
          <p className="rv-decision-consequence">{section.consequence}</p>
        </div>
      )}

      {/* Recommended solution */}
      <div className="rv-decision-block rv-decision-block--recommend">
        <p className="rv-label">Recommended solution</p>
        <p className="rv-decision-system">{section.recommendedSystem}</p>
        {section.whyRequired.length > 0 && (
          <ul className="rv-bullet-list rv-bullet-list--why" aria-label="Why this system is required">
            {section.whyRequired.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

const OUTCOME_ICON: Record<DailyExperienceSection['scenarios'][number]['outcome'], string> = {
  ok: '✓',
  limited: '~',
  slow: '~',
};

const OUTCOME_LABEL: Record<DailyExperienceSection['scenarios'][number]['outcome'], string> = {
  ok: 'Works normally',
  limited: 'Limited',
  slow: 'Slower',
};

function DailyExperienceRenderer({ section }: { section: DailyExperienceSection }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-daily-experience">
      <h2 className="rv-section__title" id="rv-daily-experience">Daily experience</h2>
      <div className="rv-scenarios" role="list">
        {section.scenarios.map((s, i) => (
          <div
            key={i}
            className={`rv-scenario rv-scenario--${s.outcome}`}
            role="listitem"
          >
            <span
              className={`rv-scenario__icon rv-scenario__icon--${s.outcome}`}
              aria-hidden="true"
            >
              {OUTCOME_ICON[s.outcome]}
            </span>
            <div className="rv-scenario__body">
              <p className="rv-scenario__name">{s.scenario}</p>
              {s.note && <p className="rv-scenario__note">{s.note}</p>}
            </div>
            <span className={`rv-scenario__badge rv-scenario__badge--${s.outcome}`}>
              {OUTCOME_LABEL[s.outcome]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhatChangesRenderer({ section }: { section: WhatChangesSection }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-what-changes">
      <h2 className="rv-section__title" id="rv-what-changes">What changes</h2>
      <p className="rv-section__subtitle">{section.systemLabel}</p>
      <ul className="rv-bullet-list" aria-label="Required installation changes">
        {section.changes.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
    </section>
  );
}

function AlternativesPageRenderer({ section }: { section: AlternativesPageSection }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-alternatives">
      <h2 className="rv-section__title" id="rv-alternatives">Alternatives</h2>
      <p className="rv-alternatives__primary">
        Recommended: <strong>{section.recommendedLabel}</strong>
      </p>
      {section.alternative ? (
        <div className="rv-alternative-card" aria-label={`Alternative: ${section.alternative.label}`}>
          <p className="rv-alternative-card__label">{section.alternative.label}</p>
          {section.alternative.requirement && (
            <p className="rv-alternative-card__requirement">{section.alternative.requirement}</p>
          )}
          {section.alternative.tradeOffs.length > 0 && (
            <div>
              <p className="rv-label rv-label--risk">Trade-offs versus recommendation</p>
              <ul className="rv-bullet-list" aria-label="Trade-offs">
                {section.alternative.tradeOffs.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="rv-alternatives__none">No comparable alternative available for this setup.</p>
      )}
      <p className="rv-alternatives__footnote">
        Other options can be explored in the interactive simulator.
      </p>
    </section>
  );
}

function EngineerSummaryRenderer({ section }: { section: EngineerSummarySection }) {
  return (
    <section
      className="rv-section rv-page-break-before rv-section--engineer"
      aria-labelledby="rv-engineer-summary"
    >
      <h2 className="rv-section__title" id="rv-engineer-summary">Engineer snapshot</h2>
      <dl className="rv-dl">
        {section.currentSystem && (
          <div className="rv-dl-row">
            <dt className="rv-dt">Current</dt>
            <dd className="rv-dd">{section.currentSystem}</dd>
          </div>
        )}
        <div className="rv-dl-row">
          <dt className="rv-dt">Recommended</dt>
          <dd className="rv-dd">{section.recommendedSystem}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Key constraint</dt>
          <dd className="rv-dd">{section.keyConstraint}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Confidence</dt>
          <dd className="rv-dd">{capitalise(section.confidenceLevel)}</dd>
        </div>
      </dl>
      {section.beforeYouStart.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <p className="rv-label">Before you start</p>
          <ul className="rv-bullet-list" aria-label="Pre-install checks">
            {section.beforeYouStart.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Section dispatcher ───────────────────────────────────────────────────────

function RenderSection({ section }: { section: ReportSection }) {
  switch (section.id) {
    case 'decision_page':
      return <DecisionPageRenderer section={section} />;
    case 'daily_experience':
      return <DailyExperienceRenderer section={section} />;
    case 'what_changes':
      return <WhatChangesRenderer section={section} />;
    case 'alternatives_page':
      return <AlternativesPageRenderer section={section} />;
    case 'engineer_summary':
      return <EngineerSummaryRenderer section={section} />;
    // Simulator-derived sections (rendered by SimulatorReportView, not here)
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportView({ output, onBack, reportReference }: Props) {
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!reportReference) return;
    let cancelled = false;
    generatePortalToken(reportReference)
      .then((token) => buildPortalUrl(reportReference, window.location.origin, token))
      .then((url) => { if (!cancelled) setPortalUrl(url); })
      .catch(() => { /* Portal URL generation failure is non-critical — silently omit the link. */ });
    return () => { cancelled = true; };
  }, [reportReference]);

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
  const engineerSection = sections.find(s => s.id === 'engineer_summary') as EngineerSummarySection | undefined;
  const confidenceLevel = engineerSection?.confidenceLevel ?? '—';
  const generatedDate = formatCurrentDate();

  return (
    <div className="rv-wrap">

      {/* ── Screen toolbar (hidden on print) ─────────────────────────────── */}
      <div className="rv-toolbar" aria-hidden="false">
        <button className="rv-toolbar__back" onClick={handleBack}>← Back</button>
        <span className="rv-toolbar__label">System Report</span>
        {portalUrl && (
          <a
            className="rv-toolbar__portal-link"
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open interactive home heating plan"
            data-testid="portal-link"
          >
            🏠 Open interactive home heating plan
          </a>
        )}
        <button className="rv-toolbar__print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── Document header ───────────────────────────────────────────────── */}
      <header className="rv-doc-header">
        <div>
          <h1 className="rv-doc-header__title">Heating system assessment</h1>
          <p className="rv-doc-header__sub">Based on your home survey</p>
        </div>
        <div className="rv-doc-header__meta">
          <div>Generated: {generatedDate}</div>
          <div>Confidence: {confidenceLevel}</div>
        </div>
      </header>

      {/* ── Completeness banner (if partial) ──────────────────────────────── */}
      {completeness.isPartial && (
        <ReportCompletenessBanner missingOptional={completeness.missingOptional} />
      )}

      {/* ── Report sections ────────────────────────────────────────────────── */}
      {sections.map((section) => (
        <RenderSection key={section.id} section={section} />
      ))}

      {/* ── QR code footer — portal link ──────────────────────────────────── */}
      {reportReference && (
        <ReportQrFooter reportReference={reportReference} />
      )}

    </div>
  );
}
