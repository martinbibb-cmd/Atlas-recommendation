/**
 * ExploreOptionsPanel.tsx
 *
 * Constrained exploration panel for the customer portal.
 *
 * Lets the customer compare realistic alternatives without exposing
 * expert-only inputs.  Survey-derived home/system inputs stay locked.
 *
 * Allowed controls:
 *   - System type (Combi / System boiler + cylinder / Heat pump)
 *   - Hot water usage (Low / Typical / High)
 *   - Heating style (Steady / Responsive)
 *
 * Not editable:
 *   - Heat loss / fabric
 *   - Emitters
 *   - Pipework
 *   - Mains pressure/flow
 *   - Expert assumptions
 *
 * Naming:
 *   - Called "Explore your options" — never "Simulator".
 *   - Labels are customer-safe plain English.
 *
 * Rules:
 *   - All data comes from EngineOutputV1 via the engine.
 *   - No Math.random().
 *   - Locked survey inputs are shown but not editable.
 */

import { useState, useMemo } from 'react';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import { runEngine } from '../../engine/Engine';
import TradeOffSummary from '../advice/TradeOffSummary';
import { buildTradeOffSummary } from '../../lib/advice/buildTradeOffSummary';
import './ExploreOptionsPanel.css';

// ─── Customer-safe choice types ───────────────────────────────────────────────

export type SystemChoice = 'combi' | 'system_cylinder' | 'heat_pump';
export type HotWaterUsage = 'low' | 'typical' | 'high';
export type HeatingStyle = 'steady' | 'responsive';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Base engine input derived from the survey — locked fields come from here. */
  baseInput: EngineInputV2_3;
  /** Original engine output for the recommended system (used for comparison). */
  originalOutput: EngineOutputV1;
}

// ─── Override application ─────────────────────────────────────────────────────

/**
 * Apply customer-safe overrides to the canonical survey-derived engine input.
 * Only the three customer controls are changed; everything else stays locked.
 */
function applyOverrides(
  base: EngineInputV2_3,
  systemChoice: SystemChoice,
  hotWaterUsage: HotWaterUsage,
  heatingStyle: HeatingStyle,
): EngineInputV2_3 {
  const overridden = { ...base };

  // System type mapping
  switch (systemChoice) {
    case 'combi':
      overridden.preferCombi = true;
      overridden.currentHeatSourceType = 'combi';
      break;
    case 'system_cylinder':
      overridden.preferCombi = false;
      overridden.currentHeatSourceType = 'system';
      break;
    case 'heat_pump':
      overridden.preferCombi = false;
      overridden.currentHeatSourceType = 'ashp';
      break;
  }

  // Hot water usage → occupancy count mapping
  switch (hotWaterUsage) {
    case 'low':
      overridden.occupancyCount = Math.min(base.occupancyCount ?? 2, 2);
      overridden.highOccupancy = false;
      break;
    case 'typical':
      // Keep base occupancy
      break;
    case 'high':
      overridden.occupancyCount = Math.max(base.occupancyCount ?? 2, 4);
      overridden.highOccupancy = true;
      break;
  }

  // Heating style → occupancy signature mapping
  switch (heatingStyle) {
    case 'steady':
      overridden.occupancySignature = 'steady_home';
      break;
    case 'responsive':
      overridden.occupancySignature = 'professional';
      break;
  }

  return overridden;
}

// ─── System choice labels ─────────────────────────────────────────────────────

const SYSTEM_LABELS: Record<SystemChoice, string> = {
  combi: 'Combi boiler',
  system_cylinder: 'System boiler + cylinder',
  heat_pump: 'Heat pump',
};

const USAGE_LABELS: Record<HotWaterUsage, string> = {
  low: 'Low',
  typical: 'Typical',
  high: 'High',
};

const STYLE_LABELS: Record<HeatingStyle, string> = {
  steady: 'Steady',
  responsive: 'Responsive',
};

// ─── Component ────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function deriveDefaultSystemChoice(input: EngineInputV2_3): SystemChoice {
  if (input.currentHeatSourceType === 'ashp') return 'heat_pump';
  if (input.preferCombi) return 'combi';
  return 'system_cylinder';
}

