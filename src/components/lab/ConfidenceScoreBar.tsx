/**
 * ConfidenceScoreBar.tsx
 *
 * Replaces the simple "Confidence: Medium" badge in System Lab with a
 * visual progress-bar representation and a breakdown of contributing
 * factors — measured, inferred, and missing data.
 *
 * The numeric score is derived from the confidence strip data:
 *   score = 100 × measured / (measured + inferred + missing)
 *   Inferred items are counted at half-weight since they are not confirmed.
 *
 * Colour bands:
 *   ≥ 75 → green  (High confidence)
 *   50–74 → amber (Medium confidence)
 *   < 50  → red   (Low confidence)
 *
 * Placement: System Lab context row, replacing the plain confidence badge.
 */

import type { ConfidenceStripData } from './LabConfidenceStrip';
import './confidence-score.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Weight applied to inferred items when computing the confidence score. */
const INFERRED_WEIGHT = 0.5;

/**
 * Compute a 0–100 confidence score from the strip data.
 * Measured = 1 pt, Inferred = INFERRED_WEIGHT pt, Missing = 0 pt.
 */
export function computeConfidenceScore(data: ConfidenceStripData): number {
  const measured = data.measured.length;
  const inferred = data.inferred.length;
  const missing  = data.missing.length;
  const total    = measured + inferred + missing;
  if (total === 0) return 0;
  const score = (measured + inferred * INFERRED_WEIGHT) / total;
  return Math.round(score * 100);
}

function scoreBand(score: number): 'green' | 'amber' | 'red' {
  if (score >= 75) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConfidenceScoreBarProps {
  data: ConfidenceStripData;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ConfidenceScoreBar
 *
 * A compact visual bar with a numeric score and bullet breakdown,
 * suitable for placement in the System Lab context/header row.
 */
export default function ConfidenceScoreBar({ data }: ConfidenceScoreBarProps) {
  const score = computeConfidenceScore(data);
  const band  = scoreBand(score);
  const label = scoreLabel(score);

  return (
    <div
      className="conf-score"
      aria-label={`Atlas confidence: ${label} (${score}%)`}
    >
      <span className="conf-score__heading">Atlas Confidence</span>
      <div className="conf-score__bar-row">
        <div className="conf-score__track">
          <div
            className={`conf-score__fill conf-score__fill--${band}`}
            style={{ width: `${score}%` }}
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className={`conf-score__pct conf-score__pct--${band}`}>
          {score}%
        </span>
      </div>
      <div className="conf-score__breakdown">
        {data.measured.length > 0 && (
          <span className="conf-score__bullet conf-score__bullet--measured">
            ✓ {data.measured.length} measured
          </span>
        )}
        {data.inferred.length > 0 && (
          <span className="conf-score__bullet conf-score__bullet--inferred">
            ~ {data.inferred.length} inferred
          </span>
        )}
        {data.missing.length > 0 && (
          <span className="conf-score__bullet conf-score__bullet--missing">
            ⚠ {data.missing.length} missing
          </span>
        )}
      </div>
    </div>
  );
}
