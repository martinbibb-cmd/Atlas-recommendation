/**
 * ScanEvidenceSummary.tsx
 *
 * Top-level engineer-facing viewer for a received SessionCaptureV2.
 *
 * Renders a structured view of all captured evidence with inline review controls:
 *   1. Session identity — session ID, device, address, capture/export timestamps
 *   2. Evidence counts summary
 *   3. Rooms
 *   4. Photos (with engineer review controls when visitId is provided)
 *   5. Voice note transcripts
 *   6. Object pins (with engineer review controls when visitId is provided)
 *   7. Pipe routes
 *   8. Point-cloud assets (floor-plan snapshots)
 *   9. QA flags
 *
 * Review mode
 * ───────────
 * When `visitId` is provided, each photo and object pin row shows
 * Confirm / Needs Review / Reject controls.  Decisions are persisted to
 * localStorage via useEvidenceReviewStore and survive browser restarts.
 * Confirmation does NOT alter engine recommendation logic.
 *
 * Constraints
 * ───────────
 * - Does not run recommendations or derive property attributes.
 * - Consumes raw SessionCaptureV2 — no upstream processing required.
 * - Rejected evidence is noted in the QA section but all items are shown
 *   (this is the engineer view, not the customer view).
 */

import { useState } from 'react';
import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import {
  selectEvidenceCounts,
  selectQaFlags,
  deriveSessionConfidence,
  getFabricEvidenceSummary,
  getHazardEvidenceSummary,
} from './scanEvidenceSelectors';
import { ScanRoomList } from './ScanRoomList';
import { ScanPhotoEvidenceGrid } from './ScanPhotoEvidenceGrid';
import { ScanTranscriptPanel } from './ScanTranscriptPanel';
import { ScanObjectPinList } from './ScanObjectPinList';
import { ScanPipeRouteList } from './ScanPipeRouteList';
import { ScanPointCloudAssetList } from './ScanPointCloudAssetList';
import { AnchorConfidenceBadge } from './AnchorConfidenceBadge';
import { ScanFabricEvidencePanel } from './ScanFabricEvidencePanel';
import { ScanHazardObservationPanel } from './ScanHazardObservationPanel';
import { useEvidenceReviewStore } from './useEvidenceReviewStore';
import type { EvidenceItemKind, EvidenceReviewStatus } from './EvidenceReviewDecisionV1';

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '0.82rem',
      fontWeight: 700,
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      margin: '0 0 0.6rem 0',
      paddingBottom: '0.3rem',
      borderBottom: '1px solid #e2e8f0',
    }}>
      {children}
    </h3>
  );
}

function Section({
  title,
  children,
  count,
}: {
  title: string;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <SectionHeader>{title}</SectionHeader>
        {count !== undefined && count > 0 && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#2b6cb0',
            background: '#ebf8ff',
            padding: '0.05rem 0.4rem',
            borderRadius: 10,
            border: '1px solid #bee3f8',
            marginBottom: '0.25rem',
          }}>
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      padding: '0.4rem 0.6rem',
      minWidth: 70,
    }}>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{value}</span>
      <span style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'center', marginTop: 1 }}>{label}</span>
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── QA flags ─────────────────────────────────────────────────────────────────