export default function ExploreOptionsPanel({ baseInput, originalOutput }: Props) {
  const [systemChoice, setSystemChoice] = useState<SystemChoice>(
    deriveDefaultSystemChoice(baseInput),
  );
  const [hotWaterUsage, setHotWaterUsage] = useState<HotWaterUsage>('typical');
  const [heatingStyle, setHeatingStyle] = useState<HeatingStyle>('responsive');

  // Run engine with overrides
  const exploredOutput = useMemo(() => {
    const input = applyOverrides(baseInput, systemChoice, hotWaterUsage, heatingStyle);
    const result = runEngine(input);
    return result.engineOutput;
  }, [baseInput, systemChoice, hotWaterUsage, heatingStyle]);

  const tradeOffSummary = useMemo(
    () => buildTradeOffSummary(exploredOutput, baseInput.currentHeatSourceType),
    [exploredOutput, baseInput.currentHeatSourceType],
  );

  // Detect if explored option performs worse than original
  const isWorse =
    exploredOutput.recommendation.primary !== originalOutput.recommendation.primary;

  return (
    <div className="explore-options" data-testid="explore-options-panel">
      <h3 className="explore-options__title">Explore your options</h3>
      <p className="explore-options__intro">
        See how different choices affect your recommendation. Your home details
        stay locked to keep the comparison realistic.
      </p>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="explore-options__controls" aria-label="Exploration controls">
        {/* System type */}
        <fieldset className="explore-options__field">
          <legend className="explore-options__legend">System type</legend>
          <div className="explore-options__choices">
            {(Object.keys(SYSTEM_LABELS) as SystemChoice[]).map((key) => (
              <label key={key} className="explore-options__choice">
                <input
                  type="radio"
                  name="system-choice"
                  value={key}
                  checked={systemChoice === key}
                  onChange={() => setSystemChoice(key)}
                />
                <span>{SYSTEM_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Hot water usage */}
        <fieldset className="explore-options__field">
          <legend className="explore-options__legend">Hot water usage</legend>
          <div className="explore-options__choices">
            {(Object.keys(USAGE_LABELS) as HotWaterUsage[]).map((key) => (
              <label key={key} className="explore-options__choice">
                <input
                  type="radio"
                  name="hot-water-usage"
                  value={key}
                  checked={hotWaterUsage === key}
                  onChange={() => setHotWaterUsage(key)}
                />
                <span>{USAGE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Heating style */}
        <fieldset className="explore-options__field">
          <legend className="explore-options__legend">Heating style</legend>
          <div className="explore-options__choices">
            {(Object.keys(STYLE_LABELS) as HeatingStyle[]).map((key) => (
              <label key={key} className="explore-options__choice">
                <input
                  type="radio"
                  name="heating-style"
                  value={key}
                  checked={heatingStyle === key}
                  onChange={() => setHeatingStyle(key)}
                />
                <span>{STYLE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* ── Worse-option warning ─────────────────────────────────────────── */}
      {isWorse && (
        <div className="explore-options__warning" role="alert" data-testid="explore-options-warning">
          <span className="explore-options__warning-icon" aria-hidden="true">⚠️</span>
          <span>
            This combination leads to a different recommendation
            ({exploredOutput.recommendation.primary}) compared to the original
            assessment. The original recommendation was chosen because it better
            suits your home.
          </span>
        </div>
      )}

      {/* ── Trade-off summary ────────────────────────────────────────────── */}
      {tradeOffSummary != null && (
        <div className="explore-options__result">
          <h4 className="explore-options__result-heading">
            Explored: {exploredOutput.recommendation.primary}
          </h4>
          <TradeOffSummary summary={tradeOffSummary} />
        </div>
      )}

      {/* ── Locked inputs notice ─────────────────────────────────────────── */}
      <div className="explore-options__locked" aria-label="Locked inputs">
        <span className="explore-options__locked-icon" aria-hidden="true">🔒</span>
        <span className="explore-options__locked-text">
          Home details (heat loss, fabric, emitters, pipework, mains data) are
          locked to your survey results to keep comparisons realistic.
        </span>
      </div>
    </div>
  );
}
