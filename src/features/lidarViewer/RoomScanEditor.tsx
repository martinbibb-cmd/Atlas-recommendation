/**
 * RoomScanEditor.tsx
 *
 * Full-screen 3D room-scan editing and review surface.
 *
 * Composes:
 *   - PointCloudViewer      — 3D point cloud with room bounding-box overlays
 *   - TaggedObjectLayer     — interactive object sprites in the 3D canvas
 *   - RoomAnnotationPanel   — sidebar for room renaming / type / review
 *   - ScanReviewToolbar     — approve / reject / export / transcript controls
 *
 * Lifecycle:
 *   The session is kept in local React state.  All mutations (approve, reject,
 *   room edits, object edits) call `upsertSession()` to persist to IDB.
 *   `syncToServer()` is called when the engineer presses Export.
 */

import { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import type { PropertyScanSession, TaggedObject } from '../scanImport/session/propertyScanSession';
import type { Room } from '../../components/floorplan/propertyPlan.types';
import type { RoomBounds, PointCloudViewerHandle } from './PointCloudViewer';
import RoomAnnotationPanel from './RoomAnnotationPanel';
import ScanReviewToolbar from './ScanReviewToolbar';
import { upsertSession, syncToServer } from '../../lib/storage/scanSessionStore';

// Lazy-load the heavy 3D editor bundle
const PointCloudViewer = lazy(() => import('./PointCloudViewer'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive RoomBounds for the point-cloud viewer from:
 *   1. The bounding box of tagged objects assigned to the room (3D scan-space).
 *   2. Fallback: approximate from Room canvas coords (assuming 1 canvas unit ≈ 1 m).
 */
function deriveRoomBounds(
  room: Room,
  taggedObjects: TaggedObject[],
): RoomBounds {
  const roomObjects = taggedObjects.filter(o => o.roomId === room.id);

  if (roomObjects.length > 0) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const obj of roomObjects) {
      const hw = obj.dimensions.width / 2;
      const hd = obj.dimensions.depth / 2;
      const hh = obj.dimensions.height / 2;
      minX = Math.min(minX, obj.position.x - hw);
      maxX = Math.max(maxX, obj.position.x + hw);
      minY = Math.min(minY, obj.position.y - hd);
      maxY = Math.max(maxY, obj.position.y + hd);
      minZ = Math.min(minZ, obj.position.z - hh);
      maxZ = Math.max(maxZ, obj.position.z + hh);
    }

    return {
      id: room.id,
      label: room.name,
      boundingBox: { minX, maxX, minY, maxY, minZ, maxZ },
    };
  }

  // Fallback: canvas coords → approximate 3D (X=x, Z=y [canvas], Y=elevation)
  const heightM = room.heightM ?? 2.4;
  return {
    id: room.id,
    label: room.name,
    boundingBox: {
      minX: room.x / 100,
      maxX: (room.x + room.width) / 100,
      minY: 0,
      maxY: heightM,
      minZ: room.y / 100,
      maxZ: (room.y + room.height) / 100,
    },
  };
}

// ─── Transcript panel ─────────────────────────────────────────────────────────

interface TranscriptPanelProps {
  session: PropertyScanSession;
  onClose: () => void;
}

function TranscriptPanel({ session, onClose }: TranscriptPanelProps) {
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    background: '#1a1a2e',
    borderLeft: '1px solid #2d3748',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 20,
    fontFamily: 'system-ui, sans-serif',
    color: '#e5e7eb',
  };

  return (
    <div style={panelStyle}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #2d3748', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Voice Note Transcripts</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}
        >
          ×
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {session.photos.filter(p => p.note).length === 0 ? (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            No voice-note transcripts for this scan session.
          </p>
        ) : (
          session.photos
            .filter(p => p.note)
            .map(p => (
              <div
                key={p.id}
                style={{
                  marginBottom: 16, padding: 12,
                  background: '#0f172a', borderRadius: 8,
                  border: '1px solid #1e293b',
                }}
              >
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  {p.capturedAt ? new Date(p.capturedAt).toLocaleTimeString() : ''}
                  {p.roomId && ` · Room: ${p.roomId}`}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>
                  {p.note}
                </p>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RoomScanEditorProps {
  /** Point-cloud positions for the 3D viewer. */
  positions: Float32Array;
  vertexCount: number;
  /** The scan session to review and edit. */
  session: PropertyScanSession;
  /** Called when the user is done (Back / Done button). */
  onDone: () => void;
  /** Called when the session has been updated (to propagate to parent state). */
  onSessionUpdate?: (updated: PropertyScanSession) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomScanEditor({
  positions,
  vertexCount,
  session: initialSession,
  onDone,
  onSessionUpdate,
}: RoomScanEditorProps) {
  const [session, setSession] = useState<PropertyScanSession>(initialSession);
  const [highlightedRoomId, setHighlightedRoomId] = useState<string | null>(null);
  const [reviewedRoomIds, setReviewedRoomIds] = useState<Set<string>>(new Set());
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const viewerRef = useRef<PointCloudViewerHandle>(null);

  // Flatten rooms from all floors
  const rooms: Room[] = session.floors.flatMap(f => f.rooms ?? []);

  const roomBounds: RoomBounds[] = rooms.map(room => ({
    ...deriveRoomBounds(room, session.taggedObjects),
    highlighted: room.id === highlightedRoomId,
  }));

  // ── Persist whenever session changes ──
  useEffect(() => {
    void upsertSession(session);
    onSessionUpdate?.(session);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Room panel callbacks ───────────────────────────────────────────────────
  const handleFocusRoom = useCallback((room: Room) => {
    setHighlightedRoomId(room.id);
    const bounds = deriveRoomBounds(room, session.taggedObjects);
    const { minX, maxX, minY, maxY, minZ, maxZ } = bounds.boundingBox;
    viewerRef.current?.focusOn(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    );
  }, [session.taggedObjects]);

  const handleRoomUpdate = useCallback((updated: Room) => {
    setSession(prev => ({
      ...prev,
      floors: prev.floors.map(floor => ({
        ...floor,
        rooms: floor.rooms.map(r => r.id === updated.id ? updated : r),
      })),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleMarkReviewed = useCallback((roomId: string) => {
    setReviewedRoomIds(prev => new Set([...prev, roomId]));
  }, []);

  // ── Object layer callbacks ─────────────────────────────────────────────────
  const handleObjectUpdate = useCallback((updated: TaggedObject) => {
    setSession(prev => ({
      ...prev,
      taggedObjects: prev.taggedObjects.map(o => o.id === updated.id ? updated : o),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // ── Toolbar callbacks ──────────────────────────────────────────────────────
  const handleApprove = useCallback(() => {
    setSession(prev => ({
      ...prev,
      reviewState: 'reviewed',
      syncState: 'queued_for_atlas',
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleReject = useCallback(() => {
    setSession(prev => ({
      ...prev,
      reviewState: 'needs_attention',
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleExport = useCallback(async () => {
    setSession(prev => ({ ...prev, syncState: 'syncing', updatedAt: new Date().toISOString() }));
    try {
      await syncToServer();
      setSession(prev => ({ ...prev, syncState: 'uploaded', updatedAt: new Date().toISOString() }));
    } catch {
      setSession(prev => ({ ...prev, syncState: 'failed_upload', updatedAt: new Date().toISOString() }));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  const editorStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#0f1117',
    zIndex: 50,
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    minHeight: 0,
    position: 'relative',
  };

  return (
    <div style={editorStyle}>
      {/* Toolbar */}
      <ScanReviewToolbar
        fileName={session.propertyAddress}
        reviewState={session.reviewState}
        syncState={session.syncState}
        transcriptOpen={transcriptOpen}
        onApprove={handleApprove}
        onReject={handleReject}
        onExport={handleExport}
        onToggleTranscript={() => setTranscriptOpen(v => !v)}
        onDone={onDone}
      />

      {/* Body */}
      <div style={bodyStyle}>
        {/* Room annotation sidebar */}
        <RoomAnnotationPanel
          rooms={rooms}
          reviewedRoomIds={reviewedRoomIds}
          highlightedRoomId={highlightedRoomId}
          onFocusRoom={handleFocusRoom}
          onRoomUpdate={handleRoomUpdate}
          onMarkReviewed={handleMarkReviewed}
        />

        {/* 3D viewer */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <Suspense fallback={
            <div style={{ color: '#9ca3af', padding: 24, fontSize: 14 }}>
              Loading 3D viewer…
            </div>
          }>
            <PointCloudViewer
              ref={viewerRef}
              positions={positions}
              vertexCount={vertexCount}
              rooms={roomBounds}
              taggedObjects={session.taggedObjects}
              onObjectUpdate={handleObjectUpdate}
              height="100%"
            />
          </Suspense>

          {/* Object count overlay */}
          {session.taggedObjects.length > 0 && (
            <div style={{
              position: 'absolute', top: 10, left: 10,
              background: 'rgba(15,17,23,0.85)', borderRadius: 6,
              padding: '4px 10px', fontSize: 12, color: '#9ca3af', pointerEvents: 'none',
            }}>
              {session.taggedObjects.length} detected object{session.taggedObjects.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Transcript overlay panel */}
        {transcriptOpen && (
          <TranscriptPanel session={session} onClose={() => setTranscriptOpen(false)} />
        )}
      </div>
    </div>
  );
}
