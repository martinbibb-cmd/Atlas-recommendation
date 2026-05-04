import { useState, useEffect } from 'react';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { sanitiseModelForEngine } from '../../ui/fullSurvey/sanitiseModelForEngine';
import { runEngine } from '../../engine/Engine';
import LiveHubPage from '../../live/LiveHubPage';
import { SystemBuilderStep } from '../../features/survey/systemBuilder/SystemBuilderStep';
import { INITIAL_SYSTEM_BUILDER_STATE } from '../../features/survey/systemBuilder/systemBuilderTypes';
import { ServicesStep } from '../../features/survey/services/ServicesStep';
import { INITIAL_WATER_QUALITY_STATE } from '../../features/survey/services/waterQualityTypes';
import { UsageStep } from '../../features/survey/usage/UsageStep';
import { INITIAL_HOME_STATE } from '../../features/survey/usage/usageTypes';
import { PrioritiesStep } from '../../features/survey/priorities/PrioritiesStep';
import { INITIAL_PRIORITIES_STATE } from '../../features/survey/priorities/prioritiesTypes';
import { HeatLossStep, INITIAL_HEAT_LOSS_STATE } from '../../features/survey/heatLoss/HeatLossStep';
import { BuildingFabricStep } from '../../features/survey/heatLoss/BuildingFabricStep';
import { SolarAssessmentStep } from '../../features/survey/solar/SolarAssessmentStep';
import { InsightLayerPage } from '../../features/survey/insight/InsightLayerPage';
import { QuoteCollectionStep } from '../../features/survey/quotes/QuoteCollectionStep';
import type { QuoteInput } from '../../features/insightPack/insightPack.types';
import {
  INITIAL_RECOMMENDATION_STATE,
  type RecommendationState,
} from '../../features/survey/recommendation/recommendationTypes';
import {
  type SurveyStepId,
  SURVEY_STEP_IDS,
  SURVEY_STEP_COUNT,
  progressLabel,
} from '../../config/surveyStepRegistry';
import { AcceptedSuggestionsReview } from '../../features/voiceNotes/AcceptedSuggestionsReview';

interface Props {
  onBack: () => void;
  /** Optional prefill state from Story Mode escalation. */
  prefill?: Partial<FullSurveyModelV1>;
  onOpenFloorPlan?: (surveyResults: Partial<FullSurveyModelV1>) => void;
  /**
   * Called when the first-pass survey completes.  Receives the cleaned
   * EngineInputV2_3 ready for the simulator.  When provided, the stepper
   * routes directly to the simulator instead of opening LiveHubPage.
   */
  onComplete?: (engineInput: EngineInputV2_3) => void;
  /**
   * Called on every step transition (and at completion) with the current raw
   * FullSurveyModelV1 — including fullSurvey extras.  Used by VisitPage to
   * autosave mid-survey state so that navigation-away-and-back, refresh, and
   * save/reload all preserve the full survey including Step 5 hot-water data.
   */
  onDraft?: (draft: FullSurveyModelV1) => void;
  /**
   * When provided, the InsightLayerPage shows a "Try in Simulator →" shortcut
   * CTA that jumps directly to the simulator without the fit-map intermediate
   * step.  Receives the cleaned EngineInputV2_3 ready for the simulator.
   */
  onOpenSimulator?: (engineInput: EngineInputV2_3) => void;
  /**
   * When provided, called after the Quotes step completes with the collected
   * QuoteInput[] so the parent can open the Atlas Insight Pack.
   */
  onOpenInsightPack?: (engineInput: EngineInputV2_3, quotes: QuoteInput[]) => void;
}

// Step type and ordered sequence derived from the canonical registry.
type Step = SurveyStepId;
const STEPS: readonly SurveyStepId[] = SURVEY_STEP_IDS;

// ─── Fabric Behaviour Controls ────────────────────────────────────────────────
// Two independent physics dimensions:
//   A) Fabric heat-loss (wall type, insulation, glazing, roof, airtightness)
//   B) Thermal inertia (mass — separate from wall type)










