/**
 * InsightPackDeck.tsx — Atlas Insight Pack main container (deck-style navigation).
 *
 * Renders all 7 panels as scrollable slides.
 * Pure presentation — no physics logic.
 * All data must be pre-built by buildInsightPackFromEngine().
 */

import { useState } from 'react';
import type { InsightPack } from './insightPack.types';
import QuoteComparisonCard from './QuoteComparisonCard';
import DailyUsePanel from './DailyUsePanel';
import LimitationsPanel from './LimitationsPanel';
import RatingsPanel from './RatingsPanel';
import BestAdvicePanel from './BestAdvicePanel';
import ImprovementsPanel from './ImprovementsPanel';
import SavingsPanel from './SavingsPanel';
import './InsightPackDeck.css';

interface Props {
  pack: InsightPack;
}

const SLIDES = [
  { id: 'overview',      label: '📋 Quotes' },
  { id: 'daily-use',     label: '🏠 Day to Day' },
  { id: 'limitations',   label: '⚠️ Limitations' },
  { id: 'ratings',       label: '⭐ Ratings' },
  { id: 'best-advice',   label: '🎯 Best Advice' },
  { id: 'improvements',  label: '🔧 Improvements' },
  { id: 'savings',       label: '💡 Savings' },
] as const;

type SlideId = typeof SLIDES[number]['id'];

export default function InsightPackDeck({ pack }: Props) {
  const [activeSlide, setActiveSlide] = useState<SlideId>('overview');

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

  function renderPanel() {
    switch (activeSlide) {
      case 'overview':
        return <QuoteComparisonCard quotes={pack.quotes} bestAdvice={pack.bestAdvice} />;
      case 'daily-use':
        return <DailyUsePanel quotes={pack.quotes} />;
      case 'limitations':
        return <LimitationsPanel quotes={pack.quotes} />;
      case 'ratings':
        return <RatingsPanel quotes={pack.quotes} />;
      case 'best-advice':
        return <BestAdvicePanel bestAdvice={pack.bestAdvice} />;
      case 'improvements':
        return <ImprovementsPanel quotes={pack.quotes} />;
      case 'savings':
        return <SavingsPanel savingsPlan={pack.savingsPlan} />;
    }
  }

  return (
    <div className="insight-deck" data-testid="insight-pack-deck">
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

      {/* Active panel */}
      <div className="insight-deck__panel" role="tabpanel">
        {renderPanel()}
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
        <button
          className="insight-deck__footer-btn"
          onClick={goNext}
          disabled={currentIndex === SLIDES.length - 1}
          aria-label="Next section"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
