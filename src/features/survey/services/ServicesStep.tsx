/**
 * ServicesStep.tsx
 *
 * Step: Services
 *
 * Captures supply-side services data for the survey.  Currently contains
 * the water quality block — a structured capture of incoming water supply
 * chemistry (hardness, limescale risk, silicate scaffold risk).
 *
 * Water quality belongs here because it is a property of the incoming supply,
 * not an appliance characteristic.  It feeds later degradation, reliability,
 * and longevity modelling for combi plate heat exchangers and cylinder coils.
 */

import { useState, type CSSProperties } from 'react';
import { getStepMeta } from '../../../config/surveyStepRegistry';
import type { WaterQualityState, HardnessBand } from './waterQualityTypes';
import { INITIAL_WATER_QUALITY_STATE } from './waterQualityTypes';
import { lookupWaterQuality } from './waterQualityLookup';
import { normaliseWaterQuality } from './waterQualityNormalizer';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ServicesStepProps {
  state: WaterQualityState;
  /** Postcode from the location step — pre-fills the lookup input. */
  surveyPostcode?: string;
  onChange: (next: WaterQualityState) => void;
  onNext: () => void;
  onPrev: () => void;
  /** When true, renders a compact dev/debug summary of the normalised output. */
  showDebugOutput?: boolean;
  /** Label for the forward navigation button. Defaults to "Next →". */
  nextLabel?: string;
  /** Mains static pressure (bar) — merged from former Mains Supply step. */
  staticPressureBar?: number;
  /** Mains dynamic pressure (bar) under flow — merged from former Mains Supply step. */
  dynamicPressureBar?: number;
  /** Mains dynamic flow rate (L/min) — merged from former Mains Supply step. */
  dynamicFlowLpm?: number;
  /** Called when any of the pressure/flow measurements change. */
  onMeasurementsChange?: (staticBar: number | undefined, dynamicBar: number | undefined, flowLpm: number | undefined) => void;
  /**
   * Indoor space for a hot water cylinder (airing cupboard / utility room).
   * Hard gate for stored water recommendations.
   *
   *   'ok'      — confirmed adequate space for a standard or slimline cylinder
   *   'tight'   — space is constrained; compact / Mixergy option may be needed
   *   'none'    — no space at all; cylinder not feasible (hard gate)
   *   'unknown' — surveyor has not yet assessed space (default)
   */
  availableSpace?: 'ok' | 'tight' | 'none' | 'unknown';
  /** Called when the cylinder-space answer changes. */
  onAvailableSpaceChange?: (value: 'ok' | 'tight' | 'none' | 'unknown') => void;
  /**
   * Space in the loft for a cold water storage (CWS) tank and a feed-and-expansion
   * (F&E) cistern — both required for open-vented / tank-fed systems.
   *
   *   'ok'      — confirmed adequate loft space for both CWS and F&E tanks
   *   'none'    — no usable loft space (hard gate for open-vented options)
   *   'unknown' — surveyor has not yet assessed (default)
   */
  loftTankSpace?: 'ok' | 'none' | 'unknown';
  /** Called when the loft tank space answer changes. */
  onLoftTankSpaceChange?: (value: 'ok' | 'none' | 'unknown') => void;
  /**
   * Whether the property has adequate outdoor space for an ASHP unit.
   * Hard gate for ASHP recommendations.
   *
   *   true   — confirmed outdoor space (garden, side return, flat roof)
   *   false  — no suitable outdoor siting; ASHP not feasible
   *   absent — not yet assessed (no gate applied)
   */
  hasOutdoorSpaceForHeatPump?: boolean;
  /** Called when the outdoor-space answer changes. */
  onOutdoorSpaceChange?: (value: boolean | undefined) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HARDNESS_BAND_OPTIONS: { value: HardnessBand; label: string; ppmHint: string }[] = [
  { value: 'soft',      label: 'Soft',      ppmHint: '<100 ppm' },
  { value: 'moderate',  label: 'Moderate',  ppmHint: '100–180 ppm' },
  { value: 'hard',      label: 'Hard',      ppmHint: '180–300 ppm' },
  { value: 'very_hard', label: 'Very hard', ppmHint: '300+ ppm' },
  { value: 'unknown',   label: 'Unknown',   ppmHint: '' },
];

const RISK_LABELS: Record<string, string> = {
  low:     '🟢 Low',
  medium:  '🟡 Medium',
  high:    '🔴 High',
  unknown: '— Unknown',
};

const SOURCE_LABELS: Record<string, string> = {
  lookup:  'Looked up',
  user:    'User confirmed',
  assumed: 'Assumed regional default',
  unknown: 'Not yet determined',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionHeadingStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
  marginTop: '1.25rem',
};

function chipStyle(isSelected: boolean): CSSProperties {
  return {
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
    background: isSelected ? '#ebf8ff' : '#fff',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: isSelected ? 600 : 400,
    color: isSelected ? '#2b6cb0' : '#4a5568',
    transition: 'border-color 0.15s, background 0.15s',
    whiteSpace: 'nowrap',
  };
}

const readoutCardStyle: CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.875rem 1rem',
  background: '#f7fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '0.82rem',
  lineHeight: 1.6,
};

