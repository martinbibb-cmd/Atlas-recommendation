/**
 * ScopeConfidenceBadges.tsx
 *
 * Displays a confidence badge and optional verification warning for a
 * `QuoteScopeItemV1`.
 *
 * Design rules:
 *   - No customer-facing copy.
 *   - Does not alter recommendation logic.
 */

import type { QuoteScopeItemConfidence } from '../../scope/buildQuoteScopeFromInstallationPlan';

// ─── Labels ───────────────────────────────────────────────────────────────────

const CONFIDENCE_LABELS: Record<QuoteScopeItemConfidence, string> = {
  confirmed:          'Confirmed',
  estimated:          'Estimated',
  low:                'Low confidence',
  needs_verification: 'Needs verification',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ScopeConfidenceBadgesProps {
  confidence: QuoteScopeItemConfidence;
  needsVerification: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScopeConfidenceBadges({
  confidence,
  needsVerification,
}: ScopeConfidenceBadgesProps) {
  return (
    <span className="scope-badges">
      <span
        className={`scope-badge scope-badge--${confidence.replace('_', '-')}`}
        aria-label={`Confidence: ${CONFIDENCE_LABELS[confidence]}`}
      >
        {CONFIDENCE_LABELS[confidence]}
      </span>
      {needsVerification && (
        <span
          className="scope-badge scope-badge--verify"
          aria-label="Needs on-site verification"
        >
          ⚠ Verify on site
        </span>
      )}
    </span>
  );
}