const defaultInput: FullSurveyModelV1 = {
  postcode: '',
  dynamicMainsPressure: 1.0,
  buildingMass: 'heavy',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
  hasMagneticFilter: false,
  installationPolicy: 'full_job',
  dhwTankType: 'standard',
  installerNetwork: 'british_gas',
  fullSurvey: {
    manualEvidence: {},
    telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
  },
};

/** Z-index reserved for any future full-screen overlays above the stepper. */
// const OVERLAY_Z_INDEX = 1000;

export default function FullSurveyStepper({ onBack, prefill, onComplete, onDraft, onOpenSimulator, onOpenInsightPack }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('system_builder');
  const [input, setInput] = useState<FullSurveyModelV1>(() =>
    prefill ? { ...defaultInput, ...prefill } : defaultInput
  );
  const [prefillActive] = useState<boolean>(!!prefill);
  const [showPrefillBanner, setShowPrefillBanner] = useState<boolean>(!!prefill);
  const [compareMixergy] = useState(() => prefill?.fullSurvey?.compareMixergy ?? false);
  const [systemBuilderState, setSystemBuilderState] = useState(
    () => prefill?.fullSurvey?.systemBuilder ?? INITIAL_SYSTEM_BUILDER_STATE
  );
  const [waterQualityState, setWaterQualityState] = useState(
    () => prefill?.fullSurvey?.waterQuality ?? INITIAL_WATER_QUALITY_STATE
  );
  const [usageState, setUsageState] = useState(
    () => prefill?.fullSurvey?.usage ?? INITIAL_HOME_STATE
  );
  const [prioritiesState, setPrioritiesState] = useState(
    () => prefill?.fullSurvey?.priorities ?? INITIAL_PRIORITIES_STATE
  );
  const [heatLossState, setHeatLossState] = useState(
    () => prefill?.fullSurvey?.heatLoss ?? INITIAL_HEAT_LOSS_STATE
  );
  const [recommendationState] = useState<RecommendationState>(
    () => prefill?.fullSurvey?.recommendation ?? INITIAL_RECOMMENDATION_STATE
  );
  const [quotesState] = useState<QuoteInput[]>(
    () => prefill?.fullSurvey?.quotes ?? []
  );
  const [results, setResults] = useState<FullEngineResult | null>(null);
  const [mode, setMode] = useState<'stepper' | 'hub'>('stepper');
  // Full draft stored when transitioning to hub so the presentation deck has
  // access to all fullSurvey step outputs (heatLoss, priorities, systemBuilder,
  // waterQuality, usage, etc.) — not just the EngineInputV2_3 subset.
  const [hubDraft, setHubDraft] = useState<FullSurveyModelV1 | null>(null);

  // ── Wire demographics into engine input ────────────────────────────────────
  // When the Home / Demographics step state changes, sync composition and
  // bathroomCount into the EngineInputV2_3 portion of `input` so that
  // sanitiseModelForEngine can derive occupancyCount + demandPreset from them.
  useEffect(() => {
    setInput(prev => ({
      ...prev,
      householdComposition: usageState.composition,
      ...(usageState.bathroomCount != null
        ? { bathroomCount: usageState.bathroomCount }
        : {}),
    }));
  // usageState is the only relevant dependency — input is intentionally omitted
  // to avoid a feedback loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usageState]);

  // ── Wire heat-loss calculator output into engine input ─────────────────────
  // When the HeatLossCalculator produces a result, sync it into input.heatLossWatts
  // so the insight page, recommendations, fit map, and engine all read the same
  // canonical value.  When the calculator output is cleared (null), fall back to
  // the default 8000 W.
  useEffect(() => {
    setInput(prev => ({
      ...prev,
      heatLossWatts: heatLossState.estimatedPeakHeatLossW ?? 8000,
    }));
  // setInput is the stable React setter — safe to omit.  Only the calculator
  // result value should re-trigger this sync; setInput never changes identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatLossState.estimatedPeakHeatLossW]);







  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / SURVEY_STEP_COUNT) * 100;

  // Determine whether the solar assessment step should be skipped.
  // Flats (any floor) do not have independent roof access for solar installation.
  const flatTypes = ['flatGround', 'flatMid', 'flatPenthouse'] as const;
  const skipSolarStep = flatTypes.includes(
    heatLossState.shellModel?.settings?.dwellingType as typeof flatTypes[number]
  );

  // Scroll to top whenever the active step changes so the user always sees the
  // top of the new step — prevents "mid-page carryover" between steps.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentStep]);

  /** Build a draft that embeds all step state into fullSurvey for persistence. */
  const buildDraft = (): FullSurveyModelV1 => ({
    ...input,
    fullSurvey: {
      ...input.fullSurvey,
      compareMixergy,
      systemBuilder: systemBuilderState,
      waterQuality: waterQualityState,
      usage: usageState,
      priorities: prioritiesState,
      heatLoss: heatLossState,
      recommendation: recommendationState,
      quotes: quotesState.length > 0 ? quotesState : undefined,
    },
  });

  const next = () => {
    if (currentStep === 'heat_loss' && skipSolarStep) {
      // Skip solar assessment step for flats
      if (onDraft) onDraft(buildDraft());
      setCurrentStep('priorities');
      return;
    }
    if (currentStep === 'insight') {
      // Advance to the quotes step — engine runs after quotes are collected.
      if (onDraft) onDraft(buildDraft());
      setCurrentStep('quotes');
      return;
    }
    if (currentStep === 'quotes') {
      // Quotes is the final step — run the engine and advance to results.
      const draft = buildDraft();
      // Sanitise before engine run AND before storing as hubDraft so that
      // buildCanonicalPresentation receives all bridged fields (roofOrientation,
      // pvStatus, batteryStatus, heatLossWatts, occupancyCount, currentSystem.boiler.*)
      // that sanitiseModelForEngine derives from fullSurvey extras.
      const sanitisedDraft = sanitiseModelForEngine(draft);
      const engineInput = toEngineInput(sanitisedDraft);
      if (onDraft) onDraft(draft);
      // If the parent wants to open the Insight Pack directly, do that first.
      if (onOpenInsightPack) {
        onOpenInsightPack(engineInput, quotesState);
        return;
      }
      if (onComplete) {
        // Route directly to the simulator dashboard without stopping at LiveHubPage.
        onComplete(engineInput);
        return;
      }
      const engineResult = runEngine(engineInput);
      setResults(engineResult);
      setHubDraft(sanitisedDraft);
      setMode('hub');
      return;
    }
    // Autosave draft on every step transition so partial survey state survives
    // page refresh / navigate-away / save-reload.
    if (onDraft) onDraft(buildDraft());
    setCurrentStep(STEPS[stepIndex + 1]);
  };

  const prev = () => {
    if (stepIndex === 0) {
      onBack();
    } else if (currentStep === 'priorities' && skipSolarStep) {
      // Skip solar assessment step backwards for flats
      if (onDraft) onDraft(buildDraft());
      setCurrentStep('heat_loss');
    } else {
      // Autosave draft on back-navigation too so that drawn heat-loss geometry
      // and other step state survive reload / save-restore even when the user
      // navigates backwards without first going forward.
      if (onDraft) onDraft(buildDraft());
      setCurrentStep(STEPS[stepIndex - 1]);
    }
  };

  if (mode === 'hub' && results) {
    return (
      <LiveHubPage
        result={results}
        input={hubDraft ?? input}
        onBack={() => setMode('stepper')}
      />
    );
  }

  return (
    <div className="stepper-container">
      {showPrefillBanner && prefillActive && (
        <div className="prefill-banner" role="status">
          <span>Prefilled from Fast Choice.</span>
          <button
            type="button"
            className="prefill-banner__reset"
            onClick={() => { setInput(defaultInput); setShowPrefillBanner(false); }}
          >
            Reset to defaults
          </button>
          <button
            type="button"
            className="prefill-banner__dismiss"
            onClick={() => setShowPrefillBanner(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Show accepted note-derived values so the engineer can see what was
          applied from voice notes and identify fields pre-filled from notes. */}
      {input.fullSurvey?.appliedNoteSuggestions &&
        input.fullSurvey.appliedNoteSuggestions.length > 0 && (
        <div style={{ padding: '0 1rem', marginTop: '0.5rem' }}>
          <AcceptedSuggestionsReview applied={input.fullSurvey.appliedNoteSuggestions} />
        </div>
      )}
      <div className="stepper-header">
        <button className="back-btn" onClick={prev}>← Back</button>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="step-label">{progressLabel(currentStep)}</span>
      </div>

      {currentStep === 'services' && (
        <ServicesStep
          state={waterQualityState}
          surveyPostcode={input.postcode}
          onChange={setWaterQualityState}
          onNext={next}
          onPrev={prev}
          showDebugOutput={true}
          nextLabel="Next →"
          staticPressureBar={input.staticMainsPressureBar}
          dynamicPressureBar={input.dynamicMainsPressureBar}
          dynamicFlowLpm={input.mainsDynamicFlowLpm}
          onMeasurementsChange={(staticBar, dynamicBar, flowLpm) => {
            setInput(prev => ({
              ...prev,
              staticMainsPressureBar: staticBar,
              dynamicMainsPressureBar: dynamicBar,
              dynamicMainsPressure: dynamicBar ?? prev.dynamicMainsPressure,
              mainsDynamicFlowLpm: flowLpm,
              mainsDynamicFlowLpmKnown: flowLpm !== undefined ? true : undefined,
            }));
          }}
          availableSpace={input.availableSpace}
          onAvailableSpaceChange={value => setInput(prev => ({ ...prev, availableSpace: value }))}
          loftTankSpace={input.loftTankSpace}
          onLoftTankSpaceChange={value => setInput(prev => ({ ...prev, loftTankSpace: value }))}
          hasOutdoorSpaceForHeatPump={input.hasOutdoorSpaceForHeatPump}
          onOutdoorSpaceChange={value => setInput(prev => ({ ...prev, hasOutdoorSpaceForHeatPump: value }))}
        />
      )}


      {currentStep === 'system_builder' && (
        <SystemBuilderStep
          state={systemBuilderState}
          onChange={setSystemBuilderState}
          onNext={next}
          onPrev={prev}
          showDebugOutput={true}
        />
      )}

      {currentStep === 'usage' && (
        <UsageStep
          state={usageState}
          onChange={setUsageState}
          onNext={next}
          onPrev={prev}
          showDebugOutput={true}
        />
      )}

      {currentStep === 'building_fabric' && (
        <BuildingFabricStep
          state={heatLossState}
          onChange={setHeatLossState}
          onNext={next}
          onPrev={prev}
        />
      )}

      {currentStep === 'heat_loss' && (
        <HeatLossStep
          state={heatLossState}
          onChange={setHeatLossState}
          onNext={next}
          onPrev={prev}
          engineHeatLossW={input.heatLossWatts ?? null}
        />
      )}

      {currentStep === 'solar_assessment' && (
        <SolarAssessmentStep
          state={heatLossState}
          onChange={setHeatLossState}
          onNext={next}
          onPrev={prev}
        />
      )}

      {currentStep === 'priorities' && (
        <PrioritiesStep
          state={prioritiesState}
          onChange={setPrioritiesState}
          onNext={next}
          onPrev={prev}
        />
      )}

      {currentStep === 'insight' && (
        <InsightLayerPage
          systemBuilder={systemBuilderState}
          home={usageState}
          input={{
            ...input,
            fullSurvey: {
              ...input.fullSurvey,
              heatLoss: heatLossState,
            },
          }}
          priorities={prioritiesState}
          onNext={next}
          onPrev={prev}
          onOpenSimulator={onOpenSimulator != null ? () => {
            const draft = buildDraft();
            const engineInput = toEngineInput(sanitiseModelForEngine(draft));
            if (onDraft) onDraft(draft);
            onOpenSimulator(engineInput);
          } : undefined}
        />
      )}

      {currentStep === 'quotes' && (
        <QuoteCollectionStep
          onNext={next}
          onPrev={prev}
          onOpenSpecification={() => {
            // Save draft before leaving the stepper to enter the specification.
            if (onDraft) onDraft(buildDraft());
          }}
        />
      )}


    </div>
  );
}

