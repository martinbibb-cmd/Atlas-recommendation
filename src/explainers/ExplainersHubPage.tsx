/**
 * ExplainersHubPage — entry point for the Lego Blocks explainer system.
 *
 * Shows:
 *  - A list of preset scenarios (quick-load)
 *  - A "Build your own scenario" option that opens the form builder
 *
 * Navigation uses the same pattern as HubPage (local state, no router).
 */

import { useState } from 'react';
import { DHW_PRESETS } from './lego/presets/dhwPresets';
import LegoScenarioBuilder from './lego/builder/LegoScenarioBuilder';
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

// ─── View ─────────────────────────────────────────────────────────────────────

type Page = 'hub' | 'preset' | 'builder';

export default function ExplainersHubPage({ onBack }: Props) {
  const [page, setPage] = useState<Page>('hub');
  const [selectedPreset, setSelectedPreset] = useState<LegoScenario | null>(null);

  if (page === 'builder') {
    return (
      <div className="hub-page">
        <div className="hub-page__header">
          <button className="hub-back-btn" onClick={() => setPage('hub')}>← Back to Explainers</button>
          <h2 className="hub-page__panel-title">Build a scenario</h2>
        </div>
        <LegoScenarioBuilder />
      </div>
    );
  }

  if (page === 'preset' && selectedPreset) {
    const computed = computeForPreset(selectedPreset);
    return (
      <div className="hub-page">
        <div className="hub-page__header">
          <button className="hub-back-btn" onClick={() => setPage('hub')}>← Back to Explainers</button>
          <h2 className="hub-page__panel-title">{selectedPreset.meta.name}</h2>
        </div>
        <div className="panel-card">
          <PerformanceGraphicView scenario={selectedPreset} computed={computed} />
        </div>
      </div>
    );
  }

  return (
    <div className="hub-page">
      <div className="hub-page__header">
        {onBack && (
          <button className="hub-back-btn" onClick={onBack}>← Back</button>
        )}
        <div>
          <h1 className="hub-page__title">Explainers</h1>
          <p className="hub-page__subtitle">Physics-based system explainers and scenario builder</p>
        </div>
      </div>

      {/* ── Presets ─────────────────────────────────────────────────────── */}
      <section className="explainers-section">
        <h2 className="explainers-section__title">Preset scenarios</h2>
        <div className="hub-tile-grid">
          {DHW_PRESETS.map(preset => (
            <button
              key={preset.meta.name}
              className="hub-tile"
              onClick={() => { setSelectedPreset(preset); setPage('preset'); }}
            >
              <span className="hub-tile__icon">💧</span>
              <span className="hub-tile__title">{preset.meta.name}</span>
              <span className="hub-tile__subtitle">{preset.meta.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Builder ──────────────────────────────────────────────────────── */}
      <section className="explainers-section" style={{ marginTop: '2rem' }}>
        <h2 className="explainers-section__title">Build your own scenario</h2>
        <div className="hub-tile-grid">
          <button className="hub-tile" onClick={() => setPage('builder')}>
            <span className="hub-tile__icon">🧱</span>
            <span className="hub-tile__title">Scenario builder</span>
            <span className="hub-tile__subtitle">Configure system template, inputs and outlets to explore performance.</span>
          </button>
        </div>
      </section>
    </div>
  );
}
