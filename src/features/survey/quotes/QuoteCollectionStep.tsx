/**
 * QuoteCollectionStep.tsx
 *
 * Survey step — Installation Specification entry card (Step 9 of 9).
 *
 * Replaces the old contractor-quote collection UI.  The surveyor uses this
 * card to launch the Installation Specification stepper, which captures the
 * technical install details (current system, proposed system, key locations,
 * flue route, condensate route, pipework and generated install scope).
 *
 * Design rules:
 *   - Does NOT ask for contractor quotes.
 *   - Does NOT block survey progress — surveyor can continue without a spec.
 *   - "Open specification" launches the InstallationSpecificationPage.
 *   - "Continue without specification" calls onNext immediately.
 *   - If a specification already exists, a status summary is shown.
 */

import type { CSSProperties } from 'react';
import { getStepMeta } from '../../../config/surveyStepRegistry';

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '1.25rem',
  marginBottom: '1rem',
};

const statusBadgeStyle = (complete: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.25rem 0.65rem',
  borderRadius: 20,
  fontSize: '0.775rem',
  fontWeight: 600,
  background: complete ? '#dcfce7' : '#f1f5f9',
  color: complete ? '#166534' : '#64748b',
  marginBottom: '1rem',
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SpecificationStatus {
  /** Whether the specification has been started at all. */
  started: boolean;
  /** Whether the specification has been completed. */
  complete: boolean;
  /** Number of generated scope items (if any). */
  scopeItemCount?: number;
  /** Number of items that need verification. */
  needsVerificationCount?: number;
  /** Short description of the current and proposed system (e.g. "Combi → System"). */
  systemSummary?: string;
}

interface QuoteCollectionStepProps {
  onNext: () => void;
  onPrev: () => void;
  /** Called when the surveyor clicks "Open specification". */
  onOpenSpecification: () => void;
  /** Optional status of the installation specification if one already exists. */
  specificationStatus?: SpecificationStatus;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuoteCollectionStep({
  onNext,
  onPrev,
  onOpenSpecification,
  specificationStatus,
}: QuoteCollectionStepProps) {
  const meta = getStepMeta('quotes');

  const isComplete = specificationStatus?.complete ?? false;
  const isStarted = specificationStatus?.started ?? false;

  let statusLabel: string;
  if (isComplete) {
    statusLabel = 'Specification complete';
  } else if (isStarted) {
    statusLabel = 'Specification started';
  } else {
    statusLabel = 'Not started';
  }

  return (
    <div
      data-testid={meta.testId}
      style={{ padding: '1rem 1rem 2rem', maxWidth: 600, margin: '0 auto' }}
    >
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e3a5f' }}>
        {meta.heading}
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.25rem' }}>
        Build the technical install specification from the selected system, site
        locations, flue route, condensate route and pipework.
      </p>

      <div style={cardStyle}>
        {/* Status badge */}
        <div style={statusBadgeStyle(isComplete)}>
          {isComplete ? '✓ ' : ''}{statusLabel}
        </div>

        {/* Scope summary — only shown when a spec exists */}
        {isStarted && (
          <div style={{ fontSize: '0.825rem', color: '#374151', marginBottom: '1rem' }}>
            {specificationStatus?.systemSummary && (
              <p style={{ margin: '0 0 0.3rem' }}>
                <strong>System:</strong> {specificationStatus.systemSummary}
              </p>
            )}
            {specificationStatus?.scopeItemCount != null && (
              <p style={{ margin: '0 0 0.3rem' }}>
                <strong>Generated scope:</strong>{' '}
                {specificationStatus.scopeItemCount === 0
                  ? '0 items'
                  : `${specificationStatus.scopeItemCount} item${specificationStatus.scopeItemCount !== 1 ? 's' : ''}`}
                {specificationStatus.needsVerificationCount != null &&
                  specificationStatus.needsVerificationCount > 0 && (
                    <span style={{ color: '#d97706', marginLeft: '0.5rem' }}>
                      · {specificationStatus.needsVerificationCount} need{specificationStatus.needsVerificationCount !== 1 ? '' : 's'} verification
                    </span>
                  )}
              </p>
            )}
          </div>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onOpenSpecification}
          aria-label="Open installation specification"
          data-testid="open-specification-btn"
          style={{
            display: 'block',
            width: '100%',
            padding: '0.65rem 1.25rem',
            borderRadius: 8,
            border: 'none',
            background: '#1e3a5f',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.925rem',
            cursor: 'pointer',
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}
        >
          🛠 Open specification
        </button>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button
          type="button"
          onClick={onPrev}
          style={{ padding: '0.6rem 1.25rem', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          data-testid="continue-without-specification-btn"
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            background: '#f8fafc',
            color: '#374151',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Continue without specification
        </button>
      </div>
    </div>
  );
}

