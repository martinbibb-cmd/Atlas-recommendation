
import type { OverlayRenderMetadata } from '../overlays/overlayRegistry';

interface SpatialTwinLegendProps {
  overlayMetadata: OverlayRenderMetadata | null;
  overlayLabel: string;
}

export function SpatialTwinLegend({ overlayMetadata, overlayLabel }: SpatialTwinLegendProps) {
  if (overlayMetadata == null || overlayMetadata.legendItems.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: '8px 12px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>{overlayLabel}</div>
      {overlayMetadata.legendItems.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: item.color,
              border: '1px solid rgba(0,0,0,0.1)',
              flexShrink: 0,
            }}
          />
          <span style={{ color: '#64748b' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
