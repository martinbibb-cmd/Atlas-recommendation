/**
 * QuoteCollectionStep.tsx
 *
 * Survey step — Installation Specification entry card (Step 9 of 9).
 *
 * Design rules:
 *   - Provides a "Simple quote" form for quick contractor quote entry (label + system type).
 *   - "Open specification" launches the full InstallationSpecificationPage.
 *   - "Continue" / "Continue without specification" calls onNext immediately.
 *   - If a specification already exists, a status summary is shown.
 *   - Does NOT block survey progress.
 */

import { useState, type CSSProperties } from 'react';
import type { QuoteInput } from '../../../features/insightPack/insightPack.types';
import { getStepMeta } from '../../../config/surveyStepRegistry';

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '1.25rem',
  marginBottom: '1rem',
};

const statusBadgeStyle = (complete: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.25rem 0.65rem',
  borderRadius: 20,
  fontSize: '0.775rem',
  fontWeight: 600,
  background: complete ? '#dcfce7' : '#f1f5f9',
  color: complete ? '#166534' : '#64748b',
  marginBottom: '1rem',
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SpecificationStatus {
  /** Whether the specification has been started at all. */
  started: boolean;
  /** Whether the specification has been completed. */
  complete: boolean;
  /** Number of generated scope items (if any). */
  scopeItemCount?: number;
  /** Number of items that need verification. */
  needsVerificationCount?: number;
  /** Short description of the current and proposed system (e.g. "Combi → System"). */
  systemSummary?: string;
}

interface QuoteCollectionStepProps {
  onNext: () => void;
  onPrev: () => void;
  /** Called when the surveyor clicks "Open specification". */
  onOpenSpecification: () => void;
  /** Optional status of the installation specification if one already exists. */
  specificationStatus?: SpecificationStatus;
  /** Simple contractor quotes already entered in this session. */
  quotes?: QuoteInput[];
  /** Called when quotes are added or removed. */
  onQuotesChange?: (quotes: QuoteInput[]) => void;
}

// ─── Simple quote form ────────────────────────────────────────────────────────

const SYSTEM_TYPE_OPTIONS: { value: QuoteInput['systemType']; label: string }[] = [
  { value: 'combi', label: 'Combi boiler' },
  { value: 'system', label: 'System boiler' },
  { value: 'regular', label: 'Regular boiler' },
  { value: 'ashp', label: 'Air source heat pump' },
];

function SimpleQuoteForm({ quotes, onQuotesChange }: {
  quotes: QuoteInput[];
  onQuotesChange: (quotes: QuoteInput[]) => void;
}) {
  const [label, setLabel] = useState('');
  const [systemType, setSystemType] = useState<QuoteInput['systemType']>('combi');
  const [showForm, setShowForm] = useState(false);

  function handleAdd() {
    const trimmed = label.trim();
    if (!trimmed) return;
    const newQuote: QuoteInput = {
      id: `quote_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: trimmed,
      systemType,
      includedUpgrades: [],
    };
    onQuotesChange([...quotes, newQuote]);
    setLabel('');
    setSystemType('combi');
    setShowForm(false);
  }

  function handleRemove(id: string) {
    onQuotesChange(quotes.filter(q => q.id !== id));
  }

  const inputStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    fontSize: '0.875rem',
    marginBottom: '0.5rem',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {quotes.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.5rem' }}>
          {quotes.map((q) => (
            <li
              key={q.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.4rem 0.6rem', background: '#f1f5f9', borderRadius: 6,
                fontSize: '0.825rem', marginBottom: '0.35rem',
              }}
            >
              <span>
                <strong>{q.label}</strong>
                <span style={{ color: '#64748b', marginLeft: '0.4rem' }}>
                  — {SYSTEM_TYPE_OPTIONS.find(o => o.value === q.systemType)?.label ?? q.systemType}
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleRemove(q.id)}
                aria-label={`Remove quote: ${q.label}`}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#ef4444', fontSize: '1rem', lineHeight: 1, padding: '0 0.25rem',
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
            Contractor / label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='e.g. "ABC Heating — £2,400"'
            style={inputStyle}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
            System type
          </label>
          <select
            value={systemType}
            onChange={(e) => setSystemType(e.target.value as QuoteInput['systemType'])}
            style={{ ...inputStyle, marginBottom: '0.75rem' }}
          >
            {SYSTEM_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!label.trim()}
              style={{
                padding: '0.45rem 1rem', borderRadius: 6, border: 'none',
                background: '#1e3a5f', color: '#fff', fontWeight: 600,
                fontSize: '0.875rem', cursor: label.trim() ? 'pointer' : 'not-allowed',
                opacity: label.trim() ? 1 : 0.5,
              }}
            >
              + Add quote
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setLabel(''); }}
              style={{
                padding: '0.45rem 0.75rem', borderRadius: 6,
                border: '1px solid #d1d5db', background: '#fff',
                fontSize: '0.875rem', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{
            padding: '0.4rem 0.85rem', borderRadius: 6,
            border: '1px solid #1e3a5f', background: '#fff',
            color: '#1e3a5f', fontWeight: 600, fontSize: '0.825rem', cursor: 'pointer',
          }}
        >
          + Add simple quote
        </button>
      )}
    </div>
  );
}

export function QuoteCollectionStep({
  onNext,
  onPrev,
  onOpenSpecification,
  specificationStatus,
  quotes = [],
  onQuotesChange,
}: QuoteCollectionStepProps) {
  const meta = getStepMeta('quotes');

  const isComplete = specificationStatus?.complete ?? false;
  const isStarted = specificationStatus?.started ?? false;
  const hasQuotes = quotes.length > 0;

  let statusLabel: string;
  if (isComplete) {
    statusLabel = 'Specification complete';
  } else if (isStarted) {
    statusLabel = 'Specification started';
  } else {
    statusLabel = 'Not started';
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
        Build the technical install specification from the selected system, site
        locations, flue route, condensate route and pipework. Or add a simple
        contractor quote to compare options.
      </p>

      {/* ── Simple quotes ─────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <p style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>
          Simple quotes
        </p>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.5rem' }}>
          Enter contractor quotes to compare in the Insight Pack.
        </p>
        {onQuotesChange && (
          <SimpleQuoteForm quotes={quotes} onQuotesChange={onQuotesChange} />
        )}
        {!onQuotesChange && hasQuotes && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {quotes.map((q) => (
              <li key={q.id} style={{ fontSize: '0.825rem', padding: '0.3rem 0', color: '#374151' }}>
                {q.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Full specification ─────────────────────────────────────────────── */}
      <div style={cardStyle}>
        {/* Status badge */}
        <div style={statusBadgeStyle(isComplete)}>
          {isComplete ? '✓ ' : ''}{statusLabel}
        </div>

        {/* Scope summary — only shown when a spec exists */}
        {isStarted && (
          <div style={{ fontSize: '0.825rem', color: '#374151', marginBottom: '1rem' }}>
            {specificationStatus?.systemSummary && (
              <p style={{ margin: '0 0 0.3rem' }}>
                <strong>System:</strong> {specificationStatus.systemSummary}
              </p>
            )}
            {specificationStatus?.scopeItemCount != null && (
              <p style={{ margin: '0 0 0.3rem' }}>
                <strong>Generated scope:</strong>{' '}
                {specificationStatus.scopeItemCount === 0
                  ? '0 items'
                  : `${specificationStatus.scopeItemCount} item${specificationStatus.scopeItemCount !== 1 ? 's' : ''}`}
                {specificationStatus.needsVerificationCount != null &&
                  specificationStatus.needsVerificationCount > 0 && (
                    <span style={{ color: '#d97706', marginLeft: '0.5rem' }}>
                      · {specificationStatus.needsVerificationCount} need{specificationStatus.needsVerificationCount !== 1 ? '' : 's'} verification
                    </span>
                  )}
              </p>
            )}
          </div>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onOpenSpecification}
          aria-label="Open installation specification"
          data-testid="open-specification-btn"
          style={{
            display: 'block',
            width: '100%',
            padding: '0.65rem 1.25rem',
            borderRadius: 8,
            border: 'none',
            background: '#1e3a5f',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.925rem',
            cursor: 'pointer',
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}
        >
          🛠 Open specification
        </button>
      </div>

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
          onClick={onNext}
          data-testid="continue-without-specification-btn"
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            background: '#f8fafc',
            color: '#374151',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          {hasQuotes ? 'Continue' : 'Continue without specification'}
        </button>
      </div>
    </div>
  );
}

