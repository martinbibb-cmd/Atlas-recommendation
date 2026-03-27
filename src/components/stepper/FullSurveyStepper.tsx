import { useState, useEffect } from 'react';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
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
import LivePhysicsOverlay, { type OverlayStepKey } from '../../ui/overlay/LivePhysicsOverlay';
import DeltaStrip from '../../ui/panels/DeltaStrip';
import HeatLossCalculator from '../heatloss/HeatLossCalculator';
import { SystemBuilderStep } from '../../features/survey/systemBuilder/SystemBuilderStep';
import { INITIAL_SYSTEM_BUILDER_STATE } from '../../features/survey/systemBuilder/systemBuilderTypes';
import { ServicesStep } from '../../features/survey/services/ServicesStep';
import { INITIAL_WATER_QUALITY_STATE } from '../../features/survey/services/waterQualityTypes';
import { UsageStep } from '../../features/survey/usage/UsageStep';
import { INITIAL_HOME_STATE } from '../../features/survey/usage/usageTypes';

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
}

type Step = 'system_builder' | 'usage' | 'services';
/** Legacy steps are preserved in the component body for their engine/physics logic,
 *  but are no longer part of the active V2 survey flow. */
const STEPS: Step[] = ['system_builder', 'usage', 'services'];

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

/** Z-index for full-screen overlays rendered above the stepper. */
const OVERLAY_Z_INDEX = 1000;

export default function FullSurveyStepper({ onBack, prefill, onComplete, onDraft }: Props) {
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
  const [results, setResults] = useState<FullEngineResult | null>(null);
  const [mode, setMode] = useState<'stepper' | 'hub'>('stepper');
  const [showHeatLossCalc, setShowHeatLossCalc] = useState(false);

  // Live physics overlay: runs a lightweight engine pass on every step for real-time feedback.
  // Debounced so it doesn't block every keystroke.
  const [liveEngineOutput, setLiveEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [prevEngineOutput, setPrevEngineOutput] = useState<EngineOutputV1 | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const engineInput = toEngineInput(sanitiseModelForEngine(input));
      const out = runEngine(engineInput);
      setLiveEngineOutput(prev => {
        setPrevEngineOutput(prev);
        return out.engineOutput;
      });
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

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

  // The overlay panel is not shown in the V2 survey flow — all legacy steps
  // that used it (location, pressure, hot_water) are no longer active.
  const overlayStepKey: OverlayStepKey | null = null;


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
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  // Scroll to top whenever the active step changes so the user always sees the
  // top of the new step — prevents "mid-page carryover" between steps.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentStep]);

  /** Build a draft that embeds compareMixergy, systemBuilder, waterQuality, and usage into fullSurvey for persistence. */
  const buildDraft = (): FullSurveyModelV1 => ({
    ...input,
    fullSurvey: {
      ...input.fullSurvey,
      compareMixergy,
      systemBuilder: systemBuilderState,
      waterQuality: waterQualityState,
      usage: usageState,
    },
  });

  const next = () => {
    if (stepIndex === STEPS.length - 1) {
      // Last survey step — run the engine and advance to results.
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

  // Heat loss calculator overlay — shown above the stepper when triggered.
  if (showHeatLossCalc) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: OVERLAY_Z_INDEX, overflowY: 'auto', background: '#f8fafc' }}>
        <HeatLossCalculator
          onBack={() => setShowHeatLossCalc(false)}
          onComplete={(totalHL) => {
            setInput(prev => ({ ...prev, heatLossWatts: Math.round(totalHL * 1000) }));
            setShowHeatLossCalc(false);
          }}
        />
      </div>
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
        <span className="step-label">Step {stepIndex + 1} of {STEPS.length}</span>
      </div>

      {/* Live physics overlay — shown on steps that have a step key mapping */}
      {liveEngineOutput && overlayStepKey && (
        <div style={{ maxWidth: '100%' }}>
          <DeltaStrip previous={prevEngineOutput} current={liveEngineOutput} />
          <LivePhysicsOverlay
            engineOutput={liveEngineOutput}
            activeStepKey={overlayStepKey}
          />
        </div>
      )}



      {currentStep === 'services' && (
        <ServicesStep
          state={waterQualityState}
          surveyPostcode={input.postcode}
          onChange={setWaterQualityState}
          onNext={next}
          onPrev={prev}
          showDebugOutput={true}
          nextLabel="Run Full Analysis →"
          staticPressureBar={input.staticMainsPressureBar}
          dynamicPressureBar={input.dynamicMainsPressureBar ?? input.dynamicMainsPressure}
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



    </div>
  );
}

