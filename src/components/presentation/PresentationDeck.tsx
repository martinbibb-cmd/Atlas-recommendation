/**
 * PresentationDeck.tsx
 *
 * Swipeable visual story deck. One idea per page, left/right navigation.
 *
 * Each page has:
 *   - one physics visual (via PresentationVisualSlot) or a data card
 *   - one title / core message
 *   - minimal text
 *   - optional "Open explainer" CTA (handled inside PresentationVisualSlot)
 *
 * Navigation:
 *   - touch swipe (left / right)
 *   - keyboard arrow keys
 *   - prev / next buttons
 *   - progress dots (clickable)
 *
 * Rules:
 *   - No Math.random() — all data from CanonicalPresentationModel.
 *   - Reduced-motion preference respected (no slide transition when enabled).
 *   - All copy from engine model — no generic standalone assertions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import {
  buildCanonicalPresentation,
  type Page1_5AgeingContext,
  type AvailableOptionExplanation,
  type PhysicsRankingItem,
  type ShortlistedOptionDetail,
  type FinalPageSimulator,
  type HouseSignal,
  type HomeSignal,
  type EnergySignal,
  type CurrentSystemSignal,
} from './buildCanonicalPresentation';
import PresentationVisualSlot from './PresentationVisualSlot';
import './PresentationDeck.css';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum/maximum rendered outlets for the flow_split visual (1–3). */
const MIN_OUTLETS = 1 as const;
const MAX_OUTLETS = 3 as const;

/**
 * Minimum horizontal swipe distance (px) required to trigger a page change.
 * Filters out incidental horizontal movement during vertical scroll.
 */
const SWIPE_THRESHOLD_PX = 40;

/**
 * Map from shortlisted option family to the physics visual that best
 * explains how that system handles domestic hot water.
 * Stored families (stored_water, open_vented) use cylinder_charge;
 * on-demand families (combi, heat_pump) use driving_style.
 */
const STORED_WATER_FAMILIES = new Set(['stored_water', 'open_vented']);

function visualIdForFamily(family: string): 'cylinder_charge' | 'driving_style' {
  return STORED_WATER_FAMILIES.has(family) ? 'cylinder_charge' : 'driving_style';
}

// ─── Reduced-motion hook ──────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

// ─── Page content components ──────────────────────────────────────────────────

function HousePage({ house }: { house: HouseSignal }) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Your house</p>
      <h2 className="atlas-presentation-deck__page-title">{house.heatLossLabel}</h2>
      <div className="atlas-presentation-deck__visual">
        <PresentationVisualSlot
          visualId="heat_particles"
          visualData={{ wallType: house.wallTypeKey }}
        />
      </div>
      <p className="atlas-presentation-deck__takeaway">{house.wallTypeLabel} — {house.insulationLabel}</p>
      <p className="atlas-presentation-deck__context">{house.heatLossBand}</p>
    </>
  );
}

function HomePage({ home }: { home: HomeSignal }) {
  const outletsActive = Math.max(MIN_OUTLETS, Math.min(home.peakSimultaneousOutlets, MAX_OUTLETS)) as 1 | 2 | 3;
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Your home</p>
      <h2 className="atlas-presentation-deck__page-title">{home.demandProfileLabel}</h2>
      <div className="atlas-presentation-deck__visual">
        <PresentationVisualSlot
          visualId="flow_split"
          visualData={{ outletsActive }}
        />
      </div>
      <p className="atlas-presentation-deck__takeaway">{home.dailyHotWaterLabel}</p>
      <p className="atlas-presentation-deck__context">{home.peakOutletsLabel}</p>
    </>
  );
}

function EnergyPage({ energy }: { energy: EnergySignal }) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Your energy</p>
      <h2 className="atlas-presentation-deck__page-title">{energy.pvStatusLabel}</h2>
      <div className="atlas-presentation-deck__visual">
        <PresentationVisualSlot visualId="solar_mismatch" />
      </div>
      <p className="atlas-presentation-deck__takeaway">{energy.pvSuitabilityLabel}</p>
      <p className="atlas-presentation-deck__context">{energy.energyAlignmentLabel}</p>
    </>
  );
}

function CurrentSystemPage({ sys }: { sys: CurrentSystemSignal }) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Your current system</p>
      <h2 className="atlas-presentation-deck__page-title">{sys.systemTypeLabel}</h2>
      <div className="atlas-presentation-deck__visual">
        <PresentationVisualSlot
          visualId="driving_style"
          visualData={{ mode: sys.drivingStyleMode }}
        />
      </div>
      <p className="atlas-presentation-deck__takeaway">{sys.ageLabel}</p>
      <p className="atlas-presentation-deck__context">{sys.ageContext}</p>
    </>
  );
}

