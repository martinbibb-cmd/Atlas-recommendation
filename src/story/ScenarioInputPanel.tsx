/**
 * ScenarioInputPanel.tsx
 *
 * Renders a compact, scenario-scoped input panel.
 * Supports both combi_switch and old_boiler_reality scenarios.
 *
 * No Shower dropdown selectors — demand is driven by household size and
 * bathroom count heuristics only (per custom_instruction rule 6).
 */
import type { CombiSwitchInputs, OldBoilerRealityInputs } from './scenarioRegistry';

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
