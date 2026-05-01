/**
 * ScanPointCloudAssetList.tsx
 *
 * Engineer-facing list of point-cloud assets from a SessionCaptureV2.
 *
 * In Atlas Scan, the primary lidar-derived spatial artefacts exported to
 * Atlas Mind are the floor-plan snapshots (floorPlanSnapshots).  This viewer
 * treats each snapshot as a point-cloud asset entry, showing the floor index,
 * capture timestamp, asset URI filename, and per-entity confidence.
 *
 * Because snapshot URIs are device-local paths, no image preview is rendered —
 * the filename and metadata are shown instead.
 *
 * Viewer only — read-only, no mutations, no engine calls.
 */

import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import {
  selectPointCloudAssets,
  deriveEntityConfidence,
} from './scanEvidenceSelectors';
import type { FloorPlanSnapshotV2 } from './scanEvidenceSelectors';
import { AnchorConfidenceBadge } from './AnchorConfidenceBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uriToFilename(uri: string): string {
  try {
    const parts = uri.split('/');
    return parts[parts.length - 1] || uri;
  } catch {
    return uri;
  }
}

function floorLabel(floorIndex: number | undefined): string {
  if (floorIndex === undefined) return 'Unknown floor';
  if (floorIndex === 0) return 'Ground floor';
  if (floorIndex === 1) return 'First floor';
  if (floorIndex === 2) return 'Second floor';
  return `Floor ${floorIndex}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Asset row ────────────────────────────────────────────────────────────────

function AssetRow({
  snapshot,
  capture,
  index,
}: {
  snapshot: FloorPlanSnapshotV2;
  capture: SessionCaptureV2;
  index: number;
}) {
  const confidence = deriveEntityConfidence(capture, snapshot.snapshotId);

  return (
    <div
      data-testid={`scan-point-cloud-asset-row-${snapshot.snapshotId}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.55rem 0.75rem',
        borderBottom: '1px solid #f1f5f9',
        flexWrap: 'wrap',
      }}
    >
      {/* Asset number */}
      <span style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: '#64748b',
        minWidth: 24,
        flexShrink: 0,
      }}>
        #{index + 1}
      </span>

      {/* Floor */}
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', flex: 1 }}>
        {floorLabel(snapshot.floorIndex)}
      </span>

      {/* Filename */}
      <span style={{
        fontSize: '0.72rem',
        color: '#64748b',
        fontFamily: 'monospace',
        wordBreak: 'break-all',
      }}>
        {uriToFilename(snapshot.uri)}
      </span>

      {/* Timestamp */}
      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
        {formatDateTime(snapshot.capturedAt)}
      </span>

      <AnchorConfidenceBadge tier={confidence} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanPointCloudAssetListProps {
  capture: SessionCaptureV2;
}

export function ScanPointCloudAssetList({ capture }: ScanPointCloudAssetListProps) {
  const assets = selectPointCloudAssets(capture);

  if (assets.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
        No point-cloud assets captured.
      </p>
    );
  }

  return (
    <div
      data-testid="scan-point-cloud-asset-list"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {assets.map((snapshot, i) => (
        <AssetRow key={snapshot.snapshotId} snapshot={snapshot} capture={capture} index={i} />
      ))}
    </div>
  );
}
