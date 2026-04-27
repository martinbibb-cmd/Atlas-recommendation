/**
 * ComparisonMatrixPage.tsx — Lightweight surveyor wrapper page.
 *
 * Renders a heading, the ComparisonMatrix, and a disclaimer.
 * Intended for surveyor use only.
 *
 * Rules:
 *   - No recommendation logic — content from ScenarioResult only.
 *   - No Math.random().
 *   - Default export (page component).
 */

import type { ScenarioResult } from '../../contracts/ScenarioResult';
import { ComparisonMatrix } from './ComparisonMatrix';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ComparisonMatrixPageProps {
  scenarios: ScenarioResult[];
  recommendedScenarioId: string;
  onBack?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ComparisonMatrixPage
 *
 * Surveyor-facing page wrapping ComparisonMatrix with a heading and disclaimer.
 */
export default function ComparisonMatrixPage({
  scenarios,
  recommendedScenarioId,
  onBack,
}: ComparisonMatrixPageProps) {
  return (
    <div
      style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto', fontFamily: 'inherit' }}
      data-testid="comparison-matrix-page"
    >
      {/* ── Back button ── */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            marginBottom: '1rem',
            padding: '0.35rem 0.9rem',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: '#4a5568',
          }}
          data-testid="comparison-matrix-page-back"
        >
          ← Back
        </button>
      )}

      {/* ── Heading ── */}
      <h1
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#1a202c',
          marginBottom: '1rem',
        }}
      >
        System Comparison — Surveyor View
      </h1>

      {/* ── Matrix ── */}
      <ComparisonMatrix
        scenarios={scenarios}
        recommendedScenarioId={recommendedScenarioId}
      />

      {/* ── Disclaimer ── */}
      <p
        style={{
          marginTop: '1.25rem',
          fontSize: '0.75rem',
          color: '#718096',
          fontStyle: 'italic',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '0.75rem',
        }}
        role="note"
        data-testid="comparison-matrix-page-disclaimer"
      >
        This matrix is for surveyor use. Suitability is determined by Atlas physics engine,
        not by this display.
      </p>
    </div>
  );
}
