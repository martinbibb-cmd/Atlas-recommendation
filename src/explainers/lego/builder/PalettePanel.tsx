import { PALETTE } from './palette';
import type { PartKind } from './types';
import './builder.css';

export default function PalettePanel({ onPick }: { onPick: (kind: PartKind) => void }) {
  return (
    <div className="palette">
      <div className="palette-head">
        <div className="palette-title">Palette</div>
        <div className="palette-sub">Tap to add a part.</div>
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
    </div>
  );
}
