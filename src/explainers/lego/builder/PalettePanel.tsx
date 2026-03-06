import { useState } from 'react';
import { PALETTE, PALETTE_ADVANCED } from './palette';
import type { PartKind } from './types';
import './builder.css';

export default function PalettePanel({ onPick }: { onPick: (kind: PartKind) => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="palette">
      <div className="palette-head">
        <div className="palette-title">Palette</div>
        <div className="palette-sub">Tap to add a part. Outlet nodes auto-bind to A/B/C.</div>
      </div>

      <div className="palette-grid">
        {PALETTE.map(p => (
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
