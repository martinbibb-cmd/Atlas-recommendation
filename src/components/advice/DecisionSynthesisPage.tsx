/**
 * DecisionSynthesisPage
 *
 * PR11 — Advice page / decision synthesis.
 * PR6  — Extended to consume compare/simulator truth when a CompareSeed is
 *         provided. When available, cards are enriched with compareWins,
 *         efficiencyScore, and confidencePct derived from the compare session.
 *
 * Turns simulator output into a clear, objective-ranked advice sheet.
 * Sits after the Simulator Dashboard and answers the actual customer questions.
 *
 * Layout:
 *  1. Best all-round fit (hero card)
 *  2. Best by objective (6 short cards)
 *  3. Installation recipe
 *  4. Trade-off strip (legacy mode) / compare wins (compare mode)
 *  5. Recommendation scope (Essential / Best Advice / Enhanced / Future Potential)
 *
 * Rules:
 *  - No long report paragraphs.
 *  - No repeated comparison prose.
 *  - Source of truth: EngineOutputV1 (+ CompareSeed when available).
 *  - Carbon wording: "at point of use" — never implies full lifecycle or grid-mix
 *    unless that data has been explicitly added.
 *  - Never Math.random() — all outputs are deterministic.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { EngineOutputV1, OpportunityAssessment } from '../../contracts/EngineOutputV1';
import { OPPORTUNITY_STATUS_LABELS } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { CompareSeed } from '../../lib/simulator/buildCompareSeedFromSurvey';
import { buildAdviceCards } from './buildAdviceCards';
import type { ObjectiveCard, RecommendationScope } from './buildAdviceCards';
import {
  buildAdviceFromCompare,
  type AdviceCard,
  type AdviceFromCompareResult,
  type FloorplanInsights,
  type PerformanceSummary,
  type UnifiedConfidence,
} from '../../lib/advice/buildAdviceFromCompare';
import { adaptFloorplanToAtlasInputs } from '../../lib/floorplan/adaptFloorplanToAtlasInputs';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import PrintableRecommendationPage from './PrintableRecommendationPage';
import PhysicsStoryPanel from '../story/PhysicsStoryPanel';
import { buildPhysicsStory } from '../../lib/story/buildPhysicsStory';
import { useGlobalMenu } from '../shell/GlobalMenuContext';
import TradeOffSummary from './TradeOffSummary';
import { buildTradeOffSummary } from '../../lib/advice/buildTradeOffSummary';
import './DecisionSynthesisPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Save state for the report save indicator.
 *
 * State machine:
 *   idle → saving → saved
 *                 → failed → retrying → saved / failed
 */
export type ReportSaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'retrying';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  engineOutput: EngineOutputV1;
  onBack?: () => void;
  /**
   * When provided, the page uses buildAdviceFromCompare to enrich cards with
   * compareWins, performanceSummary, and confidencePct derived from compare truth.
   * When absent, the page falls back to buildAdviceCards (EngineOutputV1 only).
   */
  compareSeed?: CompareSeed;
  /** Required alongside compareSeed — passed through to buildAdviceFromCompare. */
  surveyData?: FullSurveyModelV1;
  /**
   * Optional floor-plan derived outputs from the FloorPlanBuilder.
   * When provided, the adapter feeds geometry-based heat-loss, emitter adequacy,
   * and siting constraint data into the advice builder, and provenance banners
   * are shown to indicate which estimates were refined by the floor plan.
   */
  floorplanOutput?: DerivedFloorplanOutput;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
};

import type { EmitterCoverageClassification } from '../../lib/floorplan/adaptFloorplanToAtlasInputs';

/** Human-readable label for each whole-system emitter coverage classification. */
const COVERAGE_CLASSIFICATION_LABEL: Record<EmitterCoverageClassification, string> = {
  all_adequate:          'All emitters adequate for room heat demand',
  all_oversized:         'All emitters oversized — lower flow temperature achievable',
  majority_undersized:   'Majority of emitters undersized — higher operating temperature needed',
  mixed:                 'Mixed emitter coverage — some rooms need review',
  insufficient_data:     'Emitter coverage: insufficient data',
};

/** CSS modifier for each coverage classification badge. */
const COVERAGE_CLASS_MOD: Record<EmitterCoverageClassification, string> = {
  all_adequate:          'adequate',
  all_oversized:         'oversized',
  majority_undersized:   'undersized',
  mixed:                 'mixed',
  insufficient_data:     'no-data',
};

