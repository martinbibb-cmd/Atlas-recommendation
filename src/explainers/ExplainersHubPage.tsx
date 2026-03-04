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
import { LabCanvas } from './lego/animation/render/LabCanvas';
import { InstrumentStrip } from './lego/animation/render/InstrumentStrip';
import type { LabControls, OutletControl } from './lego/animation/types';
import { defaultOutlets } from './lego/animation/types';
import { computeCapacitySummary } from './lego/animation/capacitySummary';

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

// ─── Outlet kind labels ───────────────────────────────────────────────────────

const KIND_LABELS: Record<OutletControl['kind'], string> = {
  shower_mixer: 'Shower',
  basin: 'Basin',
  bath: 'Bath',
};

const OUTLET_KINDS: OutletControl['kind'][] = ['shower_mixer', 'basin', 'bath'];

// ─── View ─────────────────────────────────────────────────────────────────────

type Page = 'hub' | 'preset' | 'builder';

export default function ExplainersHubPage({ onBack }: Props) {
  const [page, setPage] = useState<Page>('hub');
  const [selectedPreset, setSelectedPreset] = useState<LegoScenario | null>(null);
  const [coldInletC, setColdInletC] = useState<LabControls['coldInletC']>(10);
  const [combiDhwKw, setCombiDhwKw] = useState(30);
  const [mainsDynamicFlowLpm, setMainsDynamicFlowLpm] = useState(12);
  const [pipeDiameterMm, setPipeDiameterMm] = useState<LabControls['pipeDiameterMm']>(15);
  const [outlets, setOutlets] = useState<OutletControl[]>(defaultOutlets());

  const labControls: LabControls = {
    coldInletC,
    dhwSetpointC: 50,
    combiDhwKw,
    mainsDynamicFlowLpm,
    pipeDiameterMm,
    outlets,
  };

  const labSummary = computeCapacitySummary(labControls);

  /** Update a single field of one outlet by id, preserving all other outlet data. */
  function updateOutlet(id: OutletControl['id'], patch: Partial<Omit<OutletControl, 'id'>>) {
    setOutlets(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  }

  if (page === 'builder') {
    return (
      <div className="hub-page">
        <div className="hub-page__header">
          <button className="hub-back-btn" onClick={() => setPage('hub')}>← Back to Demo Lab</button>
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
          <button className="hub-back-btn" onClick={() => setPage('hub')}>← Back to Demo Lab</button>
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
          <h1 className="hub-page__title">Demo Lab</h1>
          <p className="hub-page__subtitle">Physics explainers & sandbox</p>
        </div>
      </div>

      {/* ── iPad-first Lab layout ────────────────────────────────────────── */}
      <section className="explainers-section demo-lab-section" style={{ marginTop: '2rem' }}>
        <h2 className="explainers-section__title">Animation (beta)</h2>

        {/* Main two-column layout: canvas (left) + controls drawer (right) */}
        <div className="demo-lab-layout">

          {/* Left: schematic canvas (dominant) */}
          <div className="demo-lab-canvas">
            <LabCanvas controls={labControls} summary={labSummary} />
          </div>

          {/* Right: controls drawer */}
          <aside className="demo-lab-controls panel-card">
            <h3 className="demo-lab-controls__title">Controls</h3>

            {/* Cold inlet */}
            <div className="demo-lab-field">
              <span className="demo-lab-field__label">Cold inlet</span>
              <div className="demo-lab-field__seg">
                {([5, 10, 15] as LabControls['coldInletC'][]).map(c => (
                  <button
                    key={c}
                    className={`demo-lab-seg-btn${coldInletC === c ? ' demo-lab-seg-btn--active' : ''}`}
                    onClick={() => setColdInletC(c)}
                  >
                    {c} °C
                  </button>
                ))}
              </div>
            </div>

            {/* Combi kW */}
            <div className="demo-lab-field">
              <label className="demo-lab-field__label" htmlFor="lab-kw">
                Combi output: <strong>{combiDhwKw} kW</strong>
              </label>
              <input
                id="lab-kw"
                className="demo-lab-field__range"
                type="range" min={24} max={40} step={1}
                value={combiDhwKw}
                onChange={e => setCombiDhwKw(Number(e.target.value))}
              />
            </div>

            {/* Mains flow */}
            <div className="demo-lab-field">
              <label className="demo-lab-field__label" htmlFor="lab-mains">
                Mains flow: <strong>{mainsDynamicFlowLpm} L/min</strong>
              </label>
              <input
                id="lab-mains"
                className="demo-lab-field__range"
                type="range" min={6} max={25} step={1}
                value={mainsDynamicFlowLpm}
                onChange={e => setMainsDynamicFlowLpm(Number(e.target.value))}
              />
            </div>

            {/* Pipe diameter */}
            <div className="demo-lab-field">
              <span className="demo-lab-field__label">Pipe diameter</span>
              <div className="demo-lab-field__seg">
                {([15, 22] as LabControls['pipeDiameterMm'][]).map(d => (
                  <button
                    key={d}
                    className={`demo-lab-seg-btn${pipeDiameterMm === d ? ' demo-lab-seg-btn--active' : ''}`}
                    onClick={() => setPipeDiameterMm(d)}
                  >
                    {d} mm
                  </button>
                ))}
              </div>
            </div>

            {/* Per-outlet cards */}
            <div className="demo-lab-field">
              <span className="demo-lab-field__label">Outlets</span>
            </div>
            {outlets.map(outlet => {
              const delivered = labSummary.outletDeliveredLpm[outlet.id];
              return (
                <div
                  key={outlet.id}
                  className={`demo-lab-outlet-card${outlet.enabled ? ' demo-lab-outlet-card--enabled' : ''}`}
                >
                  {/* Header row: toggle + kind */}
                  <div className="demo-lab-outlet-card__header">
                    <label className="demo-lab-outlet-card__toggle">
                      <input
                        type="checkbox"
                        checked={outlet.enabled}
                        onChange={e => updateOutlet(outlet.id, { enabled: e.target.checked })}
                      />
                      <strong>Outlet {outlet.id}</strong>
                    </label>
                    <select
                      className="demo-lab-outlet-card__kind"
                      value={outlet.kind}
                      onChange={e => updateOutlet(outlet.id, { kind: e.target.value as OutletControl['kind'] })}
                    >
                      {OUTLET_KINDS.map(k => (
                        <option key={k} value={k}>{KIND_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Demand slider */}
                  <div className="demo-lab-outlet-card__demand">
                    <label htmlFor={`lab-outlet-${outlet.id}-demand`} className="demo-lab-field__label">
                      Demand: <strong>{outlet.demandLpm} L/min</strong>
                    </label>
                    <input
                      id={`lab-outlet-${outlet.id}-demand`}
                      className="demo-lab-field__range"
                      type="range" min={2} max={25} step={1}
                      value={outlet.demandLpm}
                      onChange={e => updateOutlet(outlet.id, { demandLpm: Number(e.target.value) })}
                    />
                  </div>

                  {/* Readout */}
                  {outlet.enabled && (
                    <div className="demo-lab-outlet-card__readout">
                      <span>{delivered.toFixed(1)} L/min delivered</span>
                    </div>
                  )}
                </div>
              );
            })}
          </aside>
        </div>

        {/* Bottom: instrument strip */}
        <InstrumentStrip summary={labSummary} />
      </section>

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
