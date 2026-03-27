/**
 * SystemBuilderStep.tsx
 *
 * Step: System Architecture
 *
 * Card-based visual selectors for capturing the physical architecture of the
 * existing heating and hot-water system.  Uses enforced pairings from
 * systemBuilderRules so that invalid combinations can never be submitted.
 */

import type { CSSProperties } from 'react';
import type {
  SystemBuilderState,
  HeatSource,
  DhwType,
  EmitterType,
  PrimaryPipeSize,
  PipeLayout,
  ControlFamily,
  ThermostatStyle,
  ProgrammerType,
  SedbukBand,
  ServiceHistory,
  HeatingSystemType,
  PipeworkAccess,
  BleedWaterColour,
  RadiatorPerformance,
  CirculationIssues,
  MagneticFilter,
  CleaningHistory,
} from './systemBuilderTypes';
import {
  getAllowedDhwTypes,
  coerceDhwAfterHeatSourceChange,
  deriveDefaultControlFamily,
  getNarrowedControlFamilies,
  isSystemBuilderComplete,
} from './systemBuilderRules';
import {
  HeatSourceGraphic,
  DhwTypeGraphic,
  EmitterGraphic,
} from './systemBuilderGraphics';
import { normaliseSystemBuilder } from './systemBuilderNormalizer';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SystemBuilderStepProps {
  state: SystemBuilderState;
  onChange: (next: SystemBuilderState) => void;
  onNext: () => void;
  onPrev: () => void;
  /** When true, renders a compact dev/debug summary of the normalised output. */
  showDebugOutput?: boolean;
}

// ─── Card option meta-data ────────────────────────────────────────────────────

const HEAT_SOURCE_OPTIONS: { value: HeatSource; label: string; description: string }[] = [
  { value: 'regular',       label: 'Regular (heat-only)',  description: 'Boiler with separate hot-water cylinder and feed-and-expansion cistern' },
  { value: 'system',        label: 'System boiler',        description: 'Sealed system — boiler + cylinder, no feed cistern' },
  { value: 'combi',         label: 'Combi boiler',         description: 'On-demand hot water via internal plate heat exchanger — no cylinder' },
  { value: 'storage_combi', label: 'Storage combi',        description: 'Combi with small integral store to reduce wait time' },
];

const DHW_META: Record<DhwType, { label: string; description: string }> = {
  open_vented:   { label: 'Open-vented cylinder',  description: 'Tank-fed hot water via loft cistern — gravity-fed' },
  unvented:      { label: 'Unvented cylinder',         description: 'Mains pressure cylinder with pressure relief discharge' },
  thermal_store: { label: 'Thermal store',             description: 'Large primary store feeding DHW via internal coil' },
  plate_hex:     { label: 'On-demand hot water',       description: 'Hot water heated on demand via plate heat exchanger in combi boiler' },
  small_store:   { label: 'Integral small store',      description: 'Compact integrated cylinder within storage combi' },
};

const EMITTER_OPTIONS: { value: EmitterType; label: string; description: string }[] = [
  { value: 'radiators_standard', label: 'Standard radiators',  description: 'Conventional steel panel radiators' },
  { value: 'radiators_designer', label: 'Designer radiators',  description: 'Column, ladder or designer panel radiators' },
  { value: 'underfloor',         label: 'Underfloor heating',  description: 'Wet UFH throughout — low flow temperature' },
  { value: 'mixed',              label: 'Mixed emitters',      description: 'Combination of radiators and underfloor zones' },
];

const PRIMARY_SIZE_OPTIONS: { value: PrimaryPipeSize; label: string }[] = [
  { value: 15,        label: '15 mm' },
  { value: 22,        label: '22 mm' },
  { value: 28,        label: '28 mm' },
  { value: 'unknown', label: 'Unknown' },
];

