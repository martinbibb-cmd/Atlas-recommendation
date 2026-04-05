/**
 * ScanPackageReviewPanel.tsx
 *
 * Pre-import review screen for an Atlas Scan export package.
 *
 * Shows all manifest-derived information and an import-readiness verdict
 * before the user confirms the import.
 */

import type { ScanPackageReview, ImportReadiness } from '../package/scanPackageImporter';

// ─── Readiness badge ──────────────────────────────────────────────────────────

interface ReadinessBadgeProps {
  readiness: ImportReadiness;
}

function ReadinessBadge({ readiness }: ReadinessBadgeProps) {
  const config: Record<ImportReadiness, { label: string; bg: string; color: string }> = {
    ready:               { label: '✓ Ready to import', bg: '#dcfce7', color: '#15803d' },
    ready_with_warnings: { label: '⚠ Ready with warnings', bg: '#fef9c3', color: '#a16207' },
    blocked:             { label: '✗ Blocked — resolve issues first', bg: '#fee2e2', color: '#b91c1c' },
  };
  const { label, bg, color } = config[readiness];
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 14px',
      borderRadius: 6,
      background: bg,
      color,
      fontWeight: 700,
      fontSize: 14,
    }}>
      {label}
    </span>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={{ color: '#6b7280', paddingRight: 20, paddingBottom: 6, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
        {label}
      </td>
      <td style={{ paddingBottom: 6, fontWeight: 500 }}>{value}</td>
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ScanPackageReviewPanelProps {
  review: ScanPackageReview;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

export default function ScanPackageReviewPanel({
  review,
  onConfirm,
  onCancel,
  confirming = false,
}: ScanPackageReviewPanelProps) {
  const {
    jobRef,
    propertyAddress,
    generatedAt,
    roomCount,
    reviewedRoomCount,
    scannedRoomCount,
    totalObjects,
    totalPhotos,
    evidenceIncluded,
    evidenceFileCount,
    blockingIssues,
    validationWarnings,
    readiness,
    importActions,
  } = review;

  const generatedDate = (() => {
    try { return new Date(generatedAt).toLocaleString(); }
    catch { return generatedAt; }
  })();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Pre-import review</h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
          Review the package contents before Atlas creates the draft floor plan.
        </p>
      </div>

      {/* Readiness verdict */}
      <div style={{ marginBottom: 20 }}>
        <ReadinessBadge readiness={readiness} />
      </div>

      {/* Package info */}
      <section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Package information</h3>
        <table style={{ fontSize: 14, borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <InfoRow label="Job reference"    value={jobRef || '—'} />
            <InfoRow label="Property address" value={propertyAddress || '—'} />
            <InfoRow label="Generated"        value={generatedDate} />
          </tbody>
        </table>
      </section>

      {/* Counts */}
      <section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Package contents</h3>
        <table style={{ fontSize: 14, borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <InfoRow label="Rooms"           value={roomCount} />
            <InfoRow label="Reviewed rooms"  value={reviewedRoomCount} />
            <InfoRow label="Scanned rooms"   value={scannedRoomCount} />
            <InfoRow label="Objects"         value={totalObjects} />
            <InfoRow label="Photos"          value={totalPhotos} />
            <InfoRow
              label="Evidence"
              value={
                evidenceIncluded
                  ? `Yes — ${evidenceFileCount} file${evidenceFileCount !== 1 ? 's' : ''} detected`
                  : 'Not included'
              }
            />
            <InfoRow
              label="Blocking issues"
              value={
                blockingIssues
                  ? <span style={{ color: '#b91c1c', fontWeight: 700 }}>Yes — resolve before importing</span>
                  : <span style={{ color: '#15803d' }}>No</span>
              }
            />
          </tbody>
        </table>
      </section>

      {/* Validation warnings */}
      {validationWarnings.length > 0 && (
        <section style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#92400e' }}>
            Validation warnings ({validationWarnings.length})
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#78350f' }}>
            {validationWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      {/* What Atlas will do */}
      <section style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 16px', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#0369a1' }}>
          What Atlas will do next
        </h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#0c4a6e' }}>
          {importActions.map((action, i) => <li key={i}>{action}</li>)}
        </ul>
      </section>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onConfirm}
          disabled={blockingIssues || confirming}
          style={{
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            background: blockingIssues ? '#e5e7eb' : '#6366f1',
            color: blockingIssues ? '#9ca3af' : '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: blockingIssues || confirming ? 'not-allowed' : 'pointer',
          }}
        >
          {confirming ? 'Importing…' : 'Confirm import'}
        </button>
        <button
          onClick={onCancel}
          disabled={confirming}
          style={{
            padding: '10px 24px',
            fontSize: 14,
            background: '#fff',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            cursor: confirming ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
