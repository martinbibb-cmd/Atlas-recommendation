/**
 * CustomerDeck.tsx — Customer-facing paged deck renderer.
 *
 * Consumes VisualBlock[] and renders one block per page with:
 *   - large visual area
 *   - short title
 *   - one-sentence outcome
 *   - up to 3 supporting points
 *   - page progress dots + prev/next controls
 *   - print-safe fallback layout
 *   - keyboard arrow-key navigation
 *   - touch swipe navigation
 *
 * Design rules (PR3):
 *   - No recommendation math — this renderer is deliberately dumb in logic terms.
 *   - No block reshuffling — order from VisualBlock[] is the authoritative order.
 *   - Uses VisualRegistry for artwork; no inline conditionals for visual selection.
 *   - No Math.random() — all data from VisualBlock[].
 *   - Reduced-motion preference respected.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { VisualBlock } from '../../contracts/VisualBlock';
import type { PortalLaunchContext } from '../../contracts/PortalLaunchContext';
import { HeroBlockView } from './blocks/HeroBlockView';
import { FactsBlockView } from './blocks/FactsBlockView';
import { ProblemBlockView } from './blocks/ProblemBlockView';
import { SolutionBlockView } from './blocks/SolutionBlockView';
import { DailyUseBlockView } from './blocks/DailyUseBlockView';
import { IncludedScopeBlockView } from './blocks/IncludedScopeBlockView';
import { WarningBlockView } from './blocks/WarningBlockView';
import { FutureUpgradeBlockView } from './blocks/FutureUpgradeBlockView';
import { PortalCtaBlockView } from './blocks/PortalCtaBlockView';
import type { HeroBlock, FactsBlock, ProblemBlock, SolutionBlock, DailyUseBlock, IncludedScopeBlock, WarningBlock, FutureUpgradeBlock, PortalCtaBlock } from '../../contracts/VisualBlock';
import './CustomerDeck.css';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum horizontal swipe distance (px) to register a page change. */
const SWIPE_THRESHOLD_PX = 40;

// ─── Visual registry dispatch ─────────────────────────────────────────────────

/**
 * Renders the appropriate block view component for a given VisualBlock.
 * Uses a type-safe registry dispatch — no inline type-switch logic
 * scattered across the renderer.
 */
function renderBlock(
  block: VisualBlock,
  onOpenPortal?: (launchContext: PortalLaunchContext) => void,
): React.ReactElement | null {
  switch (block.type) {
    case 'hero':           return <HeroBlockView           block={block as HeroBlock} />;
    case 'facts':          return <FactsBlockView          block={block as FactsBlock} />;
    case 'problem':        return <ProblemBlockView        block={block as ProblemBlock} />;
    case 'solution':       return <SolutionBlockView       block={block as SolutionBlock} />;
    case 'daily_use':      return <DailyUseBlockView       block={block as DailyUseBlock} />;
    case 'included_scope': return <IncludedScopeBlockView  block={block as IncludedScopeBlock} />;
    case 'warning':        return <WarningBlockView        block={block as WarningBlock} />;
    case 'future_upgrade': return <FutureUpgradeBlockView  block={block as FutureUpgradeBlock} />;
    case 'portal_cta':     return <PortalCtaBlockView      block={block as PortalCtaBlock} onOpenPortal={onOpenPortal} />;
    default:               return null;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CustomerDeckProps {
  /** The ordered array of visual blocks to render, one per page. */
  blocks: VisualBlock[];
  /** Optional callback when the user reaches the final page. */
  onComplete?: () => void;
  /**
   * Called when the user activates the portal CTA block.
   * Receives the PortalLaunchContext from the block so the portal opens at
   * the correct scenario and tab.
   * When absent the CTA button renders as disabled — no fake routing.
   */
  onOpenPortal?: (launchContext: PortalLaunchContext) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CustomerDeck
 *
 * Paged deck renderer for the customer-facing recommendation presentation.
 * Consumes VisualBlock[] and renders each block on its own page with
 * navigation controls.
 *
 * Deliberately logic-free: no recommendation math, no block reshuffling.
 */
export function CustomerDeck({ blocks, onComplete, onOpenPortal }: CustomerDeckProps) {
  const [pageIndex, setPageIndex] = useState(0);

  // Evaluated once at mount; the user's motion preference does not change
  // during a session. Using useMemo avoids a ref and keeps it out of render.
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // ── Touch tracking ──────────────────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(blocks.length - 1, index));
      setPageIndex(clamped);
      if (clamped === blocks.length - 1 && index >= blocks.length - 1) {
        onComplete?.();
      }
    },
    [blocks.length, onComplete],
  );

  const goNext = useCallback(() => goTo(pageIndex + 1), [goTo, pageIndex]);
  const goPrev = useCallback(() => goTo(pageIndex - 1), [goTo, pageIndex]);

  // ── Keyboard navigation ─────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); goPrev(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  if (blocks.length === 0) {
    return (
      <div className="customer-deck customer-deck--empty" role="status">
        No content to display.
      </div>
    );
  }

  const currentBlock = blocks[pageIndex];
  const isFirst = pageIndex === 0;
  const isLast  = pageIndex === blocks.length - 1;

  return (
    <div
      className="customer-deck"
      role="region"
      aria-label="Recommendation deck"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (delta < -SWIPE_THRESHOLD_PX) goNext();
        if (delta > SWIPE_THRESHOLD_PX)  goPrev();
      }}
    >
      {/* Progress dots */}
      <nav className="customer-deck__progress" aria-label="Page progress">
        {blocks.map((block, i) => (
          <button
            key={block.id}
            className={`customer-deck__dot${i === pageIndex ? ' customer-deck__dot--active' : ''}`}
            aria-label={`Page ${i + 1} of ${blocks.length}: ${block.title}`}
            aria-current={i === pageIndex ? 'step' : undefined}
            onClick={() => goTo(i)}
          />
        ))}
        <span className="customer-deck__progress-label" aria-live="polite">
          {pageIndex + 1} / {blocks.length}
        </span>
      </nav>

      {/* Page content */}
      <div
        className={`customer-deck__page${prefersReducedMotion ? ' customer-deck__page--no-motion' : ''}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {renderBlock(currentBlock, onOpenPortal)}
      </div>

      {/* Prev / Next controls */}
      <div className="customer-deck__nav" role="group" aria-label="Navigation controls">
        <button
          className="customer-deck__nav-btn customer-deck__nav-btn--prev"
          onClick={goPrev}
          disabled={isFirst}
          aria-label="Previous page"
        >
          ←
        </button>
        <button
          className="customer-deck__nav-btn customer-deck__nav-btn--next"
          onClick={goNext}
          disabled={isLast}
          aria-label="Next page"
        >
          →
        </button>
      </div>

      {/* Print-safe fallback: all blocks visible when printing */}
      <div className="customer-deck__print-all" aria-hidden="true">
        {blocks.map((block) => (
          <div key={block.id} className="customer-deck__print-block">
            {renderBlock(block, onOpenPortal)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CustomerDeck;
