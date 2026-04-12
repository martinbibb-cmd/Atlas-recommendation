/**
 * PortalSpatialEvidenceSection.tsx
 *
 * Customer portal section showing 3D evidence captured during the survey.
 *
 * Displays:
 *   - Indoor room scan previews (image first, 3D model link on demand)
 *   - External flue-clearance scene previews with compliance summary
 *
 * UX rules:
 * - Preview image is the primary view — 3D model opened on demand only.
 * - Raw point clouds are never shown to customers.
 * - Compliance outcome is shown as a simple pass / warning summary.
 * - This section is hidden when no 3D evidence is available.
 */

import type { SpatialEvidence3D, ExternalClearanceSceneV1 } from '../../../contracts/spatial3dEvidence';

interface Props {
  spatialEvidence3d?: SpatialEvidence3D[];
  externalClearanceScenes?: ExternalClearanceSceneV1[];
}

// ─── Room scan card ───────────────────────────────────────────────────────────

function RoomScanCard({ scan }: { scan: SpatialEvidence3D }) {
  return (
    <div className="portal-spatial__card" data-testid="portal-room-scan-card">
      {scan.previewImageUrl ? (
        <img
          src={scan.previewImageUrl}
          alt="Indoor room scan preview"
          className="portal-spatial__preview-img"
        />
      ) : (
        <div className="portal-spatial__preview-placeholder">
          <span>🏠</span>
          <span>No preview available</span>
        </div>
      )}
      <div className="portal-spatial__card-body">
        <p className="portal-spatial__card-label">Indoor room scan</p>
        {scan.bounds && (
          <p className="portal-spatial__card-meta">
            {scan.bounds.widthM.toFixed(1)} m × {scan.bounds.lengthM.toFixed(1)} m
          </p>
        )}
        {scan.captureMeta?.timestamp && (
          <p className="portal-spatial__card-meta">
            Captured {new Date(scan.captureMeta.timestamp).toLocaleDateString()}
          </p>
        )}
        <a
          href={scan.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="portal-spatial__card-link"
          aria-label="Open 3D room scan model"
        >
          View 3D scan ↗
        </a>
      </div>
    </div>
  );
}

// ─── Flue clearance card ──────────────────────────────────────────────────────

function FlueClearanceCard({ scene }: { scene: ExternalClearanceSceneV1 }) {
  const pass    = scene.compliance?.pass;
  const passLabel = pass === true ? '✓ Clearances checked' : pass === false ? '⚠ Clearance review needed' : undefined;
  const passClass = pass === true ? 'portal-spatial__badge--pass' : pass === false ? 'portal-spatial__badge--fail' : '';

  return (
    <div className="portal-spatial__card" data-testid="portal-flue-clearance-card">
      {scene.evidence.previewImageUrl ? (
        <img
          src={scene.evidence.previewImageUrl}
          alt="Flue area preview"
          className="portal-spatial__preview-img"
        />
      ) : (
        <div className="portal-spatial__preview-placeholder">
          <span>🔩</span>
          <span>No preview available</span>
        </div>
      )}
      <div className="portal-spatial__card-body">
        <p className="portal-spatial__card-label">Flue clearance check</p>

        {passLabel && (
          <span className={`portal-spatial__badge ${passClass}`}>
            {passLabel}
          </span>
        )}

        {scene.compliance?.warnings && scene.compliance.warnings.length > 0 && (
          <ul className="portal-spatial__warnings">
            {scene.compliance.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {scene.measurements.length > 0 && (
          <p className="portal-spatial__card-meta">
            {scene.measurements.length} clearance measurement{scene.measurements.length !== 1 ? 's' : ''} recorded
          </p>
        )}

        {scene.evidence.modelUrl && (
          <a
            href={scene.evidence.modelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="portal-spatial__card-link"
            aria-label="Open flue clearance scene"
          >
            View clearance scene ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortalSpatialEvidenceSection({ spatialEvidence3d, externalClearanceScenes }: Props) {
  const hasRoomScans    = (spatialEvidence3d?.length ?? 0) > 0;
  const hasClearances   = (externalClearanceScenes?.length ?? 0) > 0;

  if (!hasRoomScans && !hasClearances) return null;

  return (
    <section
      className="portal-section portal-spatial"
      aria-labelledby="portal-spatial-heading"
      data-testid="portal-spatial-evidence-section"
    >
      <h2 className="portal-section__heading" id="portal-spatial-heading">
        Property evidence
      </h2>

      <p className="portal-spatial__intro">
        During the survey, our engineer captured 3D evidence of your home. This is used for visual
        reference and compliance checks — it does not affect the heating system recommendation.
      </p>

      <div className="portal-spatial__grid">
        {spatialEvidence3d?.map((scan) => (
          <RoomScanCard key={scan.id} scan={scan} />
        ))}
        {externalClearanceScenes?.map((scene) => (
          <FlueClearanceCard key={scene.id} scene={scene} />
        ))}
      </div>
    </section>
  );
}
