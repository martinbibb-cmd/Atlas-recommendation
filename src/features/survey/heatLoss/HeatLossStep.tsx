/**
 * HeatLossStep.tsx
 *
 * Step: House / Heat Loss — bounded task shell
 *
 * The primary surface is the canvas-based HeatLossCalculator (house-shape /
 * shell model).  The calculator is wrapped in a bounded scroll region with
 * a sticky footer so that Back / Next are always reachable regardless of
 * canvas height.
 *
 * Explicit completion states:
 *   - not_started  — no points drawn yet
 *   - drawing      — points placed but shape not closed
 *   - shape_closed — valid closed polygon exists
 *   - result_ready — heat loss result derived from closed shape
 *
 * The "Next →" button is gated: disabled until the calculator produces a
 * valid heat loss result (result_ready state).  A visible reason is shown
 * when gated.
 *
 * A compact completion card surfaces the derived metrics (floor area,
 * perimeter, estimated heat loss) so the user can verify before proceeding.
 *
 * Design principles:
 *  - House-shape calculator is the canonical heat-loss method (not a form)
 *  - Roof modelling lives on the same surface — not in a separate wizard
 *  - The calculator is powerful but must behave like one survey step
 *  - Prioritize finishability over showing every builder control at once
 */

import { type CSSProperties, useMemo } from 'react';
import type { HeatLossState, ShellModel } from './heatLossTypes';
import { INITIAL_HEAT_LOSS_STATE } from './heatLossTypes';
import { getStepMeta } from '../../../config/surveyStepRegistry';
import HeatLossCalculator, { INITIAL_ROOF_MODEL } from '../../../components/heatloss/HeatLossCalculator';
import type { RoofModel } from '../../../components/heatloss/HeatLossCalculator';

export { INITIAL_HEAT_LOSS_STATE };

// ─── Completion state ─────────────────────────────────────────────────────────

export type HeatLossCompletionState =
  | 'not_started'
  | 'drawing'
  | 'shape_closed'
  | 'result_ready';

/** Derive completion state from HeatLossState. */
export function deriveCompletionState(state: HeatLossState): HeatLossCompletionState {
  if (state.estimatedPeakHeatLossW != null && state.heatLossConfidence !== 'unknown') {
    return 'result_ready';
  }
  if (state.shellModel) {
    const activeLayer = state.shellModel.layers.find(l => l.id === state.shellModel!.activeLayerId);
    if (activeLayer?.closed) return 'shape_closed';
    if (activeLayer && activeLayer.points.length > 0) return 'drawing';
  }
  return 'not_started';
}

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

const shellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  // 85vh leaves room for the browser chrome and any stepper header above this
  // component, while still giving the canvas a generous working area.
  maxHeight: '85vh',
  position: 'relative',
};

const headerStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #e2e8f0',
  background: '#fafafa',
  flexShrink: 0,
};

const scrollRegionStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderTop: '1px solid #e2e8f0',
  background: '#fafafa',
  flexShrink: 0,
  position: 'sticky',
  bottom: 0,
  zIndex: 10,
};

const completionCardStyle: CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  flexWrap: 'wrap',
  padding: '0.5rem 1rem',
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  margin: '0 1rem 0.5rem',
  fontSize: '0.85rem',
};

const gateReasonStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#9ca3af',
  maxWidth: '200px',
  textAlign: 'right',
};

const metricStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const metricValueStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '1rem',
  color: '#166534',
};

const metricLabelStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#4a5568',
};

// ─── Gate reason text ─────────────────────────────────────────────────────────

/**
 * Gate logic: the user may skip the calculator entirely (not_started → use
 * default 8000W).  But once they start drawing, they must finish to produce
 * a valid result — this prevents submitting incomplete geometry.
 */
