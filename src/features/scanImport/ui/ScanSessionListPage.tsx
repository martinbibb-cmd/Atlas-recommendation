/**
 * ScanSessionListPage.tsx
 *
 * Lists all scan sessions available to the engineer.
 *
 * Data strategy (offline-first):
 *   1. Render IDB-cached sessions immediately.
 *   2. Fetch from /api/scan-sessions in the background; merge into the list.
 *
 * Each row shows:
 *   - Property address
 *   - Scan date
 *   - Review state badge (colour coded)
 *   - Sync state badge (synced / local only / failed)
 *
 * Grouped by visit (visit_id) when available; ungrouped sessions are shown
 * under "Unassigned sessions".
 */

import { useState, useEffect } from 'react';
import { listSessions } from '../../../lib/storage/scanSessionStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemoteSession {
  id: string;
  job_reference: string;
  property_address: string;
  created_at: string;
  updated_at: string;
  scan_state: string;
  review_state: string;
  sync_state: string;
  visit_id: string | null;
}

interface SessionEntry {
  id: string;
  jobReference: string;
  propertyAddress: string;
  updatedAt: string;
  reviewState: string;
  syncState: string;
  visitId: string | null;
  source: 'local' | 'remote';
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const REVIEW_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  scanned:             { bg: '#1e293b', text: '#94a3b8', label: 'Scanned' },
  reviewed:            { bg: '#14532d', text: '#86efac', label: 'Reviewed' },
  needs_attention:     { bg: '#7f1d1d', text: '#fca5a5', label: 'Needs attention' },
  blocked_incomplete:  { bg: '#451a03', text: '#fcd34d', label: 'Incomplete' },
};

const SYNC_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  local_only:      { bg: '#1c1917', text: '#a16207', label: 'Local only' },
  queued_for_atlas:{ bg: '#1c1917', text: '#f59e0b', label: 'Pending upload' },
  syncing:         { bg: '#1e3a5f', text: '#60a5fa', label: 'Syncing…' },
  uploaded:        { bg: '#14532d', text: '#86efac', label: 'Synced' },
  failed_upload:   { bg: '#7f1d1d', text: '#fca5a5', label: 'Upload failed' },
  archived_remote: { bg: '#1e293b', text: '#64748b', label: 'Archived' },
};

function Badge({ state, map }: { state: string; map: typeof REVIEW_BADGE }) {
  const s = map[state] ?? { bg: '#1e293b', text: '#94a3b8', label: state };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.text,
    }}>
      {s.label}
    </span>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

interface SessionRowProps {
  entry: SessionEntry;
  onClick: () => void;
}

function SessionRow({ entry, onClick }: SessionRowProps) {
  const date = (() => {
    try {
      return new Date(entry.updatedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {
      return entry.updatedAt;
    }
  })();

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: '1px solid #1e293b',
        cursor: 'pointer',
        background: 'transparent',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.07)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.propertyAddress}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
          {date} · {entry.jobReference}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <Badge state={entry.reviewState} map={REVIEW_BADGE} />
        <Badge state={entry.syncState} map={SYNC_BADGE} />
      </div>
      <span style={{ color: '#475569', fontSize: 16 }}>›</span>
    </div>
  );
}

// ─── Group component ──────────────────────────────────────────────────────────

interface GroupProps {
  title: string;
  entries: SessionEntry[];
  onSelect: (id: string) => void;
}

function Group({ title, entries, onSelect }: GroupProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        padding: '6px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: '#475569', background: '#0f172a',
        borderBottom: '1px solid #1e293b',
      }}>
        {title}
      </div>
      {entries.map(e => (
        <SessionRow key={e.id} entry={e} onClick={() => onSelect(e.id)} />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export interface ScanSessionListPageProps {
  onBack: () => void;
  /** Called when the engineer selects a session to open in the editor. */
  onOpenSession: (sessionId: string) => void;
}

export default function ScanSessionListPage({ onBack, onOpenSession }: ScanSessionListPageProps) {
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLocal() {
      const stored = await listSessions();
      if (cancelled) return;
      const localEntries: SessionEntry[] = stored.map(s => ({
        id: s.id,
        jobReference: s.jobReference,
        propertyAddress: s.propertyAddress,
        updatedAt: s.updatedAt,
        reviewState: s.reviewState,
        syncState: s.syncState,
        visitId: null,
        source: 'local',
      }));
      setEntries(localEntries);
      setLoading(false);
    }

    async function loadRemote() {
      try {
        const res = await fetch('/api/scan-sessions');
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = (await res.json()) as { ok: boolean; sessions?: RemoteSession[] };
        if (!data.ok || !data.sessions) return;
        if (cancelled) return;

        // Merge remote sessions: remote wins if the id already exists locally,
        // because the remote reflects the latest persisted server state.
        setEntries(prev => {
          const localIds = new Set(prev.map(e => e.id));
          const remoteOnly = data.sessions!
            .filter(r => !localIds.has(r.id))
            .map((r): SessionEntry => ({
              id: r.id,
              jobReference: r.job_reference,
              propertyAddress: r.property_address,
              updatedAt: r.updated_at,
              reviewState: r.review_state,
              syncState: r.sync_state,
              visitId: r.visit_id,
              source: 'remote',
            }));

          // Update local entries that have a matching remote record.
          const updated = prev.map(e => {
            const remote = data.sessions!.find(r => r.id === e.id);
            if (!remote) return e;
            return {
              ...e,
              reviewState: remote.review_state,
              syncState: remote.sync_state,
              visitId: remote.visit_id,
              source: 'remote' as const,
            };
          });

          return [...updated, ...remoteOnly].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
        });
      } catch (err) {
        if (!cancelled) {
          setRemoteError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void loadLocal().then(() => loadRemote());
    return () => { cancelled = true; };
  }, []);

  // ── Group by visitId ──────────────────────────────────────────────────────
  const grouped = new Map<string | null, SessionEntry[]>();
  for (const entry of entries) {
    const key = entry.visitId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(entry);
  }

  const pageStyle: React.CSSProperties = {
    background: '#0f1117',
    minHeight: '100dvh',
    color: '#e5e7eb',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', borderBottom: '1px solid #1e293b',
    background: '#0f1117', flexShrink: 0,
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <button
          onClick={onBack}
          style={{ padding: '4px 12px', fontSize: 13, background: 'rgba(255,255,255,0.08)', color: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>My Scans</h1>
        {loading && (
          <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>Loading…</span>
        )}
      </div>

      {remoteError && (
        <div style={{ padding: '8px 16px', background: '#450a0a', fontSize: 12, color: '#fca5a5', borderBottom: '1px solid #7f1d1d' }}>
          Could not load remote sessions: {remoteError}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!loading && entries.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#475569' }}>
            <p style={{ margin: 0, fontSize: 15 }}>No scan sessions yet.</p>
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>
              Share a scan from the Atlas Scans iOS app to get started.
            </p>
          </div>
        )}

        {/* Ungrouped (no visitId) */}
        {grouped.has(null) && (
          <Group
            title="Unassigned sessions"
            entries={grouped.get(null)!}
            onSelect={onOpenSession}
          />
        )}

        {/* Grouped by visitId */}
        {[...grouped.entries()]
          .filter(([k]) => k !== null)
          .map(([visitId, groupEntries]) => (
            <Group
              key={visitId}
              title={`Visit: ${visitId}`}
              entries={groupEntries}
              onSelect={onOpenSession}
            />
          ))}
      </div>
    </div>
  );
}
