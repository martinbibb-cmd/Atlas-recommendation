import { PRESETS, CONCEPT_PRESETS } from './presets';
import './builder.css';

export default function PresetPanel({
  onLoad,
  onLoadConcept,
}: {
  onLoad: (presetId: string) => void;
  onLoadConcept: (conceptPresetId: string) => void;
}) {
  return (
    <div className="presets">
      <div className="presets-title">Generate from concept</div>
      <div className="presets-sub">Select a system type — the graph is generated automatically.</div>

      <div className="presets-list">
        {CONCEPT_PRESETS.map(preset => (
          <button key={preset.id} className="preset-item preset-item--concept" onClick={() => onLoadConcept(preset.id)}>
            <div className="preset-head">{preset.title}</div>
            <div className="preset-blurb">{preset.blurb}</div>
          </button>
        ))}
      </div>

      <div className="presets-title presets-title--secondary">Pre-built setups</div>
      <div className="presets-sub">Fully wired examples you can edit.</div>

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
