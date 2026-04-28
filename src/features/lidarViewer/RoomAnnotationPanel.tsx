/**
 * RoomAnnotationPanel.tsx
 *
 * Sidebar panel that lists rooms from a PropertyScanSession.
 *
 * Features:
 *   - Rename rooms
 *   - Change room type (RoomType enum)
 *   - Mark a room as reviewed
 *   - Clicking a room row fires onFocusRoom so the 3D viewer can pan to it
 */

import { useState } from 'react';
import type { Room } from '../../components/floorplan/propertyPlan.types';

// ─── Room-type options ────────────────────────────────────────────────────────

const ROOM_TYPES = [
  'living', 'dining', 'kitchen', 'bedroom', 'en_suite', 'bathroom',
  'hallway', 'landing', 'utility', 'garage', 'study', 'conservatory',
  'loft', 'cupboard', 'plant_room', 'outside', 'other',
] as const;

type RoomType = (typeof ROOM_TYPES)[number];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RoomAnnotationPanelProps {
  rooms: Room[];
  reviewedRoomIds: Set<string>;
  highlightedRoomId: string | null;
  onFocusRoom: (room: Room) => void;
  onRoomUpdate: (updated: Room) => void;
  onMarkReviewed: (roomId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomAnnotationPanel({
  rooms,
  reviewedRoomIds,
  highlightedRoomId,
  onFocusRoom,
  onRoomUpdate,
  onMarkReviewed,
}: RoomAnnotationPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<RoomType>('other');

  function startEdit(room: Room) {
    setEditingId(room.id);
    setEditName(room.name ?? '');
    setEditType((room.roomType as RoomType) ?? 'other');
  }

  function commitEdit(room: Room) {
    onRoomUpdate({ ...room, name: editName, roomType: editType });
    setEditingId(null);
  }

  const panelStyle: React.CSSProperties = {
    width: 240,
    flexShrink: 0,
    background: '#1a1a2e',
    color: '#e5e7eb',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '1px solid #2d3748',
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 700,
    borderBottom: '1px solid #2d3748',
    flexShrink: 0,
  };

  const listStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Rooms ({rooms.length})</div>
      <div style={listStyle}>
        {rooms.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>
            No rooms detected.
          </div>
        )}
        {rooms.map((room) => {
          const isReviewed = reviewedRoomIds.has(room.id);
          const isHighlighted = room.id === highlightedRoomId;
          const isEditing = room.id === editingId;

          const rowStyle: React.CSSProperties = {
            padding: '8px 14px',
            borderBottom: '1px solid #1e293b',
            background: isHighlighted ? 'rgba(99,102,241,0.15)' : 'transparent',
            cursor: 'pointer',
          };

          return (
            <div key={room.id} style={rowStyle}>
              {isEditing ? (
                // ── Edit mode ──
                <div onClick={e => e.stopPropagation()}>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Room name"
                    style={{
                      width: '100%', padding: '4px 6px', marginBottom: 4,
                      background: '#0f172a', border: '1px solid #334155',
                      borderRadius: 4, color: '#e2e8f0', fontSize: 12,
                      boxSizing: 'border-box',
                    }}
                  />
                  <select
                    value={editType}
                    onChange={e => setEditType(e.target.value as RoomType)}
                    style={{
                      width: '100%', padding: '4px 6px', marginBottom: 6,
                      background: '#0f172a', border: '1px solid #334155',
                      borderRadius: 4, color: '#e2e8f0', fontSize: 12,
                    }}
                  >
                    {ROOM_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => commitEdit(room)}
                      style={{
                        flex: 1, padding: '4px 0', fontSize: 12, fontWeight: 600,
                        background: '#6366f1', color: '#fff', border: 'none',
                        borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        flex: 1, padding: '4px 0', fontSize: 12,
                        background: 'transparent', color: '#94a3b8',
                        border: '1px solid #334155', borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // ── View mode ──
                <div onClick={() => onFocusRoom(room)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: isHighlighted ? 700 : 400 }}>
                      {room.name ?? room.id}
                    </span>
                    {isReviewed && (
                      <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                    {room.roomType ?? 'unknown'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(room); }}
                      style={{
                        padding: '2px 8px', fontSize: 11, background: 'transparent',
                        border: '1px solid #334155', borderRadius: 4, color: '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    {!isReviewed && (
                      <button
                        onClick={e => { e.stopPropagation(); onMarkReviewed(room.id); }}
                        style={{
                          padding: '2px 8px', fontSize: 11, background: 'transparent',
                          border: '1px solid #22c55e', borderRadius: 4, color: '#22c55e',
                          cursor: 'pointer',
                        }}
                      >
                        Mark reviewed
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
