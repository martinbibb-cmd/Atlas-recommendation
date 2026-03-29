import { useState, useEffect } from 'react';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { sanitiseModelForEngine } from '../../ui/fullSurvey/sanitiseModelForEngine';
import { runEngine } from '../../engine/Engine';
import {
  type WallType,
  type InsulationLevel,
  type AirTightness,
  type Glazing,
  type RoofInsulation,
  type ThermalMass,
} from '../../engine/presets/FabricPresets';
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
import { InsightLayerPage } from '../../features/survey/insight/InsightLayerPage';
import {
  type SurveyStepId,
  SURVEY_STEP_IDS,
  SURVEY_STEP_COUNT,
  getStepMeta,
  progressLabel,
} from '../../config/surveyStepRegistry';

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
}

// Step type and ordered sequence derived from the canonical registry.
type Step = SurveyStepId;
const STEPS: readonly SurveyStepId[] = SURVEY_STEP_IDS;

// ─── Fabric Behaviour Controls ────────────────────────────────────────────────
// Two independent physics dimensions:
//   A) Fabric heat-loss (wall type, insulation, glazing, roof, airtightness)
//   B) Thermal inertia (mass — separate from wall type)












/** Map thermal mass to buildingMass for the engine contract. */
function deriveBuildingMass(mass: ThermalMass): EngineInputV2_3['buildingMass'] {
  return mass; // ThermalMass values match BuildingMass values exactly
}

const defaultInput: FullSurveyModelV1 = {
  postcode: '',
  dynamicMainsPressure: 1.0,
  buildingMass: 'heavy',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
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

export default function FullSurveyStepper({ onBack, prefill, onComplete, onDraft, onOpenSimulator }: Props) {
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
  const [results, setResults] = useState<FullEngineResult | null>(null);
  const [mode, setMode] = useState<'stepper' | 'hub'>('stepper');

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

  // ── Fabric simulation controls ─────────────────────────────────────────────
  // Section A (heat loss): wall, insulation, glazing, roof, airtightness
  // Section B (inertia): thermalMass (independent from wall type)
  //
  // When a prefill is present with building.fabric / building.thermalMass values,
  // the individual controls are initialised directly from those saved values so
  // that a reload/navigate-away-back round-trip restores the exact fabric state
  // the surveyor had selected.  The back-mapping from engine types to UI types:
  //   'cavity_filled'   → 'cavity_insulated'
  //   'cavity_unfilled' → 'cavity_uninsulated'
  //   'timber_frame'    → 'timber_lightweight'
  //   'solid_masonry'   → 'solid_masonry'
  //   'passive'         → 'passive_level'   (airTightness only)
  const prefillFabric = prefill?.building?.fabric;
  const prefillThermalMass = prefill?.building?.thermalMass;

  const [wallType] = useState<WallType>(() => {
    const fw = prefillFabric?.wallType;
    if (fw === 'cavity_filled')   return 'cavity_insulated';
    if (fw === 'cavity_unfilled') return 'cavity_uninsulated';
    if (fw === 'timber_frame')    return 'timber_lightweight';
    if (fw === 'solid_masonry')   return 'solid_masonry';
    return 'solid_masonry';
  });
  const [insulationLevel] = useState<InsulationLevel>(() => {
    const fi = prefillFabric?.insulationLevel;
    if (fi === 'poor' || fi === 'moderate' || fi === 'good' || fi === 'exceptional') return fi;
    return 'moderate';
  });
  const [airTightness] = useState<AirTightness>(() => {
    const fa = prefillFabric?.airTightness;
    if (fa === 'passive') return 'passive_level';
    if (fa === 'leaky' || fa === 'average' || fa === 'tight') return fa;
    return 'average';
  });
  const [glazing] = useState<Glazing>(() => {
    const fg = prefillFabric?.glazing;
    if (fg === 'single' || fg === 'double' || fg === 'triple') return fg;
    return 'single';
  });
  const [roofInsulation] = useState<RoofInsulation>(() => {
    const fr = prefillFabric?.roofInsulation;
    if (fr === 'poor' || fr === 'moderate' || fr === 'good') return fr;
    return 'poor';
  });
  const [thermalMass] = useState<ThermalMass>(() => {
    const tm = prefillThermalMass;
    if (tm === 'light' || tm === 'medium' || tm === 'heavy') return tm;
    return 'heavy';
  });




  // Keep buildingMass and building.fabric in engine input in sync with the fabric controls
  useEffect(() => {
    const wallTypeForEngine =
      wallType === 'solid_masonry'        ? 'solid_masonry' :
      wallType === 'cavity_insulated'     ? 'cavity_filled' :
      wallType === 'cavity_uninsulated'   ? 'solid_masonry' :
      'timber_frame' as const;
    const airTightnessForEngine =
      airTightness === 'passive_level' ? 'passive' : airTightness as 'leaky' | 'average' | 'tight';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(prev => ({
      ...prev,
      buildingMass: deriveBuildingMass(thermalMass),
      building: {
        fabric: {
          wallType:       wallTypeForEngine,
          insulationLevel,
          glazing,
          roofInsulation,
          airTightness:   airTightnessForEngine,
        },
        thermalMass,
      },
    }));
  }, [wallType, insulationLevel, airTightness, glazing, roofInsulation, thermalMass]);







  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / SURVEY_STEP_COUNT) * 100;
  const currentMeta = getStepMeta(currentStep);

  // Scroll to top whenever the active step changes so the user always sees the
  // top of the new step — prevents "mid-page carryover" between steps.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentStep]);

  /** Build a draft that embeds compareMixergy, systemBuilder, waterQuality, usage, priorities, and heatLoss into fullSurvey for persistence. */
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
    },
  });

  const next = () => {
    if (currentStep === 'insight') {
      // Insight is the last step — run the engine and advance to results.
      const draft = buildDraft();
      const engineInput = toEngineInput(sanitiseModelForEngine(draft));
      if (onDraft) onDraft(draft);
      if (onComplete) {
        // Route directly to the simulator dashboard without stopping at LiveHubPage.
        onComplete(engineInput);
        return;
      }
      const engineResult = runEngine(engineInput);
      setResults(engineResult);
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
        input={input}
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

      {currentStep === 'heat_loss' && (
        <HeatLossStep
          state={heatLossState}
          onChange={setHeatLossState}
          onNext={next}
          onPrev={prev}
          engineHeatLossW={input.heatLossWatts ?? null}
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



    </div>
  );
}

