/**
 * SpatialTwinSceneToolbar.tsx
 *
 * Camera controls toolbar for the 3D dollhouse canvas.
 * Emits actions to parent; no state of its own.
 */

interface SpatialTwinSceneToolbarProps {
  onResetCamera: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function SpatialTwinSceneToolbar({
  onResetCamera,
  onZoomIn,
  onZoomOut,
}: SpatialTwinSceneToolbarProps) {
  const btnStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: 13,
    cursor: 'pointer',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    color: '#374151',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <button style={btnStyle} onClick={onZoomIn} title='Zoom in'>+</button>
      <button style={btnStyle} onClick={onZoomOut} title='Zoom out'>−</button>
      <button style={btnStyle} onClick={onResetCamera} title='Reset camera'>⌖</button>
    </div>
  );
}
