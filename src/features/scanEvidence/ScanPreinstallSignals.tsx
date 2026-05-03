/**
 * ScanPreinstallSignals.tsx
 *
 * Engineer-facing compact strip showing fabric confidence indicators and
 * hazard soft-warning signals derived from a SessionCaptureV2.
 *
 * Design rules
 * ────────────
 * - Display only: no engine calls, no heat-loss, no recommendation changes.
 * - Fabric signals are confidence indicators showing what Atlas captured.
 * - Hazard warnings are concise action prompts — detail is in ScanHazardObservationPanel.
 * - NEVER render this component in customer portal, deck, or PDF outputs.
 * - Does not alter any recommendation logic.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import {
  getFabricConfidenceSignals,
  getHazardSoftWarningEntries,
} from './scanEvidenceSelectors';
import type { HazardSoftWarningEntry } from './scanEvidenceSelectors';

// ─── Sub-components ───────────────────────────────────────────────────────────

function FabricSignalChip({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.25rem 0.55rem',
        borderRadius: 4,
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        fontSize: '0.76rem',
        color: '#0369a1',
        fontWeight: 500,
      }}
    >
      <span style={{ fontSize: '0.7rem' }}>✓</span>
      {label}
    </div>
  );
}

function HazardWarningRow({ entry }: { entry: HazardSoftWarningEntry }) {
  const isBlockingSeverity = entry.severity === 'blocking' || entry.severity === 'high';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.4rem',
        padding: '0.3rem 0.55rem',
        borderRadius: 4,
        background: isBlockingSeverity ? '#fef2f2' : '#fffbeb',
        border: `1px solid ${isBlockingSeverity ? '#fca5a5' : '#fcd34d'}`,
        fontSize: '0.76rem',
        color: isBlockingSeverity ? '#b91c1c' : '#92400e',
        fontWeight: 500,
      }}
    >
      <span>⚠</span>
      <span>{entry.message}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanPreinstallSignalsProps {
  capture: SessionCaptureV2;
}

/**
 * Compact strip of fabric confidence indicators and hazard soft warnings.
 * Intended for use near the top of the engineer pre-install view, before the
 * full ScanEvidenceSummary detail panel.
 *
 * Returns null when there are no signals or warnings to display.
 */
export function ScanPreinstallSignals({ capture }: ScanPreinstallSignalsProps) {
  const fabricSignals = getFabricConfidenceSignals(capture);
  const hazardEntries = getHazardSoftWarningEntries(capture);

  if (fabricSignals.length === 0 && hazardEntries.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="scan-preinstall-signals"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        marginBottom: '1rem',
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
          fontSize: '0.72rem',
          fontWeight: 700,
          color: '#475569',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Site observations
      </div>

      <div style={{ padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Fabric confidence indicators */}
        {fabricSignals.length > 0 && (
          <div
            data-testid="scan-preinstall-fabric-signals"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}
          >
            {fabricSignals.map((signal) => (
              <FabricSignalChip key={signal} label={signal} />
            ))}
          </div>
        )}

        {/* Hazard soft warnings */}
        {hazardEntries.length > 0 && (
          <div
            data-testid="scan-preinstall-hazard-warnings"
            style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}
          >
            {hazardEntries.map((entry) => (
              <HazardWarningRow key={entry.message} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
