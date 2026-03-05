import { PRESETS } from './presets';
import './builder.css';

export default function PresetPanel({ onLoad }: { onLoad: (presetId: string) => void }) {
  return (
    <div className="presets">
      <div className="presets-title">Pre-built setups</div>
      <div className="presets-sub">One tap loads a full system graph.</div>

      <div className="presets-list">
        {PRESETS.map(preset => (
          <button key={preset.id} className="preset-item" onClick={() => onLoad(preset.id)}>
            <div className="preset-head">{preset.title}</div>
            <div className="preset-blurb">{preset.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
