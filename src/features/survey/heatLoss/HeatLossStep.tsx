/**
 * HeatLossStep.tsx
 *
 * Step: House / Heat Loss
 *
 * Two sections in one step:
 *
 *  1) Heat loss context
 *     - Peak heat loss estimate (watts) and confidence level
 *     - Key drivers summary
 *
 *  2) Roof / solar
 *     - Roof type: pitched | flat | mixed | unknown
 *     - Main usable roof orientation via RoofOrientationPicker
 *     - Shading level
 *     - PV status (none / existing / planned)
 *     - Battery status (none / existing / planned)
 *
 * Design principles:
 *  - Simple, scannable layout
 *  - Touch-friendly controls
 *  - Physics-honest labels (no pricing language)
 *  - Roof orientation lives here — not in a separate solar questionnaire
 */

import type { CSSProperties, ChangeEvent } from 'react';
import type { HeatLossState, RoofType, ShadingLevel, PvStatus, BatteryStatus } from './heatLossTypes';
import { INITIAL_HEAT_LOSS_STATE } from './heatLossTypes';
import { RoofOrientationPicker } from './RoofOrientationPicker';
import { solarSuitabilitySummary, heatLossConfidenceLabel } from './heatLossDerivations';

export { INITIAL_HEAT_LOSS_STATE };

// ─── Props ────────────────────────────────────────────────────────────────────

interface HeatLossStepProps {
  state: HeatLossState;
  onChange: (next: HeatLossState) => void;
  onNext: () => void;
  onPrev: () => void;
  /** Optional: current engine-derived heat loss in watts (from prior calculation). */
  engineHeatLossW?: number | null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionHeadingStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
  marginTop: '1.5rem',
};

const dividerStyle: CSSProperties = {
  border: 'none',
  borderTop: '1px solid #e2e8f0',
  margin: '1.25rem 0',
};

const fieldRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  marginBottom: '0.85rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#4a5568',
};

const inputStyle: CSSProperties = {
  padding: '0.45rem 0.65rem',
  borderRadius: '6px',
  border: '1px solid #cbd5e0',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
};

function chipGroupStyle(): CSSProperties {
  return {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
  };
}

function chipStyle(isSelected: boolean): CSSProperties {
  return {
    padding: '0.35rem 0.75rem',
    borderRadius: '20px',
    border: isSelected ? '2px solid #2b6cb0' : '1px solid #cbd5e0',
    background: isSelected ? '#ebf8ff' : '#f7fafc',
    color: isSelected ? '#2b6cb0' : '#4a5568',
    fontWeight: isSelected ? 700 : 500,
    fontSize: '0.82rem',
    cursor: 'pointer',
    transition: 'border-color 0.12s, background 0.12s',
    userSelect: 'none' as const,
  };
}

const summaryBoxStyle: CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.6rem 0.85rem',
  background: '#f0fff4',
  border: '1px solid #9ae6b4',
  borderRadius: '6px',
  fontSize: '0.78rem',
  color: '#276749',
  lineHeight: 1.5,
};

