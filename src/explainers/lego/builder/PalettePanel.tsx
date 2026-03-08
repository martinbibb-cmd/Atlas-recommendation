import { useState } from 'react';
import { PALETTE_SECTIONS, PALETTE_ADVANCED } from './palette';
import type { PartKind } from './types';
import './builder.css';

export default function PalettePanel({ onPick }: { onPick: (kind: PartKind) => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  function toggleSection(category: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  return (
    <div className="palette">
      <div className="palette-head">
        <div className="palette-title">Components</div>
        <div className="palette-sub">Tap to add. Outlet nodes auto-bind to A/B/C.</div>
      </div>

      {PALETTE_SECTIONS.map(section => {
        const collapsed = collapsedSections.has(section.category);
        return (
          <div key={section.category} className="palette-section">
            <button
              className="palette-section-header"
              onClick={() => toggleSection(section.category)}
              aria-expanded={!collapsed}
            >
              <span className="palette-section-label">{section.label}</span>
              <span className="palette-section-chevron">{collapsed ? '▶' : '▼'}</span>
            </button>
            {!collapsed && (
              <div className="palette-grid">
                {section.items.map(p => (
                  <button
                    key={p.kind}
                    className="palette-item"
                    onClick={() => onPick(p.kind)}
                    title={p.label}
                  >
                    <span className="palette-emoji">{p.emoji}</span>
                    <span className="palette-label">{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        className="palette-advanced-toggle"
        onClick={() => setShowAdvanced(v => !v)}
      >
        {showAdvanced ? '▲ Hide advanced' : '▼ Advanced (tees)'}
      </button>

      {showAdvanced && (
        <div className="palette-grid palette-grid-advanced">
          {PALETTE_ADVANCED.map(p => (
            <button
              key={p.kind}
              className="palette-item palette-item-advanced"
              onClick={() => onPick(p.kind)}
              title={`${p.label} — auto-inserted on drag-connect`}
            >
              <span className="palette-emoji">{p.emoji}</span>
              <span className="palette-label">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
