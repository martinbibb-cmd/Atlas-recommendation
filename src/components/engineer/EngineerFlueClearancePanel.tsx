/**
 * EngineerFlueClearancePanel.tsx
 *
 * Engineer-facing flue clearance card for external flue-clearance scenes.
 *
 * Shows:
 *   - Preview image of the flue area
 *   - Tagged nearby features with distances
 *   - Measured clearance distances
 *   - Pass / warning / fail compliance summary
 *
 * Rules:
 * - Compliance runs from structured measurements and tagged features only.
 * - Point cloud is optional evidence — never shown as the primary view.
 * - No raw point cloud parsing in this component.
 * - Reports use image snapshot and compliance summary, not an inline 3D viewer.
 */

import type { ExternalClearanceSceneV1, ClearanceFeature, ClearanceMeasurement } from '../../contracts/spatial3dEvidence';

interface Props {
  scenes: ExternalClearanceSceneV1[];
}

// ─── Feature type labels ──────────────────────────────────────────────────────

const FEATURE_LABELS: Record<ClearanceFeature['type'], string> = {
  window:         'Window',
  door:           'Door',
  air_brick:      'Air brick',
  boundary:       'Boundary',
  eaves:          'Eaves',
  gutter:         'Gutter',
  soil_stack:     'Soil stack',
  opening:        'Opening',
  adjacent_flue:  'Adjacent flue',
  balcony:        'Balcony',
};

const MEASUREMENT_KIND_LABELS: Record<ClearanceMeasurement['kind'], string> = {
  terminal_to_opening:  'Terminal → opening',
  terminal_to_boundary: 'Terminal → boundary',
  terminal_to_eaves:    'Terminal → eaves',
};

// ─── Compliance badge ─────────────────────────────────────────────────────────

function ComplianceBadge({ pass }: { pass?: boolean }) {
  if (pass === true) {
    return (
      <span style={{
        display: 'inline-block',
        fontSize: '0.72rem',
        fontWeight: 700,
        color: '#276749',
        background: '#f0fff4',
        border: '1px solid #9ae6b4',
        padding: '0.1rem 0.5rem',
        borderRadius: '999px',
      }}>
        ✓ Clearances pass
      </span>
    );
  }
  if (pass === false) {
    return (
      <span style={{
        display: 'inline-block',
        fontSize: '0.72rem',
        fontWeight: 700,
        color: '#9b2c2c',
        background: '#fff5f5',
        border: '1px solid #feb2b2',
        padding: '0.1rem 0.5rem',
        borderRadius: '999px',
      }}>
        ✗ Clearance issue — review required
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.72rem',
      fontWeight: 700,
      color: '#7b341e',
      background: '#fffaf0',
      border: '1px solid #fbd38d',
      padding: '0.1rem 0.5rem',
      borderRadius: '999px',
    }}>
      ⚠ Compliance not yet assessed
    </span>
  );
}

// ─── Single scene card ────────────────────────────────────────────────────────