function getGateReason(completion: HeatLossCompletionState): string | null {
  switch (completion) {
    case 'not_started':   return null;  // allow skip when nothing drawn
    case 'drawing':       return 'Close the shape to get a heat-loss estimate';
    case 'shape_closed':  return 'Waiting for heat-loss calculation…';
    case 'result_ready':  return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HeatLossStep({
  state,
  onChange,
  onNext,
  onPrev,
}: HeatLossStepProps) {
  const stepMeta = getStepMeta('heat_loss');
  const completionState = useMemo(() => deriveCompletionState(state), [state]);
  // Allow proceeding when not started (user skips calculator, uses default) or when result is ready.
  // Only block when user has started drawing but hasn't finished.
  const canProceed = completionState === 'not_started' || completionState === 'result_ready';
  const gateReason = getGateReason(completionState);

  // Derive a RoofModel slice from HeatLossState for the calculator's roof panel
  const roofModel: RoofModel = {
    roofType:        state.roofType,
    roofOrientation: state.roofOrientation,
    shadingLevel:    state.shadingLevel,
    pvStatus:        state.pvStatus,
    batteryStatus:   state.batteryStatus,
  };

  function handleHeatLossChange(totalKw: number | null) {
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

  function handleShellChange(shell: ShellModel) {
    onChange({ ...state, shellModel: shell });
  }

  function handleSnapshotChange(dataUrl: string | null) {
    onChange({
      ...state,
      shellSnapshotUrl: dataUrl ?? undefined,
    });
  }

  // Derive completion card metrics from the shell model
  const activeLayer = state.shellModel?.layers.find(
    l => l.id === state.shellModel?.activeLayerId
  );
  const floorAreaM2 = activeLayer?.closed ? computePolygonArea(activeLayer.points) : null;
  const perimeterM = activeLayer?.closed ? computePerimeter(activeLayer.points) : null;

  return (
    <div style={shellStyle} data-testid="heat-loss-step">
      {/* ── Sticky top summary ──────────────────────────────────────────── */}
      <div style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{stepMeta.heading}</h2>
        <p style={{ color: '#4a5568', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
          Sketch the ground-floor perimeter to estimate peak heat loss.
        </p>
      </div>

      {/* ── Bounded scroll region for the calculator ───────────────────── */}
      <div style={scrollRegionStyle}>
        <HeatLossCalculator
          embedded
          onHeatLossChange={handleHeatLossChange}
          roofModel={roofModel}
          onRoofModelChange={handleRoofModelChange}
          initialShell={state.shellModel}
          onShellChange={handleShellChange}
          onSnapshotChange={handleSnapshotChange}
        />
      </div>

      {/* ── Completion card ─────────────────────────────────────────────── */}
      {completionState === 'result_ready' && (
        <div style={completionCardStyle} data-testid="heat-loss-completion-card">
          {floorAreaM2 != null && (
            <div style={metricStyle}>
              <span style={metricValueStyle}>{floorAreaM2.toFixed(1)} m²</span>
              <span style={metricLabelStyle}>Floor area</span>
            </div>
          )}
          {perimeterM != null && (
            <div style={metricStyle}>
              <span style={metricValueStyle}>{perimeterM.toFixed(1)} m</span>
              <span style={metricLabelStyle}>Perimeter</span>
            </div>
          )}
          {state.estimatedPeakHeatLossW != null && (
            <div style={metricStyle}>
              <span style={metricValueStyle}>
                {(state.estimatedPeakHeatLossW / 1000).toFixed(1)} kW
              </span>
              <span style={metricLabelStyle}>Est. heat loss</span>
            </div>
          )}
          <div style={metricStyle}>
            <span style={{ ...metricValueStyle, color: '#92400e' }}>
              {state.heatLossConfidence}
            </span>
            <span style={metricLabelStyle}>Confidence</span>
          </div>
        </div>
      )}

      {/* ── Sticky footer with Back / Next ──────────────────────────────── */}
      <div style={footerStyle} data-testid="heat-loss-step-footer">
        <button className="back-btn" type="button" onClick={onPrev}>
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {gateReason && (
            <span style={gateReasonStyle} data-testid="heat-loss-gate-reason">
              {gateReason}
            </span>
          )}
          <button
            className="next-btn"
            type="button"
            onClick={onNext}
            disabled={!canProceed}
            title={gateReason ?? undefined}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/**
 * Compute the area of a 2-D polygon using the shoelace formula.
 * Input points are in real-world metres (matching the ShellPoint coordinate
 * system); the returned value is in m².
 */
function computePolygonArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/** Compute the perimeter of a closed polygon (m). */
function computePerimeter(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

// Keep INITIAL_ROOF_MODEL accessible from this module for convenience
export { INITIAL_ROOF_MODEL };


