/**
 * SolarAssessmentStep.tsx
 *
 * Survey step: Solar & Roof Assessment — follows the heat-loss step.
 *
 * Captures:
 *   - Building bearing (compass direction the front faces)
 *   - Roof type
 *   - Main usable roof face orientation (via RoofRotationControl)
 *   - Shading on the main roof face
 *   - Solar PV status
 *   - Battery storage status
 *
 * This step is skipped entirely for all flat dwelling types (ground floor,
 * mid floor, or penthouse) because flats do not have independent roof access
 * for solar installation.
 *
 * The solar fields are stored in HeatLossState alongside the heat-loss data
 * because they share the same survey context and serialisation path.
 */

import { type CSSProperties } from 'react';
import type { HeatLossState, RoofType, ShadingLevel, PvStatus, BatteryStatus } from '../heatLoss/heatLossTypes';
import { RoofRotationControl } from '../heatLoss/RoofRotationControl';
import { solarSuitabilitySummary } from '../heatLoss/heatLossDerivations';
import { getStepMeta } from '../../../config/surveyStepRegistry';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SolarAssessmentStepProps {
  state: HeatLossState;
  onChange: (next: HeatLossState) => void;
  onNext: () => void;
  onPrev: () => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const shellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
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
  padding: '1rem',
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

const sectionStyle: CSSProperties = {
  marginBottom: '1.25rem',
};

const fieldStyle: CSSProperties = {
  marginBottom: '1rem',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontWeight: 500,
  fontSize: '0.85rem',
  marginBottom: '0.35rem',
  color: '#374151',
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem',
};

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: '0.3rem 0.7rem',
    borderRadius: '6px',
    border: active ? '2px solid #1a56db' : '1px solid #d1d5db',
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1a56db' : '#374151',
    fontWeight: active ? 600 : 400,
    fontSize: '0.82rem',
    cursor: 'pointer',
  };
}

const solarSummaryStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: '#374151',
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
  marginTop: '0.5rem',
};

const fieldHintStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#6b7280',
  marginTop: '0.2rem',
};

const numberInputStyle: CSSProperties = {
  width: '6rem',
  padding: '0.3rem 0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '0.85rem',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SolarAssessmentStep({ state, onChange, onNext, onPrev }: SolarAssessmentStepProps) {
  const stepMeta = getStepMeta('solar_assessment');

  // Closed polygon points from the active shell layer for the compass control.
  const activeLayer = state.shellModel?.layers.find(
    l => l.id === state.shellModel?.activeLayerId
  );
  const compassPerimeterPts = (activeLayer?.closed && (activeLayer.points.length ?? 0) >= 3)
    ? activeLayer.points
    : undefined;

  const summary = solarSuitabilitySummary(state);

  return (
    <div style={shellStyle} data-testid="solar-assessment-step">
      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{stepMeta.heading}</h2>
        <p style={{ color: '#4a5568', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
          Roof orientation and solar potential for this property.
        </p>
      </div>

      {/* ── Scroll region ─────────────────────────────────────────────── */}
      <div style={scrollRegionStyle}>

        {/* Building bearing */}
        <div style={sectionStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Building front bearing (° clockwise from north)
            </label>
            <input
              type="number"
              min={0} max={359} step={1}
              placeholder="e.g. 180 = south-facing front"
              value={state.buildingBearingDeg ?? ''}
              style={numberInputStyle}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') {
                  onChange({ ...state, buildingBearingDeg: undefined });
                } else {
                  const deg = ((parseInt(raw, 10) % 360) + 360) % 360;
                  onChange({ ...state, buildingBearingDeg: deg });
                }
              }}
            />
            {state.buildingBearingDeg !== undefined && (
              <span style={fieldHintStyle}>
                {state.buildingBearingDeg === 0   ? 'Front faces north'
                 : state.buildingBearingDeg === 90  ? 'Front faces east'
                 : state.buildingBearingDeg === 180 ? 'Front faces south'
                 : state.buildingBearingDeg === 270 ? 'Front faces west'
                 : `${state.buildingBearingDeg}° clockwise from north`}
              </span>
            )}
          </div>
        </div>

        {/* Roof type */}
        <div style={sectionStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Roof type</label>
            <div style={chipRowStyle}>
              {(['pitched', 'flat', 'hipped', 'dormer', 'unknown'] as RoofType[]).map(rt => (
                <button
                  key={rt}
                  type="button"
                  style={chipStyle(state.roofType === rt)}
                  aria-pressed={state.roofType === rt}
                  onClick={() => onChange({ ...state, roofType: rt })}
                >
                  {rt === 'unknown' ? 'Not sure' : rt.charAt(0).toUpperCase() + rt.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Roof orientation */}
        <div style={sectionStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Orientation (main usable roof face)</label>
            <RoofRotationControl
              value={state.roofOrientation}
              onChange={v => onChange({ ...state, roofOrientation: v })}
              perimeterPoints={compassPerimeterPts}
            />
          </div>
        </div>

        {/* Shading */}
        <div style={sectionStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Shading on main roof face</label>
            <div style={chipRowStyle}>
              {(['little_or_none', 'some', 'heavy', 'unknown'] as ShadingLevel[]).map(s => (
                <button
                  key={s}
                  type="button"
                  style={chipStyle(state.shadingLevel === s)}
                  aria-pressed={state.shadingLevel === s}
                  onClick={() => onChange({ ...state, shadingLevel: s })}
                >
                  {s === 'little_or_none' ? 'Little / none'
                   : s === 'unknown' ? 'Not sure'
                   : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Solar PV */}
        <div style={sectionStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Solar PV panels</label>
            <div style={chipRowStyle}>
              {(['none', 'existing', 'planned'] as PvStatus[]).map(p => (
                <button
                  key={p}
                  type="button"
                  style={chipStyle(state.pvStatus === p)}
                  aria-pressed={state.pvStatus === p}
                  onClick={() => onChange({ ...state, pvStatus: p })}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Battery storage */}
        <div style={sectionStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Battery storage</label>
            <div style={chipRowStyle}>
              {(['none', 'existing', 'planned'] as BatteryStatus[]).map(b => (
                <button
                  key={b}
                  type="button"
                  style={chipStyle(state.batteryStatus === b)}
                  aria-pressed={state.batteryStatus === b}
                  onClick={() => onChange({ ...state, batteryStatus: b })}
                >
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Solar suitability summary */}
        {summary && (
          <p style={solarSummaryStyle}>{summary}</p>
        )}

      </div>

      {/* ── Sticky footer ─────────────────────────────────────────────── */}
      <div style={footerStyle} data-testid="solar-assessment-step-footer">
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