function ClearanceSceneCard({ scene }: { scene: ExternalClearanceSceneV1 }) {
  return (
    <div style={{
      border: '1px solid #edf2f7',
      borderRadius: '6px',
      overflow: 'hidden',
      marginBottom: '0.75rem',
    }}>
      {/* Preview image */}
      {scene.evidence.previewImageUrl && (
        <div style={{ position: 'relative', background: '#f7fafc' }}>
          <img
            src={scene.evidence.previewImageUrl}
            alt="Flue area preview"
            style={{
              width: '100%',
              maxHeight: '200px',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      )}

      <div style={{ padding: '0.75rem 0.875rem' }}>
        {/* Compliance summary */}
        <div style={{ marginBottom: '0.6rem' }}>
          <ComplianceBadge pass={scene.compliance?.pass} />
        </div>

        {scene.compliance?.standardRef && (
          <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', color: '#718096' }}>
            Standard: {scene.compliance.standardRef}
          </p>
        )}

        {/* Warnings */}
        {scene.compliance?.warnings && scene.compliance.warnings.length > 0 && (
          <div style={{ marginBottom: '0.65rem' }}>
            {scene.compliance.warnings.map((w, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.35rem',
                marginBottom: '0.25rem',
                fontSize: '0.78rem',
                color: '#7b341e',
                background: '#fffaf0',
                border: '1px solid #fbd38d',
                borderRadius: '4px',
                padding: '0.3rem 0.5rem',
              }}>
                <span>⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Flue terminal info */}
        {scene.flueTerminal && (
          <div style={{ marginBottom: '0.65rem' }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', fontWeight: 600, color: '#2d3748' }}>
              Flue terminal
            </p>
            {scene.flueTerminal.heightAboveGroundM !== undefined && (
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#718096' }}>
                Height above ground: {scene.flueTerminal.heightAboveGroundM.toFixed(2)} m
              </p>
            )}
          </div>
        )}

        {/* Measured distances */}
        {scene.measurements.length > 0 && (
          <div style={{ marginBottom: '0.65rem' }}>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#2d3748' }}>
              Measured distances
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', paddingBottom: '0.2rem', color: '#718096', fontWeight: 600 }}>
                    Measurement
                  </th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.2rem', color: '#718096', fontWeight: 600 }}>
                    Distance
                  </th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.2rem', color: '#718096', fontWeight: 600 }}>
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {scene.measurements.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f7fafc' }}>
                    <td style={{ paddingTop: '0.3rem', color: '#4a5568' }}>
                      {MEASUREMENT_KIND_LABELS[m.kind] ?? m.kind}
                    </td>
                    <td style={{ paddingTop: '0.3rem', textAlign: 'right', fontWeight: 600, color: '#2d3748' }}>
                      {m.valueM.toFixed(2)} m
                    </td>
                    <td style={{ paddingTop: '0.3rem', textAlign: 'right', color: '#a0aec0', fontSize: '0.7rem' }}>
                      {m.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Nearby tagged features */}
        {scene.nearbyFeatures.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#2d3748' }}>
              Tagged nearby features
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {scene.nearbyFeatures.map((f) => (
                <span
                  key={f.id}
                  title={f.distanceToTerminalM !== undefined ? `${f.distanceToTerminalM.toFixed(2)} m from terminal` : f.notes}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.72rem',
                    background: '#edf2f7',
                    color: '#4a5568',
                    borderRadius: '4px',
                    padding: '0.15rem 0.45rem',
                  }}
                >
                  {FEATURE_LABELS[f.type] ?? f.type}
                  {f.distanceToTerminalM !== undefined && (
                    <span style={{ color: '#718096' }}>
                      {f.distanceToTerminalM.toFixed(2)} m
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Optional: open 3D scene or point cloud evidence */}
        {(scene.evidence.modelUrl || scene.evidence.pointCloudUrl) && (
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {scene.evidence.modelUrl && (
              <a
                href={scene.evidence.modelUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.75rem', color: '#3182ce', textDecoration: 'underline' }}
              >
                Open 3D scene ↗
              </a>
            )}
            {scene.evidence.pointCloudUrl && (
              <a
                href={scene.evidence.pointCloudUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.72rem', color: '#a0aec0', textDecoration: 'underline' }}
              >
                Raw point cloud (evidence) ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EngineerFlueClearancePanel({ scenes }: Props) {
  if (scenes.length === 0) return null;

  const hasFailure = scenes.some((s) => s.compliance?.pass === false);
  const hasWarning = scenes.some(
    (s) => s.compliance?.pass !== false && (s.compliance?.warnings?.length ?? 0) > 0,
  );

  const headerColor = hasFailure ? '#9b2c2c' : hasWarning ? '#7b341e' : '#276749';
  const headerBg    = hasFailure ? '#fff5f5' : hasWarning ? '#fffaf0' : '#f0fff4';

  return (
    <div
      data-testid="engineer-flue-clearance"
      style={{
        background: '#fff',
        border: `1px solid ${hasFailure ? '#feb2b2' : hasWarning ? '#fbd38d' : '#9ae6b4'}`,
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.85rem',
        background: headerBg,
        margin: '-1rem -1.25rem 0.85rem',
        padding: '0.6rem 1.25rem',
        borderRadius: '7px 7px 0 0',
      }}>
        <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: headerColor, flex: 1 }}>
          🔩 Flue Clearance Scenes
        </h2>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: headerColor,
          padding: '0.1rem 0.45rem',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.6)',
        }}>
          {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {scenes.map((scene) => (
        <ClearanceSceneCard key={scene.id} scene={scene} />
      ))}
    </div>
  );
}