const lookupBtnStyle: CSSProperties = {
  padding: '0.45rem 0.9rem',
  background: '#3182ce',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem',
  whiteSpace: 'nowrap',
};

const resetBtnStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  background: 'transparent',
  color: '#718096',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.78rem',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ServicesStep({
  state,
  surveyPostcode = '',
  onChange,
  onNext,
  onPrev,
  showDebugOutput = false,
  nextLabel = 'Next →',
  staticPressureBar,
  dynamicPressureBar,
  dynamicFlowLpm,
  onMeasurementsChange,
  availableSpace,
  onAvailableSpaceChange,
  loftTankSpace,
  onLoftTankSpaceChange,
  hasOutdoorSpaceForHeatPump,
  onOutdoorSpaceChange,
}: ServicesStepProps) {
  // Local postcode input — seeded from survey postcode but independently editable.
  const [postcodeInput, setPostcodeInput] = useState<string>(
    state.postcode ?? surveyPostcode,
  );
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  // ── Lookup ───────────────────────────────────────────────────────────────────

  function handleLookup() {
    setLookupError(null);
    const result = lookupWaterQuality(postcodeInput);
    if (result.source === 'assumed' && !postcodeInput.trim()) {
      setLookupError('Enter a postcode to look up water hardness.');
      return;
    }
    onChange(result);
  }

  // ── Manual override ──────────────────────────────────────────────────────────

  function handleManualBandSelect(band: HardnessBand) {
    onChange({
      ...state,
      source: 'user',
      hardnessBand: band,
      hardnessPpm: null,
      limescaleRisk: deriveLimescaleRiskFromBand(band),
      silicateRisk: 'unknown',
      confidenceNote: 'Manually selected by surveyor.',
    });
  }

  function handleReset() {
    setPostcodeInput(surveyPostcode);
    setLookupError(null);
    onChange({ ...INITIAL_WATER_QUALITY_STATE, postcode: surveyPostcode || null });
  }

  // ── Debug normalised output ──────────────────────────────────────────────────
  const normalised = showDebugOutput ? normaliseWaterQuality(state) : null;

  const hasResult = state.source !== 'unknown';

  return (
    <div className="step-card" data-testid="services-step">
      <h2>{getStepMeta('services').heading}</h2>
      <p style={{ color: '#4a5568', fontSize: '0.85rem', marginTop: '0.25rem' }}>
        Capture the incoming supply properties for this property.
        Water quality affects combi plate heat exchanger scaling, cylinder coil fouling,
        and long-term system performance.
      </p>

      {/* ── Mains pressure & flow block ─────────────────────────────────────── */}
      <div
        data-testid="mains-supply-block"
        style={{ marginTop: '1rem', padding: '1rem', background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '8px' }}
      >
        <p style={{ ...sectionHeadingStyle, marginTop: 0 }}>Mains supply</p>
        <p style={{ fontSize: '0.8rem', color: '#4a5568', margin: '0 0 0.75rem' }}>
          Record standing and dynamic pressure, plus measured flow at full-bore.
          These determine suitability for mains-fed (unvented) hot water.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="form-field">
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4a5568' }}>
              Static pressure (bar) — no flow
            </label>
            <input
              data-testid="static-pressure-input"
              type="number"
              min={0.5}
              max={8}
              step={0.1}
              value={staticPressureBar ?? ''}
              placeholder="e.g. 3.5 — optional"
              onChange={e => {
                const val = e.target.value ? +e.target.value : undefined;
                onMeasurementsChange?.(val, dynamicPressureBar, dynamicFlowLpm);
              }}
              style={{ marginTop: '0.3rem', padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', width: '120px' }}
            />
            <span style={{ fontSize: '0.72rem', color: '#718096', display: 'block', marginTop: '0.2rem' }}>
              Measured with all taps closed. Leave blank if not taken.
            </span>
          </div>
          <div className="form-field">
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4a5568' }}>
              Dynamic pressure (bar) — under flow
            </label>
            <input
              data-testid="dynamic-pressure-input"
              type="number"
              min={0.1}
              max={8}
              step={0.1}
              value={dynamicPressureBar ?? ''}
              placeholder="e.g. 2.0 — optional"
              onChange={e => {
                const val = e.target.value ? +e.target.value : undefined;
                onMeasurementsChange?.(staticPressureBar, val, dynamicFlowLpm);
              }}
              style={{ marginTop: '0.3rem', padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', width: '120px' }}
            />
            <span style={{ fontSize: '0.72rem', color: '#718096', display: 'block', marginTop: '0.2rem' }}>
              Measured with the cold tap running at full bore.
            </span>
          </div>
          <div className="form-field">
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4a5568' }}>
              Dynamic flow (L/min) — at pressure
            </label>
            <input
              data-testid="dynamic-flow-input"
              type="number"
              min={0.5}
              max={40}
              step={0.5}
              value={dynamicFlowLpm ?? ''}
              placeholder="e.g. 12 — optional"
              onChange={e => {
                const val = e.target.value ? +e.target.value : undefined;
                onMeasurementsChange?.(staticPressureBar, dynamicPressureBar, val);
              }}
              style={{ marginTop: '0.3rem', padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', width: '120px' }}
            />
            <span style={{ fontSize: '0.72rem', color: '#718096', display: 'block', marginTop: '0.2rem' }}>
              Measured simultaneously with dynamic pressure. Leave blank if not taken.
            </span>
          </div>
        </div>
      </div>

      {/* ── Water quality block ─────────────────────────────────────────────── */}
      <div
        data-testid="water-quality-block"
        style={{ marginTop: '1rem', padding: '1rem', background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '8px' }}
      >
        <p style={{ ...sectionHeadingStyle, marginTop: 0 }}>Water quality</p>
        <p style={{ fontSize: '0.8rem', color: '#4a5568', margin: '0 0 0.75rem' }}>
          Look up local water hardness from the postcode, or select manually if the
          lookup fails or the surveyor has direct knowledge.
        </p>

        {/* Postcode input + lookup button */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <input
            data-testid="water-quality-postcode-input"
            type="text"
            value={postcodeInput}
            onChange={e => {
              setPostcodeInput(e.target.value.toUpperCase());
              setLookupError(null);
            }}
            onKeyDown={e => { if (e.key === 'Enter') handleLookup(); }}
            placeholder="e.g. SW1A, BH or DT"
            style={{ flex: 1, padding: '0.45rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }}
          />
          <button
            data-testid="water-quality-lookup-btn"
            type="button"
            onClick={handleLookup}
            style={lookupBtnStyle}
          >
            Look up
          </button>
        </div>

        {lookupError && (
          <p style={{ fontSize: '0.78rem', color: '#e53e3e', margin: '0 0 0.5rem' }}>
            {lookupError}
          </p>
        )}

        {/* Result readout */}
        {hasResult && (
          <div data-testid="water-quality-result-card" style={readoutCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#2d3748' }}>
                  {state.hardnessBand !== 'unknown'
                    ? `${state.hardnessBand.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())} water`
                    : 'Hardness unknown'}
                </span>
                {state.hardnessPpm !== null && (
                  <span style={{ color: '#718096', marginLeft: '0.4rem', fontSize: '0.78rem' }}>
                    ({state.hardnessPpm} ppm)
                  </span>
                )}
              </div>
              <span
                data-testid="water-quality-source-badge"
                style={{ fontSize: '0.72rem', background: '#edf2f7', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#4a5568', whiteSpace: 'nowrap' }}
              >
                {SOURCE_LABELS[state.source] ?? state.source}
              </span>
            </div>

            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span>
                <span style={{ color: '#718096', fontSize: '0.75rem' }}>Limescale risk: </span>
                <span data-testid="water-quality-limescale-risk" style={{ fontWeight: 600 }}>
                  {RISK_LABELS[state.limescaleRisk] ?? state.limescaleRisk}
                </span>
              </span>
              <span>
                <span style={{ color: '#718096', fontSize: '0.75rem' }}>Silicate risk: </span>
                <span data-testid="water-quality-silicate-risk" style={{ fontWeight: 600 }}>
                  {RISK_LABELS[state.silicateRisk] ?? state.silicateRisk}
                </span>
              </span>
            </div>

            {state.confidenceNote && (
              <p style={{ fontSize: '0.73rem', color: '#718096', margin: '0.4rem 0 0', fontStyle: 'italic' }}>
                {state.confidenceNote}
              </p>
            )}
          </div>
        )}

        {/* Manual override */}
        {hasResult && !showOverride ? (
          <div style={{ marginTop: '0.875rem' }}>
            <button
              type="button"
              data-testid="hardness-override-toggle"
              onClick={() => setShowOverride(true)}
              style={{ fontSize: '0.78rem', color: '#3182ce', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Override hardness band
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '0.875rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0 0 0.35rem', fontWeight: 600 }}>
              {hasResult ? 'Override hardness band' : 'Or select hardness manually'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {HARDNESS_BAND_OPTIONS.map(({ value, label, ppmHint }) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`hardness-band-${value}`}
                  onClick={() => handleManualBandSelect(value)}
                  style={chipStyle(state.hardnessBand === value && state.source === 'user')}
                  title={ppmHint || undefined}
                >
                  {label}
                  {ppmHint && (
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#718096', fontWeight: 400 }}>
                      {ppmHint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reset */}
        {hasResult && (
          <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
            <button
              data-testid="water-quality-reset-btn"
              type="button"
              onClick={handleReset}
              style={resetBtnStyle}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* ── Installation space block ─────────────────────────────────────────── */}
      <div
        data-testid="installation-space-block"
        style={{ marginTop: '1rem', padding: '1rem', background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '8px' }}
      >
        <p style={{ ...sectionHeadingStyle, marginTop: 0 }}>Installation space</p>
        <p style={{ fontSize: '0.8rem', color: '#4a5568', margin: '0 0 0.75rem' }}>
          Confirm whether the property has adequate space for a hot water cylinder and
          outdoor space for a heat pump unit. These are independent hard gates — each
          constrains different system options.
        </p>

        {/* Cylinder space */}
        <p style={{ ...sectionHeadingStyle, fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
          Indoor space for a hot water cylinder
        </p>
        <p style={{ fontSize: '0.75rem', color: '#718096', margin: '0 0 0.4rem' }}>
          At least 0.5 m² of clear floor space (e.g. airing cupboard, utility room).
          Constrains stored water options — system boiler, regular boiler, heat pump.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {[
            { value: 'ok',      label: '✅ Yes — space available',    sub: 'Standard or slimline cylinder fits' },
            { value: 'tight',   label: '⚠️ Tight — very limited',     sub: 'May need compact / Mixergy option' },
            { value: 'none',    label: '🚫 No space — not feasible',   sub: 'Cylinder cannot be installed here' },
            { value: 'unknown', label: '❓ Not assessed yet',           sub: 'Check before specifying system' },
          ].map(({ value, label, sub }) => {
            const isSelected = (availableSpace ?? 'unknown') === value;
            return (
              <button
                key={value}
                type="button"
                data-testid={`cylinder-space-${value}`}
                onClick={() => onAvailableSpaceChange?.(value as 'ok' | 'tight' | 'none' | 'unknown')}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
                  background: isSelected ? '#ebf8ff' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? '#2b6cb0' : '#4a5568',
                  textAlign: 'left',
                }}
              >
                {label}
                <span style={{ display: 'block', fontSize: '0.68rem', color: '#718096', fontWeight: 400, marginTop: '0.15rem' }}>
                  {sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loft tank space — CWS + F&E */}
        <p style={{ ...sectionHeadingStyle, fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
          Loft space for cold water storage (CWS) and feed &amp; expansion (F&amp;E) tanks
        </p>
        <p style={{ fontSize: '0.75rem', color: '#718096', margin: '0 0 0.4rem' }}>
          Open-vented (tank-fed) systems require a cold water storage tank and a feed &amp;
          expansion cistern in the loft. No loft space blocks these options.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {[
            { value: 'ok',      label: '✅ Yes — loft space available', sub: 'CWS + F&E tanks can be accommodated' },
            { value: 'none',    label: '🚫 No loft tank space',          sub: 'Open-vented / tank-fed options not feasible' },
            { value: 'unknown', label: '❓ Not assessed yet',             sub: 'Check before specifying open-vented system' },
          ].map(({ value, label, sub }) => {
            const isSelected = (loftTankSpace ?? 'unknown') === value;
            return (
              <button
                key={value}
                type="button"
                data-testid={`loft-tank-space-${value}`}
                onClick={() => onLoftTankSpaceChange?.(value as 'ok' | 'none' | 'unknown')}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
                  background: isSelected ? '#ebf8ff' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? '#2b6cb0' : '#4a5568',
                  textAlign: 'left',
                }}
              >
                {label}
                <span style={{ display: 'block', fontSize: '0.68rem', color: '#718096', fontWeight: 400, marginTop: '0.15rem' }}>
                  {sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Outdoor space for ASHP */}
        <p style={{ ...sectionHeadingStyle, fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
          Outdoor space for an air source heat pump unit
        </p>
        <p style={{ fontSize: '0.75rem', color: '#718096', margin: '0 0 0.4rem' }}>
          Garden, side return or flat roof — min. 1 m clearance on all sides.
          If no outdoor space exists, ASHP is not feasible regardless of hydraulics.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { value: true as boolean | undefined,      label: '✅ Yes — outdoor space available', sub: 'ASHP siting is feasible' },
            { value: false as boolean | undefined,     label: '🚫 No outdoor space',               sub: 'ASHP not feasible — no siting location' },
            { value: undefined as boolean | undefined, label: '❓ Not assessed yet',                sub: 'Check before specifying heat pump' },
          ].map(({ value, label, sub }) => {
            const isSelected = hasOutdoorSpaceForHeatPump === value;
            return (
              <button
                key={String(value)}
                type="button"
                data-testid={`outdoor-space-${value === true ? 'yes' : value === false ? 'no' : 'unknown'}`}
                onClick={() => onOutdoorSpaceChange?.(value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
                  background: isSelected ? '#ebf8ff' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? '#2b6cb0' : '#4a5568',
                  textAlign: 'left',
                }}
              >
                {label}
                <span style={{ display: 'block', fontSize: '0.68rem', color: '#718096', fontWeight: 400, marginTop: '0.15rem' }}>
                  {sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Debug output ─────────────────────────────────────────────────────── */}
      {showDebugOutput && normalised && (
        <details style={{ marginTop: '1.5rem' }}>
          <summary style={{ fontSize: '0.75rem', color: '#718096', cursor: 'pointer' }}>
            Dev: normalised services output
          </summary>
          <pre
            data-testid="services-normalised-output"
            style={{
              fontSize: '0.72rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '0.75rem',
              overflowX: 'auto',
              marginTop: '0.5rem',
            }}
          >
            {JSON.stringify(normalised, null, 2)}
          </pre>
        </details>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <div className="step-actions" style={{ marginTop: '1.5rem' }}>
        <button className="back-btn" type="button" onClick={onPrev}>
          ← Back
        </button>
        <button
          className="next-btn"
          type="button"
          onClick={onNext}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Local helper ─────────────────────────────────────────────────────────────

/** Derive a simple limescale risk from a manually selected hardness band. */
function deriveLimescaleRiskFromBand(band: HardnessBand): 'low' | 'medium' | 'high' | 'unknown' {
  switch (band) {
    case 'very_hard': return 'high';
    case 'hard':      return 'medium';
    case 'moderate':  return 'low';
    case 'soft':      return 'low';
    default:          return 'unknown';
  }
}
