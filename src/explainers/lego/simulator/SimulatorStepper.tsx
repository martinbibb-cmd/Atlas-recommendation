/**
 * SimulatorStepper — guided setup journey before the simulator dashboard.
 *
 * Covers 6 steps:
 *   1. System type          — which heating system family
 *   2. Control strategy     — explicit layout / control scheme (no silent mapping)
 *   3. Components           — arrangement details derived from system type
 *   4. Water services       — occupancy and bathroom count
 *   5. Building physics     — fabric type (heat loss / thermal mass)
 *   6. Condition            — current system health
 *
 * On completion, calls onComplete(config) to open the simulator.
 *
 * Step 2 exposes the control strategy / layout explicitly so the simulator
 * never silently maps unvented → S-plan or open-vented → Y-plan.  Users can
 * choose the correct scheme for their property.
 */

import { useState } from 'react';
import type { SimulatorSystemChoice } from './useSystemDiagramPlayback';
import type { ControlStrategy } from './systemInputsTypes';

export type StepperConfig = {
  systemChoice: SimulatorSystemChoice;
  /** Explicit control strategy / layout chosen in step 2. */
  controlStrategy: ControlStrategy;
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

const TOTAL_STEPS = 6;

const SYSTEM_CHOICES: { value: SimulatorSystemChoice; label: string; description: string; icon: string }[] = [
  {
    value: 'combi',
    label: 'Combi boiler',
    description: 'on-demand hot water via plate heat exchanger. No cylinder. CH pauses during any hot-water draw.',
    icon: '🔥',
  },
  {
    value: 'unvented',
    label: 'Unvented cylinder',
    description: 'mains-fed pressurised cylinder with system boiler.',
    icon: '🛢',
  },
  {
    value: 'open_vented',
    label: 'Open vented cylinder',
    description: 'Tank-fed hot water from a cold-water storage cistern. Tank-fed cold supply.',
    icon: '🪣',
  },
  {
    value: 'heat_pump',
    label: 'Heat pump',
    description: 'Air-source heat pump with primary thermal store. Low flow temps, high COP, no condensing classification.',
    icon: '🌬',
  },
];

// ─── Control strategy choices per system type ─────────────────────────────────

type ControlStrategyChoice = {
  value: ControlStrategy;
  label: string;
  description: string;
  icon: string;
}

const CONTROL_STRATEGY_CHOICES: ControlStrategyChoice[] = [
  {
    value: 'combi',
    label: 'Combi',
    description: 'Combi boiler with plate heat exchanger. No zone valves or cylinder needed.',
    icon: '🔥',
  },
  {
    value: 's_plan',
    label: 'S-plan',
    description: 'Independent CH and DHW zones via motorised zone valves. Simultaneous CH and reheat is possible.',
    icon: '🔀',
  },
  {
    value: 'y_plan',
    label: 'Y-plan',
    description: 'Mid-position valve. Cannot run CH and DHW at full output simultaneously — the valve prioritises one zone.',
    icon: '↕',
  },
  {
    value: 'heat_pump',
    label: 'HP layout',
    description: 'Heat pump primary loop with primary thermal store. Low flow temperatures throughout.',
    icon: '🌬',
  },
]

/**
 * Returns the relevant control strategy options for the selected system type.
 * Each system type has a natural default, but users can choose alternatives.
 */
function controlStrategyOptionsFor(systemChoice: SimulatorSystemChoice): ControlStrategyChoice[] {
  if (systemChoice === 'combi')      return CONTROL_STRATEGY_CHOICES.filter(c => c.value === 'combi')
  if (systemChoice === 'heat_pump')  return CONTROL_STRATEGY_CHOICES.filter(c => c.value === 'heat_pump')
  // unvented, open_vented, and mixergy can use either S-plan or Y-plan
  return CONTROL_STRATEGY_CHOICES.filter(c => c.value === 's_plan' || c.value === 'y_plan')
}

/**
 * Returns the natural / most-common default control strategy for a given
 * system type.  This is a pre-fill only — the user can always override it.
 *
 * unvented   → s_plan  (S-plan is the norm for system boilers with unvented cylinders)
 * open_vented → y_plan (Y-plan is the norm for regular boilers with vented cylinders)
 * combi      → combi
 * heat_pump  → heat_pump
 * mixergy   → s_plan
 */
function defaultControlStrategyFor(systemChoice: SimulatorSystemChoice): ControlStrategy {
  switch (systemChoice) {
    case 'combi':       return 'combi'
    case 'unvented':    return 's_plan'
    case 'open_vented': return 'y_plan'
    case 'heat_pump':   return 'heat_pump'
    case 'mixergy':     return 's_plan'
  }
}

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

// ─── Step 2: Control strategy / layout ───────────────────────────────────────

function Step2({ systemChoice, controlStrategy, onSelect }: {
  systemChoice: SimulatorSystemChoice;
  controlStrategy: ControlStrategy;
  onSelect: (cs: ControlStrategy) => void;
}) {
  const options = controlStrategyOptionsFor(systemChoice)
  const isSingleOption = options.length === 1

  return (
    <div className="stepper-step">
      <h2 className="stepper-step__heading">Control strategy / layout</h2>
      <p className="stepper-step__hint">
        Choose the zone valve arrangement and control scheme for this system.
        {!isSingleOption && ' The most common option for your system type is pre-selected — change it if your setup differs.'}
      </p>
      <div className="stepper-choice-grid">
        {options.map(c => (
          <button
            key={c.value}
            className={`stepper-choice-card${controlStrategy === c.value ? ' stepper-choice-card--selected' : ''}`}
            onClick={() => onSelect(c.value)}
            aria-pressed={controlStrategy === c.value}
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

// ─── Step 3: Components / arrangement ────────────────────────────────────────

const ARRANGEMENT_LABELS: Record<SimulatorSystemChoice, string> = {
  combi:       'Combi boiler — plate HEX, expansion vessel, single zone',
  unvented:    'System boiler — unvented cylinder, expansion vessel',
  open_vented: 'Regular boiler — vented cylinder, CWS cistern',
  heat_pump:   'ASHP — primary loop, unvented cylinder, UFH or low-temp radiators',
  mixergy:     'System boiler — Mixergy stratified cylinder with top-down heating control',
};

const STRATEGY_LABELS: Record<ControlStrategy, string> = {
  combi:      'No zone valves (combi)',
  s_plan:     'S-plan zone valves — independent CH and DHW circuits',
  y_plan:     'Y-plan mid-position valve',
  heat_pump:  'Heat pump primary layout',
}

function Step3({ systemChoice, controlStrategy }: {
  systemChoice: SimulatorSystemChoice;
  controlStrategy: ControlStrategy;
}) {
  return (
    <div className="stepper-step">
      <h2 className="stepper-step__heading">System arrangement</h2>
      <p className="stepper-step__hint">
        The component layout is determined by your system type and control strategy.
      </p>
      <div className="stepper-info-card">
        <span className="stepper-info-card__label">System type</span>
        <span className="stepper-info-card__value">{ARRANGEMENT_LABELS[systemChoice]}</span>
      </div>
      <div className="stepper-info-card">
        <span className="stepper-info-card__label">Control strategy</span>
        <span className="stepper-info-card__value">{STRATEGY_LABELS[controlStrategy]}</span>
      </div>
      <p className="stepper-step__hint" style={{ marginTop: 16 }}>
        The schematic diagram will display the correct components, pipes, and zone valves
        for this arrangement.
      </p>
    </div>
  );
}

// ─── Step 4: Water services ───────────────────────────────────────────────────

type WaterServices = { occupancy: number; bathrooms: number };

function Step4({ services, onChange }: {
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

// ─── Step 5: Building physics ─────────────────────────────────────────────────

type FabricType = 'light' | 'medium' | 'heavy';

const FABRIC_OPTIONS: { value: FabricType; label: string; description: string }[] = [
  { value: 'light',  label: 'Light',  description: 'Newer build or well-insulated. Low heat loss, short warm-up.' },
  { value: 'medium', label: 'Medium', description: 'Typical semi or terrace. Moderate heat loss and thermal mass.'  },
  { value: 'heavy',  label: 'Heavy',  description: 'Solid stone or brick. High thermal mass, slow to warm and cool.' },
];

function Step5({ fabric, onSelect }: {
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

// ─── Step 6: Condition ────────────────────────────────────────────────────────

type Condition = 'new' | 'fair' | 'poor';

const CONDITION_OPTIONS: { value: Condition; label: string; description: string }[] = [
  { value: 'new',  label: 'New / clean',  description: 'No sludge or scale. Full efficiency.' },
  { value: 'fair', label: 'Fair',         description: 'Some sludge or light scale. Mild efficiency loss.' },
  { value: 'poor', label: 'Poor',         description: 'Significant sludge or heavy scale. Noticeable efficiency penalty.' },
];

function Step6({ condition, onSelect }: {
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
  const [step, setStep]                 = useState(1);
  const [systemChoice, setSystemChoice] = useState<SimulatorSystemChoice>('combi');
  const [controlStrategy, setControlStrategy] = useState<ControlStrategy>('combi');
  const [services, setServices]         = useState<WaterServices>({ occupancy: 2, bathrooms: 1 });
  const [fabric, setFabric]             = useState<FabricType>('medium');
  const [condition, setCondition]       = useState<Condition>('fair');

  function handleSystemChoiceChange(choice: SimulatorSystemChoice) {
    setSystemChoice(choice);
    // Pre-fill the most natural control strategy for this system type.
    // The user can change it on step 2.
    setControlStrategy(defaultControlStrategyFor(choice));
  }

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    } else {
      onComplete({
        systemChoice,
        controlStrategy,
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
        {step === 1 && <Step1 systemChoice={systemChoice} onSelect={handleSystemChoiceChange} />}
        {step === 2 && <Step2 systemChoice={systemChoice} controlStrategy={controlStrategy} onSelect={setControlStrategy} />}
        {step === 3 && <Step3 systemChoice={systemChoice} controlStrategy={controlStrategy} />}
        {step === 4 && <Step4 services={services} onChange={setServices} />}
        {step === 5 && <Step5 fabric={fabric} onSelect={setFabric} />}
        {step === 6 && <Step6 condition={condition} onSelect={setCondition} />}
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