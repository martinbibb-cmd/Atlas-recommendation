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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import {
  buildCanonicalPresentation,
  type Page1_5AgeingContext,
  type AvailableOptionExplanation,
  type PhysicsRankingItem,
  type ShortlistedOptionDetail,
  type FinalPageSimulator,
} from './buildCanonicalPresentation';
import { resolveShortlistVisualId } from './presentationVisualMapping';
import { imageForOptionId } from '../../ui/systemImages/systemImageMap';
import PresentationVisualSlot from './PresentationVisualSlot';
import { inputToConceptModel } from '../../explainers/lego/autoBuilder/inputToConceptModel';
import QuadrantDashboardPage from './QuadrantDashboardPage';
import { computeCurrentEfficiencyPct } from '../../engine/utils/efficiency';
import './PresentationDeck.css';

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Page 2 — Boiler degradation charts ─────────────────────────────────────

function DegradationChartsPage({
  ctx,
  input,
}: {
  ctx: Page1_5AgeingContext;
  input: EngineInputV2_3;
}) {
  const ageYears = input.currentBoilerAgeYears ?? 8;
  const maxAge = Math.max(ageYears + 5, 15);

  // Efficiency data: use engine-derived nominal SEDBUK % and 10-year decay from
  // the normalizer (water hardness + system volume) — not hardcoded generic values.
  const decayPerYear = ctx.tenYearDecayPct / 10;
  const effData = Array.from({ length: maxAge + 1 }, (_, year) => ({
    year,
    efficiency: computeCurrentEfficiencyPct(ctx.nominalEfficiencyPct, decayPerYear * year),
  }));

  // Scale accumulation: index 0–10, plate HEx faster than cylinder.
  // Rates are proportional to the engine's tenYearDecayPct so soft/hard water
  // areas produce materially different curves.
  const plateHexRatePerYear = (ctx.tenYearDecayPct / 10) * 0.55;
  const cylinderRatePerYear = (ctx.tenYearDecayPct / 10) * 0.28;
  const scaleData = Array.from({ length: maxAge + 1 }, (_, year) => ({
    year,
    'Plate HEx': Math.min(10, Math.round(year * plateHexRatePerYear * 10) / 10),
    'Cylinder': Math.min(10, Math.round(year * cylinderRatePerYear * 10) / 10),
  }));

  const bandClass = ctx.currentEfficiencyBand === 'healthy'
    ? 'atlas-deck-degradation__band--healthy'
    : ctx.currentEfficiencyBand === 'ageing'
    ? 'atlas-deck-degradation__band--ageing'
    : 'atlas-deck-degradation__band--neglected';

  const bandLabel = ctx.currentEfficiencyBand === 'healthy'
    ? '✅ Healthy'
    : ctx.currentEfficiencyBand === 'ageing'
    ? '⚠ Ageing'
    : '🔴 Neglected';

  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">System condition</p>
      <h2 className="atlas-presentation-deck__page-title">
        How boilers like yours age
      </h2>
      <p className="atlas-deck-degradation__subtitle">
        Boilers of this type, at this age, typically degrade like this.
      </p>

      <div className="atlas-deck-degradation__charts">
        {/* Left: efficiency curve */}
        <div className="atlas-deck-degradation__chart-box">
          <p className="atlas-deck-degradation__chart-label">Boiler efficiency (%)</p>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={effData} margin={{ top: 4, right: 8, left: -10, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 9 }}
                label={{ value: 'Years', position: 'insideBottom', offset: -4, fontSize: 9 }}
              />
              <YAxis domain={[Math.max(50, ctx.nominalEfficiencyPct - 40), ctx.nominalEfficiencyPct + 2]} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v: number | undefined) => [v != null ? `${v}%` : '', 'Efficiency']} />
              {ageYears > 0 && (
                <ReferenceLine
                  x={ageYears}
                  stroke="#e53e3e"
                  strokeDasharray="4 2"
                  label={{ value: `Now`, position: 'top', fontSize: 8, fill: '#e53e3e' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="efficiency"
                stroke="#3182ce"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Right: scale build-up */}
        <div className="atlas-deck-degradation__chart-box">
          <p className="atlas-deck-degradation__chart-label">Scale build-up (0–10)</p>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={scaleData} margin={{ top: 4, right: 8, left: -10, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 9 }}
                label={{ value: 'Years', position: 'insideBottom', offset: -4, fontSize: 9 }}
              />
              <YAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
              <Tooltip />
              <ReferenceLine
                y={7}
                stroke="#fc8181"
                strokeDasharray="3 3"
                label={{ value: 'Action', position: 'right', fontSize: 8, fill: '#e53e3e' }}
              />
              {ageYears > 0 && (
                <ReferenceLine
                  x={ageYears}
                  stroke="#2b6cb0"
                  strokeDasharray="4 2"
                  label={{ value: 'Now', position: 'top', fontSize: 8, fill: '#2b6cb0' }}
                />
              )}
              <Legend iconSize={8} wrapperStyle={{ fontSize: '0.65rem' }} />
              <Line type="monotone" dataKey="Plate HEx" stroke="#e53e3e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Cylinder" stroke="#ed8936" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="atlas-deck-degradation__footer">
        <span className={`atlas-deck-degradation__band ${bandClass}`}>{bandLabel}</span>
        <span className="atlas-deck-degradation__band-desc">{ctx.efficiencyBandDescription}</span>
      </div>
    </>
  );
}

// ─── Page 2.5 — Low-hanging fruit ────────────────────────────────────────────

const FRUIT_TILES = [
  { icon: '🌡️', label: 'TRV upgrade',        desc: 'Precise room-by-room control' },
  { icon: '⚖️', label: 'System balance',      desc: 'Even heat, every radiator' },
  { icon: '🧪', label: 'Chemical inhibitor',  desc: 'Corrosion & scale protection' },
  { icon: '💧', label: 'Power flush',         desc: 'Remove sludge, restore flow' },
  { icon: '🌤️', label: 'Weather comp.',       desc: 'Auto-modulate to outside temp' },
] as const;

function LowHangingFruitPage({ ctx }: { ctx: Page1_5AgeingContext }) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Quick wins</p>
      <h2 className="atlas-presentation-deck__page-title">
        The low-hanging fruit
      </h2>
      <p className="atlas-deck-fruit__subtitle">
        Before any new system — getting your return temperature to 55°C or below unlocks
        condensing-mode efficiency.
      </p>
      <div className="atlas-deck-fruit__tiles">
        {FRUIT_TILES.map(t => (
          <div key={t.label} className="atlas-deck-fruit__tile">
            <span className="atlas-deck-fruit__icon" aria-hidden="true">{t.icon}</span>
            <span className="atlas-deck-fruit__label">{t.label}</span>
            <span className="atlas-deck-fruit__desc">{t.desc}</span>
          </div>
        ))}
      </div>
      {ctx.likelyFirstImprovements.length > 0 && (
        <ul className="atlas-deck-fruit__extra">
          {ctx.likelyFirstImprovements.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </>
  );
}

// ─── Page 3 — 4-quadrant system options grid ─────────────────────────────────

const SYSTEM_OPTION_DEFS: ReadonlyArray<{
  key: string;
  heading: string;
  sub: string;
  imageId: string;
  matchIds: ReadonlyArray<string>;
}> = [
  {
    key: 'regular_vented',
    heading: 'Regular / System boiler',
    sub: '+ Open vented stored hot water',
    imageId: 'regular_vented',
    matchIds: ['regular_vented', 'stored_vented'],
  },
  {
    key: 'stored_unvented',
    heading: 'Regular / System boiler',
    sub: '+ Unvented stored hot water',
    imageId: 'stored_unvented',
    matchIds: ['stored_unvented', 'system_unvented'],
  },
  {
    key: 'ashp',
    heading: 'Air source heat pump',
    sub: '+ Stored hot water',
    imageId: 'ashp',
    matchIds: ['ashp', 'gshp'],
  },
  {
    key: 'combi',
    heading: 'Combination boiler',
    sub: 'On-demand hot water',
    imageId: 'combi',
    matchIds: ['combi'],
  },
];

function SystemOptionsGridPage({ options }: { options: AvailableOptionExplanation[] }) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Available systems</p>
      <h2 className="atlas-presentation-deck__page-title">
        The systems available to you
      </h2>
      <div className="atlas-deck-sys-grid">
        {SYSTEM_OPTION_DEFS.map(def => {
          const image = imageForOptionId(def.imageId);
          // Match this cell to an available option using the canonical matchIds list
          const opt = options.find(o => def.matchIds.includes(o.id));
          const bullets = opt
            ? [
                ...opt.throughHouseNotes.slice(0, 1),
                ...opt.throughHomeNotes.slice(0, 1),
              ].filter(Boolean)
            : [];
          const status = opt?.status ?? 'viable';

          return (
            <div
              key={def.key}
              className={`atlas-deck-sys-grid__cell atlas-deck-sys-grid__cell--${status}`}
            >
              <p className="atlas-deck-sys-grid__heading">{def.heading}</p>
              <p className="atlas-deck-sys-grid__sub">{def.sub}</p>
              {image ? (
                <img
                  src={image.src}
                  alt={image.alt}
                  className="atlas-deck-sys-grid__image"
                />
              ) : (
                <div className="atlas-deck-sys-grid__image-placeholder" />
              )}
              {bullets.length > 0 && (
                <ul className="atlas-deck-sys-grid__bullets">
                  {bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Page 4 — Physics ranking (star ratings + pick 1 or 2) ──────────────────

function RankingPage({
  items,
  onSelectOption1,
  onSelectOption2,
}: {
  items: PhysicsRankingItem[];
  onSelectOption1: () => void;
  onSelectOption2: () => void;
}) {
  const maxScore = Math.max(...items.map(i => i.overallScore), 1);
  const RANK_COLOURS = ['#b7791f', '#718096', '#744210', '#a0aec0'];

  function starRating(score: number): string {
    const filled = Math.round((score / maxScore) * 4);
    return Array.from({ length: 4 }, (_, i) => (i < filled ? '★' : '☆')).join('');
  }

  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Physics ranking</p>
      <h2 className="atlas-presentation-deck__page-title">
        From pure physics, these systems rank for your home
      </h2>
      <div className="atlas-deck-ranking__list">
        {items.map((item, i) => (
          <div
            key={item.family}
            className={`atlas-deck-ranking__row${item.rank === 1 ? ' atlas-deck-ranking__row--rank-1' : ''}`}
            aria-label={`Rank ${item.rank}: ${item.label}`}
          >
            <span
              className="atlas-deck-ranking__num"
              aria-hidden="true"
              style={{ background: RANK_COLOURS[i] ?? '#a0aec0' }}
            >
              {item.rank}
            </span>
            <div className="atlas-deck-ranking__body">
              <span className="atlas-deck-ranking__label">{item.label}</span>
              {item.overallScore > 0 && (
                <span className="atlas-deck-ranking__stars" aria-label={`${Math.round((item.overallScore / maxScore) * 4)} out of 4 stars`}>
                  {starRating(item.overallScore)}
                </span>
              )}
              <span className="atlas-deck-ranking__reason">{item.reasonLine}</span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: '#a0aec0', fontStyle: 'italic' }}>
            No ranking available — run the engine with recommendation output.
          </p>
        )}
      </div>
      {items.length >= 2 && (
        <div className="atlas-deck-ranking__cta-row">
          <button
            type="button"
            className="atlas-deck-ranking__cta-btn atlas-deck-ranking__cta-btn--1"
            onClick={onSelectOption1}
          >
            Explore option 1 →
          </button>
          <button
            type="button"
            className="atlas-deck-ranking__cta-btn atlas-deck-ranking__cta-btn--2"
            onClick={onSelectOption2}
          >
            Explore option 2 →
          </button>
        </div>
      )}
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
  const systemImage = imageForOptionId(option.family);
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Option {index + 1}</p>
      <h2 className="atlas-presentation-deck__page-title">{option.label}</h2>
      <div className="atlas-presentation-deck__visual">
        {systemImage ? (
          <img
            src={systemImage.src}
            alt={systemImage.alt}
            className="atlas-presentation-deck__system-image"
          />
        ) : (
          <PresentationVisualSlot visualId={visualId} />
        )}
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

// ─── Page 7 — Simulator + print handoff ─────────────────────────────────────

function SimulatorPage({
  sim,
  onOpenSimulator,
  onPrint,
}: {
  sim: FinalPageSimulator;
  onOpenSimulator?: () => void;
  onPrint?: () => void;
}) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Proof</p>
      <h2 className="atlas-presentation-deck__page-title">
        See how this will actually work in your home
      </h2>
      <div className="atlas-deck-simulator__tiles">
        {/* Simulator tile */}
        <div className="atlas-deck-simulator__tile atlas-deck-simulator__tile--sim">
          <p className="atlas-deck-simulator__tile-icon" aria-hidden="true">⚡</p>
          <p className="atlas-deck-simulator__tile-heading">System Simulator</p>
          <p className="atlas-deck-simulator__tile-desc">
            Live taps, heating and full system diagram. See exactly how your system performs.
          </p>
          {sim.simulatorCapabilities.length > 0 && (
            <ul className="atlas-deck-simulator__caps">
              {sim.simulatorCapabilities.map((cap, i) => <li key={i}>{cap}</li>)}
            </ul>
          )}
          {onOpenSimulator && (
            <button
              type="button"
              className="atlas-deck-simulator__tile-btn"
              onClick={onOpenSimulator}
            >
              Open simulator →
            </button>
          )}
        </div>

        {/* Print tile */}
        <div className="atlas-deck-simulator__tile atlas-deck-simulator__tile--print">
          <p className="atlas-deck-simulator__tile-icon" aria-hidden="true">📄</p>
          <p className="atlas-deck-simulator__tile-heading">Take this away</p>
          <p className="atlas-deck-simulator__tile-desc">
            We'll print a summary for you to review at home — everything in one place.
          </p>
          {onPrint && (
            <button
              type="button"
              className="atlas-deck-simulator__tile-btn atlas-deck-simulator__tile-btn--print"
              onClick={onPrint}
            >
              Print summary →
            </button>
          )}
        </div>
      </div>
      {sim.homeScenarioDescription && (
        <p className="atlas-deck-simulator__scenario">{sim.homeScenarioDescription}</p>
      )}
    </>
  );
}

// ─── Deck page descriptor ──────────────────────────────────────────────────────

interface DeckPageDescriptor {
  id: string;
  label: string;
  content: React.ReactNode;
  /**
   * Canonical source descriptor — lists the component name and the canonical
   * model fields that power this slide.  Used for automated tracing and the
   * dev-only provenance badge.
   */
  canonicalSource: {
    component: string;
    fields: string[];
  };
}

// ─── Dev-only provenance badge ────────────────────────────────────────────────

/**
 * DevProvenanceBadge — dev-only overlay showing which canonical fields
 * drive this slide.  Rendered only when import.meta.env.DEV is true.
 * Removed from production builds.
 */
function DevProvenanceBadge({
  component,
  fields,
}: {
  component: string;
  fields: string[];
}) {
  if (!import.meta.env.DEV) return null;
  return (
    <div
      className="atlas-deck-provenance"
      aria-hidden="true"
    >
      <span className="atlas-deck-provenance__label">
        🔬 {component}
      </span>
      <span className="atlas-deck-provenance__fields">
        {fields.join(' · ')}
      </span>
    </div>
  );
}

// ─── Main component props ─────────────────────────────────────────────────────

export interface PresentationDeckProps {
  result: FullEngineResult;
  input: EngineInputV2_3;
  recommendationResult?: RecommendationResult;
  onOpenSimulator?: () => void;
  /** Optional callback to open the print/PDF view. */
  onPrint?: () => void;
  /**
   * Optional heat-loss survey state.
   * When provided, the quadrant dashboard uses the shell perimeter snapshot
   * (shellSnapshotUrl) in the Your House tile and shows the roof orientation.
   */
  heatLossState?: import('../../features/survey/heatLoss/heatLossTypes').HeatLossState;
  /**
   * Optional chip-style priorities from the Priorities step.
   * When provided, the Your Objectives tile shows the selected chips.
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
  onPrint,
  heatLossState,
  prioritiesState,
}: PresentationDeckProps) {
  const reducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Touch tracking refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const model = buildCanonicalPresentation(result, input, recommendationResult, prioritiesState);
  const { page1, page1_5, page2, page3, page4Plus, finalPage } = model;

  // Derive the current system concept model once — used for architecture slides.
  const currentSystemConcept = inputToConceptModel(input);

  // ─── Pre-compute page indices for ranking → option navigation ────────────
  //
  // Pages are always in this order:
  //   0: quadrant_overview
  //   1: degradation_charts  (conditional on page1_5.hasRealEvidence)
  //   2: low_hanging_fruit   (conditional on page1_5.hasRealEvidence)
  //   1|3: system_options_grid
  //   2|4: ranking
  //   3|5: option_1
  //   4|6: option_2
  //   last: simulator
  //
  const rankingIdx = 1 + (page1_5.hasRealEvidence ? 2 : 0) + 1;
  const opt1Idx    = rankingIdx + 1;
  const opt2Idx    = rankingIdx + 2;

  // ─── Build page list ───────────────────────────────────────────────────────

  const pages: DeckPageDescriptor[] = [
    // ── 1. Quadrant overview — house / home / system / objectives ─────────────
    {
      id:    'quadrant_overview',
      label: 'Overview',
      canonicalSource: {
        component: 'QuadrantDashboardPage',
        fields: [
          'page1.house', 'page1.home', 'page1.energy', 'page1.currentSystem', 'page1.objectives',
          'heatLossState', 'prioritiesState', 'input.bedrooms/bathroomCount/householdComposition',
        ],
      },
      content: (
        <div className="atlas-presentation-deck__quadrant-wrapper">
          <p className="atlas-presentation-deck__page-eyebrow">What we know</p>
          <DevProvenanceBadge
            component="QuadrantDashboardPage"
            fields={['page1.house', 'page1.home', 'page1.energy', 'page1.currentSystem', 'page1.objectives']}
          />
          <QuadrantDashboardPage
            house={page1.house}
            home={page1.home}
            energy={page1.energy}
            currentSystem={page1.currentSystem}
            currentSystemConcept={currentSystemConcept}
            heatLossState={heatLossState}
            prioritiesState={prioritiesState}
            objectives={page1.objectives}
            input={input}
          />
        </div>
      ),
    },

    // ── 2. Degradation charts — boiler efficiency + scale build-up ────────────
    //    Only shown when backed by real survey evidence.
    ...(page1_5.hasRealEvidence
      ? [{
          id: 'degradation_charts',
          label: 'Condition',
          canonicalSource: {
            component: 'DegradationChartsPage',
            fields: [
              'page1_5.currentEfficiencyBand', 'page1_5.efficiencyBandDescription',
              'input.currentBoilerAgeYears',
            ],
          },
          content: (
            <>
              <DevProvenanceBadge
                component="DegradationChartsPage"
                fields={['page1_5.efficiencyBand', 'input.currentBoilerAgeYears']}
              />
              <DegradationChartsPage ctx={page1_5} input={input} />
            </>
          ),
        }]
      : []),

    // ── 2.5. Low-hanging fruit — quick wins before committing to a new system ──
    //    Only shown when backed by real survey evidence.
    ...(page1_5.hasRealEvidence
      ? [{
          id: 'low_hanging_fruit',
          label: 'Quick wins',
          canonicalSource: {
            component: 'LowHangingFruitPage',
            fields: [
              'page1_5.likelyFirstImprovements',
            ],
          },
          content: (
            <>
              <DevProvenanceBadge
                component="LowHangingFruitPage"
                fields={['page1_5.likelyFirstImprovements']}
              />
              <LowHangingFruitPage ctx={page1_5} />
            </>
          ),
        }]
      : []),

    // ── 3. System options grid — 4-quadrant images with bullet points ─────────
    {
      id:    'system_options_grid',
      label: 'Options',
      canonicalSource: {
        component: 'SystemOptionsGridPage',
        fields: ['page2.options ← result.engineOutput.options'],
      },
      content: (
        <>
          <DevProvenanceBadge
            component="SystemOptionsGridPage"
            fields={['page2.options ← engineOutput.options']}
          />
          <SystemOptionsGridPage options={page2.options} />
        </>
      ),
    },

    // ── 4. Physics ranking — star ratings + pick 1 or 2 ──────────────────────
    {
      id:    'ranking',
      label: 'Best fit',
      canonicalSource: {
        component: 'RankingPage',
        fields: [
          'page3.items ← recommendation.bestOverall/bestByObjective',
          'item.reasonLine ← demographicOutputs/pvAssessment',
        ],
      },
      content: (
        <>
          <DevProvenanceBadge
            component="RankingPage"
            fields={['page3.items', 'item.reasonLine']}
          />
          <RankingPage
            items={page3.items}
            onSelectOption1={() => goTo(opt1Idx)}
            onSelectOption2={() => goTo(opt2Idx)}
          />
        </>
      ),
    },

    // ── 5 / 6. Shortlisted option detail (no compare-architecture slides) ─────
    ...page4Plus.options.slice(0, 2).map((opt, i) => ({
      id:    `option_${i + 1}`,
      label: `Option ${i + 1}`,
      canonicalSource: {
        component: 'ShortlistPage',
        fields: [
          `page4Plus.options[${i}] ← recommendation shortlist`,
          'complianceItems', 'requiredWork', 'bestPerformanceUpgrades',
        ],
      },
      content: (
        <>
          <DevProvenanceBadge
            component="ShortlistPage"
            fields={[`page4Plus.options[${i}]`, 'requiredWork', 'bestPerformanceUpgrades']}
          />
          <ShortlistPage option={opt} index={i} />
        </>
      ),
    })),

    // ── 7. Simulator + print handoff ─────────────────────────────────────────
    {
      id:    'simulator',
      label: 'Proof',
      canonicalSource: {
        component: 'SimulatorPage',
        fields: [
          'finalPage.homeScenarioDescription',
          'finalPage.simulatorCapabilities',
          'finalPage.dhwArchitectureNote',
        ],
      },
      content: (
        <>
          <DevProvenanceBadge
            component="SimulatorPage"
            fields={['finalPage.homeScenarioDescription', 'finalPage.simulatorCapabilities']}
          />
          <SimulatorPage
            sim={finalPage}
            onOpenSimulator={onOpenSimulator}
            onPrint={onPrint}
          />
        </>
      ),
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
              data-canonical-source={page.id}
              data-canonical-component={page.canonicalSource.component}
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
