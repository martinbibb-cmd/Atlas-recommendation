/**
 * UsageStep.tsx
 *
 * Step: Usage / Demand
 *
 * Captures behavioural demand inputs — how heat and hot water are actually
 * used in this home.  This is a demand modelling step, not a demographics
 * step: the framing is physical behaviour, not social profile.
 *
 * Sections:
 *   1. Occupancy pattern — daytime presence / absence
 *   2. Peak simultaneous hot water use — concurrency level
 *   3. Bath use — frequency of bath vs shower
 *   4. Draw style — short taps vs long showers
 *   5. Household size — optional sizing context
 *   6. Demand summary — physics-derived indicator (dhw-demand-summary)
 */

import { type CSSProperties } from 'react';
import type {
  UsageState,
  OccupancyPattern,
  BathUse,
  ConcurrencyLevel,
  DrawStyle,
} from './usageTypes';
import { normaliseUsage } from './usageNormalizer';
import {
  CONCURRENCY_RISK_LABELS,
  VOLUME_LABELS,
} from './usageRules';

// ─── Props ────────────────────────────────────────────────────────────────────

interface UsageStepProps {
  state: UsageState;
  onChange: (next: UsageState) => void;
  onNext: () => void;
  onPrev: () => void;
  /** When true, renders a compact dev/debug summary of the normalised output. */
  showDebugOutput?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OCCUPANCY_PATTERN_OPTIONS: { value: OccupancyPattern; label: string; sub: string }[] = [
  { value: 'usually_out',      label: 'Usually out',      sub: 'Most occupants out during weekday days' },
  { value: 'someone_home',     label: 'Someone home',     sub: 'At least one person home most of the day' },
  { value: 'irregular_shifts', label: 'Irregular shifts', sub: 'Shift workers or mixed / unpredictable hours' },
  { value: 'unknown',          label: 'Not sure',         sub: '' },
];

const CONCURRENCY_OPTIONS: { value: ConcurrencyLevel; label: string; sub: string }[] = [
  { value: 1,       label: '1 outlet',   sub: 'One shower or tap at a time' },
  { value: 2,       label: '2 outlets',  sub: 'e.g. shower + kitchen simultaneously' },
  { value: 3,       label: '3 outlets',  sub: 'Multiple bathrooms in use at once' },
  { value: '4_plus', label: '4 or more', sub: 'High-demand household' },
  { value: 'unknown', label: 'Not sure', sub: '' },
];

const BATH_USE_OPTIONS: { value: BathUse; label: string; sub: string }[] = [
  { value: 'rare',      label: 'Rarely',     sub: 'Showers only, baths almost never' },
  { value: 'sometimes', label: 'Sometimes',  sub: 'Occasional baths (a few per week)' },
  { value: 'frequent',  label: 'Frequently', sub: 'Baths most days' },
  { value: 'unknown',   label: 'Not sure',   sub: '' },
];

const DRAW_STYLE_OPTIONS: { value: DrawStyle; label: string; sub: string }[] = [
  { value: 'mostly_short', label: 'Short draws',  sub: 'Brief taps, quick showers, appliances' },
  { value: 'mixed',        label: 'Mixed',         sub: 'Combination of short and long draws' },
  { value: 'mostly_long',  label: 'Long draws',    sub: 'Long showers, deep baths' },
  { value: 'unknown',      label: 'Not sure',      sub: '' },
];

const CONCURRENCY_RISK_COLOURS: Record<string, { bg: string; border: string; text: string }> = {
  low:     { bg: '#f0fff4', border: '#9ae6b4', text: '#276749' },
  medium:  { bg: '#fffbeb', border: '#f6e05e', text: '#975a16' },
  high:    { bg: '#fff5f5', border: '#feb2b2', text: '#c53030' },
  unknown: { bg: '#f7fafc', border: '#e2e8f0', text: '#4a5568' },
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

// ─── Component ────────────────────────────────────────────────────────────────

export function UsageStep({
  state,
  onChange,
  onNext,
  onPrev,
  showDebugOutput = false,
}: UsageStepProps) {
  const normalised = showDebugOutput ? normaliseUsage(state) : null;
  const { concurrencyRisk, volumeDemandBand, summaryLine } = normalised?.demand ??
    { concurrencyRisk: 'unknown' as const, volumeDemandBand: 'unknown' as const, summaryLine: 'Usage not yet specified' };

  const colours = CONCURRENCY_RISK_COLOURS[concurrencyRisk] ?? CONCURRENCY_RISK_COLOURS.unknown;

  function set<K extends keyof UsageState>(key: K, value: UsageState[K]) {
    onChange({ ...state, [key]: value });
  }

  return (
    <div className="step-card" data-testid="usage-step">
      <h2>📊 Step 6: Usage &amp; Demand</h2>
      <p style={{ color: '#4a5568', fontSize: '0.85rem', marginTop: '0.25rem' }}>
        Describe how heat and hot water are used in this home.
        This is about behaviour and demand patterns — not demographics.
      </p>

      {/* ── 1. Occupancy pattern ─────────────────────────────────────────── */}
      <div>
        <p style={{ ...sectionHeadingStyle, marginTop: '1rem' }}>
          Daytime occupancy pattern
        </p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.5rem' }}>
          How is the home occupied during weekday daytime hours?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
          {OCCUPANCY_PATTERN_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              data-testid={`occupancy-pattern-${opt.value}`}
              onClick={() => set('occupancyPattern', opt.value)}
              style={chipStyle(state.occupancyPattern === opt.value)}
            >
              <div style={{ fontWeight: state.occupancyPattern === opt.value ? 700 : 500, fontSize: '0.88rem' }}>
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

      {/* ── 2. Peak simultaneous hot water use ──────────────────────────── */}
      <div>
        <p style={sectionHeadingStyle}>
          Peak simultaneous hot water outlets
        </p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.5rem' }}>
          At the busiest moment — how many hot water outlets run at once?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
          {CONCURRENCY_OPTIONS.map(opt => (
            <button
              key={String(opt.value)}
              type="button"
              data-testid={`concurrency-${String(opt.value).replace('+', 'plus')}`}
              onClick={() => set('peakHotWaterConcurrency', opt.value)}
              style={chipStyle(state.peakHotWaterConcurrency === opt.value)}
            >
              <div style={{ fontWeight: state.peakHotWaterConcurrency === opt.value ? 700 : 500, fontSize: '0.88rem' }}>
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

      {/* ── 3. Bath use ─────────────────────────────────────────────────── */}
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
              onClick={() => set('bathUse', opt.value)}
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

      {/* ── 4. Draw style ───────────────────────────────────────────────── */}
      <div>
        <p style={sectionHeadingStyle}>Hot water draw style</p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.5rem' }}>
          How is hot water mainly drawn off?
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {DRAW_STYLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              data-testid={`draw-style-${opt.value}`}
              onClick={() => set('drawStyle', opt.value)}
              style={chipStyle(state.drawStyle === opt.value)}
            >
              <div style={{ fontWeight: state.drawStyle === opt.value ? 700 : 500, fontSize: '0.88rem' }}>
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

      {/* ── 5. Household size (optional sizing context) ─────────────────── */}
      <div>
        <p style={sectionHeadingStyle}>Household size (optional)</p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.5rem' }}>
          Number of occupants — used for cylinder sizing context only.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => set('householdSize', Math.max(1, (state.householdSize ?? 2) - 1))}
            style={{ padding: '0.3rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
            aria-label="Decrease household size"
          >
            −
          </button>
          <span style={{ fontSize: '1rem', fontWeight: 700, minWidth: '2rem', textAlign: 'center' }}>
            {state.householdSize ?? '—'}
          </span>
          <button
            type="button"
            onClick={() => set('householdSize', Math.min(10, (state.householdSize ?? 1) + 1))}
            style={{ padding: '0.3rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
            aria-label="Increase household size"
          >
            +
          </button>
          {state.householdSize !== null && (
            <button
              type="button"
              onClick={() => set('householdSize', null)}
              style={{ fontSize: '0.75rem', color: '#718096', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── 6. Demand summary indicator ─────────────────────────────────── */}
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

      {/* ── Debug output ─────────────────────────────────────────────────── */}
      {showDebugOutput && normalised && (
        <details style={{ marginTop: '1.5rem' }}>
          <summary style={{ fontSize: '0.75rem', color: '#718096', cursor: 'pointer' }}>
            Dev: normalised demand output
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
