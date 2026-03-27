/**
 * HeatLossStep.tsx
 *
 * Step: House / Heat Loss
 *
 * The primary surface is the canvas-based HeatLossCalculator (house-shape /
 * shell model).  Roof modelling controls (type, orientation, shading, PV,
 * battery) are integrated directly into the calculator's side panel via the
 * `roofModel` / `onRoofModelChange` props.
 *
 * The calculator calls `onHeatLossChange` whenever the derived heat-loss
 * value changes, and this step auto-persists that value in HeatLossState
 * with confidence set to 'estimated'.
 *
 * Design principles:
 *  - House-shape calculator is the canonical heat-loss method (not a form)
 *  - Roof modelling lives on the same surface — not in a separate wizard
 *  - Navigation buttons are rendered outside the calculator
 */

import type { CSSProperties } from 'react';
import type { HeatLossState } from './heatLossTypes';
import { INITIAL_HEAT_LOSS_STATE } from './heatLossTypes';
import HeatLossCalculator, { INITIAL_ROOF_MODEL } from '../../../components/heatloss/HeatLossCalculator';
import type { RoofModel } from '../../../components/heatloss/HeatLossCalculator';

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

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0',
};

const navStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '1rem 0 0',
  borderTop: '1px solid #e2e8f0',
  marginTop: '0.5rem',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function HeatLossStep({
  state,
  onChange,
  onNext,
  onPrev,
}: HeatLossStepProps) {
  // Derive a RoofModel slice from HeatLossState for the calculator's roof panel
  const roofModel: RoofModel = {
    roofType:        state.roofType,
    roofOrientation: state.roofOrientation,
    shadingLevel:    state.shadingLevel,
    pvStatus:        state.pvStatus,
    batteryStatus:   state.batteryStatus,
  };

  function handleHeatLossChange(totalKw: number | null) {
    // Auto-populate the heat loss value from the calculator result.
    // We mark confidence as 'estimated' since it comes from the shell model.
    onChange({
      ...state,
      estimatedPeakHeatLossW: totalKw != null ? Math.round(totalKw * 1000) : null,
      heatLossConfidence: totalKw != null ? 'estimated' : state.heatLossConfidence,
    });
  }

  function handleRoofModelChange(next: RoofModel) {
    onChange({
      ...state,
      roofType:        next.roofType,
      roofOrientation: next.roofOrientation,
      shadingLevel:    next.shadingLevel,
      pvStatus:        next.pvStatus,
      batteryStatus:   next.batteryStatus,
    });
  }

  return (
    <div style={wrapperStyle} data-testid="heat-loss-step">
      {/* ── Primary surface: house-shape heat-loss calculator ───────────── */}
      <HeatLossCalculator
        embedded
        onHeatLossChange={handleHeatLossChange}
        roofModel={roofModel}
        onRoofModelChange={handleRoofModelChange}
      />

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <div style={navStyle}>
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

// Keep INITIAL_ROOF_MODEL accessible from this module for convenience
export { INITIAL_ROOF_MODEL };

