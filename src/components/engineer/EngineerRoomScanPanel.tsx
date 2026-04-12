/**
 * EngineerRoomScanPanel.tsx
 *
 * Engineer-facing panel for internal room scan evidence (RoomPlan / LiDAR).
 *
 * Shows preview images and scan metadata for each captured indoor room scan.
 * The 3D model is not loaded inline — a link/button opens it on demand so that
 * heavy assets do not slow the pre-install page load.
 *
 * Rules:
 * - No derived maths from scan assets.
 * - Preview image shown first; 3D viewer opened on demand.
 * - Never mutates AtlasRoomV1 from scan geometry.
 */

import type { SpatialEvidence3D } from '../../contracts/spatial3dEvidence';

interface Props {
  scans: SpatialEvidence3D[];
}

const FORMAT_LABELS: Record<SpatialEvidence3D['format'], string> = {
  usdz:       'USDZ (RealityKit)',
  glb:        'GLB',
  realitykit: 'RealityKit',
};

export function EngineerRoomScanPanel({ scans }: Props) {
  if (scans.length === 0) return null;

  return (
    <div
      data-testid="engineer-room-scans"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#2d3748', flex: 1 }}>
          🏠 Indoor Room Scans
        </h2>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: '#2b6cb0',
          background: '#ebf8ff',
          padding: '0.1rem 0.45rem',
          borderRadius: '999px',
        }}>
          {scans.length} scan{scans.length !== 1 ? 's' : ''}
        </span>
      </div>

      <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: '#718096' }}>
        Indoor room capture evidence only — not used for heat-loss calculations.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {scans.map((scan) => (
          <div
            key={scan.id}
            style={{
              border: '1px solid #edf2f7',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            {scan.previewImageUrl && (
              <div style={{ position: 'relative', background: '#f7fafc' }}>
                <img
                  src={scan.previewImageUrl}
                  alt="Room scan preview"
                  style={{
                    width: '100%',
                    maxHeight: '180px',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
            )}

            <div style={{ padding: '0.6rem 0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2d3748' }}>
                  {FORMAT_LABELS[scan.format] ?? scan.format}
                </span>
                {scan.captureMeta?.timestamp && (
                  <span style={{ fontSize: '0.72rem', color: '#a0aec0' }}>
                    {new Date(scan.captureMeta.timestamp).toLocaleDateString()}
                  </span>
                )}
              </div>

              {(scan.bounds) && (
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: '#718096' }}>
                  {scan.bounds.widthM.toFixed(1)} m × {scan.bounds.lengthM.toFixed(1)} m ×{' '}
                  {scan.bounds.heightM.toFixed(1)} m
                </p>
              )}

              {scan.linkedRoomIds && scan.linkedRoomIds.length > 0 && (
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', color: '#718096' }}>
                  Linked rooms: {scan.linkedRoomIds.join(', ')}
                </p>
              )}

              {scan.captureMeta?.device && (
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', color: '#a0aec0' }}>
                  Device: {scan.captureMeta.device}
                </p>
              )}

              <a
                href={scan.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '0.35rem',
                  fontSize: '0.75rem',
                  color: '#3182ce',
                  textDecoration: 'underline',
                }}
              >
                Open 3D model ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
