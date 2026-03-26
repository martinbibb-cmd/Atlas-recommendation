/**
 * EnergyScenarioSimulator.tsx
 *
 * Educational grid scenario explorer.
 *
 * Sliders: wind, solar, nuclear, hydro/tidal, storage, gas
 * Outputs: gas dependence, balancing stress, carbon intensity,
 *          retail electricity pressure, heat pump attractiveness
 *
 * Labelled clearly as educational — not a market forecast.
 */

import { useState } from 'react';
import EnergyExplainerCard from './EnergyExplainerCard';
import { runEnergyScenarioModel } from '../lib/energyScenarioModel';
import { DEFAULT_SCENARIO_SLIDERS } from '../data/energyScenarioDefaults';
import { formatCo2Intensity } from '../lib/energyFormatting';
import { ENERGY_COPY } from '../data/energyExplainerCopy';
import type { EnergyScenarioSliders } from '../types/energyTypes';
import './EnergyScenarioSimulator.css';

// ─── Slider row sub-component ─────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  accent?: string;
}

function SliderRow({ label, value, min = 0, max = 100, step = 1, onChange, accent }: SliderRowProps) {
  return (
    <div className="ess__slider-row">
      <div className="ess__slider-label-row">
        <label className="ess__slider-label">{label}</label>
        <span className="ess__slider-value">{value}%</span>
      </div>
      <input
        type="range"
        className="ess__slider"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--slider-accent': accent } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label}: ${value}%`}
      />
    </div>
  );
}

// ─── Output metric row ────────────────────────────────────────────────────────

interface MetricProps {
  label: string;
  value: string;
  description: string;
  sentiment?: 'good' | 'neutral' | 'bad';
}

function Metric({ label, value, description, sentiment = 'neutral' }: MetricProps) {
  return (
    <div className={`ess__metric ess__metric--${sentiment}`}>
      <div className="ess__metric-value">{value}</div>
      <div className="ess__metric-label">{label}</div>
      <div className="ess__metric-desc">{description}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EnergyScenarioSimulator() {
  const [sliders, setSliders] = useState<EnergyScenarioSliders>(DEFAULT_SCENARIO_SLIDERS);

  const set = (key: keyof EnergyScenarioSliders) => (v: number) =>
    setSliders((s) => ({ ...s, [key]: v }));

  const outputs = runEnergyScenarioModel(sliders);

  return (
    <EnergyExplainerCard
      title={ENERGY_COPY.simulator.title}
      badge="Explainer"
      className="ess"
    >
      <p className="ess__subtitle">{ENERGY_COPY.simulator.subtitle}</p>

      <div className="ess__disclaimer">{ENERGY_COPY.simulator.disclaimer}</div>

      <div className="ess__layout">

        {/* ── Sliders panel ──────────────────────────────────────────────── */}
        <div className="ess__sliders">
          <div className="ess__sliders-heading">Generation mix</div>
          <SliderRow label="Wind" value={sliders.windPct} onChange={set('windPct')} accent="#38a169" />
          <SliderRow label="Solar" value={sliders.solarPct} onChange={set('solarPct')} accent="#d69e2e" />
          <SliderRow label="Nuclear" value={sliders.nuclearPct} onChange={set('nuclearPct')} accent="#3182ce" />
          <SliderRow label="Hydro / tidal" value={sliders.hydroTidalPct} onChange={set('hydroTidalPct')} accent="#6366f1" />
          <SliderRow label="Grid storage" value={sliders.storagePct} onChange={set('storagePct')} accent="#718096" />
          <SliderRow label="Gas" value={sliders.gasPct} onChange={set('gasPct')} accent="#e53e3e" />
        </div>

        {/* ── Outputs panel ──────────────────────────────────────────────── */}
        <div className="ess__outputs">
          <div className="ess__outputs-heading">Indicative outcomes</div>
          <div className="ess__metrics">
            <Metric
              label="Carbon intensity"
              value={formatCo2Intensity(outputs.carbonIntensityGPerKwh)}
              description="Operational g CO₂/kWh"
              sentiment={outputs.carbonIntensityGPerKwh < 100 ? 'good' : outputs.carbonIntensityGPerKwh < 250 ? 'neutral' : 'bad'}
            />
            <Metric
              label="Gas dependence"
              value={`${outputs.gasDependencePct}%`}
              description="Share of dispatchable capacity"
              sentiment={outputs.gasDependencePct < 30 ? 'good' : outputs.gasDependencePct < 60 ? 'neutral' : 'bad'}
            />
            <Metric
              label="Balancing stress"
              value={`${outputs.balancingStressScore}/100`}
              description="Intermittency vs. firm capacity"
              sentiment={outputs.balancingStressScore < 30 ? 'good' : outputs.balancingStressScore < 60 ? 'neutral' : 'bad'}
            />
            <Metric
              label="Retail price pressure"
              value={`${outputs.retailElectricityPressureScore}/100`}
              description="Upward pressure on electricity price"
              sentiment={outputs.retailElectricityPressureScore < 30 ? 'good' : outputs.retailElectricityPressureScore < 60 ? 'neutral' : 'bad'}
            />
            <Metric
              label="Heat pump attractiveness"
              value={`${outputs.heatPumpAttractivenessScore}/100`}
              description="Higher = stronger economic case"
              sentiment={outputs.heatPumpAttractivenessScore > 60 ? 'good' : outputs.heatPumpAttractivenessScore > 30 ? 'neutral' : 'bad'}
            />
          </div>
        </div>

      </div>

    </EnergyExplainerCard>
  );
}