const LAYOUT_OPTIONS: { value: PipeLayout; label: string; description: string }[] = [
  { value: 'two_pipe',  label: 'Two-pipe',  description: 'Flow and return to each radiator' },
  { value: 'one_pipe',  label: 'One-pipe',  description: 'Single loop with tees at each radiator' },
  { value: 'manifold',  label: 'Manifold',  description: 'Central manifold feeding individual runs' },
  { value: 'microbore', label: 'Microbore', description: '8–10 mm copper runs from headers' },
  { value: 'unknown',   label: 'Unknown',   description: '' },
];

const CONTROL_FAMILY_OPTIONS: { value: ControlFamily; label: string; description: string }[] = [
  { value: 'combi_integral', label: 'Combi integral',  description: 'Built-in programmer + room thermostat only' },
  { value: 'y_plan',         label: 'Y-plan',          description: 'Single mid-position valve for heating + DHW' },
  { value: 's_plan',         label: 'S-plan',          description: 'Separate zone valves for heating and DHW' },
  { value: 's_plan_plus',    label: 'S-plan+',         description: 'S-plan with additional zones or underfloor loop' },
  { value: 'thermal_store',  label: 'Thermal store',   description: 'Thermal store primary circuit control arrangement' },
  { value: 'unknown',        label: 'Unknown',         description: '' },
];

const THERMOSTAT_OPTIONS: { value: ThermostatStyle; label: string }[] = [
  { value: 'basic',        label: 'Basic dial' },
  { value: 'programmable', label: 'Programmable' },
  { value: 'smart',        label: 'Smart / app-linked' },
  { value: 'unknown',      label: 'Unknown' },
];

const PROGRAMMER_OPTIONS: { value: ProgrammerType; label: string; description: string }[] = [
  { value: 'integral',          label: 'Integral',           description: 'Built into the appliance' },
  { value: 'electromechanical', label: 'Mechanical timer',   description: 'Basic dial or pin-wheel programmer' },
  { value: 'digital',           label: 'Digital programmer', description: '7-day digital programmer' },
  { value: 'smart',             label: 'Smart / connected',  description: 'Internet-connected or app-linked programmer' },
  { value: 'none',              label: 'None',               description: 'No programmer installed' },
  { value: 'unknown',           label: 'Unknown',            description: '' },
];

const SEDBUK_BANDS: { value: SedbukBand; label: string }[] = [
  { value: 'A', label: 'A  (≥90%)' },
  { value: 'B', label: 'B  (86–90%)' },
  { value: 'C', label: 'C  (82–86%)' },
  { value: 'D', label: 'D  (78–82%)' },
  { value: 'E', label: 'E  (74–78%)' },
  { value: 'F', label: 'F  (70–74%)' },
  { value: 'G', label: 'G  (<70%)' },
  { value: 'unknown', label: 'Unknown' },
];

const SERVICE_HISTORY_OPTIONS: { value: ServiceHistory; label: string; description: string }[] = [
  { value: 'regular',   label: 'Regular',   description: 'Annually or near-annually serviced' },
  { value: 'irregular', label: 'Irregular', description: 'Serviced but not consistently' },
  { value: 'unknown',   label: 'Unknown',   description: '' },
];

const HEATING_SYSTEM_TYPE_OPTIONS: { value: HeatingSystemType; label: string; description: string }[] = [
  { value: 'open_vented', label: 'Open-vented', description: 'Feed-and-expansion cistern in loft — vented to atmosphere' },
  { value: 'sealed',      label: 'Sealed',      description: 'Pressurised closed circuit — no feed cistern' },
  { value: 'unknown',     label: 'Unknown',     description: '' },
];

const PIPEWORK_ACCESS_OPTIONS: { value: PipeworkAccess; label: string; description: string }[] = [
  { value: 'accessible', label: 'Exposed / accessible', description: 'Pipework visible and accessible for inspection or replacement' },
  { value: 'buried',     label: 'Buried / in walls',    description: 'Pipework concealed — difficult access for inspection or repair' },
  { value: 'unknown',    label: 'Unknown',              description: '' },
];

// ─── System condition signal options ──────────────────────────────────────────