// ─── Helper chip group ────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  options,
  labels,
  value,
  onChange,
  testIdPrefix,
}: {
  options: T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
  testIdPrefix: string;
}) {
  return (
    <div style={chipGroupStyle()}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          data-testid={`${testIdPrefix}-${opt}`}
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
          style={chipStyle(value === opt)}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HeatLossStep({
  state,
  onChange,
  onNext,
  onPrev,
  engineHeatLossW,
}: HeatLossStepProps) {
  // ── Setters ──────────────────────────────────────────────────────────────
  function set<K extends keyof HeatLossState>(key: K, value: HeatLossState[K]) {
    onChange({ ...state, [key]: value });
  }

  function handleHeatLossInput(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.trim();
    if (raw === '') {
      set('estimatedPeakHeatLossW', null);
    } else {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) {
        set('estimatedPeakHeatLossW', parsed);
      }
    }
  }

  // ── Roof type labels ──────────────────────────────────────────────────────
  const roofTypeLabels: Record<RoofType, string> = {
    pitched: 'Pitched',
    flat:    'Flat',
    mixed:   'Mixed',
    unknown: 'Unknown',
  };

  // ── Shading labels ────────────────────────────────────────────────────────
  const shadingLabels: Record<ShadingLevel, string> = {
    little_or_none: 'Little or none',
    some:           'Some',
    heavy:          'Heavy',
    unknown:        'Unknown',
  };

  // ── PV labels ─────────────────────────────────────────────────────────────
  const pvLabels: Record<PvStatus, string> = {
    none:     'None',
    existing: 'Existing',
    planned:  'Planned',
  };

  // ── Battery labels ────────────────────────────────────────────────────────
  const batteryLabels: Record<BatteryStatus, string> = {
    none:     'None',
    existing: 'Existing',
    planned:  'Planned',
  };

  // ── Solar summary ─────────────────────────────────────────────────────────
  const solar = solarSuitabilitySummary(state);

  // ── Display heat loss ─────────────────────────────────────────────────────
  const displayW =
    state.estimatedPeakHeatLossW != null
      ? state.estimatedPeakHeatLossW
      : engineHeatLossW ?? null;

  return (
    <div className="step-card" data-testid="heat-loss-step">
      <h2>🏠 House &amp; Heat Loss</h2>
      <p style={{ color: '#4a5568', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
        Capture the thermal profile of the home and the roof's solar potential.
      </p>

      {/* ── Section 1: Heat loss ─────────────────────────────────────────── */}
      <p style={sectionHeadingStyle}>Heat Loss</p>

      {/* Peak heat loss */}
      <div style={fieldRowStyle}>
        <label htmlFor="heat-loss-watts" style={labelStyle}>
          Peak design heat loss (W)
        </label>
        <input
          id="heat-loss-watts"
          type="number"
          inputMode="numeric"
          min={500}
          max={50000}
          step={100}
          placeholder={displayW != null ? String(displayW) : 'e.g. 8000'}
          value={state.estimatedPeakHeatLossW != null ? state.estimatedPeakHeatLossW : ''}
          onChange={handleHeatLossInput}
          style={inputStyle}
          data-testid="heat-loss-watts-input"
        />
        {engineHeatLossW != null && state.estimatedPeakHeatLossW == null && (
          <p style={{ fontSize: '0.75rem', color: '#718096', margin: 0 }}>
            Derived estimate: {(engineHeatLossW / 1000).toFixed(1)} kW — tap to override
          </p>
        )}
      </div>

      {/* Confidence */}
      <div style={fieldRowStyle}>
        <span style={labelStyle}>Confidence</span>
        <ChipGroup
          options={['measured', 'estimated', 'default', 'unknown'] as HeatLossState['heatLossConfidence'][]}
          labels={{
            measured:  heatLossConfidenceLabel('measured'),
            estimated: heatLossConfidenceLabel('estimated'),
            default:   heatLossConfidenceLabel('default'),
            unknown:   heatLossConfidenceLabel('unknown'),
          }}
          value={state.heatLossConfidence}
          onChange={(v) => set('heatLossConfidence', v)}
          testIdPrefix="hl-confidence"
        />
      </div>

      <hr style={dividerStyle} />

      {/* ── Section 2: Roof / solar ──────────────────────────────────────── */}
      <p style={sectionHeadingStyle}>Roof &amp; Solar</p>

      {/* Roof type */}
      <div style={fieldRowStyle}>
        <span style={labelStyle}>Roof type</span>
        <ChipGroup
          options={['pitched', 'flat', 'mixed', 'unknown'] as RoofType[]}
          labels={roofTypeLabels}
          value={state.roofType}
          onChange={(v) => set('roofType', v)}
          testIdPrefix="roof-type"
        />
      </div>

      {/* Roof orientation */}
      <div style={fieldRowStyle}>
        <span style={labelStyle}>Main usable roof orientation</span>
        <p style={{ fontSize: '0.75rem', color: '#718096', margin: '0 0 0.5rem' }}>
          Select the direction the main usable roof face points toward (where panels would face).
        </p>
        <RoofOrientationPicker
          value={state.roofOrientation}
          onChange={(v) => set('roofOrientation', v)}
        />
      </div>

      {/* Shading */}
      <div style={fieldRowStyle}>
        <span style={labelStyle}>Shading on main roof face</span>
        <ChipGroup
          options={['little_or_none', 'some', 'heavy', 'unknown'] as ShadingLevel[]}
          labels={shadingLabels}
          value={state.shadingLevel}
          onChange={(v) => set('shadingLevel', v)}
          testIdPrefix="shading"
        />
      </div>

      {/* PV */}
      <div style={fieldRowStyle}>
        <span style={labelStyle}>Solar PV panels</span>
        <ChipGroup
          options={['none', 'existing', 'planned'] as PvStatus[]}
          labels={pvLabels}
          value={state.pvStatus}
          onChange={(v) => set('pvStatus', v)}
          testIdPrefix="pv-status"
        />
      </div>

      {/* Battery */}
      <div style={fieldRowStyle}>
        <span style={labelStyle}>Battery storage</span>
        <ChipGroup
          options={['none', 'existing', 'planned'] as BatteryStatus[]}
          labels={batteryLabels}
          value={state.batteryStatus}
          onChange={(v) => set('batteryStatus', v)}
          testIdPrefix="battery-status"
        />
      </div>

      {/* Solar summary */}
      {solar && (
        <div style={summaryBoxStyle} data-testid="solar-summary">
          {solar}
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <div className="step-actions" style={{ marginTop: '1.5rem' }}>
        <button className="back-btn" type="button" onClick={onPrev}>
          ← Back
        </button>
        <button className="next-btn" type="button" onClick={onNext}>
          Next →
        </button>
      </div>
    </div>
  );
}