/** Renders floor-plan provenance banners when the floor plan has refined advice inputs. */
function FloorplanProvenanceBanner({ insights }: { insights: FloorplanInsights }) {
  return (
    <div className="advice-floorplan-provenance" aria-label="Floor plan inputs active">
      {insights.heatLossRefined && (
        <div className="advice-floorplan-provenance__item advice-floorplan-provenance__item--refined">
          📐 Floor plan refined heat-loss estimate in use ({insights.refinedHeatLossKw} kW total)
        </div>
      )}

      {/* Whole-system emitter classification */}
      {insights.coverageClassification != null &&
        insights.coverageClassification !== 'insufficient_data' && (
          <div
            className={`advice-floorplan-provenance__item advice-floorplan-provenance__item--classification advice-floorplan-provenance__item--classification-${COVERAGE_CLASS_MOD[insights.coverageClassification]}`}
          >
            🏠 Whole-system emitter coverage: {COVERAGE_CLASSIFICATION_LABEL[insights.coverageClassification]}
          </div>
        )}

      {/* Oversized rooms */}
      {insights.oversizedRooms.length > 0 && (
        <div className="advice-floorplan-provenance__item advice-floorplan-provenance__item--oversized">
          ✅ Oversized emitters in: {insights.oversizedRooms.join(', ')} — lower flow temperature achievable
        </div>
      )}

      {/* Undersized rooms */}
      {insights.undersizedRooms.length > 0 && (
        <div className="advice-floorplan-provenance__item advice-floorplan-provenance__item--undersized">
          ⚠️ Undersized emitters in: {insights.undersizedRooms.join(', ')} — higher operating temperature needed
        </div>
      )}

      {/* Operating temperature influence */}
      {insights.operatingTempInfluenced && insights.emitterExplanationTags.length > 0 && (
        <div className="advice-floorplan-provenance__item advice-floorplan-provenance__item--op-temp">
          🌡 Floor plan emitter data influencing operating temperature: {insights.emitterExplanationTags.join(' · ')}
        </div>
      )}

      {insights.emitterReviewRooms.length > 0 && (
        <div className="advice-floorplan-provenance__item advice-floorplan-provenance__item--emitter">
          🔥 Emitter adequacy informed by room layout — review: {insights.emitterReviewRooms.join(', ')}
        </div>
      )}
      {insights.sitingWarnings.length > 0 && (
        <div className="advice-floorplan-provenance__item advice-floorplan-provenance__item--siting">
          ⚠️ Siting constraints detected from floor plan — see installation notes
        </div>
      )}
      {insights.pipeLengthEstimateM > 0 && (
        <div className="advice-floorplan-provenance__item advice-floorplan-provenance__item--pipe">
          🔧 Pipe run estimate: ~{insights.pipeLengthEstimateM} m (planning estimate only)
        </div>
      )}
    </div>
  );
}

import {
  PERF_CHIP_LABEL,
  COST_LEVEL_LABEL,
  CARBON_LEVEL_LABEL,
  GEN_BAR_LEVEL,
  GEN_LEVEL_LABEL,
  OPT_BAR_LEVEL,
  OPT_STRATEGY_LABEL,
  costBarLevel,
  carbonBarLevel,
  fuelLabelFromCop,
  outputBlockCount,
} from './performanceDashboardHelpers';

/** Three-segment filled bar used for cost, carbon and local-generation comparators. */
function ComparatorRow({ icon, filledCount, label, exact }: {
  icon: string;
  filledCount: 1 | 2 | 3;
  label: string;
  exact?: string;
}) {
  return (
    <div className="advice-perf-comparator">
      <span className="advice-perf-comparator__icon" aria-hidden="true">{icon}</span>
      <div className="advice-perf-comparator__bars" aria-hidden="true">
        {([1, 2, 3] as const).map(i => (
          <div
            key={i}
            className={`advice-perf-comparator__bar${i <= filledCount ? ' advice-perf-comparator__bar--filled' : ''}`}
          />
        ))}
      </div>
      <span className="advice-perf-comparator__label">{label}</span>
      {exact && <span className="advice-perf-comparator__exact">{exact}</span>}
    </div>
  );
}

/** Visual performance dashboard — replaces the old text-heavy 5-row panel. */
function PerformancePanelUI({ summary }: { summary: PerformanceSummary }) {
  const { inputKwh, outputKwh } = summary.energyConversion;
  const fuelLabel   = fuelLabelFromCop(outputKwh);
  const numBlocks   = outputBlockCount(outputKwh);

  const costLevel   = costBarLevel(summary.costPerKwhHeat);
  const carbonLevel = carbonBarLevel(summary.carbonPerKwhHeat);
  const genLevel    = GEN_BAR_LEVEL[summary.localGenerationImpact];
  const optLevel    = OPT_BAR_LEVEL[summary.optimisationPotential];

  return (
    <div className="advice-perf-panel" aria-label="Performance summary">

      {/* 1 — performance chip */}
      <div className={`advice-perf-chip advice-perf-chip--${summary.efficiencyBand}`}>
        {PERF_CHIP_LABEL[summary.efficiencyBand]}
      </div>

      {/* 2 — energy conversion visual (hero) */}
      <div className="advice-perf-conversion" aria-label="Energy conversion">
        <div className="advice-perf-conversion__row">
          <div className="advice-perf-conversion__side">
            <div className="advice-perf-conversion__blocks">
              <div className="advice-perf-conversion__block advice-perf-conversion__block--in" />
            </div>
            <span className="advice-perf-conversion__sublabel">{inputKwh} kWh {fuelLabel}</span>
          </div>
          <span className="advice-perf-conversion__arrow" aria-hidden="true">→</span>
          <div className="advice-perf-conversion__side">
            <div className="advice-perf-conversion__blocks">
              {Array.from({ length: numBlocks }, (_, i) => (
                <div key={i} className="advice-perf-conversion__block advice-perf-conversion__block--out" />
              ))}
            </div>
            <span className="advice-perf-conversion__sublabel">{outputKwh} kWh heat</span>
          </div>
        </div>
      </div>

      {/* 3 — three compact comparator bars */}
      <div className="advice-perf-comparators">
        <ComparatorRow
          icon="£"
          filledCount={costLevel}
          label={COST_LEVEL_LABEL[costLevel - 1]}
          exact={`~${summary.costPerKwhHeat}p/kWh`}
        />
        <ComparatorRow
          icon="🌿"
          filledCount={carbonLevel}
          label={CARBON_LEVEL_LABEL[carbonLevel - 1]}
          exact={`${summary.carbonPerKwhHeat} kgCO₂/kWh`}
        />
        <ComparatorRow
          icon="☀️"
          filledCount={genLevel}
          label={GEN_LEVEL_LABEL[summary.localGenerationImpact]}
        />
        <ComparatorRow
          icon="🔄"
          filledCount={optLevel}
          label={OPT_STRATEGY_LABEL[summary.optimisationPotential]}
        />
      </div>

    </div>
  );
}


