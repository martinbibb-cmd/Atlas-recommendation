import {
  PLACEHOLDER_CONFIDENCE,
  PLACEHOLDER_CONFIDENCE_STRIP,
  PLACEHOLDER_CURRENT_SYSTEM,
  PLACEHOLDER_VERDICT,
  COMPARISON_HEADINGS,
  CANDIDATE_SYSTEMS,
} from './labSharedData';
import type { LabPrintData } from './labSharedData';
import './lab-print.css';

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Called when the user clicks the back button on screen. Defaults to window.close(). */
  onBack?: () => void;
  /**
   * Live data from the Full Survey engine result.  When provided, replaces the
   * placeholder constants so the print surface reflects the real survey output.
   */
  data?: LabPrintData;
}

/**
 * LabPrintTechnical
 *
 * An engineer / internal-use print layout showing the full technical picture:
 * current system, candidate systems with per-heading detail rows, confidence
 * drivers, inferred assumptions, technical constraints, and items still
 * requiring confirmation.
 *
 * Interactive chrome is hidden via @media print.
 */
export default function LabPrintTechnical({ onBack, data }: Props) {
  const confidence    = data?.confidence      ?? PLACEHOLDER_CONFIDENCE;
  const currentSystem = data?.currentSystem   ?? PLACEHOLDER_CURRENT_SYSTEM;
  const verdict       = data?.verdict         ?? PLACEHOLDER_VERDICT;
  const strip         = data?.confidenceStrip ?? PLACEHOLDER_CONFIDENCE_STRIP;
  const candidates    = data?.candidates      ?? CANDIDATE_SYSTEMS;

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
        <span className="lp-toolbar__label">Technical Specification</span>
        <button className="lp-toolbar__print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── Document header ────────────────────────────────────────────────── */}
      <header className="lp-doc-header">
        <div>
          <div className="lp-doc-header__brand" aria-label="Atlas">ATLAS</div>
          <h1 className="lp-doc-header__title">Technical Specification</h1>
          <p className="lp-doc-header__sub">System Summary — engineer / internal reference</p>
        </div>
        <div className="lp-doc-header__meta">
          <div>Confidence: {confidence}</div>
          <div>Current system: {currentSystem}</div>
        </div>
      </header>

      {/* ── Current system ─────────────────────────────────────────────────── */}
      <section className="lp-section" aria-labelledby="lp-tech-current">
        <h2 className="lp-section__title" id="lp-tech-current">Current system</h2>
        <dl className="lp-dl">
          <div className="lp-dl-row">
            <dt className="lp-dt">System type</dt>
            <dd className="lp-dd">{currentSystem}</dd>
          </div>
          <div className="lp-dl-row">
            <dt className="lp-dt">Status</dt>
            <dd className="lp-dd">Existing installation — baseline for comparison</dd>
          </div>
        </dl>
      </section>

      {/* ── Candidate systems ──────────────────────────────────────────────── */}
      <section className="lp-section" aria-labelledby="lp-tech-candidates">
        <h2 className="lp-section__title" id="lp-tech-candidates">Candidate systems</h2>
        {candidates.map(system => (
          <div key={system.id} className="lp-candidate-block">
            <h3 className="lp-candidate-heading">{system.label}</h3>
            <dl className="lp-dl">
              {COMPARISON_HEADINGS.map(h => (
                <div key={h.key} className="lp-dl-row">
                  <dt className="lp-dt">{h.label}</dt>
                  <dd className="lp-dd">{system.rows[h.key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      {/* ── Confidence drivers ─────────────────────────────────────────────── */}
      <section className="lp-section lp-page-break-before" aria-labelledby="lp-tech-confidence">
        <h2 className="lp-section__title" id="lp-tech-confidence">Confidence drivers</h2>

        <span className="lp-confidence-badge">Overall: {confidence}</span>

        {strip.measured.length > 0 && (
          <div className="lp-group">
            <div className="lp-group-label lp-group-label--measured">Measured</div>
            <ul className="lp-list" aria-label="Measured inputs">
              {strip.measured.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {strip.inferred.length > 0 && (
          <div className="lp-group">
            <div className="lp-group-label lp-group-label--inferred">Inferred / assumed</div>
            <ul className="lp-list" aria-label="Inferred inputs">
              {strip.inferred.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Technical constraints ──────────────────────────────────────────── */}
      <section className="lp-section" aria-labelledby="lp-tech-constraints">
        <h2 className="lp-section__title" id="lp-tech-constraints">Technical constraints and required changes</h2>
        {candidates.map(system => (
          <div key={system.id} className="lp-candidate-block">
            <div className="lp-candidate-block__name">{system.label}</div>
            <div className="lp-explanation-block lp-explanation-block--changes">
              <span className="lp-explanation-label">What would need to change</span>
              <p className="lp-explanation-text">{system.explanation.changes}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── Headline recommendation ────────────────────────────────────────── */}
      <section className="lp-section" aria-labelledby="lp-tech-verdict">
        <h2 className="lp-section__title" id="lp-tech-verdict">Recommendation</h2>
        <div className="lp-verdict" role="status" aria-label="Headline recommendation">
          <div className="lp-verdict__label">Best overall fit</div>
          <p className="lp-verdict__value">{verdict.system}</p>
          <p className="lp-verdict__note">{verdict.note}</p>
        </div>
      </section>

      {/* ── Items requiring confirmation ───────────────────────────────────── */}
      {strip.missing.length > 0 && (
        <section className="lp-section" aria-labelledby="lp-tech-missing">
          <h2 className="lp-section__title" id="lp-tech-missing">Items requiring confirmation</h2>
          <ul className="lp-list" aria-label="Missing inputs">
            {strip.missing.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {strip.nextStep && (
            <p className="lp-next-step-note">{strip.nextStep}</p>
          )}
        </section>
      )}

    </div>
  );
}
