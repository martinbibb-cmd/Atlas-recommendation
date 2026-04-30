/**
 * VisitDetailView.tsx
 *
 * On-device capture view for building a SessionCaptureV2 capture session.
 *
 * Features:
 *   1. Room scan — add / resume / replace room scans
 *   2. Object pins — place typed object pins, attach to room or session
 *   3. Floor plan review — simple room + object overview, no legacy engine
 *   4. Voice note recording — text transcript only, no raw audio
 *   5. Evidence list — grouped captured evidence
 *   6. Review blockers — export readiness, warnings, missing items
 *
 * Architecture rules:
 *   - No ScanJob, ScanBundleV1, PropertyScanSession, ExportBuilder, or
 *     AtlasSync references.
 *   - All captured data writes to CaptureSessionDraft.
 *   - Export produces a valid SessionCaptureV2 JSON download.
 *   - Photo-only jobs are valid; full wireframe is optional.
 *   - Raw audio is never stored or exported.
 */

import { useState, useRef } from 'react';
import type { ObjectPinType } from '../contracts/sessionCaptureV2';
import {
  createEmptyCaptureSessionDraft,
  exportDraftAsSessionCaptureV2,
  generateItemId,
  deriveReviewItems,
  type CaptureSessionDraft,
  type DraftRoomScan,
  type DraftObjectPin,
  type DraftVoiceNote,
  type DraftPhoto,
  type DraftFloorPlanSnapshot,
} from '../capture/captureSessionDraft';

// ─── Object type display map ──────────────────────────────────────────────────

const OBJECT_TYPE_LABELS: Record<ObjectPinType, string> = {
  boiler:        'Boiler',
  cylinder:      'Cylinder',
  radiator:      'Radiator',
  gas_meter:     'Gas Meter',
  flue:          'Flue',
  sink:          'Sink',
  bath:          'Bath',
  shower:        'Shower',
  pipe_route:    'Pipe Route',
  thermostat:    'Thermostat',
  pipe:          'Pipe',
  consumer_unit: 'Consumer Unit',
  other:         'Other',
};

/** Object types shown in the "Place Object" picker (in order). */
const OBJECT_TYPE_OPTIONS: ObjectPinType[] = [
  'boiler', 'cylinder', 'radiator', 'gas_meter', 'flue',
  'sink', 'bath', 'shower', 'pipe_route', 'other',
];

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#0f1117',
    color: '#e2e8f0',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid #1e293b',
    background: '#0f1117',
    flexShrink: 0,
  } as React.CSSProperties,

  backBtn: {
    padding: '4px 12px',
    fontSize: 13,
    background: 'rgba(255,255,255,0.08)',
    color: '#e5e7eb',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  } as React.CSSProperties,

  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    maxWidth: 600,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  } as React.CSSProperties,

  section: {
    marginBottom: 24,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#475569',
    marginBottom: 10,
  } as React.CSSProperties,

  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '12px 14px',
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left',
    marginBottom: 8,
  } as React.CSSProperties,

  primaryBtn: {
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  } as React.CSSProperties,

  dangerBtn: {
    padding: '6px 14px',
    fontSize: 13,
    background: 'transparent',
    color: '#f87171',
    border: '1px solid #f87171',
    borderRadius: 6,
    cursor: 'pointer',
  } as React.CSSProperties,

  ghostBtn: {
    padding: '6px 14px',
    fontSize: 13,
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: 6,
    cursor: 'pointer',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 6,
    boxSizing: 'border-box',
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 6,
    boxSizing: 'border-box',
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 6,
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: 80,
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
    fontWeight: 500,
  } as React.CSSProperties,

  formField: {
    marginBottom: 12,
  } as React.CSSProperties,

  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 8,
  } as React.CSSProperties,

  cardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  } as React.CSSProperties,

  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 100,
    padding: '0 0 env(safe-area-inset-bottom,0)',
  } as React.CSSProperties,

  modalPanel: {
    background: '#1e293b',
    borderRadius: '12px 12px 0 0',
    padding: '20px 20px 32px',
    width: '100%',
    maxWidth: 560,
    maxHeight: '80dvh',
    overflowY: 'auto',
  } as React.CSSProperties,

  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
    color: '#f1f5f9',
  } as React.CSSProperties,

  badge: (color: string) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: color === 'green' ? '#14532d' : color === 'amber' ? '#451a03' : color === 'red' ? '#7f1d1d' : '#1e293b',
    color: color === 'green' ? '#86efac' : color === 'amber' ? '#fcd34d' : color === 'red' ? '#fca5a5' : '#94a3b8',
  }) as React.CSSProperties,

  divider: {
    borderTop: '1px solid #1e293b',
    margin: '16px 0',
  } as React.CSSProperties,

  rowBtns: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VisitDetailViewProps {
  onBack: () => void;
  /**
   * Optional initial draft — used when reopening an in-progress capture.
   * When not supplied, a new empty draft is created.
   */
  initialDraft?: CaptureSessionDraft;
  /**
   * Called when the engineer exports the session.
   * The parent can persist, share, or submit the exported V2 payload.
   */
  onExported?: (sessionId: string) => void;
}

