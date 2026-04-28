/**
 * TaggedObjectLayer.tsx
 *
 * Renders TaggedObject entries as interactive sphere sprites inside the
 * @react-three/fiber Canvas.  Each sprite shows a label via @react-three/drei
 * <Html> and opens an edit popover on click.
 *
 * Mount this component inside a <Canvas> tree (alongside PointsScene).
 */

import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { TaggedObject } from '../scanImport/session/propertyScanSession';

// ─── Category colour map ──────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<string, string> = {
  boiler:       '#ef4444',
  cylinder:     '#f97316',
  radiator:     '#eab308',
  appliance:    '#22c55e',
  furniture:    '#3b82f6',
  fixture:      '#8b5cf6',
};

function categoryColour(category: string): string {
  return CATEGORY_COLOURS[category.toLowerCase()] ?? '#6b7280';
}

// ─── Edit popover ─────────────────────────────────────────────────────────────

interface EditPopoverProps {
  obj: TaggedObject;
  onSave: (updated: TaggedObject) => void;
  onClose: () => void;
}

function EditPopover({ obj, onSave, onClose }: EditPopoverProps) {
  const [label, setLabel] = useState(obj.label);
  const [category, setCategory] = useState(obj.category);

  const popoverStyle: React.CSSProperties = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '12px 16px',
    minWidth: 200,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    pointerEvents: 'all',
  };

  return (
    <div style={popoverStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Edit object</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}
        >
          ×
        </button>
      </div>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Label</span>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{
            display: 'block', width: '100%', marginTop: 2, padding: '4px 8px',
            background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
            color: '#e2e8f0', fontSize: 13,
          }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Category</span>
        <input
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{
            display: 'block', width: '100%', marginTop: 2, padding: '4px 8px',
            background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
            color: '#e2e8f0', fontSize: 13,
          }}
        />
      </label>
      <button
        onClick={() => onSave({ ...obj, label, category })}
        style={{
          width: '100%', padding: '6px 0', fontSize: 13, fontWeight: 600,
          background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer',
        }}
      >
        Save
      </button>
    </div>
  );
}

// ─── Single object sprite ─────────────────────────────────────────────────────

interface ObjectSpriteProps {
  obj: TaggedObject;
  onUpdate: (updated: TaggedObject) => void;
}

function ObjectSprite({ obj, onUpdate }: ObjectSpriteProps) {
  const [open, setOpen] = useState(false);
  const colour = categoryColour(obj.category);
  const { x, y, z } = obj.position;

  return (
    <group position={[x, y, z]}>
      {/* Sphere sprite */}
      <mesh onClick={() => setOpen(v => !v)}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={colour} />
      </mesh>

      {/* Label + optional edit popover */}
      <Html distanceFactor={10} style={{ pointerEvents: open ? 'all' : 'none', userSelect: 'none' }}>
        {open ? (
          <EditPopover
            obj={obj}
            onSave={(updated) => { onUpdate(updated); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        ) : (
          <div
            onClick={() => setOpen(true)}
            style={{
              background: 'rgba(15,17,23,0.85)',
              border: `1px solid ${colour}`,
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 11,
              color: colour,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              pointerEvents: 'all',
            }}
          >
            {obj.label}
          </div>
        )}
      </Html>
    </group>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface TaggedObjectLayerProps {
  objects: TaggedObject[];
  onObjectUpdate: (updated: TaggedObject) => void;
}

/**
 * Mount inside a <Canvas> tree alongside PointsScene.
 * Renders all TaggedObject entries as clickable sphere sprites with labels.
 */
export default function TaggedObjectLayer({ objects, onObjectUpdate }: TaggedObjectLayerProps) {
  return (
    <>
      {objects.map((obj) => (
        <ObjectSprite key={obj.id} obj={obj} onUpdate={onObjectUpdate} />
      ))}
    </>
  );
}
