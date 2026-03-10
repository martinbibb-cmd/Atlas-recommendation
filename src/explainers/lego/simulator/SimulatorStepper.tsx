/**
 * SimulatorStepper — guided setup journey before the simulator dashboard.
 *
 * Covers 5 steps:
 *   1. System type      — which heating system family
 *   2. Components       — arrangement details derived from system type
 *   3. Water services   — occupancy and bathroom count
 *   4. Building physics — fabric type (heat loss / thermal mass)
 *   5. Condition        — current system health
 *
 * On completion, calls onComplete(config) to open the simulator.
 *
 * Services, fabric, and condition are captured here and will be wired into
 * the simulator in a future PR once the dashboard accepts full StepperConfig.
 * For now only systemChoice is consumed by SimulatorDashboard.
 */

import { useState } from 'react';
import type { SimulatorSystemChoice } from './useSystemDiagramPlayback';

export type StepperConfig = {
  systemChoice: SimulatorSystemChoice;
  /** Number of occupants. Reserved for future simulator wiring. */
  occupancy: number;
  /** Number of bathrooms. Reserved for future simulator wiring. */
  bathrooms: number;
  /** Building fabric type. Reserved for future simulator wiring. */
  fabric: 'light' | 'medium' | 'heavy';
  /** System condition. Reserved for future simulator wiring. */
  condition: 'new' | 'fair' | 'poor';
}

interface Props {
  /** Called when the user finishes the stepper. Passes full configuration. */
  onComplete: (config: StepperConfig) => void;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const SYSTEM_CHOICES: { value: SimulatorSystemChoice; label: string; description: string; icon: string }[] = [
  {
    value: 'combi',
    label: 'Combi boiler',
    description: 'On-demand hot water via plate heat exchanger. No cylinder. CH pauses during any hot-water draw.',
    icon: '🔥',
  },
  {
    value: 'unvented',
    label: 'Unvented cylinder',
    description: 'Mains-fed pressurised cylinder with system boiler. S-plan zone valves allow simultaneous CH and reheat.',
    icon: '🛢',
  },
  {
    value: 'open_vented',
    label: 'Open vented cylinder',
    description: 'Tank-fed hot water from a cold-water storage cistern. Y-plan mid-position valve. Gravity cold supply.',
    icon: '🪣',
  },
  {
    value: 'heat_pump',
    label: 'Heat pump',
    description: 'Air-source heat pump with thermal store cylinder. Low flow temps, high COP, no condensing classification.',
    icon: '🌬',
  },
];

// ─── Step-bar component ───────────────────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  return (
    <div className="stepper-bar" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span
          key={i}
          className={`stepper-bar__dot${i + 1 === step ? ' stepper-bar__dot--active' : i + 1 < step ? ' stepper-bar__dot--done' : ''}`}
          aria-label={`Step ${i + 1}${i + 1 === step ? ' (current)' : i + 1 < step ? ' (complete)' : ''}`}
        />
      ))}
    </div>
  );
}

// ─── Step 1: System type ─────────────────────────────────────────────────────

