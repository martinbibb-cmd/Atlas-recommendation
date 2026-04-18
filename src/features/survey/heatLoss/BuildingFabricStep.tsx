/**
 * BuildingFabricStep.tsx
 *
 * Step: Building & Fabric — pre-canvas building context
 *
 * Captures dwelling type and building-fabric parameters BEFORE the
 * house-shape drawing canvas so that the HeatLossCalculator is
 * pre-populated when the user reaches the Heat Loss step.
 *
 * Collected fields:
 *   - Dwelling type   (detached / semi / terrace / flat variants)
 *   - Wall construction
 *   - Loft / ceiling insulation
 *   - Glazing type
 *   - Glazing amount
 *   - Ground floor type
 *   - Thermal mass
 *
 * These fields mirror the ShellSettings interface so they flow through
 * sanitiseModelForEngine into building.fabric.* and dwellingType on the
 * engine input without any additional bridging.
 *
 * State ownership: the settings live in heatLossState.shellModel.settings.
 * If no shell model exists yet (user hasn't drawn anything) a minimal empty
 * ShellModel is created here so the settings are available to HeatLossCalculator
 * via its initialShell prop.
 */

import { type CSSProperties } from 'react';
import type { HeatLossState, ShellSettings } from './heatLossTypes';
import { getStepMeta } from '../../../config/surveyStepRegistry';

// ─── Default settings ─────────────────────────────────────────────────────────

/** Mirrors the hard-coded defaults in HeatLossCalculator.tsx. */
const DEFAULT_SETTINGS: ShellSettings = {
  storeys:        2,
  ceilingHeight:  2.4,
  dwellingType:   'semi',
  wallType:       'cavityUninsulated',
  loftInsulation: 'mm270plus',
  glazingType:    'doubleArated',
  glazingAmount:  'medium',
  floorType:      'suspendedUninsulated',
  thermalMass:    'medium',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface BuildingFabricStepProps {
  state: HeatLossState;
  onChange: (next: HeatLossState) => void;
  onNext: () => void;
  onPrev: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read settings from state — fall back to DEFAULT_SETTINGS for any absent field
 * so the form always has a valid selected value.
 */
function readSettings(state: HeatLossState): ShellSettings {
  const ss = state.shellModel?.settings;
  if (!ss) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...ss };
}

/**
 * Write updated settings back into state.  Creates a minimal ShellModel (empty
 * layers) when none exists so that HeatLossCalculator receives the settings via
 * its initialShell prop even before the user has drawn anything.
 */
function applySettings(state: HeatLossState, patch: Partial<ShellSettings>): HeatLossState {
  const current = readSettings(state);
  const next: ShellSettings = { ...current, ...patch };

  if (!state.shellModel) {
    return {
      ...state,
      shellModel: {
        layers: [],
        activeLayerId: '',
        settings: next,
      },
    };
  }

  return {
    ...state,
    shellModel: {
      ...state.shellModel,
      settings: next,
    },
  };
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
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '1rem',
  marginBottom: '1rem',
};

const sectionHeadingStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#1a202c',
};

const fieldStyle: CSSProperties = {
  marginBottom: '0.75rem',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '0.25rem',
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.5rem',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  fontSize: '0.875rem',
  background: '#fff',
  color: '#111827',
};

const hintStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: '#6b7280',
  marginTop: '0.2rem',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BuildingFabricStep({
  state,
  onChange,
  onNext,
  onPrev,
}: BuildingFabricStepProps) {
  const stepMeta = getStepMeta('building_fabric');
  const s = readSettings(state);

  const isFlat = s.dwellingType === 'flatGround' || s.dwellingType === 'flatMid' || s.dwellingType === 'flatPenthouse';

  function patch(partial: Partial<ShellSettings>) {
    onChange(applySettings(state, partial));
  }

  // When switching to a flat, auto-update loftInsulation / floorType to
  // sensible defaults — mirrors the logic in HeatLossCalculator.tsx.
  function handleDwellingTypeChange(next: ShellSettings['dwellingType']) {
    const updates: Partial<ShellSettings> = { dwellingType: next };

    if (next === 'flatGround') {
      updates.loftInsulation = 'neighbourHeated';
      updates.storeys = 1;
      if (s.floorType === 'neighbourHeated') updates.floorType = 'suspendedUninsulated';
    } else if (next === 'flatMid') {
      updates.loftInsulation = 'neighbourHeated';
      updates.floorType = 'neighbourHeated';
      updates.storeys = 1;
    } else if (next === 'flatPenthouse') {
      updates.floorType = 'neighbourHeated';
      updates.storeys = 1;
      if (s.loftInsulation === 'neighbourHeated') updates.loftInsulation = 'mm270plus';
    } else {
      // Switching back to a house — clear flat-specific values.
      if (s.loftInsulation === 'neighbourHeated') updates.loftInsulation = 'mm270plus';
      if (s.floorType === 'neighbourHeated') updates.floorType = 'suspendedUninsulated';
    }

    onChange(applySettings(state, updates));
  }

  return (
    <div style={shellStyle} data-testid="building-fabric-step">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{stepMeta.heading}</h2>
        <p style={{ color: '#4a5568', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
          Tell us about the building type and fabric so we can pre-populate the
          heat-loss calculator with the right assumptions.
        </p>
      </div>

      {/* ── Scroll region ────────────────────────────────────────────────── */}
      <div style={scrollRegionStyle}>

        {/* Building section */}
        <div style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>Building</h3>

          <div style={fieldStyle}>
            <label style={labelStyle}>Dwelling type</label>
            <select
              style={selectStyle}
              value={s.dwellingType}
              onChange={e => handleDwellingTypeChange(e.target.value as ShellSettings['dwellingType'])}
            >
              <optgroup label="Houses">
                <option value="detached">Detached</option>
                <option value="semi">Semi-detached</option>
                <option value="endTerrace">End-terrace</option>
                <option value="midTerrace">Mid-terrace</option>
              </optgroup>
              <optgroup label="Flats">
                <option value="flatGround">Flat — ground floor</option>
                <option value="flatMid">Flat — mid floor</option>
                <option value="flatPenthouse">Flat — top floor / penthouse</option>
              </optgroup>
            </select>
            {isFlat && (
              <p style={hintStyle}>
                {s.dwellingType === 'flatGround' && 'Ground-floor flat: floor is ground-contact; ceiling is neighbour\'s flat above.'}
                {s.dwellingType === 'flatMid'    && 'Mid-floor flat: both floor and ceiling are neighbour\'s heated flats.'}
                {s.dwellingType === 'flatPenthouse' && 'Top-floor flat: floor is neighbour\'s flat below; ceiling is exposed roof.'}
              </p>
            )}
          </div>
        </div>

        {/* Fabric section */}
        <div style={sectionStyle}>
          <h3 style={sectionHeadingStyle}>Fabric</h3>

          <div style={fieldStyle}>
            <label style={labelStyle}>Wall construction</label>
            <select
              style={selectStyle}
              value={s.wallType}
              onChange={e => patch({ wallType: e.target.value })}
            >
              <option value="solidBrick">Solid brick (U 2.1)</option>
              <option value="cavityUninsulated">Cavity uninsulated (U 2.1)</option>
              <option value="cavityPartialFill">Cavity partial fill (U 0.5)</option>
              <option value="cavityFullFill">Cavity full fill (U 0.28)</option>
              <option value="timberFrame">Timber frame (U 0.25)</option>
              <option value="solidStone">Solid stone (U 1.7)</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>{isFlat ? 'Ceiling / roof insulation' : 'Loft insulation'}</label>
            <select
              style={selectStyle}
              value={s.loftInsulation}
              onChange={e => patch({ loftInsulation: e.target.value })}
            >
              {isFlat && <option value="neighbourHeated">Neighbour&apos;s heated flat above (U 0.10)</option>}
              <option value="none">None / exposed (U 2.3)</option>
              <option value="mm100">100 mm insulation (U 0.35)</option>
              <option value="mm200">200 mm insulation (U 0.18)</option>
              <option value="mm270plus">270 mm+ insulation (U 0.13)</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Glazing type</label>
            <select
              style={selectStyle}
              value={s.glazingType}
              onChange={e => patch({ glazingType: e.target.value })}
            >
              <option value="single">Single glazed (U 4.8)</option>
              <option value="doubleOld">Double old (U 2.8)</option>
              <option value="doubleArated">Double A-rated (U 1.4)</option>
              <option value="triple">Triple glazed (U 0.8)</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Glazing amount</label>
            <select
              style={selectStyle}
              value={s.glazingAmount}
              onChange={e => patch({ glazingAmount: e.target.value })}
            >
              <option value="low">Low (12 % of wall)</option>
              <option value="medium">Medium (18 %)</option>
              <option value="high">High (25 %)</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Ground floor type</label>
            <select
              style={selectStyle}
              value={s.floorType}
              onChange={e => patch({ floorType: e.target.value })}
            >
              {isFlat && <option value="neighbourHeated">Neighbour&apos;s heated flat below (U 0.10)</option>}
              <option value="solidUninsulated">Solid uninsulated (U 0.70)</option>
              <option value="suspendedUninsulated">Suspended uninsulated (U 0.80)</option>
              <option value="insulated">Insulated (U 0.20)</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Thermal mass</label>
            <select
              style={selectStyle}
              value={s.thermalMass}
              onChange={e => patch({ thermalMass: e.target.value as ShellSettings['thermalMass'] })}
            >
              <option value="light">Lightweight</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy masonry</option>
            </select>
            <p style={hintStyle}>
              Thermal mass is independent of wall heat-loss - it governs how quickly the building
              heats up and cools down (thermal inertia τ).
            </p>
          </div>
        </div>

      </div>

      {/* ── Sticky footer ────────────────────────────────────────────────── */}
      <div style={footerStyle} data-testid="building-fabric-step-footer">
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
