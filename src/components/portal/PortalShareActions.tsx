/**
 * PortalShareActions.tsx — Share and export action strip for the Atlas portal.
 *
 * Provides a persistent set of actions near the portal header:
 *   1. Copy portal link
 *   2. Copy AI summary (for paste into ChatGPT, Claude, Gemini, etc.)
 *   3. Download AI summary as .txt
 *   4. Download advice pack (URL or callback)
 *   5. Open with app / Share (Web Share API)
 *
 * Rules:
 *   - No new recommendation logic.
 *   - No external AI/API calls.
 *   - All text is visible — no hidden content.
 *   - Degrades gracefully when browser APIs are unavailable.
 *   - Minimum 44 px touch targets on mobile.
 */

import { useState, useCallback, useRef } from 'react';
import './PortalShareActions.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PortalShareActionsProps {
  /** Full URL of this portal page — used for copy-link and native share. */
  portalUrl?: string;
  /** Direct download URL for the advice pack PDF, if pre-generated. */
  advicePackUrl?: string;
  /** Pre-serialised AI handoff text to copy / download. */
  aiSummaryText?: string;
  /** Filename for the downloaded .txt file, e.g. "atlas-ai-summary-2026-04-25.txt". */
  aiSummaryFilename?: string;
  /** Fallback callback to trigger advice pack generation when no URL exists. */
  onDownloadAdvicePack?: () => void;
}

// ─── Feedback state ────────────────────────────────────────────────────────────

type CopiedField = 'link' | 'ai' | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerTxtDownload(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PortalShareActions
 *
 * Renders a horizontal (wrapping) strip of share/export action buttons.
 * Each action degrades gracefully when the required data or browser API
 * is unavailable.
 */
export function PortalShareActions({
  portalUrl,
  advicePackUrl,
  aiSummaryText,
  aiSummaryFilename = 'atlas-ai-summary.txt',
  onDownloadAdvicePack,
}: PortalShareActionsProps) {
  const [copied, setCopied] = useState<CopiedField>(null);
  const [shareUnsupported, setShareUnsupported] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Clear feedback after a short delay ──────────────────────────────────
  const scheduleFeedbackClear = useCallback(() => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setCopied(null), 2000);
  }, []);

  // ── Copy portal link ──────────────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied('link');
      scheduleFeedbackClear();
    } catch {
      // Clipboard write failed — nothing to show
    }
  }, [portalUrl]);

  // ── Copy AI summary ───────────────────────────────────────────────────────
  const handleCopyAiSummary = useCallback(async () => {
    if (!aiSummaryText) return;
    try {
      await navigator.clipboard.writeText(aiSummaryText);
      setCopied('ai');
      scheduleFeedbackClear();
    } catch {
      // Clipboard write failed — nothing to show
    }
  }, [aiSummaryText]);

  // ── Download AI summary ───────────────────────────────────────────────────
  const handleDownloadAiSummary = useCallback(() => {
    if (!aiSummaryText) return;
    triggerTxtDownload(aiSummaryText, aiSummaryFilename);
  }, [aiSummaryText, aiSummaryFilename]);

  // ── Download advice pack ───────────────────────────────────────────────────
  const handleDownloadAdvicePack = useCallback(() => {
    if (onDownloadAdvicePack) onDownloadAdvicePack();
  }, [onDownloadAdvicePack]);

  // ── Open with app / Share ─────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!portalUrl) return;
    if (!navigator.share) {
      setShareUnsupported(true);
      return;
    }
    try {
      await navigator.share({
        title: 'Atlas heating advice',
        text: 'Open your Atlas portal',
        url: portalUrl,
      });
    } catch {
      // User cancelled or share failed — no error UI needed
    }
  }, [portalUrl]);

  // ── Derived: is share available in this browser? ──────────────────────────
  const shareAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // ── Render nothing if there are no available actions ─────────────────────
  const hasAnyAction =
    portalUrl ||
    aiSummaryText ||
    advicePackUrl ||
    onDownloadAdvicePack;

  if (!hasAnyAction) return null;

  return (
    <div className="portal-share-actions" role="toolbar" aria-label="Share and export actions">

      {/* Copy portal link */}
      {portalUrl && (
        <button
          type="button"
          className="portal-share-actions__btn"
          onClick={handleCopyLink}
          aria-label="Copy portal link"
          data-testid="share-copy-link"
        >
          <span className="portal-share-actions__icon" aria-hidden="true">🔗</span>
          <span className="portal-share-actions__label">
            {copied === 'link' ? 'Copied!' : 'Copy link'}
          </span>
        </button>
      )}

      {/* Copy AI summary */}
      {aiSummaryText && (
        <button
          type="button"
          className="portal-share-actions__btn"
          onClick={handleCopyAiSummary}
          aria-label="Copy AI summary"
          data-testid="share-copy-ai"
        >
          <span className="portal-share-actions__icon" aria-hidden="true">🤖</span>
          <span className="portal-share-actions__label">
            {copied === 'ai' ? 'Copied!' : 'Copy AI summary'}
          </span>
        </button>
      )}

      {/* Download AI summary */}
      {aiSummaryText && (
        <button
          type="button"
          className="portal-share-actions__btn"
          onClick={handleDownloadAiSummary}
          aria-label="Download AI summary as text file"
          data-testid="share-download-ai"
        >
          <span className="portal-share-actions__icon" aria-hidden="true">⬇</span>
          <span className="portal-share-actions__label">Download AI summary</span>
        </button>
      )}

      {/* Download advice pack — URL takes priority over callback */}
      {advicePackUrl ? (
        <a
          className="portal-share-actions__btn portal-share-actions__btn--link"
          href={advicePackUrl}
          download
          aria-label="Download advice pack"
          data-testid="share-download-pack-link"
        >
          <span className="portal-share-actions__icon" aria-hidden="true">📄</span>
          <span className="portal-share-actions__label">Download advice pack</span>
        </a>
      ) : onDownloadAdvicePack ? (
        <button
          type="button"
          className="portal-share-actions__btn"
          onClick={handleDownloadAdvicePack}
          aria-label="Download advice pack"
          data-testid="share-download-pack-btn"
        >
          <span className="portal-share-actions__icon" aria-hidden="true">📄</span>
          <span className="portal-share-actions__label">Download advice pack</span>
        </button>
      ) : null}

      {/* Open with app / Share */}
      {portalUrl && (
        shareAvailable && !shareUnsupported ? (
          <button
            type="button"
            className="portal-share-actions__btn"
            onClick={handleShare}
            aria-label="Open with app or share"
            data-testid="share-native"
          >
            <span className="portal-share-actions__icon" aria-hidden="true">↗</span>
            <span className="portal-share-actions__label">Share</span>
          </button>
        ) : shareUnsupported ? (
          <span
            className="portal-share-actions__btn portal-share-actions__btn--disabled"
            aria-disabled="true"
            data-testid="share-native-unsupported"
          >
            <span className="portal-share-actions__icon" aria-hidden="true">↗</span>
            <span className="portal-share-actions__label">Sharing not supported on this device</span>
          </span>
        ) : null
      )}

      {/* Copy AI summary helper text */}
      {aiSummaryText && (
        <p className="portal-share-actions__helper" data-testid="share-ai-helper">
          Paste the AI summary into ChatGPT, Claude, Gemini, or another assistant.
        </p>
      )}

    </div>
  );
}

export default PortalShareActions;
