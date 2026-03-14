/**
 * LabPrintFull.tsx
 *
 * Full Output Report — prints every visible Live Output Hub section in a single
 * document.  This is the fourth print preset alongside Customer Summary,
 * Technical Spec, and Comparison Sheet.
 *
 * Unlike the other three print surfaces (which each render a partial view),
 * this component renders ALL sections returned by buildOutputHubSections(),
 * filtered through the 'full' preset so missing/invisible sections are omitted.
 *
 * Recommendation-withheld state is surfaced explicitly with a clear banner and
 * a list of exactly what data is missing, so the PDF looks cautious rather than
 * broken.
 *
 * Interactive chrome is hidden via @media print (lab-print.css).
 */

import type { OutputHubSection } from '../../live/printSections.model';
import './lab-print.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when the user clicks the back button on screen. Defaults to window.close(). */
  onBack?: () => void;
  /**
   * Pre-built sections array from buildOutputHubSections() filtered by the
   * 'full' preset (via filterSections()).  Sections are rendered in the order
   * supplied.
   */
  sections: OutputHubSection[];
  /** Human-readable date string for the report header. Defaults to today's date. */
  generatedDate?: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<'ok' | 'watch' | 'missing', string> = {
  ok:      'OK',
  watch:   'Watch',
  missing: 'Missing',
};

