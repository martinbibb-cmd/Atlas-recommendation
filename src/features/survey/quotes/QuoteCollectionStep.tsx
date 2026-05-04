/**
 * QuoteCollectionStep.tsx
 *
 * Survey step — Installation specification
 *
 * Entry point for the surveyor installation specification tool.
 * This step lets the surveyor open the installation specification
 * from within the survey flow and continue without one if needed.
 *
 * Design rules:
 *   - This is a surveyor tool, not a customer-facing form.
 *   - No contractor quote language anywhere in this component.
 *   - Progression is never blocked — the surveyor can always continue.
 *   - A soft warning is shown if no installation specification has been built.
 */

import type { CSSProperties } from 'react';
import type { QuoteInput } from '../../insightPack/insightPack.types';
import { getStepMeta } from '../../../config/surveyStepRegistry';

// ─── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  padding: '1rem 1rem 2rem',
  maxWidth: 600,
  margin: '0 auto',
};

const headingStyle: CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 700,
  marginBottom: '0.25rem',
  color: '#1e3a5f',
};

const descStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#6b7280',
  marginBottom: '1.5rem',
};

const cardStyle: CSSProperties = {
  background: '#f0f9ff',
  border: '1px solid #bae6fd',
  borderRadius: 10,
  padding: '1.25rem',
  marginBottom: '1.25rem',
};

const cardHeadingStyle: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#0c4a6e',
  marginBottom: '0.5rem',
};

const cardBodyStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#075985',
  lineHeight: 1.5,
};

const openBtnStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.7rem 1.25rem',
  marginTop: '1rem',
  borderRadius: 8,
  border: 'none',
  background: '#0ea5e9',
  color: '#fff',
  fontWeight: 700,
  fontSize: '0.9rem',
  cursor: 'pointer',
  textAlign: 'center',
};

const warningStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  background: '#fefce8',
  border: '1px solid #fde68a',
  borderRadius: 8,
  fontSize: '0.82rem',
  color: '#78350f',
  marginBottom: '1rem',
};

const navStyle: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  marginTop: '0.75rem',
};

const backBtnStyle: CSSProperties = {
  padding: '0.6rem 1.25rem',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

const continueBtnStyle: CSSProperties = {
  padding: '0.6rem 1.5rem',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuoteCollectionStepProps {
  /**
   * Previously collected installation options — read-only in this component.
   * Kept for backward compatibility with the FullSurveyStepper data contract
   * and for detecting whether a legacy visit already has installation options
   * saved, so the soft warning can be suppressed.
   */
  quotes: QuoteInput[];
  /**
   * Called when the installation options list changes — not currently triggered
   * by this component but retained for interface compatibility with FullSurveyStepper.
   */
  onChange: (next: QuoteInput[]) => void;
  onNext: () => void;
  onPrev: () => void;
  /**
   * When provided, the "Open installation specification" button calls this
   * so the surveyor can launch the specification tool and return to this step.
   */
  onOpenInstallationSpec?: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuoteCollectionStep({
  quotes,
  onNext,
  onPrev,
  onOpenInstallationSpec,
}: QuoteCollectionStepProps) {
  const meta = getStepMeta('quotes');

  // An installation specification is considered present if the surveyor has
  // previously captured installation options (backward-compat with legacy visits).
  const hasInstallSpec = quotes.length > 0;

  return (
    <div data-testid={meta.testId} style={containerStyle}>
      <h2 style={headingStyle}>{meta.heading}</h2>
      <p style={descStyle}>
        Build the install specification from the selected system, site locations,
        flue route, condensate route and pipework.
      </p>

      {/* Installation specification entry card */}
      <div style={cardStyle}>
        <p style={cardHeadingStyle}>🛠 Installation specification</p>
        <p style={cardBodyStyle}>
          Work through the current system, proposed system, location, flue route,
          condensate route and pipework to generate the installation scope for
          this visit.
        </p>

        {onOpenInstallationSpec && (
          <button
            type="button"
            style={openBtnStyle}
            onClick={onOpenInstallationSpec}
            aria-label="Open installation specification"
            data-testid="open-installation-spec-btn"
          >
            Open installation specification →
          </button>
        )}
      </div>

      {/* Soft warning — shown only when no install spec has been built */}
      {!hasInstallSpec && (
        <p style={warningStyle} role="status">
          No install specification has been built yet. You can continue and
          add it later from the Visit Hub.
        </p>
      )}

      {/* Navigation — progression is never blocked */}
      <div style={navStyle}>
        <button
          type="button"
          onClick={onPrev}
          style={backBtnStyle}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          style={continueBtnStyle}
          data-testid="install-spec-continue-btn"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
