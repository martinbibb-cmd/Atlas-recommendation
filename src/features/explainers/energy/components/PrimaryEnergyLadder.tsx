/**
 * PrimaryEnergyLadder.tsx
 *
 * Renders three side-by-side lanes showing how much useful heat is delivered
 * from one unit of gas via three different pathways:
 *   1. Gas boiler (direct combustion)
 *   2. Electric resistance (gas → grid → resistance element)
 *   3. Heat pump (gas → grid → heat pump)
 *
 * Props allow the numbers to be overridden for scenario exploration.
 * All derived values come from energyMath.ts helpers.
 */

import EnergyExplainerCard from './EnergyExplainerCard';
import {
  estimateUsefulHeatFromBoiler,
  estimateUsefulHeatFromResistanceElectric,
  estimateUsefulHeatFromHeatPump,
} from '../lib/energyMath';
import { formatEfficiencyPct } from '../lib/energyFormatting';
import { ENERGY_COPY } from '../data/energyExplainerCopy';
import './PrimaryEnergyLadder.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Boiler seasonal efficiency, 0–1.  Default: 0.92 */
  boilerEfficiency?: number;
  /** Gas power-station conversion efficiency, 0–1.  Default: 0.47 */
  gasToElectricEfficiency?: number;
  /** Heat pump COP.  Default: 3.2 */
  heatPumpCop?: number;
}

// ─── Lane sub-component ───────────────────────────────────────────────────────

interface LaneProps {
  label: string;
  steps: { label: string; pct: number }[];
  usefulHeat: number;
  accent: string;
  isWinner?: boolean;
}

function Lane({ label, steps, usefulHeat, accent, isWinner }: LaneProps) {
  return (
    <div className={`pel__lane${isWinner ? ' pel__lane--winner' : ''}`} style={{ '--lane-accent': accent } as React.CSSProperties}>
      <div className="pel__lane-label">{label}</div>
      <div className="pel__steps">
        {steps.map((step, i) => (
          <div key={i} className="pel__step">
            <div
              className="pel__step-bar"
              style={{ width: `${step.pct}%` }}
              aria-label={`${step.label}: ${step.pct}%`}
            />
            <span className="pel__step-label">{step.label}</span>
          </div>
        ))}
      </div>
      <div className="pel__useful-heat">
        <span className="pel__useful-heat-value">{formatEfficiencyPct(usefulHeat)}</span>
        <span className="pel__useful-heat-label">{ENERGY_COPY.primaryLadder.usefulHeatLabel}</span>
      </div>
      {isWinner && <div className="pel__winner-badge">Best</div>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrimaryEnergyLadder({
  boilerEfficiency = 0.92,
  gasToElectricEfficiency = 0.47,
  heatPumpCop = 3.2,
}: Props) {
  const boilerHeat = estimateUsefulHeatFromBoiler(boilerEfficiency);
  const resistanceHeat = estimateUsefulHeatFromResistanceElectric(gasToElectricEfficiency);
  const heatPumpHeat = estimateUsefulHeatFromHeatPump(gasToElectricEfficiency, heatPumpCop);

  // Normalise to boiler = 100% for the bar widths
  const max = Math.max(boilerHeat, resistanceHeat, heatPumpHeat);

  const lanes: LaneProps[] = [
    {
      label: ENERGY_COPY.primaryLadder.gasBoilerLabel,
      accent: '#e53e3e',
      usefulHeat: boilerHeat,
      steps: [
        { label: 'Gas input', pct: 100 },
        { label: `Combustion (${formatEfficiencyPct(boilerEfficiency)})`, pct: Math.round(boilerHeat / max * 100) },
      ],
      isWinner: false,
    },
    {
      label: ENERGY_COPY.primaryLadder.resistanceLabel,
      accent: '#d69e2e',
      usefulHeat: resistanceHeat,
      steps: [
        { label: 'Gas input', pct: 100 },
        { label: `Power station (${formatEfficiencyPct(gasToElectricEfficiency)})`, pct: Math.round(gasToElectricEfficiency * 100) },
        { label: `Resistance heat (100%)`, pct: Math.round(resistanceHeat / max * 100) },
      ],
      isWinner: false,
    },
    {
      label: ENERGY_COPY.primaryLadder.heatPumpLabel,
      accent: '#38a169',
      usefulHeat: heatPumpHeat,
      steps: [
        { label: 'Gas input', pct: 100 },
        { label: `Power station (${formatEfficiencyPct(gasToElectricEfficiency)})`, pct: Math.round(gasToElectricEfficiency * 100) },
        { label: `Heat pump (COP ${heatPumpCop})`, pct: Math.round(heatPumpHeat / max * 100) },
      ],
      isWinner: true,
    },
  ];

  return (
    <EnergyExplainerCard
      title={ENERGY_COPY.primaryLadder.title}
      badge="Phase 1"
      className="pel"
    >
      <p className="pel__subtitle">{ENERGY_COPY.primaryLadder.subtitle}</p>

      <div className="pel__lanes">
        {lanes.map((lane) => (
          <Lane key={lane.label} {...lane} />
        ))}
      </div>

      <p className="pel__note">{ENERGY_COPY.primaryLadder.note}</p>
    </EnergyExplainerCard>
  );
}
