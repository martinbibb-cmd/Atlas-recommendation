import {
  PLACEHOLDER_CONFIDENCE,
  PLACEHOLDER_CONFIDENCE_STRIP,
  PLACEHOLDER_CURRENT_SYSTEM,
  PLACEHOLDER_VERDICT,
  CANDIDATE_SYSTEMS,
} from './labSharedData';
import './lab-print.css';

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Called when the user clicks the back button on screen. Defaults to window.close(). */
  onBack?: () => void;
}

/**
 * LabPrintCustomer
 *
 * A customer-facing print layout showing the headline recommendation, why it
 * suits, key considerations, confidence level, and a single next step.
 *
 * Interactive chrome is hidden via @media print.  "Missing" inputs are relabelled
 * "Not yet confirmed" per customer-facing copy conventions.
 */
export default function LabPrintCustomer({ onBack }: Props) {
  // Use the recommended system's explanation copy.
  const recommended = CANDIDATE_SYSTEMS.find(s => s.id === 'ashp') ?? CANDIDATE_SYSTEMS[0];

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
        <span className="lp-toolbar__label">Customer Summary</span>
        <button className="lp-toolbar__print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── Document header ────────────────────────────────────────────────── */}
      <header className="lp-doc-header">
        <div>
          <div className="lp-doc-header__brand" aria-label="Atlas">ATLAS</div>
          <h1 className="lp-doc-header__title">Customer Summary</h1>
          <p className="lp-doc-header__sub">System Lab — heating recommendation overview</p>
        </div>
        <div className="lp-doc-header__meta">
          <div>Confidence: {PLACEHOLDER_CONFIDENCE}</div>
          <div>Current system: {PLACEHOLDER_CURRENT_SYSTEM}</div>
        </div>
      </header>

      {/* ── Recommendation ─────────────────────────────────────────────────── */}
      <section className="lp-section" aria-labelledby="lp-customer-rec">
        <h2 className="lp-section__title" id="lp-customer-rec">Recommendation</h2>
        <div className="lp-verdict" role="status" aria-label="Headline recommendation">
          <div className="lp-verdict__label">Best overall fit</div>
          <p className="lp-verdict__value">{PLACEHOLDER_VERDICT.system}</p>
          <p className="lp-verdict__note">{PLACEHOLDER_VERDICT.note}</p>
        </div>
      </section>

      {/* ── Why it's recommended ───────────────────────────────────────────── */}
      <section className="lp-section" aria-labelledby="lp-customer-why">
        <h2 className="lp-section__title" id="lp-customer-why">Why it's recommended</h2>
        <div className="lp-explanation-block lp-explanation-block--suits">
          <span className="lp-explanation-label">Why it suits</span>
          <p className="lp-explanation-text">{recommended.explanation.suits}</p>
        </div>
      </section>

      {/* ── Key considerations ─────────────────────────────────────────────── */}
      <section className="lp-section" aria-labelledby="lp-customer-considerations">
        <h2 className="lp-section__title" id="lp-customer-considerations">Key considerations</h2>
        <div className="lp-explanation-block lp-explanation-block--struggles">
          <span className="lp-explanation-label">Points to be aware of</span>
          <p className="lp-explanation-text">{recommended.explanation.struggles}</p>
        </div>
        <div className="lp-explanation-block lp-explanation-block--changes">
          <span className="lp-explanation-label">What would need to change</span>
          <p className="lp-explanation-text">{recommended.explanation.changes}</p>
        </div>
      </section>

      {/* ── Confidence ─────────────────────────────────────────────────────── */}
      <section className="lp-section" aria-labelledby="lp-customer-confidence">
        <h2 className="lp-section__title" id="lp-customer-confidence">Confidence</h2>
        <span className="lp-confidence-badge">Confidence: {PLACEHOLDER_CONFIDENCE}</span>

        {PLACEHOLDER_CONFIDENCE_STRIP.missing.length > 0 && (
          <div>
            <div className="lp-unconfirmed-tag" aria-label="Not yet confirmed inputs">
              Not yet confirmed
            </div>
            <ul className="lp-list" aria-label="Items not yet confirmed">
              {PLACEHOLDER_CONFIDENCE_STRIP.missing.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Next step ──────────────────────────────────────────────────────── */}
      {PLACEHOLDER_CONFIDENCE_STRIP.nextStep && (
        <section className="lp-section" aria-labelledby="lp-customer-next">
          <h2 className="lp-section__title" id="lp-customer-next">Next step</h2>
          <p>{PLACEHOLDER_CONFIDENCE_STRIP.nextStep}</p>
        </section>
      )}

    </div>
  );
}
