import {
  PLACEHOLDER_CONFIDENCE,
  PLACEHOLDER_CURRENT_SYSTEM,
  COMPARISON_HEADINGS,
  CANDIDATE_SYSTEMS,
  CURRENT_SYSTEM,
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
 * LabPrintComparison
 *
 * A side-by-side comparison print layout showing the current system against
 * the two candidate systems across all normalized headings already used in
 * System Lab.  A trade-off section below the table gives the strongest fit,
 * main trade-off, and required changes for each candidate.
 *
 * Interactive chrome is hidden via @media print.
 */
export default function LabPrintComparison({ onBack, data }: Props) {
  const confidence    = data?.confidence              ?? PLACEHOLDER_CONFIDENCE;
  const currentSystem = data?.currentSystem           ?? PLACEHOLDER_CURRENT_SYSTEM;
  const currentCol    = data?.currentSystemForComparison ?? CURRENT_SYSTEM;
  const candidates    = data?.candidates              ?? CANDIDATE_SYSTEMS;

  // All columns: current system + candidates
  const columns = [currentCol, ...candidates];

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
        <span className="lp-toolbar__label">Comparison Sheet</span>
        <button className="lp-toolbar__print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── Document header ────────────────────────────────────────────────── */}
      <header className="lp-doc-header">
        <div>
          <div className="lp-doc-header__brand" aria-label="Atlas">ATLAS</div>
          <h1 className="lp-doc-header__title">Comparison Sheet</h1>
          <p className="lp-doc-header__sub">System Lab — side-by-side system comparison</p>
        </div>
        <div className="lp-doc-header__meta">
          <div>Confidence: {confidence}</div>
          <div>Current system: {currentSystem}</div>
        </div>
      </header>

      {/* ── Comparison table ───────────────────────────────────────────────── */}
      <section className="lp-section" aria-labelledby="lp-comparison-table-heading">
        <h2 className="lp-section__title" id="lp-comparison-table-heading">
          Side-by-side comparison
        </h2>
        <table className="lp-comparison-table" aria-label="System comparison">
          <thead>
            <tr>
              <th scope="col">Heading</th>
              {columns.map(col => (
                <th key={col.id} scope="col">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_HEADINGS.map(h => (
              <tr key={h.key}>
                <td className="lp-row-header">{h.label}</td>
                {columns.map(col => (
                  <td key={col.id}>{col.rows[h.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Trade-off summary ──────────────────────────────────────────────── */}
      <section
        className="lp-section lp-page-break-before"
        aria-labelledby="lp-comparison-tradeoff"
      >
        <h2 className="lp-section__title" id="lp-comparison-tradeoff">
          Trade-off summary
        </h2>
        <div className="lp-tradeoff-grid">
          {candidates.map(system => (
            <div key={system.id}>
              <div className="lp-candidate-heading">{system.label}</div>
              <div className="lp-explanation-block lp-explanation-block--suits">
                <span className="lp-explanation-label">Strongest fit</span>
                <p className="lp-explanation-text">{system.explanation.suits}</p>
              </div>
              <div className="lp-explanation-block lp-explanation-block--struggles">
                <span className="lp-explanation-label">Main trade-off</span>
                <p className="lp-explanation-text">{system.explanation.struggles}</p>
              </div>
              <div className="lp-explanation-block lp-explanation-block--changes">
                <span className="lp-explanation-label">What would need to change</span>
                <p className="lp-explanation-text">{system.explanation.changes}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
