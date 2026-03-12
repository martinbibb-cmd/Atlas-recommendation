/**
 * FloorPlanBuilder.tsx
 *
 * MVP floor plan builder for System Lab.
 *
 * Allows engineers to select a house template (Bungalow, Terrace, Semi,
 * Detached, Flat) and drag heating components (boiler, cylinder, radiators,
 * UFH zones) onto a canvas to produce a rough system layout.
 *
 * Built with react-konva for performant canvas-based drag-and-drop.
 *
 * This is a display-model MVP:
 *  - No engine calculations run inside the canvas.
 *  - Pipe routing and room-by-room heat calculations are out of scope.
 *  - Data is local state only — not persisted.
 *
 * Future: Export canvas snapshot as PNG for inclusion in PDF reports.
 */

import { useState, useRef } from 'react';
import { Stage, Layer, Rect, Text, Group, Circle } from 'react-konva';
import type Konva from 'konva';
import './floorplan.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateId = 'bungalow' | 'terrace' | 'semi' | 'detached' | 'flat';

interface Room {
  id:    string;
  label: string;
  x:     number;
  y:     number;
  w:     number;
  h:     number;
}

interface PlacedComponent {
  id:      string;
  kind:    string;
  icon:    string;
  x:       number;
  y:       number;
}

// ─── Template definitions ─────────────────────────────────────────────────────

const TEMPLATES: Record<TemplateId, { label: string; rooms: Room[] }> = {
  bungalow: {
    label: 'Bungalow',
    rooms: [
      { id: 'lounge',  label: 'Lounge',   x: 10,  y: 10,  w: 160, h: 120 },
      { id: 'kitchen', label: 'Kitchen',  x: 180, y: 10,  w: 110, h: 80  },
      { id: 'bed1',    label: 'Bed 1',    x: 10,  y: 140, w: 120, h: 100 },
      { id: 'bed2',    label: 'Bed 2',    x: 140, y: 140, w: 100, h: 100 },
      { id: 'bathroom',label: 'Bathroom', x: 250, y: 100, w: 80,  h: 80  },
      { id: 'hall',    label: 'Hall',     x: 180, y: 100, w: 60,  h: 40  },
    ],
  },
  terrace: {
    label: 'Terrace',
    rooms: [
      { id: 'lounge',    label: 'Lounge',    x: 10,  y: 10,  w: 140, h: 100 },
      { id: 'dining',    label: 'Dining',    x: 10,  y: 120, w: 140, h: 80  },
      { id: 'kitchen',   label: 'Kitchen',   x: 10,  y: 210, w: 140, h: 80  },
      { id: 'bed1',      label: 'Bed 1',     x: 170, y: 10,  w: 130, h: 90  },
      { id: 'bed2',      label: 'Bed 2',     x: 170, y: 110, w: 130, h: 90  },
      { id: 'bathroom',  label: 'Bathroom',  x: 170, y: 210, w: 130, h: 80  },
    ],
  },
  semi: {
    label: 'Semi-detached',
    rooms: [
      { id: 'lounge',   label: 'Lounge',    x: 10,  y: 10,  w: 160, h: 110 },
      { id: 'dining',   label: 'Dining',    x: 180, y: 10,  w: 120, h: 110 },
      { id: 'kitchen',  label: 'Kitchen',   x: 180, y: 130, w: 120, h: 90  },
      { id: 'utility',  label: 'Utility',   x: 180, y: 230, w: 120, h: 60  },
      { id: 'bed1',     label: 'Bed 1',     x: 10,  y: 130, w: 120, h: 90  },
      { id: 'bed2',     label: 'Bed 2',     x: 10,  y: 230, w: 120, h: 60  },
      { id: 'bathroom', label: 'Bathroom',  x: 140, y: 130, w: 30,  h: 90  },
    ],
  },
  detached: {
    label: 'Detached',
    rooms: [
      { id: 'lounge',   label: 'Lounge',    x: 10,  y: 10,  w: 160, h: 120 },
      { id: 'dining',   label: 'Dining',    x: 180, y: 10,  w: 130, h: 120 },
      { id: 'kitchen',  label: 'Kitchen',   x: 180, y: 140, w: 130, h: 100 },
      { id: 'utility',  label: 'Utility',   x: 180, y: 250, w: 130, h: 60  },
      { id: 'study',    label: 'Study',     x: 10,  y: 140, w: 90,  h: 80  },
      { id: 'bed1',     label: 'Bed 1',     x: 10,  y: 230, w: 90,  h: 80  },
      { id: 'bed2',     label: 'Bed 2',     x: 110, y: 140, w: 60,  h: 80  },
      { id: 'bed3',     label: 'Bed 3',     x: 110, y: 230, w: 60,  h: 80  },
      { id: 'bathroom', label: 'Bathroom',  x: 10,  y: 310, w: 160, h: 60  },
    ],
  },
  flat: {
    label: 'Flat',
    rooms: [
      { id: 'lounge',   label: 'Lounge',    x: 10,  y: 10,  w: 160, h: 120 },
      { id: 'kitchen',  label: 'Kitchen',   x: 180, y: 10,  w: 110, h: 80  },
      { id: 'bed1',     label: 'Bed 1',     x: 10,  y: 140, w: 140, h: 100 },
      { id: 'bathroom', label: 'Bathroom',  x: 180, y: 100, w: 110, h: 80  },
      { id: 'hall',     label: 'Hall',      x: 160, y: 140, w: 40,  h: 60  },
    ],
  },
};

// ─── Available components palette ────────────────────────────────────────────

