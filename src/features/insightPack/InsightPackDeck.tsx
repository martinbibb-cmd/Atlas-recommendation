/**
 * InsightPackDeck.tsx — Atlas Insight Pack main container (deck-style navigation).
 *
 * Renders canonical sections as navigable slides.  The section list and
 * rendering behaviour are governed by the `presentationMode` prop:
 *
 *   in-room       — Full 11-section interactive presentation (default).
 *                   Used during the surveyor visit.
 *
 *   customer-pack — Trimmed 6-section view: cover, what-we-know, best-advice,
 *                   daily-use, ratings (suitability only), next-steps.
 *                   Print-optimised for leaving with the customer.
 *
 *   technical-pack — Full 11-section presentation with full engineering
 *                    detail in ratings and limitations.
 *                    Positioned as supporting evidence, not the default output.
 *
 * Section order and visibility are defined in canonicalSections.ts — the
 * single source of truth for the canonical presentation structure.
 *
 * A "Print as PDF" button on the last slide triggers window.print().
 * @media print styles in InsightPackPrint.css render all panels stacked.
 *
 * Pure presentation — no physics logic.
 * All data must be pre-built by buildInsightPackFromEngine().
 */

import { useState } from 'react';
import type { InsightPack } from './insightPack.types';
import {
  sectionsForMode,
  type PresentationMode,
  type CanonicalSectionId,
} from './canonicalSections';
import CoverHeroCard from './CoverHeroCard';
import WhatWeKnowGrid from './WhatWeKnowGrid';
import QuoteComparisonCard from './QuoteComparisonCard';
import BestAdvicePanel from './BestAdvicePanel';
import DailyUsePanel from './DailyUsePanel';
import RatingsPanel from './RatingsPanel';
import LimitationsPanel from './LimitationsPanel';
import ImprovementsPanel from './ImprovementsPanel';
import SavingsPanel from './SavingsPanel';
import WhyAtlasSuggestedThis from './WhyAtlasSuggestedThis';
import NextStepsCard from './NextStepsCard';
import './InsightPackDeck.css';
import './InsightPackPrint.css';

interface Props {
  pack: InsightPack;
  /** Optional property or customer title shown on the cover screen. */
  propertyTitle?: string;
  /** Called when the user finishes the presentation and wants to close/exit. */
  onClose?: () => void;
  /**
   * Controls which sections are shown and how panels render their detail.
   *
   *   'in-room'       — Full 11-section interactive deck (default).
   *   'customer-pack' — Trimmed 6-section print-optimised view.
   *   'technical-pack'— Full 11-section deck with full engineering detail.
   */
  presentationMode?: PresentationMode;
}

/** Delay (ms) before triggering window.print() to allow React to re-render all panels. */
const PRINT_RENDER_DELAY_MS = 100;

