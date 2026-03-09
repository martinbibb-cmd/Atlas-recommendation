/**
 * ExplainersHubPage — entry point for the Lego Blocks explainer system.
 *
 * PR5: House View is the default landing experience.
 * The Lego topology builder is available via the "Advanced Builder" mode.
 *
 * Navigation uses local state (no router).
 */

import { useState } from 'react';
import { DHW_PRESETS } from './lego/presets/dhwPresets';
import LegoScenarioBuilder from './lego/builder/LegoScenarioBuilder';
import PropertyLayoutView from './lego/builder/PropertyLayoutView';
import PerformanceGraphicView from './lego/views/PerformanceGraphicView';
import type { LegoScenario } from './lego/schema/legoTypes';
import {
  computeCombiThermalLimit,
  pipeDiameterCapacityLpm,
  computeCapacityChain,
} from './lego/model/dhwModel';
import type { CapacityChainResult } from './lego/model/dhwModel';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
}

// ─── Compute helper ───────────────────────────────────────────────────────────

function computeForPreset(scenario: LegoScenario): CapacityChainResult {
  const components: Array<{ label: string; maxFlowLpm: number | undefined }> = [];

  for (const block of scenario.graph.blocks) {
    if (block.type === 'mains_supply') {
      const flow = block.params.dynamicFlowLpm as number | undefined;
      if (flow) components.push({ label: 'Supply capacity', maxFlowLpm: flow });
    }
    if (block.type === 'pipe_section') {
      const d = block.params.diameterMm as number | undefined;
      components.push({ label: `Pipe (${d ?? '?'} mm)`, maxFlowLpm: d ? pipeDiameterCapacityLpm(d) : undefined });
    }
    if (block.type === 'boiler_combi_dhw_hex') {
      const kw = block.params.dhwOutputKw as number ?? 30;
      const cold = block.params.coldTempC as number ?? 10;
      const setpoint = block.params.dhwSetpointC as number ?? 50;
      const limit = computeCombiThermalLimit({ dhwOutputKw: kw, coldTempC: cold, setpointC: setpoint });
      components.push({ label: 'Thermal capacity (combi HEX)', maxFlowLpm: limit });
    }
    if (block.type === 'unvented_inlet_group') {
      const max = block.params.maxFlowLpm as number | undefined;
      if (max) components.push({ label: 'Inlet group', maxFlowLpm: max });
    }
  }

  if (components.length === 0) {
    components.push({ label: 'System', maxFlowLpm: undefined });
  }

  return computeCapacityChain(components);
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Top-level lab mode — House View is the default primary experience. */
type LabTopMode = 'house_view' | 'advanced_builder';

/** Sub-page used only within the advanced builder path. */
type BuilderSubPage = 'builder' | 'preset';

// ─── Mode strip ───────────────────────────────────────────────────────────────

interface LabModeStripProps {
  current: LabTopMode;
  onChange: (mode: LabTopMode) => void;
}

/** Two-button strip that switches between House View and Advanced Builder. */
function LabModeStrip({ current, onChange }: LabModeStripProps) {
  return (
    <nav className="lab-mode-strip" aria-label="Lab mode">
      <button
        className={`lab-mode-btn${current === 'house_view' ? ' lab-mode-btn--active' : ''}`}
        onClick={() => onChange('house_view')}
        aria-pressed={current === 'house_view'}
      >
        🏠 House View
      </button>
      <button
        className={`lab-mode-btn${current === 'advanced_builder' ? ' lab-mode-btn--active' : ''}`}
        onClick={() => onChange('advanced_builder')}
        aria-pressed={current === 'advanced_builder'}
      >
        🔧 Advanced Builder
      </button>
    </nav>
  );
}

// ─── View ─────────────────────────────────────────────────────────────────────

export default function ExplainersHubPage({ onBack }: Props) {
  /** House View is the primary default; Advanced Builder is secondary. */
  const [topMode, setTopMode] = useState<LabTopMode>('house_view');
  const [builderSubPage, setBuilderSubPage] = useState<BuilderSubPage>('builder');
  const [selectedPreset, setSelectedPreset] = useState<LegoScenario | null>(null);

  // ── Mode change handler ───────────────────────────────────────────────────
  /** Switch the top-level mode and always reset the builder sub-page to root. */
  function handleModeChange(mode: LabTopMode) {
    setTopMode(mode);
    setBuilderSubPage('builder');
  }

  // ── Shared page header ────────────────────────────────────────────────────
  const header = (
    <div className="hub-page__header">
      {onBack && (
        <button className="hub-back-btn" onClick={onBack}>← Back</button>
      )}
      <div>
        <h1 className="hub-page__title">Demo Lab</h1>
        <p className="hub-page__subtitle">Physics explainers &amp; sandbox</p>
      </div>
      <LabModeStrip current={topMode} onChange={handleModeChange} />
    </div>
  );

  // ── House View (default primary path) ────────────────────────────────────
  if (topMode === 'house_view') {
    return (
      <div className="hub-page">
        {header}
        {/* Property layout with plant placement is the main explainer surface */}
        <PropertyLayoutView />
      </div>
    );
  }

  // ── Advanced Builder: preset sub-page ─────────────────────────────────────
  if (builderSubPage === 'preset' && selectedPreset) {
    const computed = computeForPreset(selectedPreset);
    return (
      <div className="hub-page">
        {header}
        <div className="hub-page__header" style={{ marginBottom: 0 }}>
          <button className="hub-back-btn" onClick={() => setBuilderSubPage('builder')}>← Back to Builder</button>
          <h2 className="hub-page__panel-title">{selectedPreset.meta.name}</h2>
        </div>
        <div className="panel-card">
          <PerformanceGraphicView scenario={selectedPreset} computed={computed} />
        </div>
      </div>
    );
  }

  // ── Advanced Builder (topology builder + presets) ─────────────────────────
  return (
    <div className="hub-page">
      {header}

      {/* ── Topology builder (full simulation lab) ───────────────────── */}
      <section className="explainers-section demo-lab-section">
        <LegoScenarioBuilder />
      </section>

      {/* ── Preset scenarios (secondary, below builder) ──────────────── */}
      <section className="explainers-section" style={{ marginTop: '2rem' }}>
        <h2 className="explainers-section__title">Preset scenarios</h2>
        <div className="hub-tile-grid">
          {DHW_PRESETS.map(preset => (
            <button
              key={preset.meta.name}
              className="hub-tile"
              onClick={() => { setSelectedPreset(preset); setBuilderSubPage('preset'); }}
            >
              <span className="hub-tile__icon">💧</span>
              <span className="hub-tile__title">{preset.meta.name}</span>
              <span className="hub-tile__subtitle">{preset.meta.description}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
