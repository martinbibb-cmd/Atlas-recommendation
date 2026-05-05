/**
 * ScanExternalAreaPanel.tsx
 *
 * Engineer-facing panel for external area scan evidence captured in a
 * SessionCaptureV2.
 *
 * Shows per-scan records with:
 *   - label and capturedAt
 *   - reviewStatus
 *   - photo count
 *   - object pins (flue terminal, openings, boundaries, obstructions)
 *   - measurement lines
 *   - point cloud asset ID
 *
 * Filtering rules
 * ───────────────
 * - This panel is ENGINEER ONLY.  External / flue evidence must never appear
 *   in customer portal, deck, or PDF outputs.
 * - No pass/fail flue calculation is performed here — display only.
 *
 * Viewer only — read-only, no mutations, no engine calls.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import type {
  ExternalAreaScanV1,
  ExternalObjectPinV1,
  ExternalMeasurementLineV1,
  ExternalScanReviewStatusV1,
} from '../scanImport/contracts/sessionCaptureV2';
import { getExternalAreaScans } from './scanEvidenceSelectors';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import type { ReviewStatus } from './ReviewStatusBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toReviewStatus(s: ExternalScanReviewStatusV1 | undefined): ReviewStatus {
  return s ?? 'pending';
}

function fmtM(val: number | undefined, unit = 'm'): string {
  return val !== undefined ? `${val.toFixed(2)} ${unit}` : '—';
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const EXTERNAL_PIN_TYPE_LABELS: Record<string, string> = {
  flue_terminal: 'Flue terminal',
  opening:       'Opening',
  boundary:      'Boundary',
  obstruction:   'Obstruction',
  other:         'Other',
};

function externalPinTypeLabel(type: string): string {
  return EXTERNAL_PIN_TYPE_LABELS[type] ?? type;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExternalObjectPinRow({ pin }: { pin: ExternalObjectPinV1 }) {
  const isFlue = pin.objectType === 'flue_terminal';
  return (
    <div
      data-testid={`external-pin-row-${pin.pinId}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        padding: '0.4rem 0.6rem',
        borderBottom: '1px solid #f1f5f9',
        flexWrap: 'wrap',
        fontSize: '0.8rem',
      }}
    >
      <span
        style={{
          minWidth: 110,
          fontWeight: isFlue ? 700 : 600,
          color: isFlue ? '#92400e' : '#1e293b',
          flexShrink: 0,
        }}
      >
        {externalPinTypeLabel(pin.objectType)}
      </span>
      {pin.label && (
        <span style={{ color: '#475569', flex: 1 }}>{pin.label}</span>
      )}
      {pin.photoIds && pin.photoIds.length > 0 && (
        <span
          data-testid={`external-pin-photo-count-${pin.pinId}`}
          style={{ fontSize: '0.72rem', color: '#64748b' }}
        >
          {pin.photoIds.length} photo{pin.photoIds.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

function ExternalMeasurementRow({ line }: { line: ExternalMeasurementLineV1 }) {
  return (
    <div
      data-testid={`external-measurement-row-${line.lineId}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        padding: '0.4rem 0.6rem',
        borderBottom: '1px solid #f1f5f9',
        flexWrap: 'wrap',
        fontSize: '0.8rem',
      }}
    >
      <span style={{ minWidth: 110, fontWeight: 600, color: '#1e293b', flexShrink: 0 }}>
        {line.label ?? line.lineId}
      </span>
      <span style={{ color: '#475569', minWidth: 60, flexShrink: 0 }}>
        {fmtM(line.lengthM)}
      </span>
      {line.notes && (
        <span style={{ color: '#64748b', flex: 1 }}>{line.notes}</span>
      )}
    </div>
  );
}

function ExternalScanCard({
  scan,
  index,
}: {
  scan: ExternalAreaScanV1;
  index: number;
}) {
  const reviewStatus = toReviewStatus(scan.reviewStatus);
  const scanLabel = scan.label ?? `External scan ${index + 1}`;
  const objectPins = scan.objectPins ?? [];
  const measurementLines = scan.measurementLines ?? [];
  const photoCount = scan.photoIds?.length ?? 0;

  return (
    <div
      data-testid={`external-scan-card-${scan.scanId}`}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        marginBottom: '0.75rem',
        overflow: 'hidden',
      }}
    >
      {/* Scan header */}
      <div
        style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '0.45rem 0.7rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: '0.82rem',
        }}
      >
        <span style={{ fontWeight: 700, color: '#1e293b' }}>{scanLabel}</span>
        <span style={{ color: '#64748b' }}>{fmtDate(scan.capturedAt)}</span>
        {photoCount > 0 && (
          <span
            data-testid={`external-scan-photo-count-${scan.scanId}`}
            style={{ color: '#64748b' }}
          >
            {photoCount} photo{photoCount !== 1 ? 's' : ''}
          </span>
        )}
        {scan.pointCloudAssetId !== undefined && (
          <span
            data-testid={`external-scan-point-cloud-${scan.scanId}`}
            style={{
              fontSize: '0.7rem',
              padding: '0.05rem 0.4rem',
              borderRadius: 3,
              background: '#f0f9ff',
              color: '#0369a1',
              border: '1px solid #bae6fd',
              fontFamily: 'monospace',
            }}
          >
            PC: {scan.pointCloudAssetId}
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <ReviewStatusBadge status={reviewStatus} />
        </div>
      </div>

      {/* Object pins */}
      {objectPins.length > 0 && (
        <div>
          <div
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            Object pins ({objectPins.length})
          </div>
          {objectPins.map((pin) => (
            <ExternalObjectPinRow key={pin.pinId} pin={pin} />
          ))}
        </div>
      )}

      {/* Measurement lines */}
      {measurementLines.length > 0 && (
        <div>
          <div
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            Measurements ({measurementLines.length})
          </div>
          {measurementLines.map((line) => (
            <ExternalMeasurementRow key={line.lineId} line={line} />
          ))}
        </div>
      )}

      {objectPins.length === 0 && measurementLines.length === 0 && photoCount === 0 && (
        <p
          style={{
            margin: 0,
            padding: '0.6rem',
            fontSize: '0.78rem',
            color: '#94a3b8',
            fontStyle: 'italic',
          }}
        >
          No detail recorded for this external scan.
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanExternalAreaPanelProps {
  capture: SessionCaptureV2;
}

export function ScanExternalAreaPanel({ capture }: ScanExternalAreaPanelProps) {
  const scans = getExternalAreaScans(capture);

  if (scans.length === 0) {
    return (
      <p
        data-testid="scan-external-area-empty"
        style={{
          margin: 0,
          fontSize: '0.8rem',
          color: '#94a3b8',
          fontStyle: 'italic',
        }}
      >
        No external / flue scans received from Scan.
      </p>
    );
  }

  return (
    <div data-testid="scan-external-area-panel">
      {scans.map((scan, i) => (
        <ExternalScanCard key={scan.scanId} scan={scan} index={i} />
      ))}
    </div>
  );
}