// ─── Panel types ──────────────────────────────────────────────────────────────

type ActivePanel =
  | 'none'
  | 'room-scan'
  | 'object-pin'
  | 'floor-plan'
  | 'voice-note'
  | 'review';

// ─── Room scan panel ──────────────────────────────────────────────────────────

interface RoomScanPanelProps {
  existingRoom?: DraftRoomScan;
  onSave: (room: DraftRoomScan) => void;
  onCancel: () => void;
}

function RoomScanPanel({ existingRoom, onSave, onCancel }: RoomScanPanelProps) {
  const [label, setLabel] = useState(existingRoom?.label ?? '');
  const [floorIndex, setFloorIndex] = useState(String(existingRoom?.floorIndex ?? '0'));
  const [areaM2, setAreaM2] = useState(existingRoom?.areaM2 != null ? String(existingRoom.areaM2) : '');
  const [status, setStatus] = useState<'active' | 'complete'>(existingRoom?.status ?? 'active');

  function handleSave() {
    const trimmed = label.trim();
    if (!trimmed) return;
    const area = areaM2.trim() ? parseFloat(areaM2) : undefined;
    onSave({
      roomId: existingRoom?.roomId ?? generateItemId('room'),
      label: trimmed,
      status,
      floorIndex: parseInt(floorIndex, 10) || 0,
      areaM2: area && !isNaN(area) ? area : undefined,
    });
  }

  return (
    <div style={S.modal} role="dialog" aria-modal="true" aria-label="Scan room">
      <div style={S.modalPanel}>
        <p style={S.modalTitle}>{existingRoom ? 'Edit Room Scan' : 'Scan Room / Area'}</p>

        <div style={S.formField}>
          <label style={S.label} htmlFor="room-label">Room name *</label>
          <input
            id="room-label"
            style={S.input}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Kitchen, Utility Room, Boiler Cupboard"
            autoFocus
          />
        </div>

        <div style={S.formField}>
          <label style={S.label} htmlFor="room-floor">Floor (0 = ground)</label>
          <input
            id="room-floor"
            style={S.input}
            type="number"
            min={0}
            max={5}
            value={floorIndex}
            onChange={(e) => setFloorIndex(e.target.value)}
          />
        </div>

        <div style={S.formField}>
          <label style={S.label} htmlFor="room-area">Floor area (m²) — optional</label>
          <input
            id="room-area"
            style={S.input}
            type="number"
            min={0}
            step={0.5}
            value={areaM2}
            onChange={(e) => setAreaM2(e.target.value)}
            placeholder="e.g. 12.5"
          />
        </div>

        <div style={S.formField}>
          <label style={S.label}>Scan status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['active', 'complete'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  ...S.ghostBtn,
                  flex: 1,
                  background: status === s ? '#6366f1' : 'transparent',
                  color: status === s ? '#fff' : '#94a3b8',
                  border: `1px solid ${status === s ? '#6366f1' : '#334155'}`,
                }}
              >
                {s === 'active' ? 'In progress' : 'Complete'}
              </button>
            ))}
          </div>
        </div>

        <div style={S.rowBtns}>
          <button
            style={S.primaryBtn}
            onClick={handleSave}
            disabled={!label.trim()}
          >
            {existingRoom ? 'Save changes' : 'Save room'}
          </button>
          <button style={S.ghostBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Object pin panel ─────────────────────────────────────────────────────────

interface ObjectPinPanelProps {
  rooms: DraftRoomScan[];
  existingPin?: DraftObjectPin;
  onSave: (pin: DraftObjectPin) => void;
  onCancel: () => void;
}

function ObjectPinPanel({ rooms, existingPin, onSave, onCancel }: ObjectPinPanelProps) {
  const [objectType, setObjectType] = useState<ObjectPinType>(existingPin?.objectType ?? 'boiler');
  const [label, setLabel] = useState(existingPin?.label ?? '');
  const [roomId, setRoomId] = useState(existingPin?.roomId ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoUris, setPhotoUris] = useState<{ id: string; uri: string }[]>([]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newUris = files.map((f) => ({
      id: generateItemId('photo'),
      uri: URL.createObjectURL(f),
    }));
    setPhotoUris((prev) => [...prev, ...newUris]);
  }

  function handleSave() {
    onSave({
      pinId: existingPin?.pinId ?? generateItemId('pin'),
      objectType,
      roomId: roomId || undefined,
      label: label.trim() || undefined,
      photoIds: photoUris.map((p) => p.id),
      metadata: {},
    });
  }

  return (
    <div style={S.modal} role="dialog" aria-modal="true" aria-label="Place object">
      <div style={S.modalPanel}>
        <p style={S.modalTitle}>{existingPin ? 'Edit Object Pin' : 'Place Object'}</p>

        <div style={S.formField}>
          <label style={S.label} htmlFor="pin-type">Object type *</label>
          <select
            id="pin-type"
            style={S.select}
            value={objectType}
            onChange={(e) => setObjectType(e.target.value as ObjectPinType)}
          >
            {OBJECT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{OBJECT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div style={S.formField}>
          <label style={S.label} htmlFor="pin-label">Label (optional)</label>
          <input
            id="pin-label"
            style={S.input}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Worcester Bosch 30i, Main sink"
          />
        </div>

        {rooms.length > 0 && (
          <div style={S.formField}>
            <label style={S.label} htmlFor="pin-room">Attach to room (optional)</label>
            <select
              id="pin-room"
              style={S.select}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">— Session level (no room) —</option>
              {rooms.map((r) => (
                <option key={r.roomId} value={r.roomId}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        <div style={S.formField}>
          <label style={S.label}>Photos (optional)</label>
          <button
            style={{ ...S.ghostBtn, marginBottom: 8 }}
            type="button"
            onClick={() => fileRef.current?.click()}
          >
            📷 Add photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
            aria-label="Add photos for this object"
          />
          {photoUris.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {photoUris.map((p) => (
                <img
                  key={p.id}
                  src={p.uri}
                  alt={`${OBJECT_TYPE_LABELS[objectType]} photo`}
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #334155' }}
                />
              ))}
            </div>
          )}
        </div>

        <div style={S.rowBtns}>
          <button style={S.primaryBtn} onClick={handleSave}>
            {existingPin ? 'Save changes' : 'Place pin'}
          </button>
          <button style={S.ghostBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Voice note panel ─────────────────────────────────────────────────────────

interface VoiceNotePanelProps {
  rooms: DraftRoomScan[];
  onSave: (note: DraftVoiceNote) => void;
  onCancel: () => void;
}

function VoiceNotePanel({ rooms, onSave, onCancel }: VoiceNotePanelProps) {
  const [transcript, setTranscript] = useState('');
  const [roomId, setRoomId] = useState('');

  function handleSave() {
    const text = transcript.trim();
    if (!text) return;
    onSave({
      voiceNoteId: generateItemId('note'),
      roomId: roomId || undefined,
      createdAt: new Date().toISOString(),
      transcript: text,
    });
  }

  return (
    <div style={S.modal} role="dialog" aria-modal="true" aria-label="Record voice note">
      <div style={S.modalPanel}>
        <p style={S.modalTitle}>Record Voice Note</p>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Type or paste your note. No audio is recorded or stored — text only.
        </p>

        <div style={S.formField}>
          <label style={S.label} htmlFor="note-text">Note text *</label>
          <textarea
            id="note-text"
            style={S.textarea}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type your observations here…"
            autoFocus
          />
        </div>

        {rooms.length > 0 && (
          <div style={S.formField}>
            <label style={S.label} htmlFor="note-room">Room (optional)</label>
            <select
              id="note-room"
              style={S.select}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">— Session level —</option>
              {rooms.map((r) => (
                <option key={r.roomId} value={r.roomId}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        <div style={S.rowBtns}>
          <button
            style={S.primaryBtn}
            onClick={handleSave}
            disabled={!transcript.trim()}
          >
            Save note
          </button>
          <button style={S.ghostBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Floor plan panel ─────────────────────────────────────────────────────────

interface FloorPlanPanelProps {
  draft: CaptureSessionDraft;
  onMovePin: (pinId: string, newRoomId: string | undefined) => void;
  onAddSnapshot: (snapshot: DraftFloorPlanSnapshot) => void;
  onClose: () => void;
}

function FloorPlanPanel({ draft, onMovePin, onAddSnapshot, onClose }: FloorPlanPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSnapshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onAddSnapshot({
      snapshotId: generateItemId('snapshot'),
      uri: URL.createObjectURL(file),
      capturedAt: new Date().toISOString(),
      floorIndex: 0,
    });
  }

  /** Group rooms by floor. */
  const floorMap = new Map<number, DraftRoomScan[]>();
  for (const room of draft.roomScans) {
    const floor = room.floorIndex ?? 0;
    if (!floorMap.has(floor)) floorMap.set(floor, []);
    floorMap.get(floor)!.push(room);
  }

  const floors = [...floorMap.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div style={S.modal} role="dialog" aria-modal="true" aria-label="Review floor plan">
      <div style={{ ...S.modalPanel, maxHeight: '90dvh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ ...S.modalTitle, margin: 0 }}>Review Floor Plan</p>
          <button style={S.ghostBtn} onClick={onClose}>Close</button>
        </div>

        {draft.roomScans.length === 0 ? (
          <p style={{ color: '#475569', fontSize: 14 }}>
            No rooms have been scanned yet. Add rooms using "Scan Room / Area".
          </p>
        ) : (
          floors.map(([floor, rooms]) => (
            <div key={floor} style={{ marginBottom: 20 }}>
              <p style={{ ...S.sectionTitle, marginBottom: 8 }}>
                {floor === 0 ? 'Ground floor' : floor === 1 ? 'First floor' : `Floor ${floor}`}
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {rooms.map((room) => {
                  const roomPins = draft.objectPins.filter((p) => p.roomId === room.roomId);
                  return (
                    <div key={room.roomId} style={{ ...S.card, padding: '10px 12px' }}>
                      <div style={S.cardRow}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{room.label}</span>
                        <span style={S.badge(room.status === 'complete' ? 'green' : 'amber')}>
                          {room.status === 'complete' ? 'Complete' : 'In progress'}
                        </span>
                      </div>
                      {room.areaM2 && (
                        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                          {room.areaM2} m²
                        </p>
                      )}
                      {roomPins.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {roomPins.map((pin) => (
                            <span key={pin.pinId} style={S.badge('default')}>
                              📍 {OBJECT_TYPE_LABELS[pin.objectType]}{pin.label ? ` · ${pin.label}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Unassigned pins */}
        {draft.objectPins.filter((p) => !p.roomId).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ ...S.sectionTitle, marginBottom: 8 }}>Unassigned pins (session level)</p>
            {draft.objectPins.filter((p) => !p.roomId).map((pin) => (
              <div key={pin.pinId} style={{ ...S.card, padding: '10px 12px' }}>
                <div style={S.cardRow}>
                  <span style={{ fontSize: 14 }}>
                    📍 {OBJECT_TYPE_LABELS[pin.objectType]}{pin.label ? ` · ${pin.label}` : ''}
                  </span>
                  {draft.roomScans.length > 0 && (
                    <select
                      style={{ ...S.select, width: 'auto', fontSize: 12 }}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) onMovePin(pin.pinId, e.target.value);
                      }}
                      aria-label={`Assign ${OBJECT_TYPE_LABELS[pin.objectType]} to a room`}
                    >
                      <option value="">Move to room…</option>
                      {draft.roomScans.map((r) => (
                        <option key={r.roomId} value={r.roomId}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={S.divider} />

        {/* Floor plan snapshot */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ ...S.sectionTitle, marginBottom: 8 }}>Floor plan snapshots</p>
          {draft.floorPlanSnapshots.length === 0 ? (
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>
              No floor plan snapshots captured yet.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {draft.floorPlanSnapshots.map((s) => (
                <img
                  key={s.snapshotId}
                  src={s.uri}
                  alt={`Floor plan snapshot${s.floorIndex != null ? ` — ${s.floorIndex === 0 ? 'ground floor' : `floor ${s.floorIndex}`}` : ''}`}
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #334155' }}
                />
              ))}
            </div>
          )}
          <button
            style={S.ghostBtn}
            type="button"
            onClick={() => fileRef.current?.click()}
          >
            📷 Add snapshot
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleSnapshotChange}
            aria-label="Add floor plan snapshot"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Review panel ─────────────────────────────────────────────────────────────

interface ReviewPanelProps {
  draft: CaptureSessionDraft;
  onExport: () => void;
  onClose: () => void;
}

function ReviewPanel({ draft, onExport, onClose }: ReviewPanelProps) {
  const reviewItems = deriveReviewItems(draft);
  const hasBlockers = reviewItems.some((i) => i.type === 'missing');

  return (
    <div style={S.modal} role="dialog" aria-modal="true" aria-label="Review and export">
      <div style={{ ...S.modalPanel, maxHeight: '90dvh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ ...S.modalTitle, margin: 0 }}>Review &amp; Export</p>
          <button style={S.ghostBtn} onClick={onClose}>Close</button>
        </div>

        {/* Captured items summary */}
        <div style={{ ...S.card, background: '#0f172a' }}>
          <p style={{ ...S.sectionTitle, marginBottom: 8 }}>Captured evidence</p>
          <table style={{ fontSize: 13, borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {[
                ['🏠 Room scans', draft.roomScans.length],
                ['📍 Object pins', draft.objectPins.length],
                ['📷 Photos', draft.photos.length],
                ['📝 Voice notes', draft.voiceNotes.length],
                ['🗺 Floor plan snapshots', draft.floorPlanSnapshots.length],
              ].map(([label, count]) => (
                <tr key={String(label)}>
                  <td style={{ color: '#94a3b8', paddingBottom: 4, paddingRight: 16 }}>{label}</td>
                  <td style={{ fontWeight: 600, color: Number(count) > 0 ? '#e2e8f0' : '#475569', paddingBottom: 4 }}>
                    {count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Review items */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ ...S.sectionTitle, marginBottom: 8 }}>Review</p>
          {reviewItems.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 6,
                marginBottom: 6,
                background:
                  item.type === 'missing' ? 'rgba(239,68,68,0.1)' :
                  item.type === 'warning' ? 'rgba(245,158,11,0.1)' :
                  'rgba(34,197,94,0.1)',
                border: `1px solid ${
                  item.type === 'missing' ? 'rgba(239,68,68,0.3)' :
                  item.type === 'warning' ? 'rgba(245,158,11,0.3)' :
                  'rgba(34,197,94,0.3)'
                }`,
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>
                {item.type === 'missing' ? '🔴' : item.type === 'warning' ? '🟡' : '✅'}
              </span>
              <span style={{ fontSize: 13, color: '#cbd5e1' }}>{item.message}</span>
            </div>
          ))}
        </div>

        <button
          style={{
            ...S.primaryBtn,
            width: '100%',
            opacity: hasBlockers ? 0.6 : 1,
          }}
          onClick={onExport}
          aria-label="Export session capture as JSON"
        >
          ↓ Export SessionCaptureV2 JSON
        </button>
        {hasBlockers && (
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, textAlign: 'center' }}>
            Some recommended items are missing — you can still export.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Evidence list ────────────────────────────────────────────────────────────

interface EvidenceListProps {
  draft: CaptureSessionDraft;
  onEditRoom: (room: DraftRoomScan) => void;
  onEditPin: (pin: DraftObjectPin) => void;
  onDeleteRoom: (roomId: string) => void;
  onDeletePin: (pinId: string) => void;
  onDeleteNote: (noteId: string) => void;
}

function EvidenceList({
  draft,
  onEditRoom,
  onEditPin,
  onDeleteRoom,
  onDeletePin,
  onDeleteNote,
}: EvidenceListProps) {
  const hasAny =
    draft.roomScans.length > 0 ||
    draft.objectPins.length > 0 ||
    draft.photos.length > 0 ||
    draft.voiceNotes.length > 0 ||
    draft.floorPlanSnapshots.length > 0;

  if (!hasAny) {
    return (
      <div style={{ ...S.card, color: '#475569', fontSize: 14, textAlign: 'center', padding: '24px 16px' }}>
        No evidence captured yet.<br />
        <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          Use the actions above to start capturing.
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Room scans */}
      {draft.roomScans.length > 0 && (
        <div style={S.section}>
          <p style={S.sectionTitle}>🏠 Room scans ({draft.roomScans.length})</p>
          {draft.roomScans.map((room) => (
            <div key={room.roomId} style={S.card}>
              <div style={S.cardRow}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{room.label}</span>
                  {room.areaM2 && (
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{room.areaM2} m²</span>
                  )}
                </div>
                <div style={S.rowBtns}>
                  <span style={S.badge(room.status === 'complete' ? 'green' : 'amber')}>
                    {room.status === 'complete' ? 'Complete' : 'In progress'}
                  </span>
                  <button
                    style={S.ghostBtn}
                    onClick={() => onEditRoom(room)}
                    aria-label={`Edit room ${room.label}`}
                  >
                    Edit
                  </button>
                  <button
                    style={S.dangerBtn}
                    onClick={() => onDeleteRoom(room.roomId)}
                    aria-label={`Remove room ${room.label}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Object pins */}
      {draft.objectPins.length > 0 && (
        <div style={S.section}>
          <p style={S.sectionTitle}>📍 Object pins ({draft.objectPins.length})</p>
          {draft.objectPins.map((pin) => {
            const room = draft.roomScans.find((r) => r.roomId === pin.roomId);
            return (
              <div key={pin.pinId} style={S.card}>
                <div style={S.cardRow}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {OBJECT_TYPE_LABELS[pin.objectType]}
                    </span>
                    {pin.label && (
                      <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{pin.label}</span>
                    )}
                    {room && (
                      <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                        in {room.label}
                      </span>
                    )}
                  </div>
                  <div style={S.rowBtns}>
                    {pin.photoIds.length > 0 && (
                      <span style={S.badge('default')}>📷 {pin.photoIds.length}</span>
                    )}
                    <button
                      style={S.ghostBtn}
                      onClick={() => onEditPin(pin)}
                      aria-label={`Edit ${OBJECT_TYPE_LABELS[pin.objectType]} pin`}
                    >
                      Edit
                    </button>
                    <button
                      style={S.dangerBtn}
                      onClick={() => onDeletePin(pin.pinId)}
                      aria-label={`Remove ${OBJECT_TYPE_LABELS[pin.objectType]} pin`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photos */}
      {draft.photos.length > 0 && (
        <div style={S.section}>
          <p style={S.sectionTitle}>📷 Photos ({draft.photos.length})</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {draft.photos.map((photo, idx) => (
              <img
                key={photo.photoId}
                src={photo.uri}
                alt={
                  photo.objectPinId
                    ? `Photo ${idx + 1} linked to object pin`
                    : photo.roomId
                      ? `Photo ${idx + 1} in room`
                      : `Session photo ${idx + 1}`
                }
                style={{
                  width: 70,
                  height: 70,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: '1px solid #334155',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Voice notes */}
      {draft.voiceNotes.length > 0 && (
        <div style={S.section}>
          <p style={S.sectionTitle}>📝 Voice notes ({draft.voiceNotes.length})</p>
          {draft.voiceNotes.map((note) => {
            const room = draft.roomScans.find((r) => r.roomId === note.roomId);
            const preview = note.transcript.length > 120
              ? note.transcript.slice(0, 120) + '…'
              : note.transcript;
            return (
              <div key={note.voiceNoteId} style={S.card}>
                <div style={S.cardRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', wordBreak: 'break-word' }}>
                      {preview}
                    </p>
                    {room && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569' }}>
                        in {room.label}
                      </p>
                    )}
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569' }}>
                      {new Date(note.createdAt).toLocaleString('en-GB')}
                    </p>
                  </div>
                  <button
                    style={{ ...S.dangerBtn, flexShrink: 0 }}
                    onClick={() => onDeleteNote(note.voiceNoteId)}
                    aria-label="Remove voice note"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floor plan snapshots */}
      {draft.floorPlanSnapshots.length > 0 && (
        <div style={S.section}>
          <p style={S.sectionTitle}>🗺 Floor plan snapshots ({draft.floorPlanSnapshots.length})</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {draft.floorPlanSnapshots.map((s) => (
              <img
                key={s.snapshotId}
                src={s.uri}
                alt={`Floor plan snapshot${s.floorIndex != null ? ` — ${s.floorIndex === 0 ? 'ground floor' : `floor ${s.floorIndex}`}` : ''}`}
                style={{
                  width: 80,
                  height: 80,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: '1px solid #334155',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Photo capture bar ────────────────────────────────────────────────────────

interface PhotoCaptureBtnProps {
  onAdd: (photos: DraftPhoto[]) => void;
}

function PhotoCaptureBtn({ onAdd }: PhotoCaptureBtnProps) {
  const ref = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const photos: DraftPhoto[] = files.map((f) => ({
      photoId: generateItemId('photo'),
      uri: URL.createObjectURL(f),
      capturedAt: new Date().toISOString(),
      scope: 'session',
    }));
    onAdd(photos);
  }

  return (
    <>
      <button
        style={S.actionBtn}
        type="button"
        onClick={() => ref.current?.click()}
        aria-label="Take or attach a photo"
      >
        <span style={{ fontSize: 20 }}>📷</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Add Photo</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Attach evidence photos to this session</div>
        </div>
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleChange}
        aria-label="Select photos to attach"
      />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VisitDetailView({ onBack, initialDraft, onExported }: VisitDetailViewProps) {
  const [draft, setDraft] = useState<CaptureSessionDraft>(
    () => initialDraft ?? createEmptyCaptureSessionDraft(),
  );
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [editingRoom, setEditingRoom] = useState<DraftRoomScan | undefined>();
  const [editingPin, setEditingPin] = useState<DraftObjectPin | undefined>();

  // ── Draft mutation helpers ─────────────────────────────────────────────────

  function updateDraft(updater: (d: CaptureSessionDraft) => CaptureSessionDraft) {
    setDraft(updater);
  }

  // ── Room scan handlers ─────────────────────────────────────────────────────

  function handleSaveRoom(room: DraftRoomScan) {
    updateDraft((d) => ({
      ...d,
      roomScans: editingRoom
        ? d.roomScans.map((r) => (r.roomId === room.roomId ? room : r))
        : [...d.roomScans, room],
    }));
    setEditingRoom(undefined);
    setActivePanel('none');
  }

  function handleDeleteRoom(roomId: string) {
    updateDraft((d) => ({
      ...d,
      roomScans: d.roomScans.filter((r) => r.roomId !== roomId),
      // Clear roomId from pins and notes that referenced this room
      objectPins: d.objectPins.map((p) =>
        p.roomId === roomId ? { ...p, roomId: undefined } : p,
      ),
      voiceNotes: d.voiceNotes.map((v) =>
        v.roomId === roomId ? { ...v, roomId: undefined } : v,
      ),
    }));
  }

  // ── Object pin handlers ────────────────────────────────────────────────────

  function handleSavePin(pin: DraftObjectPin) {
    updateDraft((d) => ({
      ...d,
      objectPins: editingPin
        ? d.objectPins.map((p) => (p.pinId === pin.pinId ? pin : p))
        : [...d.objectPins, pin],
    }));
    setEditingPin(undefined);
    setActivePanel('none');
  }

  function handleDeletePin(pinId: string) {
    updateDraft((d) => ({
      ...d,
      objectPins: d.objectPins.filter((p) => p.pinId !== pinId),
    }));
  }

  function handleMovePin(pinId: string, newRoomId: string | undefined) {
    updateDraft((d) => ({
      ...d,
      objectPins: d.objectPins.map((p) =>
        p.pinId === pinId ? { ...p, roomId: newRoomId } : p,
      ),
    }));
  }

  // ── Voice note handlers ────────────────────────────────────────────────────

  function handleSaveNote(note: DraftVoiceNote) {
    updateDraft((d) => ({ ...d, voiceNotes: [...d.voiceNotes, note] }));
    setActivePanel('none');
  }

  function handleDeleteNote(noteId: string) {
    updateDraft((d) => ({
      ...d,
      voiceNotes: d.voiceNotes.filter((v) => v.voiceNoteId !== noteId),
    }));
  }

  // ── Photo handlers ─────────────────────────────────────────────────────────

  function handleAddPhotos(photos: DraftPhoto[]) {
    updateDraft((d) => ({ ...d, photos: [...d.photos, ...photos] }));
  }

  // ── Floor plan snapshot handler ────────────────────────────────────────────

  function handleAddSnapshot(snapshot: DraftFloorPlanSnapshot) {
    updateDraft((d) => ({
      ...d,
      floorPlanSnapshots: [...d.floorPlanSnapshots, snapshot],
    }));
  }

  // ── Export handler ─────────────────────────────────────────────────────────

  function handleExport() {
    const payload = exportDraftAsSessionCaptureV2(draft);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_capture_${draft.sessionId.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onExported) onExported(draft.sessionId);
    setActivePanel('none');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const shortId = draft.sessionId.slice(0, 8).toUpperCase();

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack} aria-label="Back">← Back</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>
            {draft.visitReference ? `Job: ${draft.visitReference}` : 'New Capture'}
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
            Session ···{shortId}
          </p>
        </div>
        <button
          style={{ ...S.primaryBtn, padding: '6px 14px', fontSize: 13 }}
          onClick={() => setActivePanel('review')}
          aria-label="Review and export this capture"
        >
          Review &amp; Export
        </button>
      </div>

      {/* Scrollable content */}
      <div style={S.content}>

        {/* Capture actions */}
        <div style={S.section}>
          <p style={S.sectionTitle}>Capture</p>

          <button
            style={S.actionBtn}
            onClick={() => { setEditingRoom(undefined); setActivePanel('room-scan'); }}
            aria-label="Scan a room or area"
          >
            <span style={{ fontSize: 20 }}>🏠</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Scan Room / Area</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Record a room — add label, floor, and area
              </div>
            </div>
          </button>

          <button
            style={S.actionBtn}
            onClick={() => { setEditingPin(undefined); setActivePanel('object-pin'); }}
            aria-label="Place an object pin"
          >
            <span style={{ fontSize: 20 }}>📍</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Place Object</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Pin a boiler, radiator, cylinder, or other object
              </div>
            </div>
          </button>

          <PhotoCaptureBtn onAdd={handleAddPhotos} />

          <button
            style={S.actionBtn}
            onClick={() => setActivePanel('voice-note')}
            aria-label="Record a voice note"
          >
            <span style={{ fontSize: 20 }}>📝</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Record Voice Note</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Text only — no audio is stored</div>
            </div>
          </button>

          <button
            style={S.actionBtn}
            onClick={() => setActivePanel('floor-plan')}
            aria-label="Review floor plan"
          >
            <span style={{ fontSize: 20 }}>🗺</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Review Floor Plan</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                View rooms, move object pins, add snapshots
              </div>
            </div>
          </button>
        </div>

        {/* Evidence list */}
        <div style={S.section}>
          <p style={S.sectionTitle}>Captured evidence</p>
          <EvidenceList
            draft={draft}
            onEditRoom={(room) => { setEditingRoom(room); setActivePanel('room-scan'); }}
            onEditPin={(pin) => { setEditingPin(pin); setActivePanel('object-pin'); }}
            onDeleteRoom={handleDeleteRoom}
            onDeletePin={handleDeletePin}
            onDeleteNote={handleDeleteNote}
          />
        </div>
      </div>

      {/* Panels */}
      {activePanel === 'room-scan' && (
        <RoomScanPanel
          existingRoom={editingRoom}
          onSave={handleSaveRoom}
          onCancel={() => { setEditingRoom(undefined); setActivePanel('none'); }}
        />
      )}

      {activePanel === 'object-pin' && (
        <ObjectPinPanel
          rooms={draft.roomScans}
          existingPin={editingPin}
          onSave={handleSavePin}
          onCancel={() => { setEditingPin(undefined); setActivePanel('none'); }}
        />
      )}

      {activePanel === 'voice-note' && (
        <VoiceNotePanel
          rooms={draft.roomScans}
          onSave={handleSaveNote}
          onCancel={() => setActivePanel('none')}
        />
      )}

      {activePanel === 'floor-plan' && (
        <FloorPlanPanel
          draft={draft}
          onMovePin={handleMovePin}
          onAddSnapshot={handleAddSnapshot}
          onClose={() => setActivePanel('none')}
        />
      )}

      {activePanel === 'review' && (
        <ReviewPanel
          draft={draft}
          onExport={handleExport}
          onClose={() => setActivePanel('none')}
        />
      )}
    </div>
  );
}
