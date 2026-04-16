
import type { SpatialTwinMode } from '../state/spatialTwin.types';

interface SpatialTwinModeToggleProps {
  mode: SpatialTwinMode;
  onSetMode: (mode: SpatialTwinMode) => void;
}

const MODES: Array<{ id: SpatialTwinMode; label: string }> = [
  { id: 'current', label: 'Current' },
  { id: 'proposed', label: 'Proposed' },
  { id: 'compare', label: 'Compare' },
];

export function SpatialTwinModeToggle({ mode, onSetMode }: SpatialTwinModeToggleProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        borderRadius: 6,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => { onSetMode(m.id); }}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
            background: mode === m.id ? '#0ea5e9' : '#ffffff',
            color: mode === m.id ? '#ffffff' : '#374151',
            border: 'none',
            borderRight: m.id !== 'compare' ? '1px solid #e2e8f0' : 'none',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
