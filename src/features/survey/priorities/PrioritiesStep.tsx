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
import type { PrioritiesState, PriorityKey } from './prioritiesTypes';
import { PRIORITY_META } from './prioritiesTypes';

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
    border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
    background: isSelected ? '#ebf8ff' : '#fff',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'border-color 0.15s, background 0.15s',
    width: '100%',
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
      <h2>🎯 What matters most?</h2>
      <p style={{ color: '#4a5568', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
        Select the things that matter most to this household. These shape
        how we frame recommendations — physics suitability stays the same.
      </p>
      <p style={{ color: '#718096', fontSize: '0.78rem', marginBottom: '1rem' }}>
        Select any that apply — or skip to see recommendations based on physics fit only.
      </p>

      {/* ── Priority chips ─────────────────────────────────────────────── */}
      <div>
        <p style={sectionHeadingStyle}>Priorities</p>
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
