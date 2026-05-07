/**
 * YouWeGetTriple.tsx
 *
 * Reusable "You told us / We're doing / So you get" narrative component.
 *
 * Renders a three-column grid that bridges the customer's survey observations
 * to Atlas actions and tangible day-to-day outcomes.
 *
 * Design intent:
 *   - Behavioural and outcome-first — no technical detail.
 *   - Visually connects the customer's home to the recommendation.
 *   - Each row is a standalone, readable statement.
 *
 * Rules (non-negotiable):
 *   - No engineering jargon (ΔT, L/min, hydraulic, etc.).
 *   - All strings must come from YouWeGetTripleData (engine-derived).
 *   - No fallback copy invented inside this component.
 *   - Terminology follows docs/atlas-terminology.md.
 *
 * Pure presentation — no physics logic.
 * All data pre-built by buildInsightPackFromEngine().
 */

import type { YouWeGetTripleData } from './insightPack.types';
import './YouWeGetTriple.css';

// ─── Column header ─────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'youToldUs', label: 'You told us', icon: '🏠' },
  { key: 'wereDoing', label: "We're doing",  icon: '⚙️' },
  { key: 'soYouGet',  label: 'So you get',   icon: '✅' },
] as const;

// ─── Main component ────────────────────────────────────────────────────────────

export interface YouWeGetTripleProps {
  data: YouWeGetTripleData;
}

export default function YouWeGetTriple({ data }: YouWeGetTripleProps) {
  return (
    <div className="ywg-triple" data-testid="you-we-get-triple">
      {/* Column headers */}
      <div className="ywg-triple__header-row" role="row">
        {COLUMNS.map(col => (
          <div key={col.key} className="ywg-triple__header-cell" role="columnheader">
            <span className="ywg-triple__header-icon" aria-hidden="true">{col.icon}</span>
            <span className="ywg-triple__header-label">{col.label}</span>
          </div>
        ))}
      </div>

      {/* Data rows */}
      {data.rows.map((row, i) => (
        <div
          key={i}
          className={`ywg-triple__row${i % 2 === 1 ? ' ywg-triple__row--alt' : ''}`}
          role="row"
        >
          <div className="ywg-triple__cell ywg-triple__cell--you" role="cell">
            {row.youToldUs}
          </div>
          <div className="ywg-triple__cell ywg-triple__cell--doing" role="cell">
            {row.wereDoing}
          </div>
          <div className="ywg-triple__cell ywg-triple__cell--get" role="cell">
            {row.soYouGet}
          </div>
        </div>
      ))}
    </div>
  );
}
