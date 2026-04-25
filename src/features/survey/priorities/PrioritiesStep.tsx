/**
 * PrioritiesStep.tsx
 *
 * Step: Priorities & Objectives
 *
 * Captures what matters most to this household.  Users tap chips to select
 * the priorities that apply — no forced ranking, no pricing language.
 *
 * The captured priorities shape:
 *   - which benefits are surfaced first on the insight page
 *   - emphasis in recommendation copy (reliability, eco, disruption)
 *
 * Design principles:
 *   - Fast to complete (7 tap-to-select chips)
 *   - No pricing language or product-led copy
 *   - Selection is advisory — physics suitability ranking is not overridden
 */

import type { CSSProperties } from 'react';
import { getStepMeta } from '../../../config/surveyStepRegistry';
import type {
  PrioritiesState,
  PriorityKey,
} from './prioritiesTypes';
import {
  PRIORITY_META,
  BUDGET_SENSITIVITY_META,
  DISRUPTION_TOLERANCE_META,
} from './prioritiesTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PrioritiesStepProps {
  state: PrioritiesState;
  onChange: (next: PrioritiesState) => void;
  onNext: () => void;
  onPrev: () => void;
}

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
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.65rem 0.85rem',
    borderRadius: '8px',
    border: isSelected ? '2px solid #2b6cb0' : '1px solid #e2e8f0',
    background: isSelected ? '#ebf8ff' : '#fff',
    boxShadow: isSelected ? '0 0 0 3px rgba(66, 153, 225, 0.2)' : 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
    width: '100%',
  };
}

