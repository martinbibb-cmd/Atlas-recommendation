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
  type ComponentDegradationBlock,
  type CirculationSignal,
  type AvailableOptionExplanation,
  type PhysicsRankingItem,
  type ShortlistedOptionDetail,
  type FinalPageSimulator,
  type HouseSignal,
  type HomeSignal,
  type EnergySignal,
  type CurrentSystemSignal,
  type DhwArchitecture,
} from './buildCanonicalPresentation';
import { resolveShortlistVisualId, resolveCurrentSystemVisualId, resolveOptionsOverviewVisualId } from './presentationVisualMapping';
import PresentationVisualSlot from './PresentationVisualSlot';
import SystemArchitectureVisualiser from '../../explainers/lego/autoBuilder/SystemArchitectureVisualiser';
import { inputToConceptModel } from '../../explainers/lego/autoBuilder/inputToConceptModel';
import { optionToConceptModel } from '../../explainers/lego/autoBuilder/optionToConceptModel';
import type { OptionId } from '../../explainers/lego/autoBuilder/optionToConceptModel';
import QuadrantDashboardPage from './QuadrantDashboardPage';
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
  const visualId = resolveCurrentSystemVisualId(sys.dhwArchitecture);
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Your current system</p>
      <h2 className="atlas-presentation-deck__page-title">{sys.systemTypeLabel}</h2>
      <div className="atlas-presentation-deck__visual">
        {visualId === 'thermal_store' ? (
          // Thermal stores always require high primary temperatures (75–85 °C) —
          // that is the defining physics constraint of this architecture.
          <PresentationVisualSlot
            visualId="thermal_store"
            visualData={{ flowTempBand: 'high' }}
          />
        ) : visualId === 'cylinder_charge_mixergy' ? (
          <PresentationVisualSlot visualId="cylinder_charge_mixergy" />
        ) : visualId === 'cylinder_charge_standard' ? (
          <PresentationVisualSlot visualId="cylinder_charge_standard" />
        ) : (
          <PresentationVisualSlot
            visualId="driving_style"
            visualData={{ mode: sys.drivingStyleMode }}
          />
        )}
      </div>
      <p className="atlas-presentation-deck__takeaway">{sys.ageLabel}</p>
      <p className="atlas-presentation-deck__context">{sys.ageContext}</p>
    </>
  );
}

function ArchitecturePage({ input }: { input: EngineInputV2_3 }) {
  const concept = inputToConceptModel(input);
  if (!concept) return null;
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">System architecture</p>
      <h2 className="atlas-presentation-deck__page-title">Your current system — built from modules</h2>
      <div className="atlas-presentation-deck__visual atlas-presentation-deck__visual--architecture">
        <SystemArchitectureVisualiser
          mode="current"
          currentSystem={concept}
        />
      </div>
    </>
  );
}

function CompareArchitecturePage({
  input,
  option,
}: {
  input: EngineInputV2_3;
  option: ShortlistedOptionDetail;
}) {
  const currentConcept   = inputToConceptModel(input);
  const isMixergy        = option.dhwArchitecture === 'mixergy';
  const recommendedConcept = optionToConceptModel(
    option.family as OptionId,
    isMixergy,
    input.emitterType ? [input.emitterType] : undefined,
  );
  if (!currentConcept) return null;

  // Show future solar pathway when solar storage opportunity is high
  const futurePathways = option.solarStorageOpportunity === 'high'
    ? [{ id: 'solar_connection' as const }]
    : [];

  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">System changes</p>
      <h2 className="atlas-presentation-deck__page-title">What changes — what stays</h2>
      <div className="atlas-presentation-deck__visual atlas-presentation-deck__visual--architecture">
        <SystemArchitectureVisualiser
          mode="compare"
          currentSystem={currentConcept}
          recommendedSystem={recommendedConcept}
          futurePathways={futurePathways}
        />
      </div>
    </>
  );
}

// ─── Ageing page sub-components ─────────────────────────────────────────────

