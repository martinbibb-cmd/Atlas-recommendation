/**
 * WorkspaceDetailPage.tsx
 *
 * Detail view for a single VisitWorkspaceV1 record.
 *
 * Route: /workspace/:id
 *
 * Sections:
 *   - Visit summary (reference, address, dates, device)
 *   - Captured rooms
 *   - Photos
 *   - Object pins
 *   - Floor plans
 *   - Notes / transcripts
 *   - QA warnings
 *   - Review decisions summary
 *
 * Action buttons:
 *   - Review captured evidence (opens CaptureEvidenceReviewScreen)
 *   - Generate engineer handoff
 *   - Generate customer proof (excludes pending/rejected evidence)
 *   - Export visit pack
 *   - Publish to Atlas — disabled with "Coming later" badge
 *
 * Architecture rules:
 *   - Never writes to the remote D1 database.
 *   - All data comes from VisitWorkspaceStore (IndexedDB).
 *   - Customer proof output only includes confirmed + includeInCustomerReport items.
 */

import { useState, useEffect } from 'react';
import type {
  VisitWorkspaceV1,
  VisitWorkspaceReviewDecision,
} from '../../lib/visitWorkspace/VisitWorkspaceV1';
import { visitWorkspaceStore } from '../../lib/visitWorkspace/VisitWorkspaceStore';
import { buildCaptureReviewModel } from '../scanImport/importer/captureReviewModel';
import type { CaptureReviewModel } from '../scanImport/importer/captureReviewModel';
import CaptureEvidenceReviewScreen from '../scanImport/ui/CaptureEvidenceReviewScreen';