const QA_SEVERITY_STYLE: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  error: { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
  warn:  { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
  info:  { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
};

// ─── Main component ───────────────────────────────────────────────────────────

export interface ScanEvidenceSummaryProps {
  capture: SessionCaptureV2;
  /**
   * Visit identifier used to scope review decisions.
   * When provided, each object pin and photo row shows engineer review controls
   * (Confirm / Needs Review / Reject + optional note).
   * When omitted the component renders in read-only viewer mode.
   */
  visitId?: string;
}

export function ScanEvidenceSummary({ capture, visitId }: ScanEvidenceSummaryProps) {
  const counts = selectEvidenceCounts(capture);
  const qaFlags = selectQaFlags(capture);
  const sessionConfidence = deriveSessionConfidence(capture);
  const fabricRooms = getFabricEvidenceSummary(capture);
  const hazards = getHazardEvidenceSummary(capture);

  // Collapsible photo section (can be large)
  const [photosExpanded, setPhotosExpanded] = useState(false);

  // Review store — only active when visitId is provided.
  // We call the hook unconditionally (rules of hooks) but only use its
  // results when visitId is present.
  const reviewStore = useEvidenceReviewStore(visitId ?? '');
  const reviewEnabled = Boolean(visitId);

  function handleDecide(
    itemId: string,
    kind: EvidenceItemKind,
    status: EvidenceReviewStatus,
    note?: string,
  ) {
    if (!reviewEnabled) return;
    reviewStore.setDecision(itemId, kind, status, note);
  }

  function handleClear(itemId: string) {
    if (!reviewEnabled) return;
    reviewStore.clearDecision(itemId);
  }

  return (
    <div
      data-testid="scan-evidence-summary"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ── Panel header ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
      }}>
        <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
          🔍 Scan Evidence
        </h2>
        <AnchorConfidenceBadge tier={sessionConfidence} />
      </div>

      {/* ── 1. Session identity ───────────────────────────────────────────── */}
      <Section title="Session">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: '#64748b', minWidth: 110, flexShrink: 0 }}>Session ID</span>
            <code style={{ color: '#1e293b', fontSize: '0.78rem' }}>{capture.sessionId}</code>
          </div>
          {capture.visitReference && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ color: '#64748b', minWidth: 110, flexShrink: 0 }}>Visit ref</span>
              <code style={{ color: '#1e293b', fontSize: '0.78rem' }}>{capture.visitReference}</code>
            </div>
          )}
          {capture.property?.address && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ color: '#64748b', minWidth: 110, flexShrink: 0 }}>Address</span>
              <span style={{ color: '#1e293b' }}>
                {[capture.property.address, capture.property.postcode]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: '#64748b', minWidth: 110, flexShrink: 0 }}>Device</span>
            <span style={{ color: '#1e293b' }}>{capture.deviceModel}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: '#64748b', minWidth: 110, flexShrink: 0 }}>Captured</span>
            <span style={{ color: '#1e293b' }}>{formatDateTime(capture.capturedAt)}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: '#64748b', minWidth: 110, flexShrink: 0 }}>Exported</span>
            <span style={{ color: '#1e293b' }}>{formatDateTime(capture.exportedAt)}</span>
          </div>
        </div>
      </Section>

      {/* ── 2. Evidence counts ────────────────────────────────────────────── */}
      <Section title="Evidence counts">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <CountChip label="Rooms" value={counts.rooms} />
          <CountChip label="Photos" value={counts.photos} />
          <CountChip label="Transcripts" value={counts.transcripts} />
          <CountChip label="Object pins" value={counts.objectPins} />
          <CountChip label="Pipe routes" value={counts.pipeRoutes} />
          <CountChip label="Point-cloud" value={counts.pointCloudAssets} />
          {fabricRooms.length > 0 && (
            <CountChip label="Fabric rooms" value={fabricRooms.length} />
          )}
          {hazards.length > 0 && (
            <CountChip label="Hazards" value={hazards.length} />
          )}
          {counts.qaFlags > 0 && (
            <CountChip label="QA flags" value={counts.qaFlags} />
          )}
        </div>
      </Section>

      {/* ── 3. Rooms ──────────────────────────────────────────────────────── */}
      <Section title="Rooms" count={counts.rooms}>
        <ScanRoomList capture={capture} />
      </Section>

      {/* ── 4. Photos ─────────────────────────────────────────────────────── */}
      <Section title="Photos" count={counts.photos}>
        {counts.photos === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
            No photos captured.
          </p>
        ) : photosExpanded ? (
          <>
            <button
              onClick={() => setPhotosExpanded(false)}
              style={{
                display: 'block',
                marginBottom: '0.6rem',
                fontSize: '0.75rem',
                color: '#2b6cb0',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Collapse photos
            </button>
            <ScanPhotoEvidenceGrid
              capture={capture}
              reviewDecisions={reviewEnabled ? reviewStore.decisions : undefined}
              onDecide={reviewEnabled ? (id, _kind, status, note) => handleDecide(id, 'photo', status, note) : undefined}
              onClear={reviewEnabled ? handleClear : undefined}
            />
          </>
        ) : (
          <button
            onClick={() => setPhotosExpanded(true)}
            style={{
              fontSize: '0.78rem',
              color: '#2b6cb0',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 5,
              padding: '0.3rem 0.75rem',
              cursor: 'pointer',
            }}
          >
            Show {counts.photos} photo{counts.photos !== 1 ? 's' : ''}
          </button>
        )}
      </Section>

      {/* ── 5. Transcripts ────────────────────────────────────────────────── */}
      <Section title="Voice note transcripts" count={counts.transcripts}>
        <ScanTranscriptPanel capture={capture} />
      </Section>

      {/* ── 6. Object pins ────────────────────────────────────────────────── */}
      <Section title="Object pins" count={counts.objectPins}>
        <ScanObjectPinList
          capture={capture}
          reviewDecisions={reviewEnabled ? reviewStore.decisions : undefined}
          onDecide={reviewEnabled ? (id, _kind, status, note) => handleDecide(id, 'object_pin', status, note) : undefined}
          onClear={reviewEnabled ? handleClear : undefined}
        />
      </Section>

      {/* ── 7. Pipe routes ────────────────────────────────────────────────── */}
      <Section title="Pipe routes" count={counts.pipeRoutes}>
        <ScanPipeRouteList capture={capture} />
      </Section>

      {/* ── 8. Point-cloud assets ─────────────────────────────────────────── */}
      <Section title="Point-cloud assets" count={counts.pointCloudAssets}>
        <ScanPointCloudAssetList capture={capture} />
      </Section>

      {/* ── 9. Fabric evidence (engineer only) ───────────────────────────── */}
      {fabricRooms.length > 0 && (
        <Section title="Fabric evidence (engineer)" count={fabricRooms.length}>
          <ScanFabricEvidencePanel capture={capture} />
        </Section>
      )}

      {/* ── 10. Hazard observations (engineer only) ───────────────────────── */}
      {hazards.length > 0 && (
        <Section title="Hazard observations (engineer)" count={hazards.length}>
          <ScanHazardObservationPanel capture={capture} />
        </Section>
      )}

      {/* ── 11. QA flags ─────────────────────────────────────────────────── */}
      {qaFlags.length > 0 && (
        <Section title="QA flags" count={qaFlags.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {qaFlags.map((flag, i) => {
              const style = QA_SEVERITY_STYLE[flag.severity] ?? QA_SEVERITY_STYLE['info'];
              const flagKey = `${flag.code}-${flag.severity}-${flag.entityId ?? i}`;
              return (
                <div
                  key={flagKey}
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'flex-start',
                    background: style.bg,
                    border: `1px solid ${style.border}`,
                    borderRadius: 5,
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.8rem',
                    color: style.color,
                  }}
                >
                  <span style={{ fontWeight: 700, textTransform: 'uppercase', minWidth: 36, flexShrink: 0 }}>
                    {flag.severity}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, flexShrink: 0 }}>
                    {flag.code}
                  </span>
                  {flag.message && (
                    <span style={{ flex: 1 }}>{flag.message}</span>
                  )}
                  {flag.entityId && (
                    <span style={{ fontSize: '0.68rem', opacity: 0.7, marginLeft: 'auto', flexShrink: 0 }}>
                      entity: {flag.entityId}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