function StatusBadge({ status }: { status: 'ok' | 'watch' | 'missing' }) {
  return (
    <span
      className={`lp-full-status lp-full-status--${status}`}
      aria-label={`Status: ${STATUS_LABEL[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

function RecommendationSection({ section }: { section: OutputHubSection }) {
  const c = section.content as {
    primary: string;
    secondary: string | null;
    isWithheld: boolean;
    withheldReason: string | null;
    verdict: {
      title: string;
      status: string;
      reasons: string[];
      confidence: string;
      primaryReason: string | null;
    } | null;
    options: Array<{ id: string; label: string; status: string; why: string[] }>;
  };

  return (
    <section className="lp-section" aria-labelledby="lpf-recommendation">
      <h2 className="lp-section__title" id="lpf-recommendation">
        Recommendation
        <StatusBadge status={section.status} />
      </h2>

      {c.isWithheld && (
        <div className="lp-full-withheld" role="alert" aria-label="Recommendation withheld">
          <strong>Recommendation withheld</strong>
          {c.withheldReason && <p className="lp-full-withheld__reason">{c.withheldReason}</p>}
        </div>
      )}

      {!c.isWithheld && (
        <div className="lp-verdict" role="status" aria-label="Headline recommendation">
          <div className="lp-verdict__label">
            {c.verdict?.status === 'good' ? 'Recommended' : 'Recommendation'}
          </div>
          <p className="lp-verdict__value">{c.primary}</p>
          {c.secondary && <p className="lp-verdict__note">{c.secondary}</p>}
        </div>
      )}

      {c.verdict && (
        <dl className="lp-dl" style={{ marginTop: '0.75rem' }}>
          <div className="lp-dl-row">
            <dt className="lp-dt">Verdict</dt>
            <dd className="lp-dd">{c.verdict.title}</dd>
          </div>
          <div className="lp-dl-row">
            <dt className="lp-dt">Confidence</dt>
            <dd className="lp-dd">{c.verdict.confidence.charAt(0).toUpperCase() + c.verdict.confidence.slice(1)}</dd>
          </div>
          {c.verdict.reasons.length > 0 && (
            <div className="lp-dl-row">
              <dt className="lp-dt">Reasons</dt>
              <dd className="lp-dd">
                <ul className="lp-list" aria-label="Verdict reasons">
                  {c.verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}

      {c.options.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div className="lp-group-label">Suitability cards</div>
          {c.options.map(opt => (
            <div key={opt.id} className="lp-candidate-block">
              <div className="lp-candidate-block__name">{opt.label}</div>
              <div
                className={`lp-full-option-status lp-full-option-status--${opt.status}`}
                aria-label={`${opt.label} status: ${opt.status}`}
              >
                {opt.status}
              </div>
              {opt.why.length > 0 && (
                <div className="lp-explanation-block lp-explanation-block--suits">
                  <span className="lp-explanation-label">Why it suits</span>
                  <p className="lp-explanation-text">{opt.why.join('. ')}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CurrentSystemSection({ section }: { section: OutputHubSection }) {
  const c = section.content as {
    boilerType: string | null;
    eligibility: Array<{ id: string; label: string; status: string; reason: string }>;
  };

  return (
    <section className="lp-section" aria-labelledby="lpf-current-system">
      <h2 className="lp-section__title" id="lpf-current-system">
        Current System
        <StatusBadge status={section.status} />
      </h2>
      <dl className="lp-dl">
        <div className="lp-dl-row">
          <dt className="lp-dt">System type</dt>
          <dd className="lp-dd">{c.boilerType ?? 'Not confirmed'}</dd>
        </div>
      </dl>
      {c.eligibility.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <div className="lp-group-label">Eligibility assessment</div>
          {c.eligibility.map(e => (
            <div key={e.id} className={`lp-full-eligibility lp-full-eligibility--${e.status}`}>
              <span className="lp-full-eligibility__label">{e.label}</span>
              <span className={`lp-full-eligibility__badge lp-full-eligibility__badge--${e.status}`}>
                {e.status}
              </span>
              {e.reason && <p className="lp-full-eligibility__reason">{e.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WaterPowerSection({ section }: { section: OutputHubSection }) {
  const c = section.content as { combiRisk: string };
  const riskLabel =
    c.combiRisk === 'fail' ? 'Fail — simultaneous demand not met'
    : c.combiRisk === 'warn' ? 'Caution — borderline simultaneous demand'
    : 'Pass — simultaneous demand within range';

  return (
    <section className="lp-section" aria-labelledby="lpf-water-power">
      <h2 className="lp-section__title" id="lpf-water-power">
        Water Power
        <StatusBadge status={section.status} />
      </h2>
      <dl className="lp-dl">
        <div className="lp-dl-row">
          <dt className="lp-dt">Combi DHW risk</dt>
          <dd className="lp-dd">{riskLabel}</dd>
        </div>
      </dl>
    </section>
  );
}

function UsageModelSection({ section }: { section: OutputHubSection }) {
  const c = section.content as {
    occupancyCount: number | null;
    bathroomCount: number | null;
    storedRisk: string;
    missingFields: string[];
  };

  const storedRiskLabel =
    c.storedRisk === 'fail' ? 'Fail'
    : c.storedRisk === 'warn' ? 'Caution'
    : 'Pass';

  return (
    <section className="lp-section" aria-labelledby="lpf-usage-model">
      <h2 className="lp-section__title" id="lpf-usage-model">
        Usage Model
        <StatusBadge status={section.status} />
      </h2>

      {c.missingFields.length > 0 && (
        <div className="lp-full-missing-note" role="note" aria-label="Missing usage model data">
          <strong>Data missing — recommendation withheld for this section</strong>
          <ul className="lp-list" aria-label="Missing data fields">
            {c.missingFields.map(f => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      <dl className="lp-dl">
        <div className="lp-dl-row">
          <dt className="lp-dt">Occupancy count</dt>
          <dd className="lp-dd">{c.occupancyCount !== null ? c.occupancyCount : 'Not captured'}</dd>
        </div>
        <div className="lp-dl-row">
          <dt className="lp-dt">Bathroom count</dt>
          <dd className="lp-dd">{c.bathroomCount !== null ? c.bathroomCount : 'Not captured'}</dd>
        </div>
        <div className="lp-dl-row">
          <dt className="lp-dt">Stored DHW risk</dt>
          <dd className="lp-dd">{storedRiskLabel}</dd>
        </div>
      </dl>
    </section>
  );
}

function EvidenceSection({ section }: { section: OutputHubSection }) {
  const c = section.content as {
    evidence: Array<{ label: string; source: string; confidence: string }>;
    confidenceLevel: string | null;
    unknowns: string[];
  };

  return (
    <section className="lp-section lp-page-break-before" aria-labelledby="lpf-evidence">
      <h2 className="lp-section__title" id="lpf-evidence">
        Evidence
        <StatusBadge status={section.status} />
      </h2>

      {c.confidenceLevel && (
        <span className="lp-confidence-badge" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
          Overall confidence: {c.confidenceLevel.charAt(0).toUpperCase() + c.confidenceLevel.slice(1)}
        </span>
      )}

      {c.evidence.length > 0 && (
        <div>
          {(['manual', 'assumed', 'derived', 'placeholder'] as const).map(src => {
            const items = c.evidence.filter(e => e.source === src);
            if (items.length === 0) return null;
            const groupLabel =
              src === 'manual' ? 'Measured'
              : src === 'assumed' ? 'Inferred / assumed'
              : src === 'derived' ? 'Derived'
              : 'Not captured';
            const mod =
              src === 'manual' ? 'measured'
              : src === 'assumed' ? 'inferred'
              : src === 'derived' ? 'inferred'
              : 'missing';
            return (
              <div key={src} className="lp-group">
                <div className={`lp-group-label lp-group-label--${mod}`}>{groupLabel}</div>
                <ul className="lp-list" aria-label={`${groupLabel} evidence`}>
                  {items.map((e, i) => <li key={i}>{e.label}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {c.unknowns.length > 0 && (
        <div className="lp-group">
          <div className="lp-group-label lp-group-label--missing">Unknown</div>
          <ul className="lp-list" aria-label="Unknown inputs">
            {c.unknowns.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function ConstraintsSection({ section }: { section: OutputHubSection }) {
  const c = section.content as {
    limiters: Array<{
      id: string;
      title: string;
      severity: string;
      detail: string;
      observed: string;
      limit: string;
      suggestedFix: string | null;
    }>;
  };

  return (
    <section className="lp-section" aria-labelledby="lpf-constraints">
      <h2 className="lp-section__title" id="lpf-constraints">
        Constraints
        <StatusBadge status={section.status} />
      </h2>
      {c.limiters.length === 0 ? (
        <p>No physical constraints identified.</p>
      ) : (
        c.limiters.map(l => (
          <div key={l.id} className="lp-candidate-block">
            <span className={`lp-full-limiter-badge lp-full-limiter-badge--${l.severity}`}>
              {l.severity}
            </span>
            <div className="lp-candidate-block__name">{l.title}</div>
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>{l.detail}</p>
            <dl className="lp-dl" style={{ marginTop: '0.25rem' }}>
              <div className="lp-dl-row">
                <dt className="lp-dt">Observed</dt>
                <dd className="lp-dd">{l.observed}</dd>
              </div>
              <div className="lp-dl-row">
                <dt className="lp-dt">Limit</dt>
                <dd className="lp-dd">{l.limit}</dd>
              </div>
            </dl>
            {l.suggestedFix && (
              <p className="lp-next-step-note">→ {l.suggestedFix}</p>
            )}
          </div>
        ))
      )}
    </section>
  );
}

function ChemistrySection({ section }: { section: OutputHubSection }) {
  const c = section.content as { tenYearDecayPct: number };
  return (
    <section className="lp-section" aria-labelledby="lpf-chemistry">
      <h2 className="lp-section__title" id="lpf-chemistry">
        Chemistry
        <StatusBadge status={section.status} />
      </h2>
      <dl className="lp-dl">
        <div className="lp-dl-row">
          <dt className="lp-dt">10-year efficiency decay</dt>
          <dd className="lp-dd">{c.tenYearDecayPct.toFixed(1)}%</dd>
        </div>
      </dl>
    </section>
  );
}

function GlassBoxSection({ section }: { section: OutputHubSection }) {
  const c = section.content as {
    assumptions: Array<{ id: string; title: string; detail: string; severity: string }>;
    redFlags: Array<{ id: string; title: string; detail: string; severity: string }>;
  };

  return (
    <section className="lp-section lp-page-break-before" aria-labelledby="lpf-glassbox">
      <h2 className="lp-section__title" id="lpf-glassbox">Glass Box</h2>

      {c.redFlags.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div className="lp-group-label">Red flags</div>
          {c.redFlags.map(f => (
            <div key={f.id} className={`lp-full-redflag lp-full-redflag--${f.severity}`}>
              <div className="lp-candidate-block__name">{f.title}</div>
              <p style={{ margin: '0.15rem 0', fontSize: '0.84rem' }}>{f.detail}</p>
            </div>
          ))}
        </div>
      )}

      {c.assumptions.length > 0 && (
        <div>
          <div className="lp-group-label">Modelling assumptions</div>
          {c.assumptions.map(a => (
            <div key={a.id} className="lp-candidate-block">
              <div className="lp-candidate-block__name">{a.title}</div>
              <p style={{ margin: '0.15rem 0', fontSize: '0.84rem' }}>{a.detail}</p>
            </div>
          ))}
        </div>
      )}

      {c.assumptions.length === 0 && c.redFlags.length === 0 && (
        <p>No additional assumptions or red flags recorded.</p>
      )}
    </section>
  );
}

function ControlRoomSection({ section }: { section: OutputHubSection }) {
  const c = section.content as { note: string };
  return (
    <section className="lp-section" aria-labelledby="lpf-control-room">
      <h2 className="lp-section__title" id="lpf-control-room">Control Room</h2>
      <p>{c.note}</p>
    </section>
  );
}

function SimulatorSummarySection({ section }: { section: OutputHubSection }) {
  const c = section.content as {
    simulatorAvailable: boolean;
    occupancyCount: number | null;
    bathroomCount: number | null;
    prefillHint: string | null;
  };

  return (
    <section className="lp-section" aria-labelledby="lpf-simulator">
      <h2 className="lp-section__title" id="lpf-simulator">Simulator Summary</h2>
      {c.prefillHint && <p>{c.prefillHint}</p>}
      <dl className="lp-dl">
        <div className="lp-dl-row">
          <dt className="lp-dt">Pre-fill available</dt>
          <dd className="lp-dd">{c.simulatorAvailable ? 'Yes — from survey data' : 'No'}</dd>
        </div>
        {c.occupancyCount !== null && (
          <div className="lp-dl-row">
            <dt className="lp-dt">Occupancy count</dt>
            <dd className="lp-dd">{c.occupancyCount}</dd>
          </div>
        )}
        {c.bathroomCount !== null && (
          <div className="lp-dl-row">
            <dt className="lp-dt">Bathroom count</dt>
            <dd className="lp-dd">{c.bathroomCount}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function ComparisonSection({ section }: { section: OutputHubSection }) {
  const c = section.content as {
    options: Array<{
      id: string;
      label: string;
      status: string;
      heat: string;
      dhw: string;
      engineering: string;
      why: string[];
      requirements: string[];
    }>;
  };

  return (
    <section className="lp-section lp-page-break-before" aria-labelledby="lpf-comparison">
      <h2 className="lp-section__title" id="lpf-comparison">Comparison Sheet</h2>
      {c.options.length === 0 ? (
        <p>No candidate systems to compare.</p>
      ) : (
        c.options.map(opt => (
          <div key={opt.id} className="lp-candidate-block">
            <h3 className="lp-candidate-heading">{opt.label}</h3>
            <dl className="lp-dl">
              <div className="lp-dl-row">
                <dt className="lp-dt">Heat</dt>
                <dd className="lp-dd">{opt.heat}</dd>
              </div>
              <div className="lp-dl-row">
                <dt className="lp-dt">Hot water</dt>
                <dd className="lp-dd">{opt.dhw}</dd>
              </div>
              <div className="lp-dl-row">
                <dt className="lp-dt">Engineering</dt>
                <dd className="lp-dd">{opt.engineering}</dd>
              </div>
            </dl>
            {opt.why.length > 0 && (
              <div className="lp-explanation-block lp-explanation-block--suits">
                <span className="lp-explanation-label">Why it suits</span>
                <p className="lp-explanation-text">{opt.why.join('. ')}</p>
              </div>
            )}
            {opt.requirements.length > 0 && (
              <div className="lp-explanation-block lp-explanation-block--changes">
                <span className="lp-explanation-label">Requirements</span>
                <p className="lp-explanation-text">{opt.requirements.join('. ')}</p>
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}

function TechnicalAppendixSection({ section }: { section: OutputHubSection }) {
  const c = section.content as {
    assumptions: Array<{ id: string; title: string; detail: string; severity: string }>;
    confidence: {
      level: string;
      unknowns: string[];
      unlockBy: string[];
    } | null;
    redFlags: Array<{ id: string; title: string; detail: string; severity: string }>;
  };

  return (
    <section className="lp-section lp-page-break-before" aria-labelledby="lpf-tech-appendix">
      <h2 className="lp-section__title" id="lpf-tech-appendix">Technical Appendix</h2>

      {c.confidence && (
        <div style={{ marginBottom: '0.75rem' }}>
          <span className="lp-confidence-badge">
            Overall confidence: {c.confidence.level.charAt(0).toUpperCase() + c.confidence.level.slice(1)}
          </span>
          {c.confidence.unknowns.length > 0 && (
            <div className="lp-group" style={{ marginTop: '0.5rem' }}>
              <div className="lp-group-label lp-group-label--missing">Unknown inputs</div>
              <ul className="lp-list" aria-label="Unknown inputs">
                {c.confidence.unknowns.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </div>
          )}
          {c.confidence.unlockBy.length > 0 && (
            <p className="lp-next-step-note">
              Unlock by: {c.confidence.unlockBy.join(', ')}
            </p>
          )}
        </div>
      )}

      {c.redFlags.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div className="lp-group-label">Red flags</div>
          {c.redFlags.map(f => (
            <div key={f.id} className={`lp-full-redflag lp-full-redflag--${f.severity}`}>
              <div className="lp-candidate-block__name">{f.title}</div>
              <p style={{ margin: '0.15rem 0', fontSize: '0.84rem' }}>{f.detail}</p>
            </div>
          ))}
        </div>
      )}

      {c.assumptions.length > 0 && (
        <div>
          <div className="lp-group-label">Modelling assumptions</div>
          {c.assumptions.map(a => (
            <div key={a.id} className="lp-candidate-block">
              <div className="lp-candidate-block__name">{a.title}</div>
              <p style={{ margin: '0.15rem 0', fontSize: '0.84rem' }}>{a.detail}</p>
            </div>
          ))}
        </div>
      )}

      {c.assumptions.length === 0 && c.redFlags.length === 0 && !c.confidence && (
        <p>No additional technical data recorded.</p>
      )}
    </section>
  );
}

// ─── Section dispatcher ───────────────────────────────────────────────────────

function RenderSection({ section }: { section: OutputHubSection }) {
  switch (section.id) {
    case 'recommendation':    return <RecommendationSection section={section} />;
    case 'currentSystem':     return <CurrentSystemSection section={section} />;
    case 'waterPower':        return <WaterPowerSection section={section} />;
    case 'usageModel':        return <UsageModelSection section={section} />;
    case 'evidence':          return <EvidenceSection section={section} />;
    case 'constraints':       return <ConstraintsSection section={section} />;
    case 'chemistry':         return <ChemistrySection section={section} />;
    case 'glassBox':          return <GlassBoxSection section={section} />;
    case 'controlRoom':       return <ControlRoomSection section={section} />;
    case 'simulatorSummary':  return <SimulatorSummarySection section={section} />;
    case 'comparison':        return <ComparisonSection section={section} />;
    case 'technicalAppendix': return <TechnicalAppendixSection section={section} />;
    default:                  return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LabPrintFull({ onBack, sections, generatedDate }: Props) {
  const date = generatedDate ?? new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      window.close();
    }
  }

  return (
    <div className="lp-wrap">

      {/* ── Screen toolbar (hidden on print) ──────────────────────────────── */}
      <div className="lp-toolbar" aria-hidden="false">
        <button className="lp-toolbar__back" onClick={handleBack}>← Back to Lab</button>
        <span className="lp-toolbar__label">Full Output Report</span>
        <button className="lp-toolbar__print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── Document header ────────────────────────────────────────────────── */}
      <header className="lp-doc-header">
        <div>
          <div className="lp-doc-header__brand" aria-label="Atlas">ATLAS</div>
          <h1 className="lp-doc-header__title">Full Output Report</h1>
          <p className="lp-doc-header__sub">
            System Lab — all visible result panels
          </p>
        </div>
        <div className="lp-doc-header__meta">
          <div>Generated: {date}</div>
          <div>Includes all visible result panels</div>
        </div>
      </header>

      {/* ── Sections ───────────────────────────────────────────────────────── */}
      {sections.length === 0 ? (
        <div role="alert" style={{ padding: '1.25rem', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', color: '#742a2a', fontSize: '0.84rem' }}>
          <strong>No data available</strong>
          <p style={{ margin: '0.4rem 0 0' }}>
            No visible output hub sections are available to print.
          </p>
        </div>
      ) : (
        sections.map(section => (
          <RenderSection key={section.id} section={section} />
        ))
      )}

    </div>
  );
}
