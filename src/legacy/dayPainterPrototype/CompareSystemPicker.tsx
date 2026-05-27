/**
 * CompareSystemPicker — Always-visible A/B system selector for the Day Painter.
 *
 * Renders two independent pill groups:
 *   System A (red border when selected)
 *   System B (blue border when selected)
 *
 * Designed to live at the top of the Day Painter / Behaviour Console block,
 * outside any chart component, so it is always accessible to the advisor.
 *
 * When `suggestedB` is provided it is displayed as a "Suggested: X" badge next
 * to the System B label — clicking it applies the suggestion without forcing it.
 * This ensures pathway recommendations are displayed as hints only, never as
 * silent overrides.
 */

import type { ComparisonSystemType } from '../../engine/schema/ScenarioProfileV1';

// ─── System option list ───────────────────────────────────────────────────────

const SYSTEM_OPTIONS: { value: ComparisonSystemType; label: string }[] = [
  { value: 'combi',               label: 'Combi'              },
  { value: 'stored_vented',       label: 'Stored — Vented'    },
  { value: 'stored_unvented',     label: 'Stored — Unvented'  },
  { value: 'mixergy',             label: 'Mixergy'            },
  { value: 'mixergy_open_vented', label: 'Mixergy (Tank-fed)' },
  { value: 'ashp',                label: 'ASHP'               },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CompareSystemPickerProps {
  systemA: ComparisonSystemType;
  systemB: ComparisonSystemType;
  onSystemAChange: (sys: ComparisonSystemType) => void;
  onSystemBChange: (sys: ComparisonSystemType) => void;
  /**
   * When provided, displayed as a "Suggested: <label>" badge next to the
   * System B label.  Clicking the badge applies the suggestion but does NOT
   * force it — the user's current selection takes precedence.
   */
  suggestedB?: ComparisonSystemType;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompareSystemPicker({
  systemA,
  systemB,
  onSystemAChange,
  onSystemBChange,
  suggestedB,
}: CompareSystemPickerProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '1.25rem',
        flexWrap: 'wrap',
        marginBottom: 14,
        padding: '10px 14px',
        background: '#f7fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        alignItems: 'flex-start',
      }}
    >
      {/* ── System A ──────────────────────────────────────────────────────── */}
      <div role="group" aria-label="Select System A">
        <span
          style={{
            fontSize: '0.72rem',
            color: '#c53030',
            fontWeight: 700,
            display: 'block',
            marginBottom: 5,
          }}
        >
          System A (red):
        </span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SYSTEM_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onSystemAChange(opt.value)}
              aria-pressed={systemA === opt.value}
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                border: `1.5px solid ${systemA === opt.value ? '#e53e3e' : '#e2e8f0'}`,
                background: systemA === opt.value ? '#fff5f5' : '#fff',
                color: systemA === opt.value ? '#c53030' : '#718096',
                fontSize: '0.74rem',
                fontWeight: systemA === opt.value ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── System B ──────────────────────────────────────────────────────── */}
      <div role="group" aria-label="Select System B">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: '0.72rem', color: '#2c5282', fontWeight: 700 }}>
            System B (blue):
          </span>
          {suggestedB && suggestedB !== systemB && (
            <button
              onClick={() => onSystemBChange(suggestedB)}
              title="Apply pathway suggestion"
              style={{
                padding: '1px 8px',
                borderRadius: 10,
                border: '1.5px solid #3182ce',
                background: '#ebf8ff',
                color: '#2b6cb0',
                fontSize: '0.68rem',
                cursor: 'pointer',
              }}
            >
              Suggested: {SYSTEM_OPTIONS.find(o => o.value === suggestedB)?.label ?? suggestedB}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SYSTEM_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onSystemBChange(opt.value)}
              aria-pressed={systemB === opt.value}
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                border: `1.5px solid ${systemB === opt.value ? '#2b6cb0' : '#e2e8f0'}`,
                background: systemB === opt.value ? '#ebf8ff' : '#fff',
                color: systemB === opt.value ? '#2c5282' : '#718096',
                fontSize: '0.74rem',
                fontWeight: systemB === opt.value ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
