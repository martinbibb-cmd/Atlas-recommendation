/**
 * FlueEvidenceReadinessPanel.tsx
 *
 * Engineer-facing panel showing whether Atlas Scan has captured enough
 * external / flue evidence for engineer review.
 *
 * Design rules
 * ────────────
 * - Display only: no engine calls, no flue compliance, no recommendation changes.
 * - Readiness is derived from evidence presence, not clearance calculation.
 * - NEVER render this component in customer portal, deck, or PDF outputs.
 * - No pass/fail flue compliance is shown here — that is a separate step.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import {
  getFlueEvidenceReadiness,
  hasExternalFlueScan,
  hasFlueTerminalPin,
  hasExternalMeasurements,
} from './scanEvidenceSelectors';
import type { FlueEvidenceReadiness } from './scanEvidenceSelectors';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EvidenceRowProps {
  label: string;
  present: boolean;
  testId: string;
}

function EvidenceRow({ label, present, testId }: EvidenceRowProps) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.8rem',
        color: present ? '#166534' : '#64748b',
        padding: '0.2rem 0',
      }}
    >
      <span
        style={{
          fontSize: '0.7rem',
          color: present ? '#16a34a' : '#94a3b8',
          minWidth: '1rem',
        }}
      >
        {present ? '✓' : '○'}
      </span>
      <span>{label}</span>
    </div>
  );
}

function readinessBadgeStyle(readiness: FlueEvidenceReadiness): {
  background: string;
  color: string;
  border: string;
} {
  if (readiness === 'complete') {
    return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
  }
  if (readiness === 'partial') {
    return { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' };
  }
  return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
}

function readinessBadgeLabel(readiness: FlueEvidenceReadiness): string {
  if (readiness === 'complete') return 'Evidence complete';
  if (readiness === 'partial') return 'Partial evidence';
  return 'No evidence captured';
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface FlueEvidenceReadinessPanelProps {
  capture: SessionCaptureV2;
}

/**
 * Panel showing the readiness of external flue evidence for engineer review.
 *
 * Surfaces three boolean signals (external scan, flue terminal pin,
 * measurement lines) and a derived overall readiness state
 * ('complete' | 'partial' | 'missing').
 *
 * Always rendered — even when missing — so the engineer can see that no
 * external evidence was captured.
 *
 * Engineer-internal only.
 */
export function FlueEvidenceReadinessPanel({
  capture,
}: FlueEvidenceReadinessPanelProps) {
  const readiness = getFlueEvidenceReadiness(capture);
  const hasScan = hasExternalFlueScan(capture);
  const hasTerminal = hasFlueTerminalPin(capture);
  const hasMeasurements = hasExternalMeasurements(capture);

  return (
    <div
      data-testid="flue-evidence-readiness-panel"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '0.4rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          External flue evidence
        </span>

        <span
          data-testid="flue-evidence-readiness-badge"
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '0.15rem 0.45rem',
            borderRadius: 3,
            ...readinessBadgeStyle(readiness),
          }}
        >
          {readinessBadgeLabel(readiness)}
        </span>
      </div>

      {/* Evidence rows */}
      <div style={{ padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        <EvidenceRow
          testId="flue-evidence-row-external-scan"
          label="External flue evidence captured"
          present={hasScan}
        />
        <EvidenceRow
          testId="flue-evidence-row-terminal-pin"
          label="Flue terminal marked"
          present={hasTerminal}
        />
        <EvidenceRow
          testId="flue-evidence-row-measurements"
          label="Measurement lines recorded"
          present={hasMeasurements}
        />
      </div>

      {/* Static compliance note */}
      <div
        data-testid="flue-evidence-compliance-note"
        style={{
          borderTop: '1px solid #f1f5f9',
          padding: '0.35rem 0.75rem',
          fontSize: '0.72rem',
          color: '#94a3b8',
          fontStyle: 'italic',
        }}
      >
        Clearance compliance not calculated yet
      </div>
    </div>
  );
}