export default function InsightPackDeck({
  pack,
  propertyTitle,
  onClose,
  presentationMode = 'in-room',
}: Props) {
  // Derive the ordered slide list from the canonical sections for this mode.
  const slides = sectionsForMode(presentationMode);

  const [activeSlide, setActiveSlide] = useState<CanonicalSectionId>(slides[0]?.id ?? 'cover');
  const [isPrinting, setIsPrinting] = useState(false);

  const currentIndex = slides.findIndex(s => s.id === activeSlide);

  function goTo(id: CanonicalSectionId) {
    setActiveSlide(id);
  }

  function goPrev() {
    if (currentIndex > 0) setActiveSlide(slides[currentIndex - 1].id);
  }

  function goNext() {
    if (currentIndex < slides.length - 1) setActiveSlide(slides[currentIndex + 1].id);
  }

  function handlePrint() {
    setIsPrinting(true);
    // Allow React to re-render with all-panels visible before triggering print
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, PRINT_RENDER_DELAY_MS);
  }

  // Panels render differently based on mode — customer-pack uses simplified/
  // severeOnly variants to reduce visual weight.
  const isCustomerPack = presentationMode === 'customer-pack';

  function renderPanel(id: CanonicalSectionId) {
    switch (id) {
      case 'cover':
        return (
          <CoverHeroCard
            quotes={pack.quotes}
            bestAdvice={pack.bestAdvice}
            currentSystem={pack.currentSystem}
            propertyTitle={propertyTitle}
          />
        );
      case 'what-we-know':
        return <WhatWeKnowGrid tiles={pack.homeProfile} />;
      case 'overview':
        return <QuoteComparisonCard quotes={pack.quotes} bestAdvice={pack.bestAdvice} />;
      case 'best-advice':
        return <BestAdvicePanel bestAdvice={pack.bestAdvice} />;
      case 'daily-use':
        return <DailyUsePanel quotes={pack.quotes} />;
      case 'ratings':
        return <RatingsPanel quotes={pack.quotes} simplified={isCustomerPack} />;
      case 'limitations':
        return <LimitationsPanel quotes={pack.quotes} severeOnly={isCustomerPack} />;
      case 'improvements':
        return <ImprovementsPanel quotes={pack.quotes} />;
      case 'savings':
        return <SavingsPanel savingsPlan={pack.savingsPlan} />;
      case 'why-atlas':
        return <WhyAtlasSuggestedThis reasonChain={pack.reasonChain} />;
      case 'next-steps':
        return (
          <NextStepsCard
            nextSteps={pack.nextSteps}
            onReview={() => goTo('overview')}
          />
        );
    }
  }

  /**
   * Determines whether a section starts a new print page.
   * Sections are grouped in pairs (indices 0–1, 2–3, 4–5, …) so that
   * each A4/letter page contains at most two panels side-by-side.
   * Even-index sections (0, 2, 4…) trigger a page break via the
   * `insight-deck__print-section--page-start` CSS modifier.
   */
  function isPageStart(index: number): boolean {
    return index % 2 === 0;
  }

  // Navigation label used in the ARIA label for the nav landmark.
  const navLabel =
    presentationMode === 'customer-pack'
      ? 'Customer Pack sections'
      : presentationMode === 'technical-pack'
        ? 'Technical Pack sections'
        : 'Insight Pack sections';

  return (
    <div
      className={`insight-deck${isPrinting ? ' insight-deck--printing' : ''} insight-deck--${presentationMode}`}
      data-testid="insight-pack-deck"
      data-mode={presentationMode}
    >
      {/* Slide navigation */}
      <nav className="insight-deck__nav" role="tablist" aria-label={navLabel}>
        {slides.map(slide => (
          <button
            key={slide.id}
            role="tab"
            aria-selected={slide.id === activeSlide}
            className={`insight-deck__nav-btn${slide.id === activeSlide ? ' insight-deck__nav-btn--active' : ''}`}
            onClick={() => goTo(slide.id)}
          >
            {slide.icon} {slide.label}
          </button>
        ))}
      </nav>

      {/* Active panel (screen view) */}
      <div className="insight-deck__panel" role="tabpanel">
        {renderPanel(activeSlide)}
      </div>

      {/* All panels stacked — visible only when printing.
          Sections are paired 1–2 per page via --page-start modifier.       */}
      <div className="insight-deck__all-panels" style={{ display: 'none' }}>
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`insight-deck__print-section${isPageStart(index) ? ' insight-deck__print-section--page-start' : ''}`}
            data-slide={slide.id}
          >
            {renderPanel(slide.id)}
          </div>
        ))}
      </div>

      {/* Footer prev / next */}
      <div className="insight-deck__footer">
        <button
          className="insight-deck__footer-btn"
          onClick={goPrev}
          disabled={currentIndex === 0}
          aria-label="Previous section"
        >
          ← Previous
        </button>
        <span className="insight-deck__page-indicator">
          {currentIndex + 1} / {slides.length}
        </span>
        {currentIndex === slides.length - 1 ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="insight-deck__footer-btn insight-deck__print-btn"
              onClick={handlePrint}
              aria-label="Print as PDF"
            >
              🖨️ Print as PDF
            </button>
            {onClose && (
              <button
                className="insight-deck__footer-btn insight-deck__footer-btn--done"
                onClick={onClose}
                aria-label="Close presentation"
              >
                ✓ Done
              </button>
            )}
          </div>
        ) : (
          <button
            className="insight-deck__footer-btn"
            onClick={goNext}
            disabled={currentIndex === slides.length - 1}
            aria-label="Next section"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

