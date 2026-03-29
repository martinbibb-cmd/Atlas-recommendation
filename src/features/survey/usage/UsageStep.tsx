/**
 * UsageStep.tsx  (Home / Demographics step)
 *
 * Step: Home & Household
 *
 * Captures household demographics as the primary demand signal.
 * Age group headcounts drive demand shape, concurrency likelihood,
 * and draw type — users do not enter flow rates or concurrency figures.
 *
 * Sections:
 *   1. Household composition — headcounts by age band
 *   2. Daytime occupancy — three-option fast question
 *   3. Bath use frequency — three-option fast question
 *   4. Bathroom count — concurrent draw risk gate
 *   5. Demand summary — physics-derived indicator
 */

import { type CSSProperties } from 'react';
import type {
  HomeState,
  DaytimeOccupancy,
  BathUse,
  HouseholdComposition,
} from './usageTypes';
import { normaliseUsage } from './usageNormalizer';
import {
  CONCURRENCY_RISK_LABELS,
  VOLUME_LABELS,
} from './usageRules';

// ─── Props ────────────────────────────────────────────────────────────────────

interface UsageStepProps {
  state: HomeState;
  onChange: (next: HomeState) => void;
  onNext: () => void;
  onPrev: () => void;
  /** When true, renders a compact dev/debug summary of the normalised output. */
  showDebugOutput?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYTIME_OPTIONS: { value: DaytimeOccupancy; label: string; sub: string }[] = [
  { value: 'usually_out',  label: 'Usually out',   sub: 'Most adults out during working hours' },
  { value: 'usually_home', label: 'Someone home',  sub: 'At least one adult home most of the day' },
  { value: 'irregular',    label: 'Irregular',     sub: 'Shift work, part-time or variable schedule' },
  { value: 'unknown',      label: 'Not sure',      sub: '' },
];

const BATH_USE_OPTIONS: { value: BathUse; label: string; sub: string }[] = [
  { value: 'rare',      label: 'Rarely',     sub: 'Showers only — baths almost never' },
  { value: 'sometimes', label: 'Sometimes',  sub: 'Occasional baths (a few per week)' },
  { value: 'frequent',  label: 'Frequently', sub: 'Baths most days' },
  { value: 'unknown',   label: 'Not sure',   sub: '' },
];

const CONCURRENCY_RISK_COLOURS: Record<string, { bg: string; border: string; text: string }> = {
  low:     { bg: '#f0fff4', border: '#9ae6b4', text: '#276749' },
  medium:  { bg: '#fffbeb', border: '#f6e05e', text: '#975a16' },
  high:    { bg: '#fff5f5', border: '#feb2b2', text: '#c53030' },
  unknown: { bg: '#f7fafc', border: '#e2e8f0', text: '#4a5568' },
};

// ─── Age band definitions ─────────────────────────────────────────────────────

type AgeField = keyof HouseholdComposition;

const AGE_BANDS: {
  field: AgeField;
  label: string;
  sub: string;
}[] = [
  { field: 'adultCount',               label: 'Adults',          sub: '26+ years' },
  { field: 'youngAdultCount18to25AtHome', label: 'Young adults',  sub: '18–25 at home (student / gap year)' },
  { field: 'childCount11to17',          label: 'Teenagers',       sub: '11–17 years' },
  { field: 'childCount5to10',           label: 'Children',        sub: '5–10 years' },
  { field: 'childCount0to4',            label: 'Young children',  sub: '0–4 years' },
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

function chipStyle(isSelected: boolean): CSSProperties {
  return {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
    background: isSelected ? '#ebf8ff' : '#fff',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: isSelected ? 600 : 400,
    color: isSelected ? '#2b6cb0' : '#4a5568',
    transition: 'border-color 0.15s, background 0.15s',
    textAlign: 'left' as const,
  };
}

function spinnerBtnStyle(): CSSProperties {
  return {
    padding: '0.3rem 0.7rem',
    border: '1px solid #e2e8f0',
    borderRadius: '5px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UsageStep({
  state,
  onChange,
  onNext,
  onPrev,
  showDebugOutput = false,
}: UsageStepProps) {
  const normalised = showDebugOutput ? normaliseUsage(state) : null;
  const { concurrencyRisk, volumeDemandBand, summaryLine } = normalised?.home ??
    { concurrencyRisk: 'unknown' as const, volumeDemandBand: 'unknown' as const, summaryLine: 'Household not yet specified' };

  const colours = CONCURRENCY_RISK_COLOURS[concurrencyRisk] ?? CONCURRENCY_RISK_COLOURS.unknown;

  function setComp<K extends AgeField>(field: K, value: number) {
    onChange({ ...state, composition: { ...state.composition, [field]: Math.max(0, value) } });
  }

  return (
    <div className="step-card" data-testid="usage-step">
      <h2>🏠 Step 2: Home &amp; Household</h2>
      <p style={{ color: '#4a5568', fontSize: '0.85rem', marginTop: '0.25rem' }}>
        Tell us about who lives here. Demand is derived automatically from
        household composition — no need to estimate flow rates or concurrency.
      </p>

      {/* ── 1. Household composition ─────────────────────────────────── */}
      <div>
        <p style={{ ...sectionHeadingStyle, marginTop: '1rem' }}>
          Who lives here?
        </p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.75rem' }}>
          Enter headcounts by age group. Teenagers and young adults are the
          strongest predictors of simultaneous hot water demand.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {AGE_BANDS.map(({ field, label, sub }) => (
            <div
              key={field}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: '#f7fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#2d3748' }}>{label}</span>
                <span style={{ fontSize: '0.75rem', color: '#718096', marginLeft: '0.4rem' }}>{sub}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  data-testid={`comp-dec-${field}`}
                  onClick={() => setComp(field, (state.composition[field] as number) - 1)}
                  style={spinnerBtnStyle()}
                  aria-label={`Decrease ${label}`}
                >
                  −
                </button>
                <span
                  data-testid={`comp-val-${field}`}
                  style={{ fontWeight: 700, fontSize: '1rem', minWidth: '1.75rem', textAlign: 'center' }}
                >
                  {state.composition[field]}
                </span>
                <button
                  type="button"
                  data-testid={`comp-inc-${field}`}
                  onClick={() => setComp(field, (state.composition[field] as number) + 1)}
                  style={spinnerBtnStyle()}
                  aria-label={`Increase ${label}`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Daytime occupancy ─────────────────────────────────────── */}
      <div>
        <p style={sectionHeadingStyle}>
          Weekday daytime occupancy
        </p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.5rem' }}>
          Is anyone at home during working hours on weekdays?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
          {DAYTIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              data-testid={`daytime-${opt.value}`}
              onClick={() => onChange({ ...state, daytimeOccupancy: opt.value })}
              style={chipStyle(state.daytimeOccupancy === opt.value)}
            >
              <div style={{ fontWeight: state.daytimeOccupancy === opt.value ? 700 : 500, fontSize: '0.88rem' }}>
                {opt.label}
              </div>
              {opt.sub && (
                <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.1rem' }}>
                  {opt.sub}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Bath use ──────────────────────────────────────────────── */}
      <div>
        <p style={sectionHeadingStyle}>Bath use</p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.5rem' }}>
          How often are baths (rather than showers) taken?
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {BATH_USE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              data-testid={`bath-use-${opt.value}`}
              onClick={() => onChange({ ...state, bathUse: opt.value })}
              style={chipStyle(state.bathUse === opt.value)}
            >
              <div style={{ fontWeight: state.bathUse === opt.value ? 700 : 500, fontSize: '0.88rem' }}>
                {opt.label}
              </div>
              {opt.sub && (
                <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.1rem' }}>
                  {opt.sub}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. Bathroom count ────────────────────────────────────────── */}
      <div>
        <p style={sectionHeadingStyle}>Number of bathrooms</p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.5rem' }}>
          How many bathrooms does the property have? Multiple bathrooms increase
          concurrent draw risk for combi and small-store systems.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
          {[1, 2, 3, 4].map(n => (
            <button
              key={n}
              type="button"
              data-testid={`bathroom-count-${n}`}
              onClick={() => onChange({ ...state, bathroomCount: n })}
              style={{
                padding: '0.5rem',
                border: `2px solid ${state.bathroomCount === n ? '#3182ce' : '#e2e8f0'}`,
                borderRadius: '6px',
                background: state.bathroomCount === n ? '#ebf8ff' : '#fff',
                cursor: 'pointer',
                fontWeight: state.bathroomCount === n ? 700 : 400,
                fontSize: '0.9rem',
                transition: 'all 0.12s',
              }}
            >
              {n}{n === 4 ? '+' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ── 5. Demand summary indicator ──────────────────────────────── */}
      <div
        data-testid="dhw-demand-summary"
        style={{
          marginTop: '1.25rem',
          padding: '0.625rem 0.875rem',
          background: colours.bg,
          border: `1px solid ${colours.border}`,
          borderRadius: '8px',
          fontSize: '0.82rem',
          color: colours.text,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Demand summary</div>
        <div>{summaryLine}</div>
        {concurrencyRisk !== 'unknown' && (
          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
            Concurrency risk: <strong>{CONCURRENCY_RISK_LABELS[concurrencyRisk]}</strong>
            {volumeDemandBand !== 'unknown' && (
              <span> · Volume demand: <strong>{VOLUME_LABELS[volumeDemandBand]}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* ── Debug output ─────────────────────────────────────────────── */}
      {showDebugOutput && normalised && (
        <details style={{ marginTop: '1.5rem' }}>
          <summary style={{ fontSize: '0.75rem', color: '#718096', cursor: 'pointer' }}>
            Dev: normalised home output
          </summary>
          <pre
            data-testid="usage-normalised-output"
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

      {/* ── Navigation ───────────────────────────────────────────────── */}
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
