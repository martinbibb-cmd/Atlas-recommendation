/**
 * CustomerSummaryPrintPage.tsx
 *
 * PR12 — Dedicated customer share route and printable summary page.
 *
 * Renders a VisitHandoffPack as a clean, customer-safe, A4-printable summary.
 * Only CustomerVisitSummary fields are shown — no engineer-only data.
 *
 * Sections
 * ────────
 *   1. Survey complete (confirmation banner)
 *   2. What we found   (findings)
 *   3. What's planned  (plannedWork)
 *   4. What happens next (nextSteps)
 *
 * Actions (screen only)
 * ─────────────────────
 *   · Print summary  — window.print()
 *   · Share summary  — Web Share API where available, clipboard copy fallback
 *
 * Architecture rules
 * ──────────────────
 *   - Only renders CustomerVisitSummary — no EngineerVisitSummary fields.
 *   - No dependency on the legacy report / Insight pipeline.
 *   - No dependency on the recommendation engine.
 *   - Fully isolated read-only surface.
 *
 * Terminology: docs/atlas-terminology.md applies to all user-facing strings.
 */

import { useState, useCallback } from 'react';
import type { VisitHandoffPack } from '../types/visitHandoffPack';
import { safeParseVisitHandoffPack } from '../parser/parseVisitHandoffPack';
import './CustomerSummaryPrintPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Error / missing-pack state ────────────────────────────────────────────

function MissingPackState() {
  return (
    <div className="csp-error" data-testid="csp-missing-pack">
      <div className="csp-error__icon" aria-hidden="true">⚠️</div>
      <h2 className="csp-error__heading">No summary available</h2>
      <p className="csp-error__body">
        This link does not contain a valid visit summary. It may have expired or
        the data may be missing. Please contact your installer if you need a
        copy of your visit summary.
      </p>
    </div>
  );
}

// ─── Dev pack loader (DEV only) ────────────────────────────────────────────