// ─── Status / storage helpers ─────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  needs_review:     '⚠ Needs review',
  ready_for_report: '✓ Ready for report',
  published:        '✅ Published',
};

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  needs_review:     { bg: '#fffbeb', color: '#a16207', border: '#fcd34d' },
  ready_for_report: { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  published:        { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' },
};

const STORAGE_LABELS: Record<string, string> = {
  local: '💾 Local only',
  drive: '☁️ Drive saved',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatObjectType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ label, style }: { label: string; style: { bg: string; color: string; border: string } }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 12,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
        {count !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#64748b', padding: '1px 7px', borderRadius: 10 }}>
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

// ─── Customer proof builder ───────────────────────────────────────────────────

/**
 * Build a customer-facing proof from the workspace.
 *
 * Only includes evidence that is:
 *   - status is 'confirmed' (not pending or rejected)
 *   - includeInCustomerReport is true
 *
 * Returns a plain-text summary suitable for export / display.
 */
function buildCustomerProof(workspace: VisitWorkspaceV1): string {
  const decisions = new Map<string, VisitWorkspaceReviewDecision>(
    workspace.reviewDecisions.map((d) => [d.ref, d]),
  );

  const confirmedPhotos = workspace.sessionCapture.photos.filter((p) => {
    const d = decisions.get(p.photoId);
    return (
      (d?.reviewStatus ?? 'confirmed') === 'confirmed' &&
      (d?.includeInCustomerReport ?? (p.scope !== 'object'))
    );
  });

  const confirmedFloorPlans = workspace.sessionCapture.floorPlanSnapshots.filter((s) => {
    const d = decisions.get(s.snapshotId);
    return (
      (d?.reviewStatus ?? 'confirmed') === 'confirmed' &&
      (d?.includeInCustomerReport ?? true)
    );
  });

  const lines: string[] = [
    `Visit Workspace — Customer Proof`,
    `Reference: ${workspace.visitReference}`,
    workspace.property?.address ? `Address: ${workspace.property.address}` : null,
    workspace.property?.postcode ? `Postcode: ${workspace.property.postcode}` : null,
    `Captured: ${formatDate(workspace.capturedAt)}`,
    '',
    `Rooms: ${workspace.sessionCapture.roomScans.length}`,
    ...workspace.sessionCapture.roomScans.map((r) => `  • ${r.label}`),
    '',
    `Customer-approved photos: ${confirmedPhotos.length}`,
    `Customer-approved floor plans: ${confirmedFloorPlans.length}`,
  ].filter((l): l is string => l !== null);

  return lines.join('\n');
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WorkspaceDetailPageProps {
  workspaceId: string;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkspaceDetailPage({
  workspaceId,
  onBack,
}: WorkspaceDetailPageProps) {
  const [workspace, setWorkspace] = useState<VisitWorkspaceV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'detail' | 'evidence_review' | 'customer_proof' | 'engineer_handoff'>('detail');
  const [reviewModel, setReviewModel] = useState<CaptureReviewModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    visitWorkspaceStore.getWorkspace(workspaceId).then((ws) => {
      if (!cancelled) { setWorkspace(ws); setLoading(false); }
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load workspace');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [workspaceId]);

  if (loading) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading workspace…</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <button onClick={onBack} style={{ fontSize: 13, marginBottom: 16, padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
          ← Back
        </button>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '16px 20px', color: '#b91c1c', fontSize: 14 }}>
          {error ?? 'Workspace not found.'}
        </div>
      </div>
    );
  }

  // ── Evidence review mode ─────────────────────────────────────────────────
  if (mode === 'evidence_review' && reviewModel !== null) {
    return (
      <CaptureEvidenceReviewScreen
        initialModel={reviewModel}
        onConfirm={(confirmedModel) => {
          // Translate confirmed model back to review decisions and save.
          const decisions: VisitWorkspaceReviewDecision[] = [
            ...confirmedModel.photos.map((p) => ({
              ref: p.photoId,
              kind: 'photo' as const,
              reviewStatus: p.reviewStatus,
              includeInCustomerReport: p.includeInCustomerReport,
            })),
            ...confirmedModel.objectPins.map((pin) => ({
              ref: pin.pinId,
              kind: 'object_pin' as const,
              reviewStatus: pin.reviewStatus,
              includeInCustomerReport: false,
            })),
            ...confirmedModel.floorPlanSnapshots.map((s) => ({
              ref: s.snapshotId,
              kind: 'floor_plan_snapshot' as const,
              reviewStatus: s.reviewStatus,
              includeInCustomerReport: s.includeInCustomerReport,
            })),
          ];
          visitWorkspaceStore.saveReviewDecisions(workspaceId, decisions).then(() => {
            return visitWorkspaceStore.getWorkspace(workspaceId);
          }).then((updated) => {
            setWorkspace(updated);
            setMode('detail');
          }).catch(() => {
            setMode('detail');
          });
        }}
        onCancel={() => setMode('detail')}
      />
    );
  }

  // ── Customer proof mode ──────────────────────────────────────────────────
  if (mode === 'customer_proof') {
    const proof = buildCustomerProof(workspace);
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <button onClick={() => setMode('detail')} style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Customer Proof</h1>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          Only confirmed evidence with "Include in customer report" is shown below.
          Pending and rejected items are excluded.
        </p>
        <pre
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 20px',
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {proof}
        </pre>
        <button
          onClick={() => {
            const blob = new Blob([proof], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `customer-proof-${workspace.visitReference}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{ marginTop: 16, padding: '8px 20px', fontSize: 14, fontWeight: 600, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Download proof
        </button>
      </div>
    );
  }

  // ── Engineer handoff mode ─────────────────────────────────────────────────
  if (mode === 'engineer_handoff') {
    const capture = workspace.sessionCapture;
    const lines = [
      `Engineer Handoff — ${workspace.visitReference}`,
      workspace.property?.address ? `Address: ${workspace.property.address}` : null,
      workspace.property?.postcode ? `Postcode: ${workspace.property.postcode}` : null,
      `Captured: ${formatDate(workspace.capturedAt)}`,
      `Device: ${capture.deviceModel}`,
      '',
      'ROOMS:',
      ...capture.roomScans.map((r) => `  ${r.label} (Floor ${r.floorIndex ?? 0}, ${r.areaM2 != null ? `${r.areaM2} m²` : 'area unknown'})`),
      '',
      'OBJECT PINS:',
      ...capture.objectPins.map((p) => `  [${formatObjectType(p.objectType)}] ${p.label ?? p.pinId}`),
      '',
      'QA FLAGS:',
      ...(capture.qaFlags.length > 0
        ? capture.qaFlags.map((f) => `  [${f.severity.toUpperCase()}] ${f.code}${f.message ? ` — ${f.message}` : ''}`)
        : ['  No QA flags']),
    ].filter((l): l is string => l !== null);

    const text = lines.join('\n');
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <button onClick={() => setMode('detail')} style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Engineer Handoff</h1>
        </div>
        <pre
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 20px',
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </pre>
        <button
          onClick={() => {
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `engineer-handoff-${workspace.visitReference}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{ marginTop: 16, padding: '8px 20px', fontSize: 14, fontWeight: 600, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Download handoff
        </button>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────────
  const capture = workspace.sessionCapture;
  const qaErrors = capture.qaFlags.filter((f) => f.severity === 'error');
  const qaWarns = capture.qaFlags.filter((f) => f.severity === 'warn');

  const pageStyle: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
  };

  const headerStyle: React.CSSProperties = {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  };

  const bodyStyle: React.CSSProperties = {
    maxWidth: 680,
    margin: '0 auto',
    padding: '24px 20px',
  };

  const actionBtnStyle: React.CSSProperties = {
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <button
          onClick={onBack}
          style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
        >
          ← Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{workspace.visitReference}</h1>
            <Badge
              label={STATUS_LABELS[workspace.status] ?? workspace.status}
              style={STATUS_COLORS[workspace.status] ?? { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }}
            />
            <Badge
              label={STORAGE_LABELS[workspace.storageType] ?? workspace.storageType}
              style={{ bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }}
            />
          </div>
          {workspace.property?.address && (
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{workspace.property.address}{workspace.property.postcode ? `, ${workspace.property.postcode}` : ''}</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={bodyStyle}>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <button
            style={{ ...actionBtnStyle, background: '#4f46e5', color: '#fff' }}
            onClick={() => {
              const model = buildCaptureReviewModel(capture);
              setReviewModel(model);
              setMode('evidence_review');
            }}
          >
            🔍 Review captured evidence
          </button>
          <button
            style={{ ...actionBtnStyle, background: '#0f172a', color: '#fff' }}
            onClick={() => setMode('engineer_handoff')}
          >
            🛠 Generate engineer handoff
          </button>
          <button
            style={{ ...actionBtnStyle, background: '#047857', color: '#fff' }}
            onClick={() => setMode('customer_proof')}
          >
            📄 Generate customer proof
          </button>
          <button
            style={{ ...actionBtnStyle, background: '#374151', color: '#fff' }}
            onClick={() => {
              const data = JSON.stringify(workspace, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `workspace-${workspace.visitReference}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            📦 Export visit pack
          </button>
          {/* Publish — disabled with Coming later badge */}
          <button
            disabled
            title="Cloud publish is not yet available"
            style={{ ...actionBtnStyle, background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' }}
          >
            🌐 Publish to Atlas
            <span style={{ marginLeft: 6, fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>
              Coming later
            </span>
          </button>
        </div>

        {/* Visit summary */}
        <SectionCard title="Visit summary">
          <table style={{ fontSize: 13, borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {[
                ['Visit reference', workspace.visitReference],
                ['Session ID', capture.sessionId],
                ['Captured', formatDate(capture.capturedAt)],
                ['Exported', formatDate(capture.exportedAt)],
                ['Imported', formatDate(workspace.importedAt)],
                ['Device', capture.deviceModel],
                workspace.property?.address ? ['Address', workspace.property.address] : null,
                workspace.property?.postcode ? ['Postcode', workspace.property.postcode] : null,
              ].filter(Boolean).map(([label, value]) => (
                <tr key={String(label)}>
                  <td style={{ color: '#6b7280', paddingRight: 20, paddingBottom: 6, width: '35%' }}>{label}</td>
                  <td style={{ paddingBottom: 6 }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        {/* Captured rooms */}
        <SectionCard title="Captured rooms" count={capture.roomScans.length}>
          {capture.roomScans.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No rooms recorded.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {capture.roomScans.map((r) => (
                <li key={r.roomId} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>{r.label}</span>
                  <span style={{ color: '#94a3b8' }}>
                    Floor {r.floorIndex ?? 0}
                    {r.areaM2 != null ? ` · ${r.areaM2} m²` : ''}
                    {' '}
                    <span style={{ color: r.status === 'complete' ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                      {r.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Photos */}
        <SectionCard title="Photos" count={capture.photos.length}>
          {capture.photos.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No photos captured.</p>
          ) : (
            <div style={{ fontSize: 13, color: '#374151' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                {['session', 'room', 'object'].map((scope) => {
                  const n = capture.photos.filter((p) => p.scope === scope).length;
                  return n > 0 ? (
                    <div key={scope}>
                      <span style={{ fontWeight: 600 }}>{n}</span>{' '}
                      <span style={{ color: '#64748b' }}>{scope}-scope</span>
                    </div>
                  ) : null;
                })}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
                Session and room-scope photos are customer-safe. Object-scope photos are engineer-only.
              </p>
            </div>
          )}
        </SectionCard>

        {/* Object pins */}
        <SectionCard title="Object pins" count={capture.objectPins.length}>
          {capture.objectPins.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No object pins recorded.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {capture.objectPins.map((pin) => (
                <li key={pin.pinId} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>{pin.label ?? formatObjectType(pin.objectType)}</span>
                  <span style={{ color: '#94a3b8' }}>{formatObjectType(pin.objectType)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Floor plans */}
        <SectionCard title="Floor plans" count={capture.floorPlanSnapshots.length}>
          {capture.floorPlanSnapshots.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No floor plan snapshots.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {capture.floorPlanSnapshots.map((s) => (
                <li key={s.snapshotId} style={{ fontSize: 13 }}>
                  Floor {s.floorIndex ?? 0} · {formatDate(s.capturedAt)}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Notes / transcripts */}
        <SectionCard title="Notes / transcripts" count={capture.voiceNotes.length}>
          {capture.voiceNotes.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No voice notes.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {capture.voiceNotes.map((vn) => (
                <li key={vn.voiceNoteId} style={{ fontSize: 13 }}>
                  <div style={{ color: '#64748b', marginBottom: 2, fontSize: 11 }}>
                    {vn.voiceNoteId}{vn.roomId ? ` · ${vn.roomId}` : ''}
                  </div>
                  {vn.transcript ? (
                    <p style={{ margin: 0, color: '#374151', fontStyle: 'italic' }}>&ldquo;{vn.transcript}&rdquo;</p>
                  ) : (
                    <p style={{ margin: 0, color: '#94a3b8' }}>No transcript</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* QA warnings */}
        {capture.qaFlags.length > 0 && (
          <SectionCard title="QA warnings" count={capture.qaFlags.length}>
            {qaErrors.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 10 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>
                  Errors ({qaErrors.length})
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#991b1b' }}>
                  {qaErrors.map((f, i) => (
                    <li key={i}><strong>{f.code}</strong>{f.message ? ` — ${f.message}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            {qaWarns.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '10px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#a16207' }}>
                  Warnings ({qaWarns.length})
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#78350f' }}>
                  {qaWarns.map((f, i) => (
                    <li key={i}><strong>{f.code}</strong>{f.message ? ` — ${f.message}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>
        )}

        {/* Review decisions summary */}
        {workspace.reviewDecisions.length > 0 && (
          <SectionCard title="Review decisions">
            {(() => {
              const confirmed = workspace.reviewDecisions.filter(d => d.reviewStatus === 'confirmed').length;
              const pending   = workspace.reviewDecisions.filter(d => d.reviewStatus === 'pending').length;
              const rejected  = workspace.reviewDecisions.filter(d => d.reviewStatus === 'rejected').length;
              return (
                <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                  <div><span style={{ fontWeight: 700, color: '#16a34a' }}>{confirmed}</span> confirmed</div>
                  {pending > 0 && <div><span style={{ fontWeight: 700, color: '#a16207' }}>{pending}</span> pending</div>}
                  {rejected > 0 && <div><span style={{ fontWeight: 700, color: '#b91c1c' }}>{rejected}</span> rejected</div>}
                </div>
              );
            })()}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
