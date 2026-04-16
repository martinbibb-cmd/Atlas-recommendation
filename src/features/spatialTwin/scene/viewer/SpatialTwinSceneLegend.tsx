/**
 * SpatialTwinSceneLegend.tsx
 *
 * Legend for the 3D dollhouse view.
 * Items are derived from scene mode; no engineering data here.
 */

import type { SceneMode } from '../sceneGraph.types';
import { buildSceneLegendItems } from '../sceneLegend';

interface SpatialTwinSceneLegendProps {
  mode: SceneMode;
}

export function SpatialTwinSceneLegend({ mode }: SpatialTwinSceneLegendProps) {
  const items = buildSceneLegendItems(mode);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 11,
        pointerEvents: 'none',
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: item.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: '#374151' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
