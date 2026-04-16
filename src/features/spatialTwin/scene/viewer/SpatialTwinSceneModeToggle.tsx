/**
 * SpatialTwinSceneModeToggle.tsx
 *
 * 2D Plan / 3D Dollhouse view toggle.
 * This is a visual toggle only — it does not affect canonical mode
 * (current/proposed/compare), which lives in the Spatial Twin store.
 */

import type { SpatialTwinViewDimension } from '../../state/spatialTwin.types';

interface SpatialTwinSceneModeToggleProps {
  viewDimension: SpatialTwinViewDimension;
  onSetViewDimension: (v: SpatialTwinViewDimension) => void;
}

export function SpatialTwinSceneModeToggle({
  viewDimension,
  onSetViewDimension,
}: SpatialTwinSceneModeToggleProps) {
  const btnBase: React.CSSProperties = {
    padding: '5px 14px',
    fontSize: 12,
    cursor: 'pointer',
    border: 'none',
    borderRight: '1px solid #e2e8f0',
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        borderRadius: 6,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}
    >
      <button
        style={{
          ...btnBase,
          background: viewDimension === '2d' ? '#0ea5e9' : '#ffffff',
          color: viewDimension === '2d' ? '#ffffff' : '#374151',
        }}
        onClick={() => { onSetViewDimension('2d'); }}
      >
        2D Plan
      </button>
      <button
        style={{
          ...btnBase,
          borderRight: 'none',
          background: viewDimension === '3d' ? '#0ea5e9' : '#ffffff',
          color: viewDimension === '3d' ? '#ffffff' : '#374151',
        }}
        onClick={() => { onSetViewDimension('3d'); }}
      >
        3D Dollhouse
      </button>
    </div>
  );
}
