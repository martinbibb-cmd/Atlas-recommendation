/**
 * LegoScenarioBuilder — form-based DHW scenario composer (v1).
 *
 * Uses a template selector (Vented / Unvented / Combi) and a handful of
 * configurable fields to generate a LegoScenario graph on the fly.
 *
 * Renders in three view modes:
 *  - Performance (default for customers)
 *  - Plumbing Stack (for engineers)
 *  - System Flow (for engineers)
 *
 * Validation issues are shown in a panel below the controls.
 */

import { useState, useMemo } from 'react';
import type { LegoScenario, ViewMode } from '../schema/legoTypes';
import { validateGraph } from '../validation/validateGraph';
import type { ValidationIssue } from '../validation/validateGraph';
import {
  computeCombiThermalLimit,
  pipeDiameterCapacityLpm,
  computeCapacityChain,
} from '../model/dhwModel';
import PerformanceGraphicView from '../views/PerformanceGraphicView';
import PlumbingStackView from '../views/PlumbingStackView';
import SystemFlowView from '../views/SystemFlowView';

// ─── System template ──────────────────────────────────────────────────────────

type SystemTemplate = 'combi' | 'vented' | 'unvented';

const TEMPLATE_LABELS: Record<SystemTemplate, string> = {
  combi:    'Combi — on-demand hot water',
  vented:   'Vented cylinder — tank-fed',
  unvented: 'Unvented cylinder — mains-fed',
};

// ─── Builder state ────────────────────────────────────────────────────────────

interface BuilderState {
  template: SystemTemplate;
  mainsFlowLpm: number;
  coldTempC: 5 | 10 | 15;
  dhwOutputKw: number;
  pipeDiameterMm: 15 | 22;
  simultaneousOutlets: 1 | 2 | 3;
  demandFlowLpm: number;
  cylinderVolumeL: number;
}

const DEFAULT_STATE: BuilderState = {
  template: 'combi',
  mainsFlowLpm: 16,
  coldTempC: 10,
  dhwOutputKw: 30,
  pipeDiameterMm: 15,
  simultaneousOutlets: 1,
  demandFlowLpm: 10,
  cylinderVolumeL: 150,
};

// ─── Graph generator ──────────────────────────────────────────────────────────

function buildScenario(s: BuilderState): LegoScenario {
  const description =
    s.template === 'combi'
      ? `On-demand hot water at ${s.coldTempC} °C cold inlet, ${s.dhwOutputKw} kW output, ${s.simultaneousOutlets} outlet${s.simultaneousOutlets > 1 ? 's' : ''}.`
      : s.template === 'vented'
      ? `Tank-fed stored hot water, ${s.cylinderVolumeL} L cylinder, ${s.simultaneousOutlets} outlet${s.simultaneousOutlets > 1 ? 's' : ''}.`
      : `Mains-fed unvented cylinder, ${s.cylinderVolumeL} L, ${s.simultaneousOutlets} outlet${s.simultaneousOutlets > 1 ? 's' : ''}.`;

  const meta = {
    name: TEMPLATE_LABELS[s.template],
    description,
    tags: [s.template],
  };

  if (s.template === 'combi') {
    const blocks: LegoScenario['graph']['blocks'] = [
      { id: 'mains', type: 'mains_supply',         params: { dynamicFlowLpm: s.mainsFlowLpm, confidence: 'med' } },
      { id: 'pipe',  type: 'pipe_section',          params: { diameterMm: s.pipeDiameterMm } },
      { id: 'hex',   type: 'boiler_combi_dhw_hex',  params: { dhwOutputKw: s.dhwOutputKw, coldTempC: s.coldTempC, dhwSetpointC: 50 } },
    ];
    const edges: LegoScenario['graph']['edges'] = [
      { fromBlockId: 'mains', fromPortId: 'out', toBlockId: 'pipe', toPortId: 'in' },
      { fromBlockId: 'pipe',  fromPortId: 'out', toBlockId: 'hex',  toPortId: 'in' },
    ];

    if (s.simultaneousOutlets > 1) {
      blocks.push({ id: 'split', type: 'branch_splitter', params: { branches: s.simultaneousOutlets, simultaneousUse: s.simultaneousOutlets } });
      edges.push({ fromBlockId: 'hex', fromPortId: 'out', toBlockId: 'split', toPortId: 'in' });
      for (let i = 1; i <= s.simultaneousOutlets; i++) {
        blocks.push({ id: `draw${i}`, type: 'draw_event', params: { flowLpm: s.demandFlowLpm, durationMin: 8, label: `Outlet ${i}` } });
        edges.push({ fromBlockId: 'split', fromPortId: `out${i}`, toBlockId: `draw${i}`, toPortId: 'in' });
      }
    } else {
      blocks.push({ id: 'draw1', type: 'draw_event', params: { flowLpm: s.demandFlowLpm, durationMin: 8, label: 'Outlet' } });
      edges.push({ fromBlockId: 'hex', fromPortId: 'out', toBlockId: 'draw1', toPortId: 'in' });
    }

    return { meta, graph: { blocks, edges } };
  }

  if (s.template === 'vented') {
    return {
      meta,
      graph: {
        blocks: [
          { id: 'tank',  type: 'tank_head',        params: { headMeters: 3 } },
          { id: 'pipe',  type: 'pipe_section',      params: { diameterMm: s.pipeDiameterMm } },
          { id: 'cyl',   type: 'cylinder_vented',   params: { volumeL: s.cylinderVolumeL } },
          { id: 'draw1', type: 'draw_event',         params: { flowLpm: s.demandFlowLpm, durationMin: 8 } },
        ],
        edges: [
          { fromBlockId: 'tank', fromPortId: 'out', toBlockId: 'pipe',  toPortId: 'in' },
          { fromBlockId: 'pipe', fromPortId: 'out', toBlockId: 'cyl',   toPortId: 'in' },
          { fromBlockId: 'cyl',  fromPortId: 'out', toBlockId: 'draw1', toPortId: 'in' },
        ],
      },
    };
  }

  // unvented
  return {
    meta,
    graph: {
      blocks: [
        { id: 'mains',  type: 'mains_supply',          params: { dynamicFlowLpm: s.mainsFlowLpm, confidence: 'med' } },
        { id: 'inlet',  type: 'unvented_inlet_group',   params: { setPressureBar: 3, maxFlowLpm: s.mainsFlowLpm } },
        { id: 'cyl',    type: 'cylinder_unvented',      params: { volumeL: s.cylinderVolumeL } },
        { id: 'draw1',  type: 'draw_event',              params: { flowLpm: s.demandFlowLpm, durationMin: 8 } },
      ],
      edges: [
        { fromBlockId: 'mains',  fromPortId: 'out', toBlockId: 'inlet',  toPortId: 'in' },
        { fromBlockId: 'inlet',  fromPortId: 'out', toBlockId: 'cyl',    toPortId: 'in' },
        { fromBlockId: 'cyl',    fromPortId: 'out', toBlockId: 'draw1',  toPortId: 'in' },
      ],
    },
  };
}