function EnrichedObjectiveCardUI({ card }: { card: AdviceCard }) {
  return (
    <div className="advice-obj-card" role="region" aria-label={card.title}>
      <div className="advice-obj-card__header">
        <span className="advice-obj-card__icon" aria-hidden="true">{card.icon}</span>
        <h3 className="advice-obj-card__title">{card.title}</h3>
      </div>

      <div className="advice-obj-card__system" aria-label="Recommended system for this objective">
        {card.recommendedPathLabel}
      </div>

      {card.why.map((line, i) => (
        <p key={i} className="advice-obj-card__why">{line}</p>
      ))}

      {card.compareWins.length > 0 && (
        <ul
          className="advice-obj-card__wins"
          aria-label="Compare wins"
        >
          {card.compareWins.map((win, i) => (
            <li key={i} className="advice-obj-card__win">✓ {win}</li>
          ))}
        </ul>
      )}

      {card.performanceSummary != null && (
        <PerformancePanelUI summary={card.performanceSummary} />
      )}

      {card.keyTradeOff && (
        <div className="advice-obj-card__tradeoff" aria-label="Trade-off">
          <span className="advice-obj-card__tradeoff-label">Trade-off: </span>
          {card.keyTradeOff}
        </div>
      )}
    </div>
  );
}

/** Renders a legacy objective card (from buildAdviceCards). */
function ObjectiveCardUI({ card }: { card: ObjectiveCard }) {
  return (
    <div className="advice-obj-card" role="region" aria-label={card.title}>
      <div className="advice-obj-card__header">
        <span className="advice-obj-card__icon" aria-hidden="true">{card.icon}</span>
        <h3 className="advice-obj-card__title">{card.title}</h3>
      </div>

      <div className="advice-obj-card__system" aria-label="Recommended system for this objective">
        {card.systemPath}
      </div>

      <p className="advice-obj-card__why">{card.why}</p>

      {card.keyInclusions.length > 0 && (
        <ul className="advice-obj-card__inclusions" aria-label="Key inclusions">
          {card.keyInclusions.map((item, i) => (
            <li key={i} className="advice-obj-card__inclusion">{item}</li>
          ))}
        </ul>
      )}

      {card.tradeOff && (
        <div className="advice-obj-card__tradeoff" aria-label="Trade-off">
          <span className="advice-obj-card__tradeoff-label">Trade-off: </span>
          {card.tradeOff}
        </div>
      )}
    </div>
  );
}