function DevPackLoader({ onLoad }: { onLoad: (raw: unknown) => void }) {
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        onLoad(JSON.parse(String(ev.target?.result ?? '')));
      } catch {
        onLoad(null);
      }
    };
    reader.readAsText(file);
  }, [onLoad]);

  const handlePaste = useCallback(() => {
    try {
      onLoad(JSON.parse(pasteText));
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
      maxWidth: 794,
      margin: '0 auto',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🔬 Dev: load a different pack</div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ cursor: 'pointer' }}>
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
            rows={5}
            style={{
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              border: '1px solid #fbbf24',
              borderRadius: 4,
              padding: '0.4rem',
              background: '#fffbeb',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handlePaste}
            disabled={!pasteText.trim()}
            style={{
              alignSelf: 'flex-start',
              padding: '0.3rem 0.75rem',
              background: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: pasteText.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.8rem',
              opacity: pasteText.trim() ? 1 : 0.5,
            }}
          >
            Load
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Customer summary content ──────────────────────────────────────────────

interface CustomerSummaryContentProps {
  pack: VisitHandoffPack;
}

function CustomerSummaryContent({ pack }: CustomerSummaryContentProps) {
  const { customerSummary } = pack;
  const formattedDate = formatDate(pack.completedAt);

  return (
    <>
      {/* ── Page header ── */}
      <header className="csp-header">
        <p className="csp-header__address">{customerSummary.address}</p>
        <p className="csp-header__meta">
          Survey completed {formattedDate}
          {pack.engineerName ? ` · ${pack.engineerName}` : ''}
        </p>
      </header>

      {/* ── 1. Survey complete banner ── */}
      <div className="csp-banner" data-testid="csp-banner">
        <span className="csp-banner__icon" aria-hidden="true">✓</span>
        <div>
          <p className="csp-banner__title">Survey complete</p>
          <p className="csp-banner__subtitle">
            Summary of what we found and what happens next.
          </p>
        </div>
      </div>

      {customerSummary.currentSystemDescription && (
        <p className="csp-system-description">
          {customerSummary.currentSystemDescription}
        </p>
      )}

      {/* ── 2. What we found ── */}
      <section className="csp-section" data-testid="csp-section-findings">
        <h2 className="csp-section__heading">What we found</h2>
        {customerSummary.findings.length === 0 ? (
          <p className="csp-empty">No additional findings recorded.</p>
        ) : (
          <ul className="csp-section__list">
            {customerSummary.findings.map((finding, i) => (
              <li key={i} className="csp-section__list-item">{finding}</li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 3. What's planned ── */}
      <section className="csp-section" data-testid="csp-section-planned">
        <h2 className="csp-section__heading">What&apos;s planned</h2>
        {customerSummary.plannedWork.length === 0 ? (
          <p className="csp-empty">No planned work recorded.</p>
        ) : (
          <ul className="csp-section__list">
            {customerSummary.plannedWork.map((item, i) => (
              <li key={i} className="csp-section__list-item">{item}</li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 4. What happens next ── */}
      <section className="csp-section" data-testid="csp-section-next-steps">
        <h2 className="csp-section__heading">What happens next</h2>
        {customerSummary.nextSteps ? (
          <p className="csp-section__body">{customerSummary.nextSteps}</p>
        ) : (
          <p className="csp-empty">Next steps will be confirmed by your installer.</p>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="csp-footer" data-testid="csp-footer">
        <p className="csp-footer__text">Generated from Atlas visit handoff</p>
      </footer>
    </>
  );
}

// ─── Share button ──────────────────────────────────────────────────────────

function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Visit summary', url });
        return;
      } catch {
        // Fallthrough to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently skip
    }
  }, []);

  return (
    <button
      className={`csp-toolbar__share${copied ? ' csp-toolbar__share--copied' : ''}`}
      onClick={handleShare}
      data-testid="csp-share-button"
      aria-label="Share summary"
    >
      {copied ? 'Link copied' : 'Share summary'}
    </button>
  );
}

// ─── Main page component ───────────────────────────────────────────────────

export interface CustomerSummaryPrintPageProps {
  /** Initial pack to display.  Pass null / undefined to show the missing-pack state. */
  initialPack?: VisitHandoffPack | null;
  onBack?: () => void;
}

export default function CustomerSummaryPrintPage({
  initialPack,
  onBack,
}: CustomerSummaryPrintPageProps) {
  const [pack, setPack] = useState<VisitHandoffPack | null>(initialPack ?? null);
  const [parseError, setParseError] = useState(false);

  const handleLoad = useCallback((raw: unknown) => {
    const parsed = safeParseVisitHandoffPack(raw);
    if (parsed) {
      setPack(parsed);
      setParseError(false);
    } else {
      setPack(null);
      setParseError(true);
    }
  }, []);

  const showContent = pack !== null;
  const showError = !pack && (parseError || initialPack === null || initialPack === undefined);

  return (
    <div className="csp-wrap">

      {/* ── Screen toolbar (hidden when printing) ── */}
      <div className="csp-toolbar" data-testid="csp-toolbar">
        {onBack && (
          <button
            className="csp-toolbar__back"
            onClick={onBack}
            aria-label="Back"
          >
            ← Back
          </button>
        )}
        <span className="csp-toolbar__label">Customer summary</span>
        {showContent && (
          <div className="csp-toolbar__actions">
            <button
              className="csp-toolbar__print"
              onClick={() => window.print()}
              data-testid="csp-print-button"
              aria-label="Print summary"
            >
              Print summary
            </button>
            <ShareButton />
          </div>
        )}
      </div>

      {/* ── Page card ── */}
      <div className="csp-page" data-testid="csp-page">

        {/* Error / missing pack */}
        {(showError || !showContent) && <MissingPackState />}

        {/* Loaded pack — customer-safe summary only */}
        {showContent && <CustomerSummaryContent pack={pack} />}
      </div>

      {/* Dev: pack loader (only in development builds, below the page card) */}
      {import.meta.env.DEV && (
        <div style={{ marginTop: '1.25rem' }}>
          <DevPackLoader onLoad={handleLoad} />
        </div>
      )}
    </div>
  );
}
