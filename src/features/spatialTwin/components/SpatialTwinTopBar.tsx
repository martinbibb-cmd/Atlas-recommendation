

interface SpatialTwinTopBarProps {
  visitId: string;
  dirty: boolean;
  onBack: () => void;
}

export function SpatialTwinTopBar({ visitId, dirty, onBack }: SpatialTwinTopBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: 13,
          color: '#374151',
        }}
      >
        ← Back
      </button>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Spatial Twin</span>
        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>Visit: {visitId}</span>
      </div>
      {dirty && (
        <span
          style={{
            fontSize: 11,
            color: '#d97706',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 4,
            padding: '2px 8px',
          }}
        >
          Unsaved changes
        </span>
      )}
    </div>
  );
}