/** Renders the scope-based recommendation model (Essential / Best Advice / Enhanced / Future Potential). */
function RecommendationScopeUI({ scope }: { scope: RecommendationScope }) {
  const cards = [
    scope.essential,
    scope.bestAdvice,
    scope.enhanced,
    scope.futurePotential,
  ].filter(Boolean) as NonNullable<typeof scope.essential>[];

  return (
    <div
      className="advice-scope"
      role="list"
      aria-label="Recommendation scope"
    >
      {cards.map(card => (
        <div
          key={card.title}
          className={`advice-scope__card advice-scope__card--${card.title.toLowerCase().replace(/\s+/g, '-')}`}
          role="listitem"
          aria-label={card.title}
        >
          <div className="advice-scope__card-title">{card.title}</div>
          <ul className="advice-scope__items" aria-label={`${card.title} items`}>
            {card.items.map((item, i) => (
              <li
                key={i}
                className={`advice-scope__item advice-scope__item--${item.type}${item.selectable ? ' advice-scope__item--selectable' : ''}`}
              >
                {item.selectable ? (
                  <label className="advice-scope__item-label">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="advice-scope__item-checkbox"
                      aria-label={item.label}
                    />
                    {item.label}
                  </label>
                ) : (
                  <span className="advice-scope__item-label">{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders the unified confidence breakdown panel.
 *
 * Shows overall score, three contributor bars (data / physics / decision),
 * measured / inferred / missing field lists, and the top "next best checks".
 */
function UnifiedConfidencePanel({ unified }: { unified: UnifiedConfidence }) {
  return (
    <div
      className={`advice-confidence advice-confidence--${unified.level}`}
      aria-label="Recommendation confidence"
    >
      <div className="advice-confidence__header">
        <span className="advice-confidence__headline">
          Recommendation confidence
        </span>
        <span
          className={`advice-confidence__badge advice-confidence__badge--${unified.level}`}
          aria-label={`Overall confidence: ${unified.overallPct}%`}
        >
          {unified.overallPct}% — {CONFIDENCE_LABEL[unified.level]}
        </span>
      </div>

      <div className="advice-confidence__contributors" aria-label="Confidence contributors">
        <div className="advice-confidence__contributor">
          <span className="advice-confidence__contrib-label">Data</span>
          <div className="advice-confidence__bar-track" role="presentation">
            <div
              className="advice-confidence__bar-fill"
              style={{ width: `${unified.dataPct}%` }}
              aria-label={`Data confidence: ${unified.dataPct}%`}
            />
          </div>
          <span className="advice-confidence__contrib-pct">{unified.dataPct}%</span>
        </div>

        <div className="advice-confidence__contributor">
          <span className="advice-confidence__contrib-label">Physics</span>
          <div className="advice-confidence__bar-track" role="presentation">
            <div
              className="advice-confidence__bar-fill"
              style={{ width: `${unified.physicsPct}%` }}
              aria-label={`Physics confidence: ${unified.physicsPct}%`}
            />
          </div>
          <span className="advice-confidence__contrib-pct">{unified.physicsPct}%</span>
        </div>

        <div className="advice-confidence__contributor">
          <span className="advice-confidence__contrib-label">Decision</span>
          <div className="advice-confidence__bar-track" role="presentation">
            <div
              className="advice-confidence__bar-fill"
              style={{ width: `${unified.decisionPct}%` }}
              aria-label={`Decision confidence: ${unified.decisionPct}%`}
            />
          </div>
          <span className="advice-confidence__contrib-pct">{unified.decisionPct}%</span>
        </div>
      </div>

      <div className="advice-confidence__lists">
        {unified.measured.length > 0 && (
          <div className="advice-confidence__list-group">
            <span className="advice-confidence__list-label advice-confidence__list-label--measured">
              Measured
            </span>
            <span className="advice-confidence__list-items">
              {unified.measured.join(' · ')}
            </span>
          </div>
        )}

        {unified.inferred.length > 0 && (
          <div className="advice-confidence__list-group">
            <span className="advice-confidence__list-label advice-confidence__list-label--inferred">
              Inferred
            </span>
            <span className="advice-confidence__list-items">
              {unified.inferred.join(' · ')}
            </span>
          </div>
        )}

        {unified.missing.length > 0 && (
          <div className="advice-confidence__list-group">
            <span className="advice-confidence__list-label advice-confidence__list-label--missing">
              Not yet confirmed
            </span>
            <span className="advice-confidence__list-items">
              {unified.missing.join(' · ')}
            </span>
          </div>
        )}
      </div>

      {unified.nextBestChecks.length > 0 && (
        <div className="advice-confidence__next-checks">
          <span className="advice-confidence__next-checks-label">
            To raise confidence further:
          </span>
          <ul className="advice-confidence__next-checks-list" aria-label="Next best checks">
            {unified.nextBestChecks.map((check, i) => (
              <li key={i} className="advice-confidence__next-check">{check}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── OpportunityCardUI ─────────────────────────────────────────────────────────

const OPPORTUNITY_STATUS_LABEL = OPPORTUNITY_STATUS_LABELS;

function OpportunityCardUI({
  title,
  card,
}: {
  title: string;
  card: OpportunityAssessment;
}) {
  return (
    <div
      className={`advice-opportunity advice-opportunity--${card.status}`}
      aria-label={`${title} opportunity`}
    >
      <div className="advice-opportunity__header">
        <span className="advice-opportunity__title">{title}</span>
        <span
          className={`advice-opportunity__badge advice-opportunity__badge--${card.status}`}
          aria-label={`Status: ${OPPORTUNITY_STATUS_LABEL[card.status]}`}
        >
          {OPPORTUNITY_STATUS_LABEL[card.status]}
        </span>
      </div>
      <p className="advice-opportunity__summary">{card.summary}</p>
      {card.reasons.length > 0 && (
        <div className="advice-opportunity__block">
          <div className="advice-opportunity__block-label">Why it matters</div>
          <ul className="advice-opportunity__list" aria-label={`${title} reasons`}>
            {card.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {card.checksRequired.length > 0 && (
        <div className="advice-opportunity__block">
          <div className="advice-opportunity__block-label advice-opportunity__block-label--checks">
            What needs confirming
          </div>
          <ul
            className="advice-opportunity__list advice-opportunity__list--checks"
            aria-label={`${title} checks required`}
          >
            {card.checksRequired.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DecisionSynthesisPage({
  engineOutput,
  onBack,
  compareSeed,
  surveyData,
  floorplanOutput,
}: Props) {
  const [showPrint, setShowPrint] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [saveState, setSaveState] = useState<ReportSaveState>('idle');
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register context-specific explainer IDs with the global menu shell.
  const { setContextExplainerIds, setContextMenuSections } = useGlobalMenu();

  // Generate QR code data URL whenever a report ID is saved.
  useEffect(() => {
    if (savedReportId == null) return;
    const reportUrl = `${window.location.origin}/report/${savedReportId}`;
    QRCode.toDataURL(reportUrl, { width: 160, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => { /* QR generation is optional — silently ignore */ });
  }, [savedReportId]);

  // Adapt floor-plan outputs into Atlas inputs when provided.
  const floorplanInputs = floorplanOutput != null
    ? adaptFloorplanToAtlasInputs(floorplanOutput)
    : undefined;

  // When a compareSeed is provided (survey-backed compare flow), use the richer
  // compare-truth builder.  Otherwise fall back to the EngineOutputV1-only builder.
  const compareAdvice: AdviceFromCompareResult | null =
    compareSeed != null && surveyData != null
      ? buildAdviceFromCompare({
          surveyData,
          engineOutput,
          compareSeed,
          floorplanInputs,
        })
      : null;

  // Derive engine input for Physics Story Mode signal detection.
  const storyEngineInput = surveyData != null ? toEngineInput(surveyData) : undefined;
  // Build story cards (used for inline preview + full panel).
  const storyCards = buildPhysicsStory(engineOutput, storyEngineInput);

  const legacyAdvice = compareAdvice == null ? buildAdviceCards(engineOutput) : null;

  // ── Recommendation trade-off summary ────────────────────────────────────────
  const tradeOffSummary = buildTradeOffSummary(
    engineOutput,
    surveyData?.currentHeatSourceType ?? undefined,
  );

  // ── Save report ─────────────────────────────────────────────────────────────
  // Posts the current synthesis snapshot to POST /api/reports.
  //
  // Save state machine:
  //   idle → saving → saved
  //                 → failed → retrying → saved / failed
  //
  // Refs are used to:
  //  - read latest canonical state at call time (avoids stale closures)
  //  - prevent duplicate concurrent save calls (busy guard)

  /** Always reflects the current saveState so the busy-guard reads fresh state. */
  const saveStateRef = useRef<ReportSaveState>('idle');
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  /**
   * Ref-stable copies of the canonical data used to build the payload.
   * Updated on every render so that a retry click always rebuilds from the
   * latest props/derived values rather than a captured closure.
   */
  const compareAdviceRef = useRef(compareAdvice);
  compareAdviceRef.current = compareAdvice;
  const surveyDataRef = useRef(surveyData);
  surveyDataRef.current = surveyData;
  const engineOutputRef = useRef(engineOutput);
  engineOutputRef.current = engineOutput;

  /**
   * Shared persist function — always reads from refs so retries use the
   * latest canonical state.  Called for both initial save and retry.
   */
  const persistReport = useCallback(async () => {
    const latestCompareAdvice = compareAdviceRef.current;
    const latestSurveyData = surveyDataRef.current;
    const latestEngineOutput = engineOutputRef.current;

    if (latestCompareAdvice == null || latestSurveyData == null) {
      setSaveState('failed');
      return;
    }
    try {
      const engineInput = toEngineInput(latestSurveyData);
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postcode: latestSurveyData.postcode ?? null,
          payload: {
            surveyData: latestSurveyData,
            engineInput,
            engineOutput: latestEngineOutput,
            decisionSynthesis: latestCompareAdvice,
          },
        }),
      });
      if (!res.ok) {
        setSaveState('failed');
        return;
      }
      const json = await res.json() as { ok: boolean; id?: string };
      if (json.ok && json.id) {
        setSavedReportId(json.id);
        setSaveState('saved');
      } else {
        setSaveState('failed');
      }
    } catch {
      setSaveState('failed');
    }
  }, []);

  /** Initial save handler. */
  const handleSaveReport = useCallback(() => {
    if (saveStateRef.current === 'saving' || saveStateRef.current === 'retrying') return;
    setSaveState('saving');
    persistReport();
  }, [persistReport]);

  /** Retry handler — re-reads latest canonical state and performs a real second save. */
  const handleRetrySave = useCallback(() => {
    if (saveStateRef.current === 'saving' || saveStateRef.current === 'retrying') return;
    setSaveState('retrying');
    persistReport();
  }, [persistReport]);

  // Resolve display values from whichever advice mode is active.
  const heroSystemPath = compareAdvice
    ? compareAdvice.bestOverall.recommendedPathLabel
    : legacyAdvice!.bestAllRound.systemPath;

  const heroWhy = compareAdvice
    ? compareAdvice.bestOverall.why[0] ?? ''
    : legacyAdvice!.bestAllRound.why;

  const heroConfidenceLevel = compareAdvice
    ? compareAdvice.confidenceSummary.level
    : legacyAdvice!.bestAllRound.confidence;

  const heroPerformanceSummary = compareAdvice?.bestOverall.performanceSummary ?? null;
  const heroConfidencePct = compareAdvice?.bestOverall.confidencePct ?? null;
  const heroCompareWins = compareAdvice?.bestOverall.compareWins ?? [];

  // Objective cards — either enriched (compare mode) or legacy.
  const enrichedObjectiveCards = compareAdvice
    ? [
        compareAdvice.byObjective.lowestRunningCost,
        compareAdvice.byObjective.lowestInstallationCost,
        compareAdvice.byObjective.greatestLongevity,
        compareAdvice.byObjective.lowestCarbonPointOfUse,
        compareAdvice.byObjective.greatestComfortAndDelivery,
        compareAdvice.byObjective.measuredForwardThinkingPlan,
      ]
    : null;
  const legacyObjectiveCards = legacyAdvice?.objectiveCards ?? null;

  // Installation recipe.
  const recipe = compareAdvice
    ? {
        heatSource: compareAdvice.installationRecipe.heatSource,
        dhwArrangement: compareAdvice.installationRecipe.hotWaterArrangement,
        controls: compareAdvice.installationRecipe.controls,
        emitterAction: compareAdvice.installationRecipe.emitters,
        primaryAction: compareAdvice.installationRecipe.primaryPipework[0] ?? null,
        protection: compareAdvice.installationRecipe.protectionAndAncillaries,
      }
    : legacyAdvice!.installationRecipe;

  // Recommendation scope — use compare-backed scope when available, fall back to legacy.
  const recommendationScope: RecommendationScope = compareAdvice
    ? compareAdvice.recommendationScope
    : legacyAdvice!.recommendationScope;

  // Trade-off warnings (legacy only — compare mode uses compareWins instead).
  const tradeOffWarnings = legacyAdvice?.tradeOffWarnings ?? [];

  // Engine explainer IDs emitted for this recommendation.
  const explainerIds = new Set(engineOutput.explainers.map(e => e.id));
  const showMixergySuggested     = explainerIds.has('stored-mixergy-suggested');
  const showCylinderCondition    = explainerIds.has('stored-cylinder-condition');
  const showHydraulicAshpFlow    = explainerIds.has('hydraulic-ashp-flow');
  const showCondensingCompromised = explainerIds.has('condensing-compromised');
  const showWaterHardness        = explainerIds.has('water-hardness');
  const showThermalMassHeavy     = explainerIds.has('thermal-mass-heavy');
  const showSplanConfirmed       = explainerIds.has('splan-confirmed');

  // ── Context-relevant explainer IDs for the overlay ──────────────────────
  // Map each engine explainer signal to one or more educational explainer IDs.
  // These are shown first under "For this recommendation" in the overlay menu.
  // All deps are stable primitive booleans derived from the engine output, so
  // the memo only recomputes when the actual signals change.
  const contextExplainerIds = useMemo<string[]>(() => {
    const ids: string[] = [];
    if (showMixergySuggested || showCylinderCondition) {
      ids.push('on_demand_vs_stored');
    }
    if (showMixergySuggested) {
      ids.push('standard_vs_mixergy');
    }
    if (showCylinderCondition) {
      ids.push('cylinder_age_condition');
    }
    if (showHydraulicAshpFlow) {
      ids.push('pipe_capacity', 'heat_pump_flow_temp');
    }
    if (showCondensingCompromised) {
      ids.push('condensing_return_temp', 'cycling_efficiency');
    }
    if (showWaterHardness) {
      ids.push('water_quality_scale');
    }
    if (showThermalMassHeavy) {
      ids.push('thermal_mass_inertia');
    }
    if (showSplanConfirmed) {
      ids.push('splan_vs_yplan');
    }
    return ids;
  }, [
    showMixergySuggested,
    showCylinderCondition,
    showHydraulicAshpFlow,
    showCondensingCompromised,
    showWaterHardness,
    showThermalMassHeavy,
    showSplanConfirmed,
  ]);

  // Push context explainer IDs into the global menu shell whenever they change.
  // Clears them when the advice page unmounts.
  useEffect(() => {
    setContextExplainerIds(contextExplainerIds);
    return () => setContextExplainerIds([]);
  }, [contextExplainerIds, setContextExplainerIds]);

  // Register an empty context menu sections list so the overlay stays clean.
  // Clears when the advice page unmounts.
  useEffect(() => {
    setContextMenuSections([]);
    return () => setContextMenuSections([]);
  }, [setContextMenuSections]);

  // Print view — render the dedicated print component.
  if (showPrint) {
    return (
      <PrintableRecommendationPage
        advice={compareAdvice}
        compareSeed={compareSeed}
        onBack={() => setShowPrint(false)}
      />
    );
  }

  return (
    <div className="advice-page" aria-label="Decision synthesis">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="advice-page__header">
        {onBack && (
          <button
            className="advice-page__back-btn"
            onClick={onBack}
            aria-label="Back to simulator"
          >
            ← Back to Simulator
          </button>
        )}
        {/* Print button — only shown when advice truth is available */}
        {compareAdvice != null && (
          <button
            className="advice-page__print-btn"
            onClick={() => setShowPrint(true)}
            aria-label="Print Atlas recommendation"
          >
            🖨 Print Recommendation
          </button>
        )}
        {/* Save Report */}
        {compareAdvice != null && saveState !== 'saved' && (
          <button
            className="advice-page__save-btn"
            onClick={saveState === 'failed' ? handleRetrySave : handleSaveReport}
            aria-label="Save Atlas report"
            disabled={saveState === 'saving' || saveState === 'retrying'}
          >
            {saveState === 'saving'   && '⏳ Saving…'}
            {saveState === 'retrying' && '⏳ Retrying…'}
            {saveState === 'failed'   && '❌ Save failed — retry?'}
            {saveState === 'idle'     && '💾 Save Report'}
          </button>
        )}
        {/* Show me why — Physics Story Mode */}
        <button
          className="advice-page__story-btn"
          onClick={() => setShowStory(prev => !prev)}
          aria-label="Show me why — Physics Story Mode"
          aria-expanded={showStory}
        >
          ⚡ Show me why
        </button>
        <div className="advice-page__title-block">
          <h1 className="advice-page__title">🎯 Advice</h1>
          <p className="advice-page__subtitle">
            Given what matters most to you, this is the route.
          </p>
        </div>
      </div>

      {/* ── Share panel — shown after successful report save ──────────────── */}
      {saveState === 'saved' && savedReportId != null && (
        <div
          className="advice-share-panel"
          role="region"
          aria-label="Share this report"
          data-testid="share-panel"
        >
          <div className="advice-share-panel__inner">
            <div className="advice-share-panel__left">
              <span className="advice-share-panel__label">✅ Report saved</span>
              <span className="advice-share-panel__id" aria-label="Report ID">
                ID: {savedReportId}
              </span>
              <div className="advice-share-panel__actions">
                <button
                  className="advice-share-panel__copy-btn"
                  onClick={() => {
                    const url = `${window.location.origin}/report/${savedReportId}`;
                    navigator.clipboard.writeText(url)
                      .then(() => {
                        setCopyState('copied');
                        if (copyTimer.current !== null) clearTimeout(copyTimer.current);
                        copyTimer.current = setTimeout(() => setCopyState('idle'), 2500);
                      })
                      .catch(() => {
                        setCopyState('failed');
                        if (copyTimer.current !== null) clearTimeout(copyTimer.current);
                        copyTimer.current = setTimeout(() => setCopyState('idle'), 2500);
                      });
                  }}
                  aria-label="Copy share link"
                >
                  {copyState === 'copied' && '✓ Copied!'}
                  {copyState === 'failed' && '⚠ Copy failed'}
                  {copyState === 'idle' && '🔗 Copy link'}
                </button>
                <a
                  className="advice-share-panel__open-btn"
                  href={`/report/${savedReportId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open saved report in new tab"
                >
                  Open report ↗
                </a>
              </div>
            </div>
            {qrDataUrl != null && (
              <div className="advice-share-panel__qr">
                <img
                  src={qrDataUrl}
                  alt={`QR code for report ${savedReportId}`}
                  className="advice-share-panel__qr-img"
                  width={120}
                  height={120}
                />
                <span className="advice-share-panel__qr-caption">Scan to open</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Floor-plan provenance banners ───────────────────────────────────── */}
      {compareAdvice?.floorplanInsights != null && (
        <FloorplanProvenanceBanner insights={compareAdvice.floorplanInsights} />
      )}

      {/* ── Physics Story Mode — full panel (shown when expanded) ────────── */}
      {showStory && (
        <PhysicsStoryPanel
          engineOutput={engineOutput}
          input={storyEngineInput}
          onClose={() => setShowStory(false)}
        />
      )}

      {/* ── Physics Story Mode — inline preview (top 1–2 headlines) ─────── */}
      {!showStory && storyCards.length > 0 && (
        <div className="advice-page__section" aria-label="Physics story preview">
          <div className="psp-preview">
            <div className="psp-preview__headlines">
              {storyCards.slice(0, 2).map(card => (
                <div key={card.id} className="psp-preview__headline">
                  {card.title}
                </div>
              ))}
            </div>
            <button
              className="psp-preview__btn"
              onClick={() => setShowStory(true)}
              aria-label="Show me why — open Physics Story Mode"
            >
              ⚡ Show me why
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Best all-round fit                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="advice-page__section" aria-label="Best all-round fit">
        <h2 className="advice-page__section-title">Best all-round fit</h2>

        <div className="advice-hero" role="region" aria-label="Primary recommendation">
          <div className="advice-hero__eyebrow">ATLAS RECOMMENDS</div>
          <div className="advice-hero__system" aria-label="Recommended system">
            {heroSystemPath}
          </div>
          <p className="advice-hero__why">{heroWhy}</p>

          {/* Compare wins on the hero card (compare mode only) */}
          {heroCompareWins.length > 0 && (
            <ul
              className="advice-hero__wins"
              aria-label="Compare wins for recommended system"
            >
              {heroCompareWins.map((win, i) => (
                <li key={i} className="advice-hero__win">✓ {win}</li>
              ))}
            </ul>
          )}

          {/* Performance panel (compare mode only) */}
          {heroPerformanceSummary != null && (
            <PerformancePanelUI summary={heroPerformanceSummary} />
          )}

          {/* Confidence — show pct in compare mode, label in legacy mode */}
          {heroConfidencePct != null ? (
            <div
              className={`advice-hero__confidence advice-hero__confidence--${heroConfidenceLevel ?? 'medium'}`}
              aria-label={`Confidence: ${heroConfidencePct}%`}
            >
              {CONFIDENCE_LABEL[heroConfidenceLevel ?? 'medium']} — {heroConfidencePct}%
            </div>
          ) : heroConfidenceLevel != null ? (
            <div
              className={`advice-hero__confidence advice-hero__confidence--${heroConfidenceLevel}`}
              aria-label={`Confidence: ${heroConfidenceLevel}`}
            >
              {CONFIDENCE_LABEL[heroConfidenceLevel]}
            </div>
          ) : null}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1b — Unified confidence breakdown (compare mode only)     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {compareAdvice?.confidenceSummary.unified != null && (
        <div className="advice-page__section" aria-label="Confidence breakdown">
          <h2 className="advice-page__section-title">Recommendation confidence</h2>
          <UnifiedConfidencePanel unified={compareAdvice.confidenceSummary.unified} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1c — Recommendation trade-off summary                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tradeOffSummary != null && (
        <div className="advice-page__section" aria-label="Recommendation trade-off summary">
          <h2 className="advice-page__section-title">Current vs recommended — at a glance</h2>
          <p className="advice-page__section-intro">
            How the recommended system compares to your current setup on the dimensions that matter.
          </p>
          <TradeOffSummary summary={tradeOffSummary} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Best by objective (6 cards)                           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="advice-page__section" aria-label="Best by objective">
        <h2 className="advice-page__section-title">Best by objective</h2>
        <p className="advice-page__section-intro">
          Different objectives lead to different answers. Here is each one clearly.
        </p>
        <div
          className="advice-obj-grid"
          role="list"
          aria-label="Objective cards"
        >
          {enrichedObjectiveCards != null
            ? enrichedObjectiveCards.map(card => (
                <div key={card.id} role="listitem">
                  <EnrichedObjectiveCardUI card={card} />
                </div>
              ))
            : (legacyObjectiveCards ?? []).map(card => (
                <div key={card.id} role="listitem">
                  <ObjectiveCardUI card={card} />
                </div>
              ))
          }
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Installation recipe                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="advice-page__section" aria-label="Installation recipe">
        <h2 className="advice-page__section-title">Your installation should include…</h2>

        <div className="advice-recipe" role="list" aria-label="Installation recipe items">

          <div className="advice-recipe__row" role="listitem">
            <div className="advice-recipe__label">Heat source</div>
            <div className="advice-recipe__value">{recipe.heatSource}</div>
          </div>

          <div className="advice-recipe__row" role="listitem">
            <div className="advice-recipe__label">Hot water arrangement</div>
            <div className="advice-recipe__value">{recipe.dhwArrangement}</div>
          </div>

          {recipe.controls.length > 0 && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Controls</div>
              <ul className="advice-recipe__list" aria-label="Controls">
                {recipe.controls.map((c, i) => (
                  <li key={i} className="advice-recipe__item">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {recipe.emitterAction.length > 0 && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Emitter action</div>
              <ul className="advice-recipe__list" aria-label="Emitter actions">
                {recipe.emitterAction.map((e, i) => (
                  <li key={i} className="advice-recipe__item">{e}</li>
                ))}
              </ul>
            </div>
          )}

          {recipe.primaryAction && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Primary pipework</div>
              <div className="advice-recipe__value">{recipe.primaryAction}</div>
            </div>
          )}

          {recipe.protection.length > 0 && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Protection & treatment</div>
              <ul className="advice-recipe__list" aria-label="Protection items">
                {recipe.protection.map((p, i) => (
                  <li key={i} className="advice-recipe__item">{p}</li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — Trade-off strip (legacy) or compare context note      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tradeOffWarnings.length > 0 && (
        <div className="advice-page__section" aria-label="Trade-off warnings">
          <h2 className="advice-page__section-title">Key trade-offs</h2>
          <div
            className="advice-tradeoffs"
            role="list"
            aria-label="Trade-off warnings"
          >
            {tradeOffWarnings.map(w => (
              <div key={w.id} className="advice-tradeoff" role="listitem">
                <span className="advice-tradeoff__icon" aria-hidden="true">⚠️</span>
                <span className="advice-tradeoff__text">{w.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5 — Recommendation scope (Essential / Best Advice / Enhanced / Future Potential) */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="advice-page__section" aria-label="Recommendation scope">
        <h2 className="advice-page__section-title">What this means for you</h2>
        <p className="advice-page__section-intro">
          Clear scope — what must be done, what should be done, what is optional, and what is possible later.
        </p>
        <RecommendationScopeUI scope={recommendationScope} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6 — Future energy opportunities                           */}
      {/* Solar PV and EV charging suitability assessments.                 */}
      {/* Shown when the engine has evaluated whole-home pathway signals.   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {engineOutput.futureEnergyOpportunities != null && (
        <div
          className="advice-page__section"
          aria-label="Future energy opportunities"
          data-testid="future-energy-opportunities-section"
        >
          <h2 className="advice-page__section-title">Future energy opportunities</h2>
          <p className="advice-page__section-intro">
            Based on this home&apos;s profile, these whole-home energy opportunities are worth considering
            alongside the heating recommendation. These are opportunity assessments — not installation
            approvals or full designs.
          </p>
          <div
            className="advice-opportunities"
            role="list"
            aria-label="Future energy opportunity cards"
          >
            <div role="listitem">
              <OpportunityCardUI
                title="Solar PV"
                card={engineOutput.futureEnergyOpportunities.solarPv}
              />
            </div>
            <div role="listitem">
              <OpportunityCardUI
                title="EV charging"
                card={engineOutput.futureEnergyOpportunities.evCharging}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
