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
import ReportQrFooter from '../report/ReportQrFooter';
import PhysicsStoryPanel from '../story/PhysicsStoryPanel';
import { buildPhysicsStory } from '../../lib/story/buildPhysicsStory';
import { useGlobalMenu } from '../shell/GlobalMenuContext';
import TradeOffSummary from './TradeOffSummary';
import { buildTradeOffSummary } from '../../lib/advice/buildTradeOffSummary';
import {
  type RecommendationPresentationState,
  hasCustomerDivergence,
} from '../../lib/selection/optionSelection';
import {
  CHOOSE_OPTION_LABEL,
  CHOSEN_OPTION_CONFIRMED_LABEL,
  CHOSEN_OPTION_FRAMING,
} from '../../lib/copy/customerCopy';
import { buildRealWorldBehaviourCards } from '../../lib/behaviour/buildRealWorldBehaviourCards';
import RealWorldBehaviourCards from './RealWorldBehaviourCards';
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
  /**
   * Pre-existing report reference (e.g. from ReportPage).
   * When provided, this is used as the QR target in the print view even before
   * the user saves the current session report.
   */
  reportReference?: string;
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
          exact={`~${summary.costPerKwhHeat}p/kWh heat`}
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
  reportReference,
}: Props) {
  const [showPrint, setShowPrint] = useState(false);
  const [showPrintQr, setShowPrintQr] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [saveState, setSaveState] = useState<ReportSaveState>('idle');
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PR3 — Customer-chosen option state (presentation layer only).
  // chosenOptionId tracks which option the customer has actively preferred.
  // This NEVER alters engine scoring or the recommended option.
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null);

  // Register context-specific explainer IDs with the global menu shell.
  const { setContextExplainerIds, setContextMenuSections, openExplainerById } = useGlobalMenu();

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
  // PR3 — ref so persistReport always uses the latest chosen option.
  const chosenOptionIdRef = useRef(chosenOptionId);
  chosenOptionIdRef.current = chosenOptionId;

  /**
   * Shared persist function — always reads from refs so retries use the
   * latest canonical state.  Called for both initial save and retry.
   */
  const persistReport = useCallback(async () => {
    const latestCompareAdvice = compareAdviceRef.current;
    const latestSurveyData = surveyDataRef.current;
    const latestEngineOutput = engineOutputRef.current;
    const latestChosenOptionId = chosenOptionIdRef.current;

    if (latestCompareAdvice == null || latestSurveyData == null) {
      setSaveState('failed');
      return;
    }

    // PR3 — Resolve recommended option ID from engine output for the
    // presentation state. This is presentation-only and does not affect
    // the engine recommendation.
    const recommendedOptionId =
      latestEngineOutput.options?.find(o => o.status === 'viable')?.id ??
      latestEngineOutput.options?.[0]?.id ??
      '';

    const presentationState: RecommendationPresentationState = {
      recommendedOptionId,
      chosenOptionId: latestChosenOptionId ?? undefined,
      chosenByCustomer: latestChosenOptionId != null,
    };

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
            presentationState,
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

  // ── Multiple suitable options — shown when the engine signals ambiguity ──────
  // When multiple options are viable (or all are caution), surface all of them
  // so the adviser can present a complete picture rather than picking one.
  const MULTIPLE_OPTIONS_SIGNALS = new Set([
    'Multiple suitable options',
    'Multiple stored-water options suitable',
    'Multiple options need review',
  ]);
  const primaryRecommendation = engineOutput.recommendation?.primary ?? '';
  const showMultipleOptions =
    MULTIPLE_OPTIONS_SIGNALS.has(primaryRecommendation) &&
    engineOutput.options != null &&
    engineOutput.options.length > 1;
  // All viable options, or caution options when no viable ones exist.
  // Cache the viable filter result to avoid iterating the array twice.
  const viableOptions = showMultipleOptions && engineOutput.options
    ? engineOutput.options.filter(o => o.status === 'viable')
    : [];
  const multipleOptions = showMultipleOptions && engineOutput.options
    ? (viableOptions.length > 1
        ? viableOptions
        : engineOutput.options.filter(o => o.status === 'caution'))
    : [];

  // PR3 — Resolve the recommended option ID from engine output.
  // Used to build the presentation state for the "Choose this option" UI
  // and for including in the saved report. Never affects engine scoring.
  const recommendedOptionId =
    engineOutput.options?.find(o => o.status === 'viable')?.id ??
    engineOutput.options?.[0]?.id ??
    '';

  // PR3 — Build the current presentation state.
  const presentationState: RecommendationPresentationState = {
    recommendedOptionId,
    chosenOptionId: chosenOptionId ?? undefined,
    chosenByCustomer: chosenOptionId != null,
  };

  // PR3 — True when the customer has chosen an option different from the recommendation.
  const showChosenOptionBanner =
    hasCustomerDivergence(presentationState) &&
    chosenOptionId != null;

  // PR3 — The chosen option card (for framing the divergence banner).
  const chosenOptionCard =
    showChosenOptionBanner && engineOutput.options
      ? engineOutput.options.find(o => o.id === chosenOptionId) ?? null
      : null;

  // PR4 — The recommended option card (for labelling the divergence comparison).
  const recommendedOptionCard =
    engineOutput.options?.find(o => o.id === recommendedOptionId) ?? null;

  // PR4 — Build real-world behaviour cards from engine output and presentation state.
  // Derived each render so they always reflect the latest chosenOptionId.
  const behaviourCards = buildRealWorldBehaviourCards(engineOutput, presentationState);

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

  const printableReportReference = reportReference ?? savedReportId ?? undefined;

  // Print view — render the dedicated print component.
  if (showPrint) {
    return (
      <PrintableRecommendationPage
        advice={compareAdvice}
        compareSeed={compareSeed}
        onBack={() => setShowPrint(false)}
        reportReference={printableReportReference}
      />
    );
  }

  // Print QR & link view — renders only the portal QR code and link.
  if (showPrintQr && printableReportReference) {
    return (
      <div className="advice-print-qr-page" aria-label="QR code and portal link">
        <div className="advice-print-qr-page__toolbar prp__toolbar">
          <button
            className="prp__back-btn"
            onClick={() => setShowPrintQr(false)}
            aria-label="Back to advice page"
          >
            ← Back to advice page
          </button>
          <button
            className="prp__print-btn"
            onClick={() => window.print()}
            aria-label="Print QR code and link"
          >
            🖨 Print
          </button>
        </div>
        <div className="advice-print-qr-page__content">
          <ReportQrFooter reportReference={printableReportReference} />
        </div>
      </div>
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
        {/* Print QR & Link — only shown when a report reference is available */}
        {printableReportReference != null && (
          <button
            className="advice-page__print-btn"
            onClick={() => setShowPrintQr(true)}
            aria-label="Print QR code and link"
          >
            🔗 Print QR &amp; Link
          </button>
        )}
        {/* Save Report */}
        {compareAdvice != null && saveState !== 'saved' && (
          <>
            {saveState === 'idle' && (
              <p className="advice-page__save-hint" data-testid="save-report-hint">
                Save this report to generate a shareable link and QR code.
              </p>
            )}
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
          </>
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

      {/* ── Portal QR & link — shown at top when a reportReference is available ── */}
      {printableReportReference != null && (
        <div
          className="advice-portal-qr"
          role="region"
          aria-label="Customer portal link and QR code"
          data-testid="portal-qr-section"
        >
          <ReportQrFooter reportReference={printableReportReference} />
        </div>
      )}

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

          {/* Structured decision breakdown (compare mode only) */}
          {compareAdvice != null && (
            <dl className="advice-hero__breakdown" aria-label="Recommendation breakdown">
              <div className="advice-hero__breakdown-row">
                <dt className="advice-hero__breakdown-label">Heat source</dt>
                <dd className="advice-hero__breakdown-value">{recipe.heatSource}</dd>
              </div>
              <div className="advice-hero__breakdown-row">
                <dt className="advice-hero__breakdown-label">Hot water</dt>
                <dd className="advice-hero__breakdown-value">{recipe.dhwArrangement}</dd>
              </div>
              {(compareAdvice.bestOverall.keyTradeOff ?? engineOutput.verdict?.primaryReason) && (
                <div className="advice-hero__breakdown-row">
                  <dt className="advice-hero__breakdown-label">Why not top alternative</dt>
                  <dd className="advice-hero__breakdown-value">
                    {compareAdvice.bestOverall.keyTradeOff ?? engineOutput.verdict?.primaryReason}
                  </dd>
                </div>
              )}
              {(() => {
                const futurePotential = recommendationScope.futurePotential;
                return futurePotential != null && futurePotential.items.length > 0 ? (
                  <div className="advice-hero__breakdown-row">
                    <dt className="advice-hero__breakdown-label">Future path</dt>
                    <dd className="advice-hero__breakdown-value">
                      {futurePotential.items[0].label}
                    </dd>
                  </div>
                ) : null;
              })()}
            </dl>
          )}

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
      {/* SECTION 1d — Multiple suitable options                              */}
      {/* Shown when the engine signals ambiguity or multiple viable paths.   */}
      {/* PR3 — "Choose this option" affordance added to each card.           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showMultipleOptions && multipleOptions.length > 1 && (
        <div
          className="advice-page__section"
          aria-label="Multiple suitable options"
          data-testid="multiple-options-section"
        >
          <h2 className="advice-page__section-title">
            {primaryRecommendation === 'Multiple options need review'
              ? 'All options for review'
              : 'All suitable options'}
          </h2>
          <p className="advice-page__section-intro">
            {primaryRecommendation === 'Multiple options need review'
              ? 'More than one system needs investigation before a single recommendation can be confirmed. Review all options below.'
              : 'More than one system fits this property\'s profile. Each is shown below so you can discuss the best choice with the customer.'}
          </p>
          <div
            className="advice-multi-options"
            role="list"
            aria-label="All suitable options"
          >
            {multipleOptions.map(option => {
              const isChosen = chosenOptionId === option.id;
              return (
                <div
                  key={option.id}
                  className={`advice-multi-option advice-multi-option--${option.status}${isChosen ? ' advice-multi-option--chosen' : ''}`}
                  role="listitem"
                  data-testid={`option-card-${option.id}`}
                >
                  <div className="advice-multi-option__header">
                    <div className="advice-multi-option__label">{option.label}</div>
                    <span className={`advice-multi-option__badge advice-multi-option__badge--${option.status}`}>
                      {option.status === 'viable' ? '✓ Viable' : '⚠ Review needed'}
                    </span>
                    {isChosen && (
                      <span
                        className="advice-multi-option__chosen-badge"
                        data-testid={`chosen-badge-${option.id}`}
                      >
                        {CHOSEN_OPTION_CONFIRMED_LABEL}
                      </span>
                    )}
                  </div>
                  <p className="advice-multi-option__headline">{option.headline}</p>
                  {option.why.length > 0 && (
                    <ul className="advice-multi-option__why" aria-label={`${option.label} reasons`}>
                      {option.why.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                  {option.typedRequirements.mustHave.length > 0 && (
                    <div className="advice-multi-option__reqs">
                      <span className="advice-multi-option__reqs-label">Must have:</span>
                      <ul aria-label={`${option.label} requirements`}>
                        {option.typedRequirements.mustHave.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* PR3 — "Choose this option" affordance */}
                  <div className="advice-multi-option__actions">
                    {isChosen ? (
                      <button
                        className="advice-multi-option__choose-btn advice-multi-option__choose-btn--chosen"
                        onClick={() => setChosenOptionId(null)}
                        aria-label={`Clear choice: ${option.label}`}
                        data-testid={`clear-choice-btn-${option.id}`}
                      >
                        ✓ {CHOSEN_OPTION_CONFIRMED_LABEL}
                      </button>
                    ) : (
                      <button
                        className="advice-multi-option__choose-btn"
                        onClick={() => setChosenOptionId(option.id)}
                        aria-label={`${CHOOSE_OPTION_LABEL}: ${option.label}`}
                        data-testid={`choose-btn-${option.id}`}
                      >
                        {CHOOSE_OPTION_LABEL}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1e — Available options (single-recommendation case)         */}
      {/* PR3 — When there is one clear recommendation but other options       */}
      {/* exist, show them so the customer can express a preference.           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {!showMultipleOptions && engineOutput.options != null && engineOutput.options.length > 1 && (
        <div
          className="advice-page__section"
          aria-label="All available options"
          data-testid="all-options-section"
        >
          <h2 className="advice-page__section-title">All available options</h2>
          <p className="advice-page__section-intro">
            The recommended option is shown above. If you have a preference for a different system, you can choose it here — the recommendation and physics will not change.
          </p>
          <div
            className="advice-multi-options"
            role="list"
            aria-label="Available options"
          >
            {engineOutput.options.map(option => {
              const isRecommended = option.id === recommendedOptionId;
              const isChosen = chosenOptionId === option.id;
              return (
                <div
                  key={option.id}
                  className={`advice-multi-option advice-multi-option--${option.status}${isChosen ? ' advice-multi-option--chosen' : ''}${isRecommended ? ' advice-multi-option--recommended' : ''}`}
                  role="listitem"
                  data-testid={`option-card-${option.id}`}
                >
                  <div className="advice-multi-option__header">
                    <div className="advice-multi-option__label">{option.label}</div>
                    {isRecommended && (
                      <span className="advice-multi-option__badge advice-multi-option__badge--recommended">
                        ✓ Recommended
                      </span>
                    )}
                    {isChosen && !isRecommended && (
                      <span
                        className="advice-multi-option__chosen-badge"
                        data-testid={`chosen-badge-${option.id}`}
                      >
                        {CHOSEN_OPTION_CONFIRMED_LABEL}
                      </span>
                    )}
                  </div>
                  <p className="advice-multi-option__headline">{option.headline}</p>
                  {/* PR3 — Only show "Choose this option" for non-recommended options */}
                  {!isRecommended && (
                    <div className="advice-multi-option__actions">
                      {isChosen ? (
                        <button
                          className="advice-multi-option__choose-btn advice-multi-option__choose-btn--chosen"
                          onClick={() => setChosenOptionId(null)}
                          aria-label={`Clear choice: ${option.label}`}
                          data-testid={`clear-choice-btn-${option.id}`}
                        >
                          ✓ {CHOSEN_OPTION_CONFIRMED_LABEL}
                        </button>
                      ) : (
                        <button
                          className="advice-multi-option__choose-btn"
                          onClick={() => setChosenOptionId(option.id)}
                          aria-label={`${CHOOSE_OPTION_LABEL}: ${option.label}`}
                          data-testid={`choose-btn-${option.id}`}
                        >
                          {CHOOSE_OPTION_LABEL}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1f — Customer-chosen option framing banner                  */}
      {/* PR3 — Shown when customer has chosen a different option.            */}
      {/* Structure: Affirm → Align → Explain behaviour → Guide               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showChosenOptionBanner && chosenOptionCard != null && (
        <div
          className="advice-page__section advice-chosen-banner"
          aria-label="Your chosen option"
          data-testid="chosen-option-banner"
          role="region"
        >
          <h2 className="advice-chosen-banner__heading">
            {CHOSEN_OPTION_FRAMING.heading}: {chosenOptionCard.label}
          </h2>
          <p className="advice-chosen-banner__affirm">
            {CHOSEN_OPTION_FRAMING.affirm}
          </p>
          {chosenOptionCard.why.length > 0 && (
            <p className="advice-chosen-banner__align">
              {CHOSEN_OPTION_FRAMING.align} {chosenOptionCard.why[0]}
            </p>
          )}
          <p className="advice-chosen-banner__headline">
            {chosenOptionCard.headline}
          </p>
          <p className="advice-chosen-banner__guide">
            {CHOSEN_OPTION_FRAMING.guide}
          </p>
          <p className="advice-chosen-banner__recommendation-note">
            {CHOSEN_OPTION_FRAMING.recommendedStillAvailable}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1g — Real-world behaviour cards                            */}
      {/* PR4 — Shown below recommendation summary and chosen-option framing */}
      {/* Translates engine outputs into daily-use scenarios so the customer */}
      {/* understands practical consequences of the recommended option and,  */}
      {/* when divergent, their chosen option too.                           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {behaviourCards.length > 0 && (
        <div
          className="advice-page__section"
          aria-label="In daily use"
          data-testid="behaviour-cards-section"
        >
          <h2 className="advice-page__section-title">In daily use</h2>
          <p className="advice-page__section-intro">
            How this would feel day-to-day, based on the survey data.
          </p>
          <RealWorldBehaviourCards
            cards={behaviourCards}
            isDivergent={showChosenOptionBanner}
            recommendedOptionLabel={recommendedOptionCard?.label ?? 'Recommended option'}
            chosenOptionLabel={chosenOptionCard?.label ?? 'Your chosen option'}
            onOpenExplainer={openExplainerById}
          />
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