const BLEED_WATER_COLOUR_OPTIONS: { value: BleedWaterColour; label: string; description: string }[] = [
  { value: 'clear',                label: 'Clear',               description: 'Water ran clear when bleeding' },
  { value: 'slightly_discoloured', label: 'Slightly discoloured', description: 'Mild rust or grey tinge' },
  { value: 'dark',                 label: 'Dark / brown',        description: 'Noticeably dark — indicates oxidised magnetite' },
  { value: 'sludge',               label: 'Sludge / black',      description: 'Heavy black or gritty discharge — significant fouling' },
  { value: 'unknown',              label: 'Unknown / not bled',  description: '' },
];

const RADIATOR_PERFORMANCE_OPTIONS: { value: RadiatorPerformance; label: string; description: string }[] = [
  { value: 'all_even',       label: 'All heat evenly',   description: 'All radiators heat up fully and evenly' },
  { value: 'some_cold_spots', label: 'Some cold spots',  description: 'One or more radiators have cold patches or slow heating' },
  { value: 'many_cold',      label: 'Many cold / poor',  description: 'Multiple radiators cold or poorly performing' },
];

const CIRCULATION_ISSUES_OPTIONS: { value: CirculationIssues; label: string; description: string }[] = [
  { value: 'none',                        label: 'None',              description: 'System runs quietly with good flow' },
  { value: 'occasional_noise',            label: 'Occasional noise',  description: 'Intermittent gurgling, banging or dripping sounds' },
  { value: 'frequent_noise_or_poor_flow', label: 'Frequent noise / poor flow', description: 'Persistent noise or radiators slow to heat' },
];

const MAGNETIC_FILTER_OPTIONS: { value: MagneticFilter; label: string; description: string }[] = [
  { value: 'fitted',     label: 'Fitted',     description: 'Magnetic filter present — typically on return pipework near boiler' },
  { value: 'not_fitted', label: 'Not fitted', description: 'No magnetic filter observed' },
  { value: 'unknown',    label: 'Unknown',    description: '' },
];

const CLEANING_HISTORY_OPTIONS: { value: CleaningHistory; label: string; description: string }[] = [
  { value: 'recently_cleaned',         label: 'Recently cleaned',          description: 'Power flush or chemical clean within last 2–3 years' },
  { value: 'cleaned_over_5_years_ago', label: 'Cleaned 5+ years ago',      description: 'System was cleaned but not recently' },
  { value: 'never_cleaned',            label: 'Never cleaned',             description: 'No record of any flush or chemical treatment' },
  { value: 'unknown',                  label: 'Unknown',                   description: '' },
];

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

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: '0.5rem',
};

const inlineRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
};

function cardStyle(isSelected: boolean, isDisabled: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.625rem 0.5rem 0.5rem',
    borderRadius: '8px',
    border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
    background: isSelected ? '#ebf8ff' : isDisabled ? '#f8fafc' : '#fff',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.45 : 1,
    textAlign: 'center',
    transition: 'border-color 0.15s, background 0.15s',
    minWidth: 0,
  };
}

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

// ─── Component ────────────────────────────────────────────────────────────────