const PALETTE_ITEMS = [
  { kind: 'boiler',    icon: '🔥', label: 'Boiler'   },
  { kind: 'cylinder',  icon: '🛢',  label: 'Cylinder' },
  { kind: 'radiator',  icon: '📡', label: 'Radiator' },
  { kind: 'ufh',       icon: '〰️', label: 'UFH Zone' },
  { kind: 'pump',      icon: '⚙️',  label: 'Pump'     },
  { kind: 'thermostat',icon: '🌡️', label: 'T-stat'   },
];

// ─── Room colours ─────────────────────────────────────────────────────────────

const ROOM_FILL   = '#edf2f7';
const ROOM_STROKE = '#cbd5e0';

// ─── Component ────────────────────────────────────────────────────────────────

let nextId = 1;

export default function FloorPlanBuilder() {
  const [template, setTemplate] = useState<TemplateId>('terrace');
  const [placed,   setPlaced]   = useState<PlacedComponent[]>([]);
  const stageRef = useRef<Konva.Stage>(null);

  const { rooms } = TEMPLATES[template];

  /** Drop a new component onto the canvas at a default position. */
  function handlePaletteClick(kind: string, icon: string) {
    setPlaced(prev => [
      ...prev,
      {
        id:   `c-${nextId++}`,
        kind,
        icon,
        x:    30 + (prev.length % 5) * 40,
        y:    30 + Math.floor(prev.length / 5) * 40,
      },
    ]);
  }

  /** Remove a placed component from the canvas. */
  function removeComponent(id: string) {
    setPlaced(prev => prev.filter(c => c.id !== id));
  }

  /** Export the canvas as a PNG download. */
  function handleExport() {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!uri) return;
    const a = document.createElement('a');
    a.href     = uri;
    a.download = 'floor-plan.png';
    a.click();
  }

  return (
    <div className="floor-plan">
      <div className="floor-plan__header">
        <h2 className="floor-plan__title">🏠 Floor Plan Builder</h2>
        <p className="floor-plan__subtitle">
          Select a template and drag heating components onto the plan.
        </p>
      </div>

      {/* ── Template selector ─────────────────────────────────────── */}
      <div className="floor-plan__templates" role="group" aria-label="House templates">
        {(Object.entries(TEMPLATES) as [TemplateId, { label: string }][]).map(([id, t]) => (
          <button
            key={id}
            className={`floor-plan__template-btn${template === id ? ' floor-plan__template-btn--active' : ''}`}
            onClick={() => { setTemplate(id); setPlaced([]); }}
            aria-pressed={template === id}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="floor-plan__workspace">
        {/* ── Component palette ───────────────────────────────────── */}
        <div className="floor-plan__palette" aria-label="Component palette">
          <div className="floor-plan__palette-title">Components</div>
          {PALETTE_ITEMS.map(item => (
            <button
              key={item.kind}
              className="floor-plan__palette-item"
              onClick={() => handlePaletteClick(item.kind, item.icon)}
              aria-label={`Add ${item.label}`}
              title={`Add ${item.label}`}
            >
              <span className="floor-plan__palette-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="floor-plan__palette-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* ── Canvas ──────────────────────────────────────────────── */}
        <div className="floor-plan__canvas-wrap">
          <Stage
            ref={stageRef}
            width={340}
            height={380}
            style={{ background: '#fff', border: '1px solid #cbd5e0', borderRadius: 8 }}
          >
            <Layer>
              {/* Rooms */}
              {rooms.map(room => (
                <Group key={room.id}>
                  <Rect
                    x={room.x} y={room.y}
                    width={room.w} height={room.h}
                    fill={ROOM_FILL}
                    stroke={ROOM_STROKE}
                    strokeWidth={1}
                    cornerRadius={4}
                  />
                  <Text
                    x={room.x + 4} y={room.y + 4}
                    text={room.label}
                    fontSize={10}
                    fill="#4a5568"
                    width={room.w - 8}
                    wrap="word"
                  />
                </Group>
              ))}

              {/* Placed components */}
              {placed.map(comp => (
                <Group
                  key={comp.id}
                  x={comp.x}
                  y={comp.y}
                  draggable
                  onDragEnd={e => {
                    setPlaced(prev =>
                      prev.map(c =>
                        c.id === comp.id
                          ? { ...c, x: e.target.x(), y: e.target.y() }
                          : c,
                      ),
                    );
                  }}
                >
                  <Circle
                    radius={14}
                    fill="#6366f1"
                    opacity={0.9}
                  />
                  <Text
                    text={comp.icon}
                    fontSize={14}
                    x={-8}
                    y={-8}
                  />
                </Group>
              ))}
            </Layer>
          </Stage>

          {/* Remove last / clear buttons */}
          <div className="floor-plan__canvas-actions">
            <button
              className="floor-plan__action-btn"
              onClick={() => setPlaced(prev => prev.slice(0, -1))}
              disabled={placed.length === 0}
            >
              Undo last
            </button>
            <button
              className="floor-plan__action-btn"
              onClick={() => setPlaced([])}
              disabled={placed.length === 0}
            >
              Clear all
            </button>
            <button
              className="floor-plan__action-btn floor-plan__action-btn--export"
              onClick={handleExport}
            >
              Export PNG
            </button>
          </div>
        </div>
      </div>

      {/* ── Placed component list ──────────────────────────────────── */}
      {placed.length > 0 && (
        <div className="floor-plan__placed-list" aria-label="Placed components">
          <div className="floor-plan__placed-title">Placed components</div>
          <div className="floor-plan__placed-chips">
            {placed.map(comp => (
              <span key={comp.id} className="floor-plan__placed-chip">
                {comp.icon} {comp.kind}
                <button
                  className="floor-plan__placed-remove"
                  onClick={() => removeComponent(comp.id)}
                  aria-label={`Remove ${comp.kind}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
