/**
 * InsightPackDeck.tsx — Atlas Insight Pack main container (deck-style navigation).
 *
 * Renders all 11 panels as scrollable slides in the following order:
 *   1. Cover
 *   2. What we know
 *   3. Quotes overview
 *   4. Best advice
 *   5. Daily use
 *   6. Ratings
 *   7. Limitations
 *   8. Improvements
 *   9. Savings
 *  10. Why Atlas suggested this
 *  11. Next steps
 *
 * A "Print as PDF" button on the last slide triggers window.print().
 * @media print styles in InsightPackPrint.css render all panels stacked.
 *
 * Pure presentation — no physics logic.
 * All data must be pre-built by buildInsightPackFromEngine().
 */

import { useState } from 'react';
import type { InsightPack } from './insightPack.types';
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
}

const SLIDES = [
  { id: 'cover',       label: '🏠 Your Home' },
  { id: 'what-we-know', label: '📋 What We Looked At' },
  { id: 'overview',    label: '📄 Options' },
  { id: 'best-advice', label: '🎯 Best Advice' },
  { id: 'daily-use',   label: '☀️ Day to Day' },
  { id: 'ratings',     label: '⭐ Ratings' },
  { id: 'limitations', label: '⚠️ Limitations' },
  { id: 'improvements', label: '🔧 Improvements' },
  { id: 'savings',     label: '💡 Savings' },
  { id: 'why-atlas',   label: '🧠 Why This' },
  { id: 'next-steps',  label: '✅ Next Steps' },
] as const;

type SlideId = typeof SLIDES[number]['id'];

export default function InsightPackDeck({ pack, propertyTitle, onClose }: Props) {
  const [activeSlide, setActiveSlide] = useState<SlideId>('cover');
  const [isPrinting, setIsPrinting] = useState(false);

  const currentIndex = SLIDES.findIndex(s => s.id === activeSlide);

  function goTo(id: SlideId) {
    setActiveSlide(id);
  }

  function goPrev() {
    if (currentIndex > 0) setActiveSlide(SLIDES[currentIndex - 1].id);
  }

  function goNext() {
    if (currentIndex < SLIDES.length - 1) setActiveSlide(SLIDES[currentIndex + 1].id);
  }

  function handlePrint() {
    setIsPrinting(true);
    // Allow React to re-render with all-panels visible before triggering print
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  }

  function renderPanel() {
    switch (activeSlide) {
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
        return <RatingsPanel quotes={pack.quotes} />;
      case 'limitations':
        return <LimitationsPanel quotes={pack.quotes} />;
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

  return (
    <div
      className={`insight-deck${isPrinting ? ' insight-deck--printing' : ''}`}
      data-testid="insight-pack-deck"
    >
      {/* Slide navigation */}
      <nav className="insight-deck__nav" role="tablist" aria-label="Insight Pack sections">
        {SLIDES.map(slide => (
          <button
            key={slide.id}
            role="tab"
            aria-selected={slide.id === activeSlide}
            className={`insight-deck__nav-btn${slide.id === activeSlide ? ' insight-deck__nav-btn--active' : ''}`}
            onClick={() => goTo(slide.id)}
          >
            {slide.label}
          </button>
        ))}
      </nav>

      {/* Active panel (screen view) */}
      <div className="insight-deck__panel" role="tabpanel">
        {renderPanel()}
      </div>

      {/* All panels stacked — visible only when printing */}
      <div className="insight-deck__all-panels" style={{ display: 'none' }}>
        <div className="insight-deck__print-section">
          <CoverHeroCard
            quotes={pack.quotes}
            bestAdvice={pack.bestAdvice}
            currentSystem={pack.currentSystem}
            propertyTitle={propertyTitle}
          />
        </div>
        <div className="insight-deck__print-section">
          <WhatWeKnowGrid tiles={pack.homeProfile} />
        </div>
        <div className="insight-deck__print-section">
          <QuoteComparisonCard quotes={pack.quotes} bestAdvice={pack.bestAdvice} />
        </div>
        <div className="insight-deck__print-section">
          <BestAdvicePanel bestAdvice={pack.bestAdvice} />
        </div>
        <div className="insight-deck__print-section">
          <DailyUsePanel quotes={pack.quotes} />
        </div>
        <div className="insight-deck__print-section">
          <RatingsPanel quotes={pack.quotes} />
        </div>
        <div className="insight-deck__print-section">
          <LimitationsPanel quotes={pack.quotes} />
        </div>
        <div className="insight-deck__print-section">
          <ImprovementsPanel quotes={pack.quotes} />
        </div>
        <div className="insight-deck__print-section">
          <SavingsPanel savingsPlan={pack.savingsPlan} />
        </div>
        <div className="insight-deck__print-section">
          <WhyAtlasSuggestedThis reasonChain={pack.reasonChain} />
        </div>
        <div className="insight-deck__print-section">
          <NextStepsCard
            nextSteps={pack.nextSteps}
            onReview={() => goTo('overview')}
          />
        </div>
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
          {currentIndex + 1} / {SLIDES.length}
        </span>
        {currentIndex === SLIDES.length - 1 ? (
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
            disabled={currentIndex === SLIDES.length - 1}
            aria-label="Next section"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