function Step1({ systemChoice, onSelect }: {
  systemChoice: SimulatorSystemChoice;
  onSelect: (c: SimulatorSystemChoice) => void;
}) {
  return (
    <div className="stepper-step">
      <h2 className="stepper-step__heading">Choose your system type</h2>
      <p className="stepper-step__hint">
        The simulator will show the correct schematic and behaviour for your selection.
      </p>
      <div className="stepper-choice-grid">
        {SYSTEM_CHOICES.map(c => (
          <button
            key={c.value}
            className={`stepper-choice-card${systemChoice === c.value ? ' stepper-choice-card--selected' : ''}`}
            onClick={() => onSelect(c.value)}
            aria-pressed={systemChoice === c.value}
          >
            <span className="stepper-choice-card__icon" aria-hidden="true">{c.icon}</span>
            <span className="stepper-choice-card__label">{c.label}</span>
            <span className="stepper-choice-card__desc">{c.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Components / arrangement ────────────────────────────────────────

const ARRANGEMENT_LABELS: Record<SimulatorSystemChoice, string> = {
  combi:       'Combi boiler — plate HEX, expansion vessel, single zone',
  unvented:    'System boiler — S-plan zone valves, unvented cylinder, expansion vessel',
  open_vented: 'Regular boiler — Y-plan mid-position valve, vented cylinder, CWS cistern',
  heat_pump:   'ASHP — primary loop, unvented cylinder, UFH or low-temp radiators',
};

function Step2({ systemChoice }: { systemChoice: SimulatorSystemChoice }) {
  return (
    <div className="stepper-step">
      <h2 className="stepper-step__heading">System arrangement</h2>
      <p className="stepper-step__hint">
        The component layout is determined by your system type.
      </p>
      <div className="stepper-info-card">
        <span className="stepper-info-card__label">Selected arrangement</span>
        <span className="stepper-info-card__value">{ARRANGEMENT_LABELS[systemChoice]}</span>
      </div>
      <p className="stepper-step__hint" style={{ marginTop: 16 }}>
        The schematic diagram will display the correct components, pipes, and zone valves
        for this arrangement.
      </p>
    </div>
  );
}

// ─── Step 3: Water services ───────────────────────────────────────────────────

type WaterServices = { occupancy: number; bathrooms: number };

function Step3({ services, onChange }: {
  services: WaterServices;
  onChange: (s: WaterServices) => void;
}) {
  return (
    <div className="stepper-step">
      <h2 className="stepper-step__heading">Water services</h2>
      <p className="stepper-step__hint">
        Household size and bathroom count affect simultaneous demand pressure on the system.
      </p>

      <div className="stepper-field-group">
        <label className="stepper-field__label" htmlFor="occupancy-select">
          Occupancy (people)
        </label>
        <select
          id="occupancy-select"
          className="stepper-field__select"
          value={services.occupancy}
          onChange={e => onChange({ ...services, occupancy: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
          ))}
        </select>
      </div>

      <div className="stepper-field-group">
        <label className="stepper-field__label" htmlFor="bathrooms-select">
          Bathrooms
        </label>
        <select
          id="bathrooms-select"
          className="stepper-field__select"
          value={services.bathrooms}
          onChange={e => onChange({ ...services, bathrooms: Number(e.target.value) })}
        >
          {[1, 2, 3].map(n => (
            <option key={n} value={n}>{n} bathroom{n !== 1 ? 's' : ''}</option>
          ))}
        </select>
      </div>

      {services.occupancy >= 3 && services.bathrooms >= 2 && (
        <div className="stepper-warning">
          ⚠ High simultaneous demand — a combi boiler may struggle with this configuration.
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Building physics ─────────────────────────────────────────────────

type FabricType = 'light' | 'medium' | 'heavy';

const FABRIC_OPTIONS: { value: FabricType; label: string; description: string }[] = [
  { value: 'light',  label: 'Light',  description: 'Newer build or well-insulated. Low heat loss, short warm-up.' },
  { value: 'medium', label: 'Medium', description: 'Typical semi or terrace. Moderate heat loss and thermal mass.'  },
  { value: 'heavy',  label: 'Heavy',  description: 'Solid stone or brick. High thermal mass, slow to warm and cool.' },
];

function Step4({ fabric, onSelect }: {
  fabric: FabricType;
  onSelect: (f: FabricType) => void;
}) {
  return (
    <div className="stepper-step">
      <h2 className="stepper-step__heading">Building physics</h2>
      <p className="stepper-step__hint">
        Fabric type determines heat loss rate and thermal time constant (τ).
      </p>
      <div className="stepper-choice-row">
        {FABRIC_OPTIONS.map(f => (
          <button
            key={f.value}
            className={`stepper-choice-pill${fabric === f.value ? ' stepper-choice-pill--selected' : ''}`}
            onClick={() => onSelect(f.value)}
            aria-pressed={fabric === f.value}
          >
            <span className="stepper-choice-pill__label">{f.label}</span>
            <span className="stepper-choice-pill__desc">{f.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 5: Condition ────────────────────────────────────────────────────────

type Condition = 'new' | 'fair' | 'poor';

const CONDITION_OPTIONS: { value: Condition; label: string; description: string }[] = [
  { value: 'new',  label: 'New / clean',  description: 'No sludge or scale. Full efficiency.' },
  { value: 'fair', label: 'Fair',         description: 'Some sludge or light scale. Mild efficiency loss.' },
  { value: 'poor', label: 'Poor',         description: 'Significant sludge or heavy scale. Noticeable efficiency penalty.' },
];

function Step5({ condition, onSelect }: {
  condition: Condition;
  onSelect: (c: Condition) => void;
}) {
  return (
    <div className="stepper-step">
      <h2 className="stepper-step__heading">System condition</h2>
      <p className="stepper-step__hint">
        Sludge and scale reduce heat transfer efficiency and increase return temperatures.
      </p>
      <div className="stepper-choice-row">
        {CONDITION_OPTIONS.map(c => (
          <button
            key={c.value}
            className={`stepper-choice-pill${condition === c.value ? ' stepper-choice-pill--selected' : ''}`}
            onClick={() => onSelect(c.value)}
            aria-pressed={condition === c.value}
          >
            <span className="stepper-choice-pill__label">{c.label}</span>
            <span className="stepper-choice-pill__desc">{c.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main stepper ─────────────────────────────────────────────────────────────

export default function SimulatorStepper({ onComplete }: Props) {
  const [step, setStep]               = useState(1);
  const [systemChoice, setSystemChoice] = useState<SimulatorSystemChoice>('combi');
  const [services, setServices]       = useState<WaterServices>({ occupancy: 2, bathrooms: 1 });
  const [fabric, setFabric]           = useState<FabricType>('medium');
  const [condition, setCondition]     = useState<Condition>('fair');

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    } else {
      onComplete({
        systemChoice,
        occupancy: services.occupancy,
        bathrooms: services.bathrooms,
        fabric,
        condition,
      });
    }
  }

  function handleBack() {
    if (step > 1) setStep(s => s - 1);
  }

  return (
    <div className="simulator-stepper">
      <div className="stepper-header">
        <h1 className="stepper-header__title">Simulator Setup</h1>
        <p className="stepper-header__subtitle">Step {step} of {TOTAL_STEPS}</p>
        <StepBar step={step} />
      </div>

      <div className="stepper-body">
        {step === 1 && <Step1 systemChoice={systemChoice} onSelect={setSystemChoice} />}
        {step === 2 && <Step2 systemChoice={systemChoice} />}
        {step === 3 && <Step3 services={services} onChange={setServices} />}
        {step === 4 && <Step4 fabric={fabric} onSelect={setFabric} />}
        {step === 5 && <Step5 condition={condition} onSelect={setCondition} />}
      </div>

      <div className="stepper-footer">
        {step > 1 && (
          <button
            className="stepper-btn stepper-btn--back"
            onClick={handleBack}
            aria-label="Go to previous step"
          >
            ← Back
          </button>
        )}
        <button
          className="stepper-btn stepper-btn--next"
          onClick={handleNext}
          aria-label={step < TOTAL_STEPS ? 'Go to next step' : 'Launch simulator'}
        >
          {step < TOTAL_STEPS ? 'Next →' : 'Launch Simulator →'}
        </button>
      </div>
    </div>
  );
}