/** Block A: efficiency drift — shows healthy → ageing → neglected path */
function EfficiencyDriftBlock({ ctx }: { ctx: Page1_5AgeingContext }) {
  const bands: Array<{ key: 'healthy' | 'ageing' | 'neglected'; label: string }> = [
    { key: 'healthy',   label: 'Healthy' },
    { key: 'ageing',    label: 'Ageing' },
    { key: 'neglected', label: 'Neglected' },
  ];
  return (
    <div className="ageing-block">
      <p className="ageing-block__label">A — Efficiency drift</p>
      <div className="ageing-block__drift-track">
        {bands.map(b => {
          const isCurrent = ctx.currentEfficiencyBand === b.key;
          const cls = [
            `ageing-block__drift-band ageing-block__drift-band--${b.key}`,
            isCurrent ? 'ageing-block__drift-band--current' : '',
          ].filter(Boolean).join(' ');
          return (
            <div key={b.key} className={cls}>
              {b.label}
              {isCurrent && (
                <span className="ageing-block__drift-here" aria-label="Current position">▲</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="ageing-block__desc">{ctx.efficiencyBandDescription}</p>
    </div>
  );
}

/** Block B: architecture-specific component degradation */
function ComponentDegradationBlockView({ block }: { block: ComponentDegradationBlock }) {
  const conditionColour: Record<string, string> = {
    good:     'ageing-condition--good',
    moderate: 'ageing-condition--moderate',
    poor:     'ageing-condition--poor',
    severe:   'ageing-condition--severe',
    unknown:  'ageing-condition--unknown',
  };
  return (
    <div className="ageing-block">
      <p className="ageing-block__label">B — Hot-water component</p>
      <p className="ageing-block__component-name">{block.componentLabel}</p>
      <p className={`ageing-block__condition-badge ${conditionColour[block.conditionBand] ?? ''}`}>
        {block.conditionLabel}
      </p>
      <p className="ageing-block__desc">{block.degradationMechanism}</p>
    </div>
  );
}

/** Block C: cleanliness / circulation signal pills */
function CirculationBlock({ signals }: { signals: CirculationSignal[] }) {
  const statusIcon: Record<CirculationSignal['status'], string> = {
    ok:      '✓ ',
    warn:    '⚠ ',
    unknown: '? ',
  };
  return (
    <div className="ageing-block">
      <p className="ageing-block__label">C — Cleanliness &amp; circulation</p>
      <ul className="ageing-block__signals" aria-label="Circulation signals">
        {signals.map((s, i) => (
          <li
            key={i}
            className={`ageing-block__signal-pill ageing-block__signal-pill--${s.status}`}
          >
            {statusIcon[s.status]}{s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgeingPage({ ctx }: { ctx: Page1_5AgeingContext }) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">System condition</p>
      <h2 className="atlas-presentation-deck__page-title">{ctx.heading}</h2>
      <p className="ageing-page__condition-summary">{ctx.conditionSummary}</p>

      {/* Three visual blocks */}
      <div className="ageing-page__blocks">
        <EfficiencyDriftBlock ctx={ctx} />
        <ComponentDegradationBlockView block={ctx.componentDegradation} />
        <CirculationBlock signals={ctx.circulationSignals} />
      </div>

      {/* What this means in your home */}
      <div className="ageing-page__impacts">
        <p className="ageing-page__section-heading">What this means in your home</p>
        <ul className="ageing-page__impact-list">
          {ctx.homeImpacts.map((impact, i) => (
            <li key={i}>{impact}</li>
          ))}
        </ul>
      </div>

      {/* Likely first improvements */}
      {ctx.likelyFirstImprovements.length > 0 && (
        <div className="ageing-page__improvements">
          <p className="ageing-page__section-heading">Likely first improvements</p>
          <ul className="ageing-page__improvement-list">
            {ctx.likelyFirstImprovements.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function OptionsPage({
  options,
  currentSystemArchitecture,
}: {
  options: AvailableOptionExplanation[];
  currentSystemArchitecture: DhwArchitecture;
}) {
  const viableCount = options.filter(o => o.status === 'viable').length;
  const title = viableCount === 1
    ? '1 viable system for this home'
    : `${viableCount} viable systems for this home`;

  // Use the current system's DHW architecture to select an architecture-valid
  // visual.  Returns null for on_demand (no cylinder to animate) and undefined
  // architectures so a neutral card is rendered instead of a fallback animation.
  const visualId = resolveOptionsOverviewVisualId(currentSystemArchitecture);

  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Available options</p>
      <h2 className="atlas-presentation-deck__page-title">{title}</h2>
      <div className="atlas-presentation-deck__visual">
        {visualId === 'thermal_store' ? (
          <PresentationVisualSlot
            visualId="thermal_store"
            visualData={{ flowTempBand: 'high' }}
          />
        ) : visualId === 'cylinder_charge_mixergy' ? (
          <PresentationVisualSlot visualId="cylinder_charge_mixergy" />
        ) : visualId === 'cylinder_charge_standard' ? (
          <PresentationVisualSlot visualId="cylinder_charge_standard" />
        ) : (
          // null — architecture has no animation (on_demand / unknown).
          // Render a neutral card: the options list below carries the story.
          <div className="atlas-presentation-deck__neutral-architecture-card" aria-hidden="true" />
        )}
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
  const visualId = resolveShortlistVisualId(
    option.solarStorageOpportunity,
    option.peakSimultaneousOutlets,
    option.dhwArchitecture,
    option.storageBenefitSignal,
  );
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Option {index + 1}</p>
      <h2 className="atlas-presentation-deck__page-title">{option.label}</h2>
      <div className="atlas-presentation-deck__visual">
        <PresentationVisualSlot visualId={visualId} />
      </div>
      <div className="atlas-presentation-deck__shortlist-body">
        {option.complianceItems.length > 0 && (
          <div className="atlas-presentation-deck__shortlist-section atlas-presentation-deck__shortlist-section--compliance">
            <p className="atlas-presentation-deck__shortlist-section-heading">🔒 Required safety &amp; compliance</p>
            <ul className="atlas-presentation-deck__shortlist-list">
              {option.complianceItems.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
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
        <p className="atlas-presentation-deck__simulator-identity">
          System Simulator · Live taps, heating, and full system diagram
        </p>
        <p className="atlas-presentation-deck__simulator-scenario">{sim.homeScenarioDescription}</p>
        <p className="atlas-presentation-deck__simulator-architecture-note">{sim.dhwArchitectureNote}</p>
        {sim.simulatorCapabilities.length > 0 && (
          <ul className="atlas-presentation-deck__simulator-capabilities">
            {sim.simulatorCapabilities.map((cap, i) => <li key={i}>{cap}</li>)}
          </ul>
        )}
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
            Open System Simulator →
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
  /**
   * Optional heat-loss survey state.
   * When provided, the quadrant dashboard uses the shell perimeter snapshot
   * (shellSnapshotUrl) in the Your House tile and shows the roof orientation.
   */
  heatLossState?: import('../../features/survey/heatLoss/heatLossTypes').HeatLossState;
  /**
   * Optional chip-style priorities from the Priorities step.
   * When provided, the Your Priorities tile shows the selected chips.
   */
  prioritiesState?: import('../../features/survey/priorities/prioritiesTypes').PrioritiesState;
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
  heatLossState,
  prioritiesState,
}: PresentationDeckProps) {
  const reducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Touch tracking refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const model = buildCanonicalPresentation(result, input, recommendationResult);
  const { page1, page1_5, page2, page3, page4Plus, finalPage } = model;

  // Derive the current system concept model once — used for architecture slides.
  const currentSystemConcept = inputToConceptModel(input);

  // ─── Build page list ───────────────────────────────────────────────────────

  const pages: DeckPageDescriptor[] = [
    // ── PR8a: Quadrant overview — first page ──────────────────────────────
    {
      id:    'quadrant_overview',
      label: 'Overview',
      content: (
        <div className="atlas-presentation-deck__quadrant-wrapper">
          <p className="atlas-presentation-deck__page-eyebrow">What we know</p>
          <QuadrantDashboardPage
            house={page1.house}
            home={page1.home}
            currentSystem={page1.currentSystem}
            heatLossState={heatLossState}
            prioritiesState={prioritiesState}
          />
        </div>
      ),
    },
    { id: 'house',          label: 'House',         content: <HousePage house={page1.house} /> },
    { id: 'home',           label: 'Home',          content: <HomePage home={page1.home} /> },
    { id: 'energy',         label: 'Energy',        content: <EnergyPage energy={page1.energy} /> },
    { id: 'current_system', label: 'System',        content: <CurrentSystemPage sys={page1.currentSystem} /> },
    // Architecture slide — auto-built schematic of the current system from modules
    ...(currentSystemConcept
      ? [{ id: 'architecture', label: 'Blueprint', content: <ArchitecturePage input={input} /> }]
      : []),
    { id: 'ageing',         label: 'Condition',     content: <AgeingPage ctx={page1_5} /> },
    { id: 'options',        label: 'Options',       content: <OptionsPage options={page2.options} currentSystemArchitecture={page1.currentSystem.dhwArchitecture} /> },
    { id: 'ranking',        label: 'Best fit',      content: <RankingPage items={page3.items} /> },
    ...page4Plus.options.flatMap((opt, i) => [
      {
        id:      `option_${i + 1}`,
        label:   `Option ${i + 1}`,
        content: <ShortlistPage option={opt} index={i} />,
      },
      // Compare architecture slide — shows what changes vs current system
      ...(currentSystemConcept
        ? [{
            id:      `compare_${i + 1}`,
            label:   `Changes ${i + 1}`,
            content: <CompareArchitecturePage input={input} option={opt} />,
          }]
        : []),
    ]),
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