function smallChipStyle(isSelected: boolean): CSSProperties {
  return {
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
    background: isSelected ? '#ebf8ff' : '#fff',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: isSelected ? 600 : 400,
    color: isSelected ? '#2b6cb0' : '#4a5568',
    transition: 'border-color 0.15s, background 0.15s',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PrioritiesStep({
  state,
  onChange,
  onNext,
  onPrev,
}: PrioritiesStepProps) {
  const selectedSet = new Set(state.selected);

  function toggle(key: PriorityKey) {
    const next = new Set(selectedSet);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange({ ...state, selected: Array.from(next) as PriorityKey[] });
  }

  return (
    <div className="step-card" data-testid="priorities-step">
      <h2>{getStepMeta('priorities').heading}</h2>
      <p style={{ color: '#4a5568', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
        These priorities shape how we present suitable options. Physics fit stays the same.
      </p>

      {/* ── Priority chips ─────────────────────────────────────────────── */}
      <div>
        <p style={sectionHeadingStyle}>What matters most?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {PRIORITY_META.map(({ key, label, sub, emoji }) => {
            const isSelected = selectedSet.has(key);
            return (
              <button
                key={key}
                type="button"
                data-testid={`priority-${key}`}
                onClick={() => toggle(key)}
                style={chipStyle(isSelected)}
                aria-pressed={isSelected}
              >
                <span style={{ fontSize: '1.1rem', lineHeight: 1, flexShrink: 0, marginTop: '0.1rem' }}>
                  {emoji}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '0.88rem',
                    color: isSelected ? '#2b6cb0' : '#2d3748',
                    marginBottom: '0.1rem',
                  }}>
                    {label}
                    {isSelected && (
                      <span style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#2b6cb0',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.04em',
                      }}>
                        ✓
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>{sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selection summary ──────────────────────────────────────────── */}
      {selectedSet.size > 0 && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.5rem 0.75rem',
            background: '#f0fff4',
            border: '1px solid #9ae6b4',
            borderRadius: '6px',
            fontSize: '0.78rem',
            color: '#276749',
          }}
        >
          <strong>{selectedSet.size}</strong>{' '}
          {selectedSet.size === 1 ? 'priority' : 'priorities'} selected — recommendations
          will surface these benefits first where relevant.
        </div>
      )}

      {/* ── Future plans ───────────────────────────────────────────────── */}
      <div style={{ marginTop: '1.5rem' }}>
        <p style={sectionHeadingStyle}>Future plans</p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.75rem' }}>
          Any planned changes that affect heating or hot-water demand?{' '}
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#3182ce', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
            Used by recommendation
          </span>
        </p>

        {/* Loft conversion */}
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
            Loft conversion planned or completed?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {([
              { value: true,  label: '✓ Yes', testId: 'future-loft-yes' },
              { value: false, label: '✗ No',  testId: 'future-loft-no' },
            ] as const).map(({ value, label, testId }) => (
              <button
                key={String(value)}
                type="button"
                data-testid={testId}
                onClick={() => onChange({ ...state, futureLoftConversion: value })}
                style={smallChipStyle(state.futureLoftConversion === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Extra bathroom */}
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
            Additional bathroom planned?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {([
              { value: true,  label: '✓ Yes', testId: 'future-bathroom-yes' },
              { value: false, label: '✗ No',  testId: 'future-bathroom-no' },
            ] as const).map(({ value, label, testId }) => (
              <button
                key={String(value)}
                type="button"
                data-testid={testId}
                onClick={() => onChange({ ...state, futureAddBathroom: value })}
                style={smallChipStyle(state.futureAddBathroom === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Heat pump interest */}
        <div>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
            Interested in a heat pump in future?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {([
              { value: true,  label: '✓ Yes', testId: 'heat-pump-interest-yes' },
              { value: false, label: '✗ No',  testId: 'heat-pump-interest-no' },
            ] as const).map(({ value, label, testId }) => (
              <button
                key={String(value)}
                type="button"
                data-testid={testId}
                onClick={() => onChange({ ...state, heatPumpInterest: value })}
                style={smallChipStyle(state.heatPumpInterest === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Customer constraints ───────────────────────────────────────── */}
      <div style={{ marginTop: '1.5rem' }}>
        <p style={sectionHeadingStyle}>Customer constraints</p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.75rem' }}>
          How the customer is thinking about cost and disruption.{' '}
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#3182ce', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
            Used by recommendation
          </span>
        </p>

        {/* Budget sensitivity */}
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
            Budget outlook
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {BUDGET_SENSITIVITY_META.map(({ value, label, sub, emoji }) => {
              const isSelected = state.budgetSensitivity === value;
              return (
                <button
                  key={value}
                  type="button"
                  data-testid={`budget-${value}`}
                  onClick={() => onChange({ ...state, budgetSensitivity: value })}
                  style={chipStyle(isSelected)}
                  aria-pressed={isSelected}
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0, marginTop: '0.1rem' }}>{emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.88rem', color: isSelected ? '#2b6cb0' : '#2d3748' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Disruption tolerance */}
        <div>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
            Installation disruption
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {DISRUPTION_TOLERANCE_META.map(({ value, label, sub, emoji }) => {
              const isSelected = state.disruptionTolerance === value;
              return (
                <button
                  key={value}
                  type="button"
                  data-testid={`disruption-${value}`}
                  onClick={() => onChange({ ...state, disruptionTolerance: value })}
                  style={chipStyle(isSelected)}
                  aria-pressed={isSelected}
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0, marginTop: '0.1rem' }}>{emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.88rem', color: isSelected ? '#2b6cb0' : '#2d3748' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Current system issues ─────────────────────────────────────── */}
      <div style={{ marginTop: '1.5rem' }}>
        <p style={sectionHeadingStyle}>Current system issues</p>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.75rem' }}>
          How the current system is performing for the customer.{' '}
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#3182ce', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
            Shown on customer summary
          </span>
        </p>

        {/* Hot water adequacy */}
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
            Do you run out of hot water?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {([
              { value: true,  label: '✓ Yes', testId: 'issues-runs-out-hot-water-yes' },
              { value: false, label: '✗ No',  testId: 'issues-runs-out-hot-water-no' },
            ] as const).map(({ value, label, testId }) => (
              <button
                key={String(value)}
                type="button"
                data-testid={testId}
                onClick={() => onChange({ ...state, runsOutOfHotWater: value })}
                style={smallChipStyle(state.runsOutOfHotWater === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Multiple tap use */}
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
            Can you use multiple taps at once?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {([
              { value: true,  label: '✓ Yes', testId: 'issues-multiple-taps-yes' },
              { value: false, label: '✗ No',  testId: 'issues-multiple-taps-no' },
            ] as const).map(({ value, label, testId }) => (
              <button
                key={String(value)}
                type="button"
                data-testid={testId}
                onClick={() => onChange({ ...state, canUseMultipleTaps: value })}
                style={smallChipStyle(state.canUseMultipleTaps === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Room temperature */}
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
            Do all rooms reach temperature?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {([
              { value: true,  label: '✓ Yes', testId: 'issues-rooms-temp-yes' },
              { value: false, label: '✗ No',  testId: 'issues-rooms-temp-no' },
            ] as const).map(({ value, label, testId }) => (
              <button
                key={String(value)}
                type="button"
                data-testid={testId}
                onClick={() => onChange({ ...state, allRoomsReachTemperature: value })}
                style={smallChipStyle(state.allRoomsReachTemperature === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Other issues */}
        <div>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
            Any other issues?
          </p>
          <textarea
            data-testid="issues-other-text"
            value={state.otherIssues ?? ''}
            onChange={e => onChange({ ...state, otherIssues: e.target.value })}
            placeholder="Describe any other problems with the current system…"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.5rem 0.65rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.82rem',
              color: '#2d3748',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
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
