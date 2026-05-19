import { PRESETS, CONCEPT_PRESETS } from './presets';
import type { SpawnTopologyId } from './topologyComposerFoundation';
import './builder.css';

export default function PresetPanel({
  onLoad,
  onLoadConcept,
  onSpawnTopology,
}: {
  onLoad: (presetId: string) => void;
  onLoadConcept: (conceptPresetId: string) => void;
  onSpawnTopology: (topologyId: SpawnTopologyId) => void;
}) {
  return (
    <div className="presets">
      <div className="presets-title">Spawn topology</div>
      <div className="presets-sub">Create a complete connected system from primitive-backed template placement data.</div>

      <div className="presets-list">
        <button className="preset-item preset-item--concept" onClick={() => onSpawnTopology('sealed_unvented')}>
          <div className="preset-head">Sealed + unvented</div>
          <div className="preset-blurb">System boiler, unvented cylinder, radiators and connected domestic outlets.</div>
        </button>
        <button className="preset-item preset-item--concept" onClick={() => onSpawnTopology('combi_direct_hot_water')}>
          <div className="preset-head">Combi direct hot water</div>
          <div className="preset-blurb">Combi boiler with direct on-demand DHW outlets and CH emitter loop.</div>
        </button>
      </div>

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
