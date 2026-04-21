/**
 * VisitHandoffReviewPage.tsx
 *
 * PR11 — Shared shell for the completed-visit handoff review.
 *
 * Wraps CustomerHandoffView and EngineerHandoffView in a tabbed shell.
 *
 * Features:
 *   - Title / header with address and completion date
 *   - Customer / Engineer tab switcher
 *   - Read-only notice
 *   - Error state when the pack fails to parse
 *   - Sparse section graceful handling (delegated to child views)
 *   - Dev: raw JSON toggle (only shown when import.meta.env.DEV)
 *   - Dev: upload / paste JSON to load a different pack
 *
 * Architecture rules:
 *   - No dependency on the legacy report / Insight pipeline.
 *   - No wiring into the recommendation engine.
 *   - Fully isolated read-only surface.
 */

import { useState, useCallback } from 'react';
import type { VisitHandoffPack } from '../types/visitHandoffPack';
import { safeParseVisitHandoffPack } from '../parser/parseVisitHandoffPack';
import CustomerHandoffView from './CustomerHandoffView';
import EngineerHandoffView from './EngineerHandoffView';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ReviewTab = 'customer' | 'engineer';

// ─── Tab button ──────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1.25rem',
        border: 'none',
        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
        background: 'transparent',
        fontWeight: active ? 600 : 400,
        color: active ? '#2563eb' : '#64748b',
        fontSize: '0.9rem',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────

function InvalidPackState({ onTryAgain }: { onTryAgain: () => void }) {
  return (
    <div style={{
      padding: '2rem 1rem',
      maxWidth: 480,
      margin: '3rem auto',
      textAlign: 'center',
      fontFamily: 'inherit',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }} aria-hidden="true">⚠️</div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
        Invalid handoff pack
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        The handoff data could not be read. It may be incomplete, in the wrong format, or from an
        unsupported version of Atlas Scan.
      </p>
      <button
        onClick={onTryAgain}
        style={{
          padding: '0.55rem 1.25rem',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: '0.9rem',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Load a different pack
      </button>
    </div>
  );
}

// ─── Dev loader ───────────────────────────────────────────────────────────────

function DevPackLoader({ onLoad }: { onLoad: (raw: unknown) => void }) {
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result ?? ''));
        onLoad(parsed);
      } catch {
        onLoad(null);
      }
    };
    reader.readAsText(file);
  }, [onLoad]);

  const handlePaste = useCallback(() => {
    try {
      const parsed = JSON.parse(pasteText);
      onLoad(parsed);
    } catch {
      onLoad(null);
    }
  }, [pasteText, onLoad]);

  return (
    <div style={{
      background: '#fefce8',
      border: '1px solid #fde68a',
      borderRadius: 8,
      padding: '0.75rem 1rem',
      fontSize: '0.8rem',
      color: '#78350f',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🔬 Dev: load a different pack</div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>Upload JSON</span>
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </label>
        <button
          onClick={() => setShowPaste((v) => !v)}
          style={{
            background: 'none',
            border: '1px solid #fbbf24',
            borderRadius: 4,
            padding: '0.25rem 0.6rem',
            cursor: 'pointer',
            color: '#78350f',
            fontSize: '0.8rem',
          }}
        >
          {showPaste ? 'Hide paste' : 'Paste JSON'}
        </button>
      </div>
      {showPaste && (
        <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste VisitHandoffPack JSON here…"
            rows={6}
            style={{
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              border: '1px solid #fbbf24',
              borderRadius: 4,
              padding: '0.4rem',
              background: '#fffbeb',
              color: '#1e293b',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handlePaste}
            disabled={pasteText.trim().length === 0}
            style={{
              alignSelf: 'flex-start',
              padding: '0.3rem 0.75rem',
              background: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: pasteText.trim().length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              opacity: pasteText.trim().length === 0 ? 0.5 : 1,
            }}
          >
            Load
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export interface VisitHandoffReviewPageProps {
  /** Initial pack to display.  Pass null / undefined to show the loader. */
  initialPack?: VisitHandoffPack | null;
  onBack?: () => void;
}

export default function VisitHandoffReviewPage({
  initialPack,
  onBack,
}: VisitHandoffReviewPageProps) {
  const [pack, setPack] = useState<VisitHandoffPack | null>(initialPack ?? null);
  const [parseError, setParseError] = useState(false);
  const [activeTab, setActiveTab] = useState<ReviewTab>('customer');
  const [showRawJson, setShowRawJson] = useState(false);

  const handleLoad = useCallback((raw: unknown) => {
    const parsed = safeParseVisitHandoffPack(raw);
    if (parsed) {
      setPack(parsed);
      setParseError(false);
      setActiveTab('customer');
    } else {
      setPack(null);
      setParseError(true);
    }
  }, []);

  const handleTryAgain = useCallback(() => {
    setPack(null);
    setParseError(false);
  }, []);

  const formattedDate = pack
    ? (() => {
        try {
          return new Date(pack.completedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        } catch {
          return pack.completedAt;
        }
      })()
    : null;

  return (
    <div style={{
      background: '#f8fafc',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.75rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '0.9rem',
              padding: '0.25rem 0.5rem',
              borderRadius: 4,
            }}
            aria-label="Back"
          >
            ← Back
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
            {pack ? pack.customerSummary.address : 'Visit Review'}
          </h1>
          {formattedDate && (
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.1rem 0 0' }}>
              Completed {formattedDate}
              {pack?.engineerName ? ` · ${pack.engineerName}` : ''}
            </p>
          )}
        </div>
        <span style={{
          fontSize: '0.7rem',
          color: '#64748b',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          padding: '0.2rem 0.5rem',
        }}>
          Read only
        </span>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>

        {/* Error state — parse failed */}
        {parseError && !pack && (
          <InvalidPackState onTryAgain={handleTryAgain} />
        )}

        {/* No pack loaded yet — show dev loader */}
        {!parseError && !pack && (
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
              No handoff pack loaded. Use the controls below to load one.
            </p>
            <DevPackLoader onLoad={handleLoad} />
          </div>
        )}

        {/* Pack loaded — show review */}
        {pack && (
          <>
            {/* Tab switcher */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '1.5rem',
              background: '#ffffff',
              borderRadius: '8px 8px 0 0',
              padding: '0 0.5rem',
            }}>
              <TabButton active={activeTab === 'customer'} onClick={() => setActiveTab('customer')}>
                Customer view
              </TabButton>
              <TabButton active={activeTab === 'engineer'} onClick={() => setActiveTab('engineer')}>
                Engineer view
              </TabButton>
            </div>

            {/* Tab content */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              padding: '1.5rem 1.25rem',
            }}>
              {activeTab === 'customer' && (
                <CustomerHandoffView summary={pack.customerSummary} />
              )}
              {activeTab === 'engineer' && (
                <EngineerHandoffView
                  summary={pack.engineerSummary}
                  completedAt={pack.completedAt}
                  engineerName={pack.engineerName}
                />
              )}
            </div>

            {/* Dev controls */}
            {import.meta.env.DEV && (
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <DevPackLoader onLoad={handleLoad} />
                <button
                  onClick={() => setShowRawJson((v) => !v)}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.78rem',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
                </button>
                {showRawJson && (
                  <pre style={{
                    background: '#0f172a',
                    color: '#e2e8f0',
                    borderRadius: 8,
                    padding: '1rem',
                    fontSize: '0.72rem',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {JSON.stringify(pack, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
