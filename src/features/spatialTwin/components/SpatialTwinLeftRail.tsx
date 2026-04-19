
import type { SpatialTwinLeftRailSection } from '../state/spatialTwin.types';

const SECTIONS: Array<{ id: SpatialTwinLeftRailSection; label: string; icon: string }> = [
  { id: 'house', label: 'House', icon: '🏠' },
  { id: 'currentSystem', label: 'Current System', icon: '🔥' },
  { id: 'proposedSystem', label: 'Proposed', icon: '✨' },
  { id: 'evidence', label: 'Evidence', icon: '📷' },
  { id: 'overlays', label: 'Overlays', icon: '🎨' },
  { id: 'compare', label: 'Compare', icon: '⚖️' },
  { id: 'physicsTrace', label: 'Physics Trace', icon: '📐' },
  { id: 'alignment', label: 'Structure View', icon: '📍' },
];

interface SpatialTwinLeftRailProps {
  activeSection: SpatialTwinLeftRailSection;
  onSelectSection: (section: SpatialTwinLeftRailSection) => void;
}

export function SpatialTwinLeftRail({
  activeSection,
  onSelectSection,
}: SpatialTwinLeftRailProps) {
  return (
    <nav
      style={{
        width: 200,
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        background: '#f8fafc',
        height: '100%',
      }}
    >
      <div style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
          Spatial Twin
        </span>
      </div>
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          onClick={() => { onSelectSection(section.id); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: activeSection === section.id ? '#e0f2fe' : 'none',
            border: 'none',
            borderLeft: activeSection === section.id ? '3px solid #0ea5e9' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: 13,
            color: activeSection === section.id ? '#0369a1' : '#374151',
            textAlign: 'left',
          }}
        >
          <span>{section.icon}</span>
          <span>{section.label}</span>
        </button>
      ))}
    </nav>
  );
}
