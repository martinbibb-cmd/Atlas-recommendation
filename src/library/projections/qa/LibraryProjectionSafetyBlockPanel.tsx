import type { LibraryProjectionSafetyV1 } from './LibraryProjectionSafetyV1';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LibraryProjectionSafetyBlockPanelProps {
  /** Safety assessment result from assessLibraryProjectionSafety. */
  readonly safety: LibraryProjectionSafetyV1;
  /**
   * When true the panel is rendered even when safeForCustomer is true, showing
   * only warnings.  Defaults to false (panel is hidden when safe).
   */
  readonly showWhenSafe?: boolean;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/**
 * LibraryProjectionSafetyBlockPanel
 *
 * Renders a blocking notification when a customer projection is not safe for
 * customer-facing output.  Shows exact leakage reasons and any non-blocking
 * warnings so engineers can diagnose and fix the projection.
 *
 * Use in customer preview routes to prevent unsafe content being displayed.
 * The audit output is never affected — this panel is for customer-facing
 * render paths only.
 */
export function LibraryProjectionSafetyBlockPanel({
  safety,
  showWhenSafe = false,
}: LibraryProjectionSafetyBlockPanelProps) {
  const hasWarnings = safety.warnings.length > 0;

  if (safety.safeForCustomer && !showWhenSafe) {
    return null;
  }

  if (safety.safeForCustomer && !hasWarnings) {
    return null;
  }

  const isBlocked = !safety.safeForCustomer;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="projection-safety-block-panel"
      style={{
        border: `2px solid ${isBlocked ? '#dc2626' : '#d97706'}`,
        borderRadius: '0.5rem',
        background: isBlocked ? '#fef2f2' : '#fffbeb',
        padding: '0.75rem 1rem',
        display: 'grid',
        gap: '0.5rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: isBlocked ? '#dc2626' : '#92400e',
          }}
          data-testid="projection-safety-status"
        >
          {isBlocked
            ? '⛔ Customer output blocked — projection safety failed'
            : '⚠ Customer projection quality warnings'}
        </span>
      </div>

      {/* Blocking reasons */}
      {safety.blockingReasons.length > 0 && (
        <div data-testid="projection-safety-blocking-reasons">
          <p
            style={{
              margin: '0 0 0.25rem',
              fontSize: 12,
              fontWeight: 600,
              color: '#991b1b',
            }}
          >
            Blocking reasons
          </p>
          <ul
            style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12, color: '#7f1d1d' }}
          >
            {safety.blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Leakage terms */}
      {safety.leakageTerms.length > 0 && (
        <div data-testid="projection-safety-leakage-terms">
          <p
            style={{
              margin: '0 0 0.25rem',
              fontSize: 12,
              fontWeight: 600,
              color: '#991b1b',
            }}
          >
            Detected leakage terms
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {safety.leakageTerms.map((term) => (
              <span
                key={term}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: 999,
                  padding: '0.1rem 0.45rem',
                }}
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing required content */}
      {safety.missingRequiredContent.length > 0 && (
        <div data-testid="projection-safety-missing-content">
          <p
            style={{
              margin: '0 0 0.25rem',
              fontSize: 12,
              fontWeight: 600,
              color: '#78350f',
            }}
          >
            Missing required content
          </p>
          <ul
            style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12, color: '#78350f' }}
          >
            {safety.missingRequiredContent.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {safety.warnings.length > 0 && (
        <div data-testid="projection-safety-warnings">
          <p
            style={{
              margin: '0 0 0.25rem',
              fontSize: 12,
              fontWeight: 600,
              color: '#92400e',
            }}
          >
            Warnings
          </p>
          <ul
            style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12, color: '#78350f' }}
          >
            {safety.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