// ─── Computed props builder ────────────────────────────────────────────────────

function computeForScenario(s: BuilderState) {
  const deltaT = 50 - s.coldTempC;

  const components = [];

  // Supply
  if (s.mainsFlowLpm > 0 && s.template !== 'vented') {
    components.push({ label: 'Supply capacity', maxFlowLpm: s.mainsFlowLpm });
  }
  // Pipe
  const pipeCap = pipeDiameterCapacityLpm(s.pipeDiameterMm);
  components.push({ label: `Pipe (${s.pipeDiameterMm} mm)`, maxFlowLpm: pipeCap });

  // Combi thermal limit
  if (s.template === 'combi') {
    const thermalLimit = computeCombiThermalLimit({
      dhwOutputKw: s.dhwOutputKw,
      coldTempC: s.coldTempC,
      setpointC: 50,
    });
    components.push({ label: 'Thermal capacity (combi HEX)', maxFlowLpm: thermalLimit });
  }

  // Cylinder (no flow cap in v1 — storage just stores)
  if (s.template !== 'combi') {
    components.push({ label: 'Stored cylinder', maxFlowLpm: undefined });
  }

  // Distribution per outlet
  const totalDemand = s.simultaneousOutlets * s.demandFlowLpm;
  components.push({ label: 'Distribution demand', maxFlowLpm: totalDemand });

  return {
    ...computeCapacityChain(components),
    deltaT,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LegoScenarioBuilder() {
  const [state, setState] = useState<BuilderState>(DEFAULT_STATE);
  const [viewMode, setViewMode] = useState<ViewMode>('performance');

  const scenario = useMemo(() => buildScenario(state), [state]);
  const computed  = useMemo(() => computeForScenario(state), [state]);
  const issues: ValidationIssue[] = useMemo(() => validateGraph(scenario.graph), [scenario]);

  function set<K extends keyof BuilderState>(key: K, value: BuilderState[K]) {
    setState(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="lego-builder">

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="lego-builder__controls">

        {/* System template */}
        <div className="lego-field">
          <label className="lego-field__label" htmlFor="lego-template">System template</label>
          <select
            id="lego-template"
            className="lego-field__select"
            value={state.template}
            onChange={e => set('template', e.target.value as SystemTemplate)}
          >
            {(Object.keys(TEMPLATE_LABELS) as SystemTemplate[]).map(t => (
              <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Cold temp (combi only) */}
        {state.template === 'combi' && (
          <div className="lego-field">
            <label className="lego-field__label">Cold inlet temperature</label>
            <div className="segment-control" role="group" aria-label="Cold inlet temperature">
              {([5, 10, 15] as const).map(t => (
                <button
                  key={t}
                  className={`segment-control__btn${state.coldTempC === t ? ' segment-control__btn--active' : ''}`}
                  onClick={() => set('coldTempC', t)}
                >
                  {t} °C{t === 5 ? ' (winter)' : t === 15 ? ' (summer)' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DHW output (combi only) */}
        {state.template === 'combi' && (
          <div className="lego-field">
            <label className="lego-field__label" htmlFor="lego-dhwkw">
              Combi DHW output: {state.dhwOutputKw} kW
            </label>
            <input
              id="lego-dhwkw"
              className="lego-field__range"
              type="range"
              min={18}
              max={45}
              step={1}
              value={state.dhwOutputKw}
              onChange={e => set('dhwOutputKw', Number(e.target.value))}
            />
          </div>
        )}

        {/* Cylinder volume (stored systems) */}
        {state.template !== 'combi' && (
          <div className="lego-field">
            <label className="lego-field__label" htmlFor="lego-vol">
              Cylinder volume: {state.cylinderVolumeL} L
            </label>
            <input
              id="lego-vol"
              className="lego-field__range"
              type="range"
              min={100}
              max={300}
              step={25}
              value={state.cylinderVolumeL}
              onChange={e => set('cylinderVolumeL', Number(e.target.value))}
            />
          </div>
        )}

        {/* Mains flow (mains-fed systems) */}
        {state.template !== 'vented' && (
          <div className="lego-field">
            <label className="lego-field__label" htmlFor="lego-mains">
              Mains dynamic flow: {state.mainsFlowLpm} L/min
            </label>
            <input
              id="lego-mains"
              className="lego-field__range"
              type="range"
              min={6}
              max={30}
              step={1}
              value={state.mainsFlowLpm}
              onChange={e => set('mainsFlowLpm', Number(e.target.value))}
            />
          </div>
        )}

        {/* Pipe diameter */}
        <div className="lego-field">
          <label className="lego-field__label">Pipe diameter</label>
          <div className="segment-control" role="group" aria-label="Pipe diameter">
            {([15, 22] as const).map(d => (
              <button
                key={d}
                className={`segment-control__btn${state.pipeDiameterMm === d ? ' segment-control__btn--active' : ''}`}
                onClick={() => set('pipeDiameterMm', d)}
              >
                {d} mm
              </button>
            ))}
          </div>
        </div>

        {/* Simultaneous outlets */}
        <div className="lego-field">
          <label className="lego-field__label">Simultaneous outlets</label>
          <div className="segment-control" role="group" aria-label="Simultaneous outlets">
            {([1, 2, 3] as const).map(n => (
              <button
                key={n}
                className={`segment-control__btn${state.simultaneousOutlets === n ? ' segment-control__btn--active' : ''}`}
                onClick={() => set('simultaneousOutlets', n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Demand per outlet */}
        <div className="lego-field">
          <label className="lego-field__label" htmlFor="lego-demand">
            Demand per outlet: {state.demandFlowLpm} L/min
          </label>
          <input
            id="lego-demand"
            className="lego-field__range"
            type="range"
            min={4}
            max={20}
            step={1}
            value={state.demandFlowLpm}
            onChange={e => set('demandFlowLpm', Number(e.target.value))}
          />
        </div>
      </div>

      {/* ── View mode toggle ──────────────────────────────────────────────── */}
      <div className="segment-control lego-builder__view-toggle" role="group" aria-label="View mode">
        {(['performance', 'plumbing', 'system'] as ViewMode[]).map(m => (
          <button
            key={m}
            className={`segment-control__btn${viewMode === m ? ' segment-control__btn--active' : ''}`}
            onClick={() => setViewMode(m)}
          >
            {m === 'performance' ? 'Performance' : m === 'plumbing' ? 'Plumbing' : 'System'}
          </button>
        ))}
      </div>

      {/* ── View ─────────────────────────────────────────────────────────── */}
      <div className="lego-builder__view">
        {viewMode === 'performance' && (
          <PerformanceGraphicView
            scenario={scenario}
            computed={computed}
            outlets={state.simultaneousOutlets}
            demandFlowLpm={state.demandFlowLpm}
          />
        )}
        {viewMode === 'plumbing' && (
          <PlumbingStackView scenario={scenario} computed={computed} />
        )}
        {viewMode === 'system' && (
          <SystemFlowView scenario={scenario} computed={computed} />
        )}
      </div>

      {/* ── Validation issues ─────────────────────────────────────────────── */}
      {issues.length > 0 && (
        <div className="lego-builder__issues">
          <h4 className="lego-builder__issues-title">Validation</h4>
          <ul className="lego-builder__issues-list">
            {issues.map((issue, i) => (
              <li
                key={i}
                className={`lego-issue lego-issue--${issue.severity}`}
              >
                {issue.severity === 'error' ? '⛔' : '⚠️'} {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
