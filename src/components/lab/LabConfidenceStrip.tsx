import { useState } from 'react';
import './lab.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConfidenceStripData {
  /** Inputs that were directly provided or observed. */
  measured: string[];
  /** Inputs estimated or derived from available data. */
  inferred: string[];
  /** Inputs that are absent and would improve recommendation certainty. */
  missing: string[];
  /** Single most-valuable action the user can take next. */
  nextStep?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a confidence percentage from the three evidence buckets.
 * Measured items score full weight; inferred items score half; missing score 0.
 */
function computeConfidencePct(data: ConfidenceStripData): number {
  const total = data.measured.length + data.inferred.length + data.missing.length;
  if (total === 0) return 0;
  const score = data.measured.length + data.inferred.length * 0.5;
  return Math.round((score / total) * 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LabConfidenceStrip
 *
 * A compact, scan-friendly summary of what is measured, inferred, missing, and
 * most worth confirming next.  Placed near the top of System Lab so the user
 * understands recommendation certainty before reading the candidate cards.
 *
 * Starts collapsed so it reads as supporting evidence, not the main event.
 * Tapping the header expands the full breakdown.
 *
 * Data is presentation-layer only; no engine logic runs here.  A future PR will
 * derive the four groups from engine evidence buckets.
 */
export default function LabConfidenceStrip({ data }: { data: ConfidenceStripData }) {
  const [expanded, setExpanded] = useState(false);
  const pct = computeConfidencePct(data);

  return (
    <div className="lab-confidence-strip" aria-label="Confidence drivers">
      {/* Collapsed summary row — always visible */}
      <button
        className="lab-confidence-strip__summary"
        onClick={() => setExpanded(open => !open)}
        aria-expanded={expanded}
        aria-controls="lab-confidence-strip-body"
      >
        <span className="lab-confidence-strip__summary-text">
          Confidence: <strong>{pct}%</strong>
        </span>
        <span className="lab-confidence-strip__summary-chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {/* Expandable full breakdown */}
      <div
        id="lab-confidence-strip-body"
        className={`lab-confidence-strip__body${expanded ? ' lab-confidence-strip__body--open' : ''}`}
        aria-hidden={!expanded}
      >
        <div className="lab-confidence-strip__groups">

          {data.measured.length > 0 && (
            <div className="lab-confidence-strip__group">
              <span className="lab-confidence-strip__group-label lab-confidence-strip__group-label--measured">
                Measured
              </span>
              <ul className="lab-confidence-strip__list">
                {data.measured.map(item => (
                  <li key={item} className="lab-confidence-strip__item lab-confidence-strip__item--measured">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.inferred.length > 0 && (
            <div className="lab-confidence-strip__group">
              <span className="lab-confidence-strip__group-label lab-confidence-strip__group-label--inferred">
                Inferred
              </span>
              <ul className="lab-confidence-strip__list">
                {data.inferred.map(item => (
                  <li key={item} className="lab-confidence-strip__item lab-confidence-strip__item--inferred">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.missing.length > 0 && (
            <div className="lab-confidence-strip__group">
              <span className="lab-confidence-strip__group-label lab-confidence-strip__group-label--missing">
                Missing
              </span>
              <ul className="lab-confidence-strip__list">
                {data.missing.map(item => (
                  <li key={item} className="lab-confidence-strip__item lab-confidence-strip__item--missing">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.nextStep && (
            <div className="lab-confidence-strip__group lab-confidence-strip__group--next-step">
              <span className="lab-confidence-strip__group-label lab-confidence-strip__group-label--next-step">
                Next best step
              </span>
              <p className="lab-confidence-strip__next-step-text">{data.nextStep}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
