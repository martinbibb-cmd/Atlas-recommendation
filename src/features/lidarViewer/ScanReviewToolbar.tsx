/**
 * ScanReviewToolbar.tsx
 *
 * Top toolbar for the 3D room-scan editor.
 *
 * Controls:
 *   • Approve   — sets reviewState to 'reviewed' and syncs to server
 *   • Reject    — sets reviewState to 'needs_attention'
 *   • Export    — calls syncToServer() to push the session and assets
 *   • Transcript toggle — opens/closes the voice-note transcript panel
 */

import { useState } from 'react';
import type { SessionReviewState } from '../scanImport/session/propertyScanSession';

export interface ScanReviewToolbarProps {
  fileName: string;
  reviewState: SessionReviewState;
  syncState: string;
  transcriptOpen: boolean;
  onApprove: () => void;
  onReject: () => void;
  onExport: () => Promise<void>;
  onToggleTranscript: () => void;
  onDone: () => void;
}

export default function ScanReviewToolbar({
  fileName,
  reviewState,
  syncState,
  transcriptOpen,
  onApprove,
  onReject,
  onExport,
  onToggleTranscript,
  onDone,
}: ScanReviewToolbarProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  }

  const syncBadgeColour: Record<string, string> = {
    local_only:      '#f59e0b',
    queued_for_atlas:'#f59e0b',
    syncing:         '#3b82f6',
    uploaded:        '#22c55e',
    failed_upload:   '#ef4444',
    archived_remote: '#6b7280',
  };

  const reviewBadgeColour: Record<SessionReviewState, string> = {
    scanned:             '#6b7280',
    reviewed:            '#22c55e',
    needs_attention:     '#ef4444',
    blocked_incomplete:  '#f59e0b',
  };

  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: '#0f1117',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
    flexWrap: 'wrap',
  };

  const btnBase: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  };

  return (
    <div style={toolbarStyle}>
      {/* Back */}
      <button
        onClick={onDone}
        style={{ ...btnBase, background: 'rgba(255,255,255,0.08)', color: '#e5e7eb', fontWeight: 400 }}
      >
        ← Done
      </button>

      {/* File name */}
      <span style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginRight: 4 }}>
        {fileName}
      </span>

      {/* Review state badge */}
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
        background: reviewBadgeColour[reviewState] + '22',
        color: reviewBadgeColour[reviewState],
        border: `1px solid ${reviewBadgeColour[reviewState]}55`,
      }}>
        {reviewState.replace(/_/g, ' ')}
      </span>

      {/* Sync state badge */}
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
        color: syncBadgeColour[syncState] ?? '#6b7280',
        background: (syncBadgeColour[syncState] ?? '#6b7280') + '22',
        border: `1px solid ${(syncBadgeColour[syncState] ?? '#6b7280')}55`,
      }}>
        {syncState.replace(/_/g, ' ')}
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Transcript toggle */}
      <button
        onClick={onToggleTranscript}
        style={{
          ...btnBase,
          background: transcriptOpen ? '#6366f1' : 'rgba(255,255,255,0.08)',
          color: transcriptOpen ? '#fff' : '#9ca3af',
        }}
      >
        📝 Transcript
      </button>

      {/* Reject */}
      <button
        onClick={onReject}
        disabled={reviewState === 'needs_attention'}
        style={{
          ...btnBase,
          background: reviewState === 'needs_attention' ? '#7f1d1d' : 'rgba(239,68,68,0.15)',
          color: '#fca5a5',
          opacity: reviewState === 'needs_attention' ? 0.6 : 1,
          cursor: reviewState === 'needs_attention' ? 'default' : 'pointer',
        }}
      >
        Reject
      </button>

      {/* Approve */}
      <button
        onClick={onApprove}
        disabled={reviewState === 'reviewed'}
        style={{
          ...btnBase,
          background: reviewState === 'reviewed' ? '#14532d' : '#22c55e',
          color: '#fff',
          opacity: reviewState === 'reviewed' ? 0.7 : 1,
          cursor: reviewState === 'reviewed' ? 'default' : 'pointer',
        }}
      >
        {reviewState === 'reviewed' ? '✓ Approved' : 'Approve'}
      </button>

      {/* Export */}
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          ...btnBase,
          background: exporting ? '#312e81' : '#6366f1',
          color: '#fff',
          cursor: exporting ? 'not-allowed' : 'pointer',
        }}
      >
        {exporting ? 'Exporting…' : 'Export'}
      </button>
    </div>
  );
}