export function SystemBuilderStep({
  state,
  onChange,
  onNext,
  onPrev,
  showDebugOutput = false,
}: SystemBuilderStepProps) {
  // ── Heat source selection ────────────────────────────────────────────────────
  function handleHeatSource(value: HeatSource) {
    const coercedDhw = coerceDhwAfterHeatSourceChange(value, state.dhwType);
    const defaultControl = deriveDefaultControlFamily(value, coercedDhw);
    onChange({
      ...state,
      heatSource: value,
      dhwType: coercedDhw,
      // Only set a default control family when there isn't one yet
      controlFamily: state.controlFamily ?? defaultControl,
    });
  }

  // ── DHW selection ────────────────────────────────────────────────────────────
  const allowedDhw = getAllowedDhwTypes(state.heatSource);

  function handleDhwType(value: DhwType) {
    if (!allowedDhw.includes(value)) return;
    onChange({ ...state, dhwType: value });
  }

  // ── Completion gate ──────────────────────────────────────────────────────────
  const canSubmit = isSystemBuilderComplete(state);

  // ── Control narrowing ────────────────────────────────────────────────────────
  const narrowed = getNarrowedControlFamilies(state.heatSource, state.dhwType);
  const hasNarrowing = narrowed.primary.length < CONTROL_FAMILY_OPTIONS.length;

  // ── Debug normalised output ──────────────────────────────────────────────────
  const normalised = showDebugOutput ? normaliseSystemBuilder(state) : null;

  return (
    <div className="step-card" data-testid="system-builder-step">
      <h2>🔧 System Architecture</h2>
      <p style={{ color: '#4a5568', fontSize: '0.85rem', marginTop: '0.25rem' }}>
        Describe the heating and hot-water system that is currently installed.
        Select options that match what you can observe on site.
      </p>

      {/* ── 1. Heat source ─────────────────────────────────────────────────── */}
      <p style={sectionHeadingStyle}>1 — Heat source</p>
      <div style={cardGridStyle}>
        {HEAT_SOURCE_OPTIONS.map(({ value, label, description }) => {
          const isSelected = state.heatSource === value;
          return (
            <button
              key={value}
              type="button"
              data-testid={`heat-source-${value}`}
              onClick={() => handleHeatSource(value)}
              style={cardStyle(isSelected, false)}
              title={description}
            >
              <HeatSourceGraphic type={value} />
              <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, color: '#2d3748', marginTop: '0.3rem', lineHeight: 1.3 }}>
                {label}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#718096', marginTop: '0.2rem', lineHeight: 1.3 }}>
                {description}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 2. Hot water system ────────────────────────────────────────────── */}
      <p style={sectionHeadingStyle}>2 — Hot water system</p>
      {state.heatSource === null && (
        <p style={{ fontSize: '0.8rem', color: '#718096', fontStyle: 'italic' }}>
          Select a heat source above to see compatible hot water options.
        </p>
      )}
      {state.heatSource !== null && (
        <div style={cardGridStyle}>
          {(Object.keys(DHW_META) as DhwType[]).map(value => {
            const isAllowed = allowedDhw.includes(value);
            const isSelected = state.dhwType === value;
            const meta = DHW_META[value];
            return (
              <button
                key={value}
                type="button"
                data-testid={`dhw-type-${value}`}
                onClick={() => handleDhwType(value)}
                disabled={!isAllowed}
                style={cardStyle(isSelected, !isAllowed)}
                title={isAllowed ? meta.description : 'Not compatible with the selected heat source'}
              >
                <DhwTypeGraphic type={value} />
                <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, color: '#2d3748', marginTop: '0.3rem', lineHeight: 1.3 }}>
                  {meta.label}
                </span>
                {!isAllowed && (
                  <span style={{ fontSize: '0.65rem', color: '#a0aec0', marginTop: '0.15rem' }}>
                    Not compatible
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── 3. Emitters ────────────────────────────────────────────────────── */}
      <p style={sectionHeadingStyle}>3 — Emitters</p>
      <div style={cardGridStyle}>
        {EMITTER_OPTIONS.map(({ value, label, description }) => {
          const isSelected = state.emitters === value;
          return (
            <button
              key={value}
              type="button"
              data-testid={`emitter-${value}`}
              onClick={() => onChange({ ...state, emitters: value })}
              style={cardStyle(isSelected, false)}
              title={description}
            >
              <EmitterGraphic type={value} />
              <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, color: '#2d3748', marginTop: '0.3rem', lineHeight: 1.3 }}>
                {label}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#718096', marginTop: '0.2rem', lineHeight: 1.3 }}>
                {description}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 4. Pipework ────────────────────────────────────────────────────── */}
      <p style={sectionHeadingStyle}>4 — Pipework</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0 0 0.35rem' }}>
            Primary pipe size
          </p>
          <div style={inlineRowStyle}>
            {PRIMARY_SIZE_OPTIONS.map(({ value, label }) => (
              <button
                key={String(value)}
                type="button"
                data-testid={`pipe-size-${value}`}
                onClick={() => onChange({ ...state, primarySize: value })}
                style={chipStyle(state.primarySize === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0.5rem 0 0.35rem' }}>
            Circuit layout
          </p>
          <div style={inlineRowStyle}>
            {LAYOUT_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`pipe-layout-${value}`}
                onClick={() => onChange({ ...state, layout: value })}
                style={chipStyle(state.layout === value)}
                title={description || undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. Controls ────────────────────────────────────────────────────── */}
      <p style={sectionHeadingStyle}>5 — Controls</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

        {/* 5a. System controls */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0 0 0.35rem' }}>
            System controls
            {hasNarrowing && state.heatSource && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.68rem', color: '#2b6cb0', background: '#ebf8ff', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                Auto-narrowed for {state.heatSource.replace('_', ' ')}
              </span>
            )}
          </p>
          <div style={inlineRowStyle}>
            {CONTROL_FAMILY_OPTIONS.map(({ value, label, description }) => {
              const isPrimary = narrowed.primary.includes(value);
              const isSecondary = narrowed.secondary.includes(value);
              const isDeprioritised = hasNarrowing && !isPrimary;
              return (
                <button
                  key={value}
                  type="button"
                  data-testid={`control-family-${value}`}
                  onClick={() => onChange({ ...state, controlFamily: value })}
                  style={{
                    ...chipStyle(state.controlFamily === value),
                    opacity: isDeprioritised ? 0.55 : 1,
                  }}
                  title={description || (isDeprioritised ? `Not typical for ${state.heatSource?.replace('_', ' ')} — select if present` : undefined)}
                >
                  {label}
                  {isPrimary && hasNarrowing && (
                    <span style={{ display: 'block', fontSize: '0.6rem', color: '#276749', fontWeight: 600 }}>
                      ✓ typical
                    </span>
                  )}
                  {isSecondary && hasNarrowing && (
                    <span style={{ display: 'block', fontSize: '0.6rem', color: '#718096' }}>
                      if present
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5b. Thermostats */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0.5rem 0 0.35rem' }}>
            Thermostat
          </p>
          <div style={inlineRowStyle}>
            {THERMOSTAT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                data-testid={`thermostat-${value}`}
                onClick={() => onChange({ ...state, thermostatStyle: value })}
                style={chipStyle(state.thermostatStyle === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 5c. Programmers */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0.5rem 0 0.35rem' }}>
            Programmer
          </p>
          <div style={inlineRowStyle}>
            {PROGRAMMER_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`programmer-${value}`}
                onClick={() => onChange({ ...state, programmerType: value })}
                style={chipStyle(state.programmerType === value)}
                title={description || undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 6. Existing asset health ────────────────────────────────────────── */}
      <p style={sectionHeadingStyle}>6 — Existing system health</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Boiler age */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#4a5568', minWidth: '120px' }}>
            Boiler age (years)
          </label>
          <input
            type="number"
            min={0}
            max={50}
            placeholder="e.g. 12"
            value={state.boilerAgeYears ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
              onChange({ ...state, boilerAgeYears: v !== null && !isNaN(v) ? v : null });
            }}
            data-testid="boiler-age-years"
            style={{
              width: '90px',
              padding: '0.3rem 0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.82rem',
            }}
          />
        </div>

        {/* SEDBUK band */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0 0 0.35rem' }}>
            SEDBUK efficiency band
          </p>
          <div style={inlineRowStyle}>
            {SEDBUK_BANDS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                data-testid={`sedbuk-band-${value}`}
                onClick={() => onChange({ ...state, sedbukBand: value })}
                style={chipStyle(state.sedbukBand === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Service history */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0 0 0.35rem' }}>
            Service history
          </p>
          <div style={inlineRowStyle}>
            {SERVICE_HISTORY_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`service-history-${value}`}
                onClick={() => onChange({ ...state, serviceHistory: value })}
                style={chipStyle(state.serviceHistory === value)}
                title={description || undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 7. Regular system detail (only for regular / heat-only boilers) ──── */}
      {state.heatSource === 'regular' && (
        <>
          <p style={sectionHeadingStyle}>7 — Regular system detail</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* 7a. Heating system type */}
            <div>
              <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0 0 0.35rem' }}>
                Heating system type
              </p>
              <div style={inlineRowStyle}>
                {HEATING_SYSTEM_TYPE_OPTIONS.map(({ value, label, description }) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`heating-system-type-${value}`}
                    onClick={() => onChange({ ...state, heatingSystemType: value })}
                    style={chipStyle(state.heatingSystemType === value)}
                    title={description || undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 7b. Pipework routing */}
            <div>
              <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0.5rem 0 0.35rem' }}>
                Pipework routing
              </p>
              <div style={inlineRowStyle}>
                {PIPEWORK_ACCESS_OPTIONS.map(({ value, label, description }) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`pipework-access-${value}`}
                    onClick={() => onChange({ ...state, pipeworkAccess: value })}
                    style={chipStyle(state.pipeworkAccess === value)}
                    title={description || undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

      {/* ── 8. System condition ─────────────────────────────────────────────── */}
      <p style={sectionHeadingStyle}>8 — System condition</p>
      <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.75rem', marginTop: '-0.25rem' }}>
        These signals feed directly into the system health assessment and quick-win advice.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/* 8a. Bleed water colour */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0 0 0.35rem' }}>
            Bleed water colour
          </p>
          <div style={inlineRowStyle}>
            {BLEED_WATER_COLOUR_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`bleed-water-colour-${value}`}
                onClick={() => onChange({ ...state, bleedWaterColour: value })}
                style={chipStyle(state.bleedWaterColour === value)}
                title={description || undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 8b. Radiator performance */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0.5rem 0 0.35rem' }}>
            Radiator performance
          </p>
          <div style={inlineRowStyle}>
            {RADIATOR_PERFORMANCE_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`radiator-performance-${value}`}
                onClick={() => onChange({ ...state, radiatorPerformance: value })}
                style={chipStyle(state.radiatorPerformance === value)}
                title={description || undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 8c. Circulation / noise */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0.5rem 0 0.35rem' }}>
            Circulation / noise
          </p>
          <div style={inlineRowStyle}>
            {CIRCULATION_ISSUES_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`circulation-issues-${value}`}
                onClick={() => onChange({ ...state, circulationIssues: value })}
                style={chipStyle(state.circulationIssues === value)}
                title={description || undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 8d. Magnetic filter */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0.5rem 0 0.35rem' }}>
            Magnetic filter
          </p>
          <div style={inlineRowStyle}>
            {MAGNETIC_FILTER_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`magnetic-filter-${value}`}
                onClick={() => onChange({ ...state, magneticFilter: value })}
                style={chipStyle(state.magneticFilter === value)}
                title={description || undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 8e. Cleaning history */}
        <div>
          <p style={{ fontSize: '0.78rem', color: '#4a5568', margin: '0.5rem 0 0.35rem' }}>
            Cleaning history
          </p>
          <div style={inlineRowStyle}>
            {CLEANING_HISTORY_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`cleaning-history-${value}`}
                onClick={() => onChange({ ...state, cleaningHistory: value })}
                style={chipStyle(state.cleaningHistory === value)}
                title={description || undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── Debug output ─────────────────────────────────────────────────────── */}
      {showDebugOutput && normalised && (
        <details style={{ marginTop: '1.5rem' }}>
          <summary style={{ fontSize: '0.75rem', color: '#718096', cursor: 'pointer' }}>
            Dev: normalised system output
          </summary>
          <pre
            data-testid="system-builder-normalised-output"
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
          disabled={!canSubmit}
          title={canSubmit ? undefined : 'Select heat source, hot water type, and emitters to continue'}
          style={{ opacity: canSubmit ? 1 : 0.45 }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
