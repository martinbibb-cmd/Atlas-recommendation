/**
 * ScenarioInputPanel.tsx
 *
 * Renders a compact, scenario-scoped input panel.
 * Supports combi_switch, old_boiler_reality, and heat_pump_viability scenarios.
 *
 * No Shower dropdown selectors — demand is driven by household size and
 * bathroom count heuristics only (per custom_instruction rule 6).
 */
import type { CombiSwitchInputs, OldBoilerRealityInputs } from './scenarioRegistry';
import { COMBI_OUTPUT_KW_OPTIONS } from '../engine/presets/DhwFlowPresets';
import type { HeatPumpViabilityInputs } from './scenarios/heatPumpViability';

// ── Shared chip button ────────────────────────────────────────────────────────

function ChipButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`chip-btn${active ? ' chip-btn--active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="form-field">
      <label className="form-field__label">{label}</label>
      <div className="chip-group">
        {options.map(opt => (
          <ChipButton
            key={opt.value}
            label={opt.label}
            active={value === opt.value}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Combi Switch input panel ──────────────────────────────────────────────────

interface CombiSwitchPanelProps {
  inputs: CombiSwitchInputs;
  onChange: (inputs: CombiSwitchInputs) => void;
}

export function CombiSwitchInputPanel({ inputs, onChange }: CombiSwitchPanelProps) {
  function set<K extends keyof CombiSwitchInputs>(key: K, value: CombiSwitchInputs[K]) {
    onChange({ ...inputs, [key]: value });
  }

  return (
    <div className="scenario-input-panel">
      <p className="scenario-input-panel__intent">
        Let&apos;s see how hot water and heating behave in your household.
      </p>

      <section className="cockpit-group">
        <h4>Household</h4>

        {/* Occupants */}
        <div className="form-field">
          <label className="form-field__label">Occupants</label>
          <div className="chip-group">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <ChipButton
                key={n}
                label={String(n)}
                active={inputs.occupancyCount === n}
                onClick={() => set('occupancyCount', n)}
              />
            ))}
            <ChipButton
              label="7+"
              active={inputs.occupancyCount >= 7}
              onClick={() => set('occupancyCount', 7)}
            />
          </div>
        </div>

        {/* Bathrooms */}
        <div className="form-field">
          <label className="form-field__label">Bathrooms</label>
          <div className="chip-group">
            {[1, 2, 3].map(n => (
              <ChipButton
                key={n}
                label={String(n)}
                active={inputs.bathroomCount === n}
                onClick={() => set('bathroomCount', n)}
              />
            ))}
            <ChipButton
              label="4+"
              active={inputs.bathroomCount >= 4}
              onClick={() => set('bathroomCount', 4)}
            />
          </div>
        </div>

        {/* Simultaneous use */}
        <ChipGroup
          label="Simultaneous hot water use"
          options={[
            { value: 'rare',      label: 'Rare' },
            { value: 'sometimes', label: 'Sometimes' },
            { value: 'often',     label: 'Often' },
          ]}
          value={inputs.simultaneousUse}
          onChange={v => set('simultaneousUse', v)}
        />
      </section>

      <section className="cockpit-group">
        <h4>Water supply</h4>

        <ChipGroup
          label="Mains flow known?"
          options={[
            { value: 'known',   label: 'Known' },
            { value: 'unknown', label: 'Unknown' },
          ]}
          value={inputs.mainsFlowLpmKnown ? 'known' : 'unknown'}
          onChange={v => set('mainsFlowLpmKnown', v === 'known')}
        />

        {inputs.mainsFlowLpmKnown && (
          <div className="form-field">
            <label className="form-field__label">Mains flow (L/min): {inputs.mainsFlowLpm}</label>
            <input
              type="range"
              min={6}
              max={30}
              step={1}
              value={inputs.mainsFlowLpm}
              onChange={e => set('mainsFlowLpm', Number(e.target.value))}
              className="range-input"
            />
            <div className="range-labels">
              <span>6</span>
              <span>30</span>
            </div>
          </div>
        )}

        {!inputs.mainsFlowLpmKnown && (
          <ChipGroup
            label="Hot water demand"
            options={[
              { value: 'low',    label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high',   label: 'High' },
            ]}
            value={inputs.hotWaterDemand}
            onChange={v => set('hotWaterDemand', v)}
          />
        )}
      </section>

      <section className="cockpit-group">
        <h4>DHW sizing presets</h4>

        <ChipGroup
          label="Cold supply (season)"
          options={[
            { value: 'winter',  label: 'Winter (5°C)' },
            { value: 'typical', label: 'Typical (10°C)' },
            { value: 'summer',  label: 'Summer (15°C)' },
          ]}
          value={inputs.season}
          onChange={v => set('season', v)}
        />

        <ChipGroup
          label="DHW mode (combi target)"
          options={[
            { value: 'normal', label: 'Normal (50°C)' },
            { value: 'high',   label: 'High (55°C)' },
          ]}
          value={inputs.dhwMode}
          onChange={v => set('dhwMode', v)}
        />

        <ChipGroup
          label="Shower type"
          options={[
            { value: 'mixer',      label: 'Mixer (10 L/min)' },
            { value: 'mixer_high', label: 'Mixer high (12 L/min)' },
            { value: 'rainfall',   label: 'Rainfall (16 L/min)' },
          ]}
          value={inputs.showerPreset}
          onChange={v => set('showerPreset', v)}
        />
      </section>

      <section className="cockpit-group">
        <h4>System type</h4>

        {/* Combi output kW — drives heat-limit line on the graph */}
        <div className="form-field">
          <label className="form-field__label">Combi boiler output (kW)</label>
          <div className="chip-group">
            {COMBI_OUTPUT_KW_OPTIONS.map(kw => (
              <ChipButton
                key={kw}
                label={`${kw} kW`}
                active={inputs.combiKw === kw}
                onClick={() => set('combiKw', kw)}
              />
            ))}
          </div>
          <p className="form-field__hint">
            Larger combi → higher heat-limit line on the concurrency graph.
          </p>
        </div>

        {/* Property type — heat demand context */}
        <ChipGroup
          label="Property type"
          options={[
            { value: 'flat',         label: 'Flat (~3 kW)' },
            { value: 'small_house',  label: 'Small house (~5 kW)' },
            { value: 'medium_house', label: 'Medium house (~8 kW)' },
            { value: 'large_house',  label: 'Large house (~12 kW)' },
          ]}
          value={inputs.propertyType}
          onChange={v => set('propertyType', v)}
        />
      </section>

      <section className="cockpit-group">
        <h4>Daily water &amp; heat usage</h4>

        {/* Showers per day */}
        <div className="form-field">
          <label className="form-field__label">Showers per day</label>
          <div className="chip-group">
            {([1, 2, 3, 4] as const).map(n => (
              <ChipButton
                key={n}
                label={n === 4 ? '4+' : String(n)}
                active={inputs.showersPerDay === n}
                onClick={() => set('showersPerDay', n)}
              />
            ))}
          </div>
        </div>

        {/* Shower duration */}
        <ChipGroup
          label="Shower duration"
          options={[
            { value: 'quick',    label: 'Quick (5 min)' },
            { value: 'standard', label: 'Standard (8 min)' },
            { value: 'long',     label: 'Long (12 min)' },
          ]}
          value={inputs.showerDurationPreset}
          onChange={v => set('showerDurationPreset', v)}
        />

        {/* Baths per day */}
        <div className="form-field">
          <label className="form-field__label">Baths per day</label>
          <div className="chip-group">
            {([0, 1, 2] as const).map(n => (
              <ChipButton
                key={n}
                label={n === 2 ? '2+' : String(n)}
                active={inputs.bathsPerDay === n}
                onClick={() => set('bathsPerDay', n)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Old Boiler Reality input panel ───────────────────────────────────────────

interface OldBoilerPanelProps {
  inputs: OldBoilerRealityInputs;
  onChange: (inputs: OldBoilerRealityInputs) => void;
}

export function OldBoilerRealityInputPanel({ inputs, onChange }: OldBoilerPanelProps) {
  function set<K extends keyof OldBoilerRealityInputs>(key: K, value: OldBoilerRealityInputs[K]) {
    onChange({ ...inputs, [key]: value });
  }

  return (
    <div className="scenario-input-panel">
      <p className="scenario-input-panel__intent">
        Let&apos;s compare the as-manufactured rating vs likely real-world performance today.
      </p>

      <section className="cockpit-group">
        <h4>Boiler</h4>

        <div className="form-field">
          <label className="form-field__label">Boiler age (years): {inputs.boilerAgeYears}</label>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={inputs.boilerAgeYears}
            onChange={e => set('boilerAgeYears', Number(e.target.value))}
            className="range-input"
          />
          <div className="range-labels">
            <span>0</span>
            <span>30+</span>
          </div>
        </div>

        <ChipGroup
          label="As-manufactured band (ErP)"
          options={(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const).map(b => ({ value: b, label: `Band ${b}` }))}
          value={inputs.manufacturedBand}
          onChange={v => set('manufacturedBand', v)}
        />

        <ChipGroup
          label="SEDBUK % known?"
          options={[
            { value: 'known',   label: 'I know the %' },
            { value: 'unknown', label: 'Use band midpoint' },
          ]}
          value={inputs.manufacturedSedbukPctKnown ? 'known' : 'unknown'}
          onChange={v => set('manufacturedSedbukPctKnown', v === 'known')}
        />

        {inputs.manufacturedSedbukPctKnown && (
          <div className="form-field">
            <label className="form-field__label">SEDBUK %: {inputs.manufacturedSedbukPct}</label>
            <input
              type="range"
              min={50}
              max={99}
              step={1}
              value={inputs.manufacturedSedbukPct}
              onChange={e => set('manufacturedSedbukPct', Number(e.target.value))}
              className="range-input"
            />
            <div className="range-labels">
              <span>50</span>
              <span>99</span>
            </div>
          </div>
        )}
      </section>

      <section className="cockpit-group">
        <h4>Controls &amp; condition</h4>

        <ChipGroup
          label="Controls type"
          options={[
            { value: 'basic_stat',   label: 'Basic stat' },
            { value: 'prog_stat',    label: 'Programmer' },
            { value: 'modulating',   label: 'Modulating' },
            { value: 'weather_comp', label: 'Weather comp' },
          ]}
          value={inputs.controlsType}
          onChange={v => set('controlsType', v)}
        />

        <ChipGroup
          label="System condition"
          options={[
            { value: 'clean',               label: 'Clean' },
            { value: 'some_contamination',  label: 'Some contamination' },
            { value: 'heavy_contamination', label: 'Heavy contamination' },
            { value: 'unknown',             label: 'Unknown' },
          ]}
          value={inputs.systemCleanliness}
          onChange={v => set('systemCleanliness', v)}
        />

        <ChipGroup
          label="Magnetic filter present"
          options={[
            { value: 'yes',     label: 'Yes' },
            { value: 'no',      label: 'No' },
            { value: 'unknown', label: 'Unknown' },
          ]}
          value={inputs.filterPresent}
          onChange={v => set('filterPresent', v)}
        />
      </section>
    </div>
  );
}

// ── Heat Pump Viability input panel ──────────────────────────────────────────

interface HeatPumpViabilityPanelProps {
  inputs: HeatPumpViabilityInputs;
  onChange: (inputs: HeatPumpViabilityInputs) => void;
}

export function HeatPumpViabilityInputPanel({ inputs, onChange }: HeatPumpViabilityPanelProps) {
  function set<K extends keyof HeatPumpViabilityInputs>(key: K, value: HeatPumpViabilityInputs[K]) {
    onChange({ ...inputs, [key]: value });
  }

  return (
    <div className="scenario-input-panel">
      <p className="scenario-input-panel__intent">
        Let&apos;s assess what an air source heat pump would need to perform well here.
      </p>

      <section className="cockpit-group">
        <h4>Heat loss</h4>

        <ChipGroup
          label="Heat loss known?"
          options={[
            { value: 'known',   label: 'Known' },
            { value: 'unknown', label: 'Unknown' },
          ]}
          value={inputs.heatLossKnown ? 'known' : 'unknown'}
          onChange={v => set('heatLossKnown', v === 'known')}
        />

        {inputs.heatLossKnown && (
          <div className="form-field">
            <label className="form-field__label">
              Heat loss (W): {inputs.heatLossWatts}
            </label>
            <input
              type="range"
              min={2000}
              max={20000}
              step={500}
              value={inputs.heatLossWatts}
              onChange={e => set('heatLossWatts', Number(e.target.value))}
              className="range-input"
            />
            <div className="range-labels">
              <span>2 kW</span>
              <span>20 kW</span>
            </div>
          </div>
        )}
      </section>

      <section className="cockpit-group">
        <h4>Emitters &amp; pipework</h4>

        <ChipGroup
          label="Radiators"
          options={[
            { value: 'mostly_doubles', label: 'Mostly doubles' },
            { value: 'mixed',          label: 'Mixed' },
            { value: 'mostly_singles', label: 'Mostly singles' },
          ]}
          value={inputs.radiatorsType}
          onChange={v => set('radiatorsType', v)}
        />

        <ChipGroup
          label="Primary pipe size known?"
          options={[
            { value: 'known',   label: 'Known' },
            { value: 'unknown', label: 'Unknown' },
          ]}
          value={inputs.primaryPipeDiameterKnown ? 'known' : 'unknown'}
          onChange={v => set('primaryPipeDiameterKnown', v === 'known')}
        />

        {inputs.primaryPipeDiameterKnown && (
          <ChipGroup
            label="Primary pipe diameter (mm)"
            options={[
              { value: '15', label: '15 mm' },
              { value: '22', label: '22 mm' },
              { value: '28', label: '28 mm' },
            ]}
            value={String(inputs.primaryPipeDiameter)}
            onChange={v => set('primaryPipeDiameter', Number(v) as 15 | 22 | 28)}
          />
        )}
      </section>

      <section className="cockpit-group">
        <h4>Comfort &amp; siting</h4>

        <ChipGroup
          label="Comfort preference"
          options={[
            { value: 'steady_heat',   label: 'Steady background heat' },
            { value: 'fast_response', label: 'Fast pick-up' },
          ]}
          value={inputs.comfortPreference}
          onChange={v => set('comfortPreference', v)}
        />

        <ChipGroup
          label="Outdoor space available?"
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no',  label: 'No' },
          ]}
          value={inputs.outdoorSpace ? 'yes' : 'no'}
          onChange={v => set('outdoorSpace', v === 'yes')}
        />
      </section>
    </div>
  );
}