function AgeingPage({ ctx }: { ctx: Page1_5AgeingContext }) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">System condition</p>
      <h2 className="atlas-presentation-deck__page-title">{ctx.heading}</h2>
      <div className="atlas-presentation-deck__ageing-card">
        <p className="atlas-presentation-deck__ageing-band">Age band: <strong>{ctx.ageBandLabel}</strong></p>
        <ul className="atlas-presentation-deck__ageing-notes">
          {ctx.probabilisticNotes.map((note, i) => <li key={i}>{note}</li>)}
        </ul>
        {ctx.waterQualityNote && (
          <p className="atlas-presentation-deck__ageing-water-note">{ctx.waterQualityNote}</p>
        )}
      </div>
    </>
  );
}

function OptionsPage({ options }: { options: AvailableOptionExplanation[] }) {
  const viableCount = options.filter(o => o.status === 'viable').length;
  const title = viableCount === 1
    ? '1 viable system for this home'
    : `${viableCount} viable systems for this home`;

  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Available options</p>
      <h2 className="atlas-presentation-deck__page-title">{title}</h2>
      <div className="atlas-presentation-deck__visual">
        <PresentationVisualSlot visualId="cylinder_charge" hideExplainer={false} />
      </div>
      <ul className="atlas-presentation-deck__options-list">
        {options.map(opt => (
          <li key={opt.id} className="atlas-presentation-deck__options-item">
            <span className={`atlas-presentation-deck__options-badge atlas-presentation-deck__options-badge--${opt.status}`}>
              {opt.status === 'viable' ? '✅' : opt.status === 'caution' ? '⚠️' : '🚫'}
            </span>
            <span>{opt.label}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function RankingPage({ items }: { items: PhysicsRankingItem[] }) {
  const best = items[0];
  const title = best ? `Best fit: ${best.label}` : 'Physics-first ranking';

  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Best fit</p>
      <h2 className="atlas-presentation-deck__page-title">{title}</h2>
      {best && (
        <p className="atlas-presentation-deck__takeaway">{best.reasonLine}</p>
      )}
      <div className="atlas-presentation-deck__ranking-podium">
        {items.slice(0, 3).map(item => (
          <div
            key={item.family}
            className={`atlas-presentation-deck__ranking-row${item.rank === 1 ? ' atlas-presentation-deck__ranking-row--rank-1' : ''}`}
            aria-label={`Rank ${item.rank}: ${item.label}`}
          >
            <span className="atlas-presentation-deck__ranking-num" aria-hidden="true">{item.rank}</span>
            <span className="atlas-presentation-deck__ranking-label">{item.label}</span>
            {item.overallScore > 0 && (
              <span className="atlas-presentation-deck__ranking-reason">{item.overallScore} pts</span>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: '#a0aec0', fontStyle: 'italic' }}>
            No ranking available.
          </p>
        )}
      </div>
    </>
  );
}

function ShortlistPage({ option, index }: { option: ShortlistedOptionDetail; index: number }) {
  const visualId = visualIdForFamily(option.family);
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Option {index + 1}</p>
      <h2 className="atlas-presentation-deck__page-title">{option.label}</h2>
      <div className="atlas-presentation-deck__visual">
        <PresentationVisualSlot visualId={visualId} />
      </div>
      <div className="atlas-presentation-deck__shortlist-body">
        <div className="atlas-presentation-deck__shortlist-section atlas-presentation-deck__shortlist-section--required">
          <p className="atlas-presentation-deck__shortlist-section-heading">🔨 Required work</p>
          {option.requiredWork.length > 0 ? (
            <ul className="atlas-presentation-deck__shortlist-list">
              {option.requiredWork.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          ) : (
            <p className="atlas-presentation-deck__shortlist-empty">No enabling works recorded.</p>
          )}
        </div>
        <div className="atlas-presentation-deck__shortlist-section atlas-presentation-deck__shortlist-section--best">
          <p className="atlas-presentation-deck__shortlist-section-heading">✨ To get the most from it</p>
          {option.bestPerformanceUpgrades.length > 0 ? (
            <ul className="atlas-presentation-deck__shortlist-list">
              {option.bestPerformanceUpgrades.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          ) : (
            <p className="atlas-presentation-deck__shortlist-empty">No additional upgrades identified.</p>
          )}
        </div>
      </div>
    </>
  );
}

function SimulatorPage({
  sim,
  onOpenSimulator,
}: {
  sim: FinalPageSimulator;
  onOpenSimulator?: () => void;
}) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Proof</p>
      <h2 className="atlas-presentation-deck__page-title">Test this recommendation</h2>
      <div className="atlas-presentation-deck__simulator-card">
        <p className="atlas-presentation-deck__simulator-scenario">{sim.homeScenarioDescription}</p>
        {sim.houseConstraintNotes.length > 0 && (
          <ul className="atlas-presentation-deck__simulator-notes">
            {sim.houseConstraintNotes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        )}
        {sim.energyTimingNotes.length > 0 && (
          <ul className="atlas-presentation-deck__simulator-notes">
            {sim.energyTimingNotes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        )}
        {onOpenSimulator && (
          <button
            type="button"
            className="atlas-presentation-deck__simulator-cta"
            onClick={onOpenSimulator}
          >
            Open simulator →
          </button>
        )}
      </div>
    </>
  );
}

// ─── Deck page descriptor ──────────────────────────────────────────────────────

interface DeckPageDescriptor {
  id: string;
  label: string;
  content: React.ReactNode;
}

// ─── Main component props ─────────────────────────────────────────────────────

export interface PresentationDeckProps {
  result: FullEngineResult;
  input: EngineInputV2_3;
  recommendationResult?: RecommendationResult;
  onOpenSimulator?: () => void;
}

/**
 * PresentationDeck — horizontally swipeable visual story deck.
 *
 * Wraps CanonicalPresentationPage content as one-idea-per-page cards.
 * Navigate with swipe, arrow keys, or prev/next buttons.
 */
export default function PresentationDeck({
  result,
  input,
  recommendationResult,
  onOpenSimulator,
}: PresentationDeckProps) {
  const reducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Touch tracking refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const model = buildCanonicalPresentation(result, input, recommendationResult);
  const { page1, page1_5, page2, page3, page4Plus, finalPage } = model;

  // ─── Build page list ───────────────────────────────────────────────────────

  const pages: DeckPageDescriptor[] = [
    { id: 'house',          label: 'House',         content: <HousePage house={page1.house} /> },
    { id: 'home',           label: 'Home',          content: <HomePage home={page1.home} /> },
    { id: 'energy',         label: 'Energy',        content: <EnergyPage energy={page1.energy} /> },
    { id: 'current_system', label: 'System',        content: <CurrentSystemPage sys={page1.currentSystem} /> },
    { id: 'ageing',         label: 'Condition',     content: <AgeingPage ctx={page1_5} /> },
    { id: 'options',        label: 'Options',       content: <OptionsPage options={page2.options} /> },
    { id: 'ranking',        label: 'Best fit',      content: <RankingPage items={page3.items} /> },
    ...page4Plus.options.map((opt, i) => ({
      id:      `option_${i + 1}`,
      label:   `Option ${i + 1}`,
      content: <ShortlistPage option={opt} index={i} />,
    })),
    {
      id:      'simulator',
      label:   'Proof',
      content: <SimulatorPage sim={finalPage} onOpenSimulator={onOpenSimulator} />,
    },
  ];

  const total = pages.length;

  // ─── Navigation ───────────────────────────────────────────────────────────

  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, total - 1)));
  }, [total]);

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext]);

  // ─── Touch handlers ────────────────────────────────────────────────────────

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Only register horizontal swipe if horizontal delta exceeds vertical delta
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;

    if (dx < 0) goNext();
    else        goPrev();
  }

  // ─── Slide transform ───────────────────────────────────────────────────────

  const trackStyle = reducedMotion
    ? { transform: `translateX(-${currentIndex * 100}%)`, transition: 'none' }
    : { transform: `translateX(-${currentIndex * 100}%)` };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="atlas-presentation-deck"
      data-testid="presentation-deck"
      aria-roledescription="carousel"
      aria-label="Recommendation story deck"
    >

      {/* ── Progress dots ───────────────────────────────────────── */}
      <nav className="atlas-presentation-deck__progress" aria-label="Deck navigation">
        {pages.map((page, i) => (
          <button
            key={page.id}
            type="button"
            className={`atlas-presentation-deck__dot${i === currentIndex ? ' atlas-presentation-deck__dot--active' : ''}`}
            aria-label={`Go to page: ${page.label}`}
            aria-current={i === currentIndex ? 'true' : undefined}
            onClick={() => goTo(i)}
          />
        ))}
        <span className="atlas-presentation-deck__progress-label" aria-live="polite">
          {currentIndex + 1} / {total}
        </span>
      </nav>

      {/* ── Slide viewport ──────────────────────────────────────── */}
      <div
        className="atlas-presentation-deck__viewport"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          className="atlas-presentation-deck__track"
          style={trackStyle}
        >
          {pages.map((page, i) => (
            <div
              key={page.id}
              className="atlas-presentation-deck__page"
              role="group"
              aria-roledescription="slide"
              aria-label={`${page.label} (${i + 1} of ${total})`}
              aria-hidden={i !== currentIndex}
            >
              {page.content}
            </div>
          ))}
        </div>
      </div>

      {/* ── Navigation buttons ───────────────────────────────────── */}
      <div className="atlas-presentation-deck__nav" aria-label="Deck controls">
        <button
          type="button"
          className="atlas-presentation-deck__nav-btn"
          onClick={goPrev}
          disabled={currentIndex === 0}
          aria-label="Previous page"
        >
          ← Back
        </button>

        <span className="atlas-presentation-deck__nav-counter" aria-hidden="true">
          {pages[currentIndex]?.label ?? ''}
        </span>

        <button
          type="button"
          className="atlas-presentation-deck__nav-btn"
          onClick={goNext}
          disabled={currentIndex === total - 1}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>

    </div>
  );
}
