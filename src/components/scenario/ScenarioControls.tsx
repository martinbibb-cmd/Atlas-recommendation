import ScenarioChip from './ScenarioChip';
import type { ScenarioState } from '../../scenario/scenarioEngineAdapter';
import './scenarioControls.css';

interface Props {
  scenario: ScenarioState;
  onChange: (next: ScenarioState) => void;
}

export default function ScenarioControls({ scenario, onChange }: Props) {
  const activeChips: Array<{ label: string; onRemove: () => void }> = [];

  if (scenario.extraShowers > 0) {
    activeChips.push({
      label: scenario.extraShowers === 1 ? 'Shower' : `${scenario.extraShowers} showers`,
      onRemove: () => onChange({ ...scenario, extraShowers: 0 }),
    });
  }

  if (scenario.bathRunning) {
    activeChips.push({
      label: 'Bath',
      onRemove: () => onChange({ ...scenario, bathRunning: false }),
    });
  }

  if (scenario.kitchenTap) {
    activeChips.push({
      label: 'Kitchen tap',
      onRemove: () => onChange({ ...scenario, kitchenTap: false }),
    });
  }

  if (scenario.utilityTap) {
    activeChips.push({
      label: 'Utility tap',
      onRemove: () => onChange({ ...scenario, utilityTap: false }),
    });
  }

  if (scenario.heatingDemand) {
    activeChips.push({
      label: 'Heating demand',
      onRemove: () => onChange({ ...scenario, heatingDemand: false }),
    });
  }

  if (scenario.boilerOutputOverrideKw) {
    activeChips.push({
      label: `Boiler ${scenario.boilerOutputOverrideKw} kW`,
      onRemove: () => onChange({ ...scenario, boilerOutputOverrideKw: undefined }),
    });
  }

  return (
    <div className="scenario-controls" aria-label="What if scenario controls">
      <div className="scenario-controls__title">What if…?</div>
      <div className="scenario-controls__actions">
        <button
          type="button"
          className={`scenario-controls__toggle${scenario.extraShowers > 0 ? ' scenario-controls__toggle--active' : ''}`}
          onClick={() => onChange({ ...scenario, extraShowers: scenario.extraShowers > 0 ? 0 : 1 })}
        >
          + Shower
        </button>
        <button
          type="button"
          className={`scenario-controls__toggle${scenario.bathRunning ? ' scenario-controls__toggle--active' : ''}`}
          onClick={() => onChange({ ...scenario, bathRunning: !scenario.bathRunning })}
        >
          + Bath
        </button>
        <button
          type="button"
          className={`scenario-controls__toggle${scenario.kitchenTap ? ' scenario-controls__toggle--active' : ''}`}
          onClick={() => onChange({ ...scenario, kitchenTap: !scenario.kitchenTap })}
        >
          Kitchen tap
        </button>
        <button
          type="button"
          className={`scenario-controls__toggle${scenario.utilityTap ? ' scenario-controls__toggle--active' : ''}`}
          onClick={() => onChange({ ...scenario, utilityTap: !scenario.utilityTap })}
        >
          Utility tap
        </button>
        <button
          type="button"
          className={`scenario-controls__toggle${scenario.heatingDemand ? ' scenario-controls__toggle--active' : ''}`}
          onClick={() => onChange({ ...scenario, heatingDemand: !scenario.heatingDemand })}
        >
          Heating demand
        </button>
        <button
          type="button"
          className={`scenario-controls__toggle${scenario.boilerOutputOverrideKw ? ' scenario-controls__toggle--active' : ''}`}
          onClick={() => onChange({ ...scenario, boilerOutputOverrideKw: scenario.boilerOutputOverrideKw ? undefined : 18 })}
        >
          Reduce boiler output
        </button>
      </div>

      {activeChips.length > 0 && (
        <div className="scenario-controls__active">
          <span className="scenario-controls__active-label">Active scenarios</span>
          <div className="scenario-controls__chips">
            {activeChips.map(chip => (
              <ScenarioChip
                key={chip.label}
                label={chip.label}
                onRemove={chip.onRemove}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
