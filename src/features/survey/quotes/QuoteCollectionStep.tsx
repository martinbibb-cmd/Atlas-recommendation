/**
 * QuoteCollectionStep.tsx
 *
 * Survey step — Contractor Quotes
 *
 * Collects 1–N contractor quotes so the Atlas Insight Pack can compare them
 * against the engine-derived recommendation.
 *
 * Each quote captures:
 *   • Label (e.g. "Quote A — ABC Heating")
 *   • System type (combi / system / regular / ashp)
 *   • Nominal heat source output (kW) — optional
 *   • Cylinder spec (type + volume) — optional, only for system/regular
 *   • Included upgrades (powerflush, filter, controls, etc.)
 *
 * Design rules:
 *   - No pricing fields — quote comparison is physics-based, not cost-based
 *   - Upgrade list uses checkboxes; free-text note per quote is NOT a price field
 *   - At least one quote must be entered before the user can proceed
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { QuoteInput } from '../../insightPack/insightPack.types';
import { getStepMeta } from '../../../config/surveyStepRegistry';

// ─── Constants ────────────────────────────────────────────────────────────────

const UPGRADE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'powerflush', label: 'Powerflush' },
  { id: 'filter', label: 'Magnetic filter' },
  { id: 'controls', label: 'Smart controls / thermostat' },
  { id: 'trvs', label: 'TRVs on radiators' },
  { id: 'scale_reducer', label: 'Scale reducer / inhibitor' },
  { id: 'unvented_cylinder', label: 'Unvented cylinder upgrade' },
  { id: 'flue_relocation', label: 'Flue relocation' },
];

const SYSTEM_TYPE_LABELS: Record<QuoteInput['systemType'], string> = {
  combi: 'Combination boiler (on-demand hot water)',
  system: 'System boiler + unvented cylinder',
  regular: 'Regular boiler + vented cylinder',
  ashp: 'Air source heat pump',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '1rem',
  marginBottom: '0.75rem',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '0.25rem',
  marginTop: '0.75rem',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: '0.9rem',
  boxSizing: 'border-box',
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  background: '#fff',
};

const upgradeChipStyle = (active: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.3rem 0.6rem',
  borderRadius: 6,
  border: active ? '2px solid #2563eb' : '1px solid #e2e8f0',
  background: active ? '#eff6ff' : '#f9fafb',
  fontSize: '0.8rem',
  cursor: 'pointer',
  marginRight: '0.4rem',
  marginBottom: '0.4rem',
  fontWeight: active ? 600 : 400,
  color: active ? '#1d4ed8' : '#374151',
  transition: 'all 0.12s',
  userSelect: 'none',
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuoteCollectionStepProps {
  quotes: QuoteInput[];
  onChange: (next: QuoteInput[]) => void;
  onNext: () => void;
  onPrev: () => void;
}

// ─── Quote form helpers ───────────────────────────────────────────────────────

function makeBlankQuote(index: number): QuoteInput {
  return {
    id: `quote_${String.fromCharCode(97 + index)}`,
    label: `Quote ${String.fromCharCode(65 + index)}`,
    systemType: 'combi',
    heatSourceKw: undefined,
    cylinder: undefined,
    includedUpgrades: [],
  };
}

function needsCylinder(type: QuoteInput['systemType']): boolean {
  return type === 'system' || type === 'regular';
}

// ─── Single quote editor ──────────────────────────────────────────────────────

interface QuoteEditorProps {
  quote: QuoteInput;
  index: number;
  canRemove: boolean;
  onChange: (updated: QuoteInput) => void;
  onRemove: () => void;
}

function QuoteEditor({ quote, index, canRemove, onChange, onRemove }: QuoteEditorProps) {
  const showCylinder = needsCylinder(quote.systemType);

  function toggleUpgrade(upgradeId: string) {
    const current = quote.includedUpgrades;
    const next = current.includes(upgradeId)
      ? current.filter(u => u !== upgradeId)
      : [...current, upgradeId];
    onChange({ ...quote, includedUpgrades: next });
  }

  function setSystemType(type: QuoteInput['systemType']) {
    const updated: QuoteInput = {
      ...quote,
      systemType: type,
      // Clear cylinder if switching to a system that doesn't need one
      cylinder: needsCylinder(type) ? (quote.cylinder ?? { type: 'standard', volumeL: 210 }) : undefined,
    };
    onChange(updated);
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.95rem', color: '#1e3a5f' }}>
          Quote {String.fromCharCode(65 + index)}
        </strong>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove Quote ${String.fromCharCode(65 + index)}`}
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', padding: '0.25rem' }}
          >
            ✕ Remove
          </button>
        )}
      </div>

      {/* Label */}
      <label style={labelStyle} htmlFor={`quote-label-${index}`}>
        Quote label (optional — e.g. contractor name)
      </label>
      <input
        id={`quote-label-${index}`}
        style={inputStyle}
        type="text"
        value={quote.label}
        onChange={e => onChange({ ...quote, label: e.target.value.trim() || `Quote ${String.fromCharCode(65 + index)}` })}
        placeholder={`Quote ${String.fromCharCode(65 + index)}`}
        aria-label={`Label for Quote ${String.fromCharCode(65 + index)}`}
      />

      {/* System type */}
      <label style={labelStyle} htmlFor={`quote-type-${index}`}>
        System type *
      </label>
      <select
        id={`quote-type-${index}`}
        style={selectStyle}
        value={quote.systemType}
        onChange={e => setSystemType(e.target.value as QuoteInput['systemType'])}
        aria-label={`System type for Quote ${String.fromCharCode(65 + index)}`}
      >
        {(Object.entries(SYSTEM_TYPE_LABELS) as [QuoteInput['systemType'], string][]).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      {/* Heat source kW */}
      <label style={labelStyle} htmlFor={`quote-kw-${index}`}>
        Boiler / heat pump output (kW) — optional
      </label>
      <input
        id={`quote-kw-${index}`}
        style={{ ...inputStyle, width: 100 }}
        type="number"
        min={4}
        max={100}
        step={0.5}
        value={quote.heatSourceKw ?? ''}
        onChange={e => onChange({ ...quote, heatSourceKw: e.target.value ? parseFloat(e.target.value) : undefined })}
        placeholder="e.g. 30"
        aria-label={`Heat source output (kW) for Quote ${String.fromCharCode(65 + index)}`}
      />

      {/* Cylinder — only shown for system / regular */}
      {showCylinder && (
        <>
          <label style={labelStyle}>
            Cylinder
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              style={{ ...selectStyle, width: 160 }}
              value={quote.cylinder?.type ?? 'standard'}
              onChange={e => onChange({
                ...quote,
                cylinder: { type: e.target.value as 'standard' | 'mixergy', volumeL: quote.cylinder?.volumeL ?? 210 },
              })}
              aria-label={`Cylinder type for Quote ${String.fromCharCode(65 + index)}`}
            >
              <option value="standard">Standard cylinder</option>
              <option value="mixergy">Mixergy smart cylinder</option>
            </select>
            <input
              style={{ ...inputStyle, width: 90 }}
              type="number"
              min={120}
              max={400}
              step={5}
              value={quote.cylinder?.volumeL ?? 210}
              onChange={e => onChange({
                ...quote,
                cylinder: { type: quote.cylinder?.type ?? 'standard', volumeL: parseInt(e.target.value, 10) || 210 },
              })}
              aria-label={`Cylinder volume (litres) for Quote ${String.fromCharCode(65 + index)}`}
            />
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>litres</span>
          </div>
        </>
      )}

      {/* Included upgrades */}
      <label style={{ ...labelStyle, marginTop: '0.85rem' }}>
        Included in this quote
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {UPGRADE_OPTIONS.map(opt => (
          <button
            key={opt.id}
            type="button"
            style={upgradeChipStyle(quote.includedUpgrades.includes(opt.id))}
            onClick={() => toggleUpgrade(opt.id)}
            aria-pressed={quote.includedUpgrades.includes(opt.id)}
            aria-label={`${opt.label} — ${quote.includedUpgrades.includes(opt.id) ? 'included' : 'not included'}`}
          >
            {quote.includedUpgrades.includes(opt.id) ? '✓ ' : ''}{opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuoteCollectionStep({
  quotes,
  onChange,
  onNext,
  onPrev,
}: QuoteCollectionStepProps) {
  const meta = getStepMeta('quotes');
  const [triedNext, setTriedNext] = useState(false);

  const canProceed = quotes.length >= 1;

  function addQuote() {
    onChange([...quotes, makeBlankQuote(quotes.length)]);
  }

  function updateQuote(index: number, updated: QuoteInput) {
    const next = quotes.map((q, i) => (i === index ? updated : q));
    onChange(next);
  }

  function removeQuote(index: number) {
    const next = quotes.filter((_, i) => i !== index);
    // Re-index IDs to stay sequential
    const reindexed = next.map((q, i) => ({
      ...q,
      id: `quote_${String.fromCharCode(97 + i)}`,
    }));
    onChange(reindexed);
  }

  function handleNext() {
    setTriedNext(true);
    if (!canProceed) return;
    onNext();
  }

  return (
    <div
      data-testid={meta.testId}
      style={{ padding: '1rem 1rem 2rem', maxWidth: 600, margin: '0 auto' }}
    >
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e3a5f' }}>
        {meta.heading}
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.25rem' }}>
        Enter the contractor quotes you have received. Atlas will compare each quote
        against the assessment and highlight strengths, limitations, and the best fit
        for this home.
      </p>

      {quotes.length === 0 && (
        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem', border: '1px dashed #e2e8f0' }}>
          No quotes added yet. Add at least one quote to compare.
        </div>
      )}

      {quotes.map((quote, i) => (
        <QuoteEditor
          key={quote.id}
          quote={quote}
          index={i}
          canRemove={quotes.length > 1}
          onChange={updated => updateQuote(i, updated)}
          onRemove={() => removeQuote(i)}
        />
      ))}

      {quotes.length < 4 && (
        <button
          type="button"
          onClick={addQuote}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            border: '1.5px dashed #2563eb',
            borderRadius: 8,
            background: '#eff6ff',
            color: '#2563eb',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '1.25rem',
          }}
        >
          + Add quote
        </button>
      )}

      {triedNext && !canProceed && (
        <p role="alert" style={{ color: '#dc2626', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
          Add at least one contractor quote to continue.
        </p>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button
          type="button"
          onClick={onPrev}
          style={{ padding: '0.6rem 1.25rem', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed}
          style={{
            padding: '0.6rem 1.5rem',
            borderRadius: 8,
            border: 'none',
            background: canProceed ? '#2563eb' : '#cbd5e1',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: canProceed ? 'pointer' : 'not-allowed',
          }}
        >
          View Insight Pack →
        </button>
        <button
          type="button"
          onClick={onNext}
          style={{
            padding: '0.6rem 1rem',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            background: '#f8fafc',
            color: '#374151',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Skip →
        </button>
      </div>
    </div>
  );
}
