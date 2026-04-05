/**
 * ScanImportSummary.tsx
 *
 * Post-import summary shown after the draft floor plan has been hydrated.
 */

import type { ImportSummary } from '../package/scanPackageImporter';
import type { ScanImportWarning } from '../importer/scanMapper';

// ─── Component ────────────────────────────────────────────────────────────────

export interface ScanImportSummaryProps {
  summary: ImportSummary;
  warnings: ScanImportWarning[];
  onContinue: () => void;
}

export default function ScanImportSummary({
  summary,
  warnings,
  onContinue,
}: ScanImportSummaryProps) {
  const { roomsImported, objectsImported, photosDetected, warningsCount, pendingReviewCount } = summary;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Import complete</h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
          The draft floor plan has been created from the scan package.
        </p>
      </div>

      {/* Summary counts */}
      <section style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#166534' }}>Import summary</h3>
        <table style={{ fontSize: 14, borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              ['Rooms imported',      roomsImported],
              ['Objects imported',    objectsImported],
              ['Photos detected',     photosDetected],
              ['Warnings',            warningsCount],
              ['Pending review',      pendingReviewCount],
            ].map(([label, value]) => (
              <tr key={String(label)}>
                <td style={{ color: '#6b7280', paddingRight: 20, paddingBottom: 6 }}>{label}</td>
                <td style={{ fontWeight: 600, paddingBottom: 6 }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Warnings carried forward */}
      {warnings.length > 0 && (
        <section style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#92400e' }}>
            Warnings carried forward ({warnings.length})
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f' }}>
            {warnings.map((w, i) => (
              <li key={i}>
                <code style={{ color: '#92400e' }}>{w.code}</code>
                {w.entityId && <code style={{ color: '#6b7280', marginLeft: 4 }}>[{w.entityId}]</code>}
                {' — '}{w.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pending review note */}
      {pendingReviewCount > 0 && (
        <section style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#0c4a6e' }}>
            <strong>{pendingReviewCount} {pendingReviewCount === 1 ? 'entity is' : 'entities are'} pending review.</strong>
            {' '}These items were imported from the scan and should be checked before the survey is finalised.
          </p>
        </section>
      )}

      <button
        onClick={onContinue}
        style={{
          padding: '10px 24px',
          fontSize: 14,
          fontWeight: 600,
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Continue to floor plan →
      </button>
    </div>
  );
}
