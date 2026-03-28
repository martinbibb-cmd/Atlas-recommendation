/**
 * ExplainersHubPage — entry point for the canonical System Simulator.
 *
 * PR6:  Added SimulatorStepper setup journey before the simulator dashboard.
 * PR16: Added survey-backed entry — when surveyData is provided, the stepper
 *       is skipped and the simulator opens pre-configured from survey inputs.
 *       An "Edit setup" button lets users re-enter the stepper at any time.
 * PR5:  Survey-backed entry now defaults to compare mode (current vs proposed)
 *       via buildCompareSeedFromSurvey, making comparison the primary Atlas
 *       demonstration rather than a hidden secondary feature.
 * PR5b: Physics Explainers and Energy Literacy panels moved into GlobalMenuShell
 *       via context registration — no longer rendered inline in the dashboard.
 * PR-SIM-FIX: Removed legacy SurveyFamilyDashboard / SelectedFamilyDashboard
 *       branch.  All survey-backed entries now unconditionally render the
 *       canonical SimulatorDashboard (system diagram, house view, draw-off
 *       behaviour, efficiency, system limiters, system behaviour, system inputs).
 */

import { useState, useMemo, useEffect } from 'react';
import SimulatorDashboard from './lego/simulator/SimulatorDashboard';
import type { FloorplanOperatingAssumptions } from './lego/simulator/SimulatorDashboard';
import type { SimulatorSystemChoice } from './lego/simulator/useSystemDiagramPlayback';
import SimulatorStepper from './lego/simulator/SimulatorStepper';
import type { StepperConfig } from './lego/simulator/SimulatorStepper';
import { adaptFullSurveyToSimulatorInputs } from './lego/simulator/adaptFullSurveyToSimulatorInputs';
import type { OccupancyProfile, SystemInputs } from './lego/simulator/systemInputsTypes';
import type { FullSurveyModelV1 } from '../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import ExplainerPanel from './educational/ExplainerPanel';
import { EnergyLiteracyPanel } from '../features/explainers/energy';
import type { DerivedFloorplanOutput } from '../components/floorplan/floorplanDerivations';
import { runEngine } from '../engine/Engine';
import { buildCompareSeedFromSurvey } from '../lib/simulator/buildCompareSeedFromSurvey';
import { adaptFloorplanToAtlasInputs } from '../lib/floorplan/adaptFloorplanToAtlasInputs';
import { buildHeatingOperatingState, FLOOR_PLAN_EMITTER_EXPLANATION_TAGS } from '../lib/heating/buildHeatingOperatingState';
import { useGlobalMenu } from '../components/shell/GlobalMenuContext';
import type { GlobalMenuSection } from '../components/shell/GlobalMenuContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
  /**
   * Called when the user clicks "Edit setup" in survey-backed mode.
   * When provided, clicking "Edit setup" calls this callback instead of
   * showing the internal stepper — allowing the parent to navigate back to
   * the originating survey/setup context (e.g. FullSurveyStepper or VisitPage).
   * When absent, the legacy stepper-within-hub behaviour is used.
   */
  onEditSetup?: () => void;
  /**
   * Engine input used to pre-configure the simulator.  Accepts either a
   * completed EngineInputV2_3 (e.g. from the Full Survey or Fast Choice) or
   * a full FullSurveyModelV1 that includes extended survey diagnostics.
   * When provided, the stepper is hidden by default; users can still access
   * it via "Edit setup".
   */
  surveyData?: EngineInputV2_3 | FullSurveyModelV1;
  /**
   * When provided, a secondary "System Lab" action is shown in the dashboard
   * header so users can navigate to the compare/sandbox area.
   */
  onOpenSystemLab?: () => void;
  /**
   * When provided and surveyData is present, an "In-room presentation" action
   * is shown so surveyors can navigate to PresentationFlow from the simulator.
   */
  onOpenPresentation?: () => void;
  /**
   * Optional floor-plan derived outputs from the FloorPlanBuilder.
   * When provided, the simulator and advice page surface which physics
   * assumptions are informed by the floor plan (heat loss, emitter coverage,
   * operating temperature).
   */
  floorplanOutput?: DerivedFloorplanOutput;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Derives FloorplanOperatingAssumptions from a DerivedFloorplanOutput so the
 * SimulatorDashboard can surface which physics constraints come from the floor
 * plan (refined heat loss, emitter coverage, operating temperature).
 */
function buildFloorplanOperatingAssumptions(
  floorplanOutput: DerivedFloorplanOutput,
  heatLossWatts?: number,
): FloorplanOperatingAssumptions | null {
  const fp = adaptFloorplanToAtlasInputs(floorplanOutput);
  if (!fp.isReliable) return null;
  const adequacy = fp.wholeSystemEmitterAdequacy;
  const fpOperatingState = adequacy.hasActualData
    ? buildHeatingOperatingState({ flowTempC: 70, floorplanEmitterAdequacy: adequacy, heatLossWatts })
    : null;
  const emitterExplanationTags =
    fpOperatingState?.explanationTags.filter((t) => FLOOR_PLAN_EMITTER_EXPLANATION_TAGS.has(t)) ?? [];
  return {
    refinedHeatLossKw: fp.refinedHeatLossKw > 0 ? fp.refinedHeatLossKw : null,
    coverageClassification: adequacy.hasActualData ? adequacy.coverageClassification : null,
    undersizedRooms: adequacy.undersizedRooms,
    oversizedRooms: adequacy.oversizedRooms,
    operatingTempInfluenced:
      adequacy.hasActualData &&
      adequacy.impliedOversizingFactor !== null &&
      adequacy.impliedOversizingFactor !== 1.0,
    emitterExplanationTags,
  };
}

// ─── View ─────────────────────────────────────────────────────────────────────

/**
 * Human-readable labels for each SimulatorSystemChoice.
 * Used to build compare-mode column headings that are specific to the
 * surveyed and recommended systems (e.g. "Combi boiler" / "Heat pump").
 */
const SYSTEM_CHOICE_LABEL: Record<SimulatorSystemChoice, string> = {
  combi:       'Combi boiler',
  unvented:    'Unvented cylinder',
  open_vented: 'Open vented cylinder',
  heat_pump:   'Heat pump',
  mixergy:     'Mixergy cylinder',
};

export default function ExplainersHubPage({ onBack, onEditSetup, surveyData, onOpenSystemLab, onOpenPresentation, floorplanOutput }: Props) {
  const [config, setConfig] = useState<StepperConfig | null>(null);
  // When launched from a survey, hide the stepper by default.
  const [showStepper, setShowStepper] = useState<boolean>(!surveyData);

  // Adapt survey data once when present.
  // The adapter accepts FullSurveyModelV1; EngineInputV2_3 satisfies it because
  // FullSurveyModelV1 = EngineInputV2_3 & { optionalExtras? } — missing extras
  // are handled gracefully by the adapter's optional-chaining guards.
  const surveyAdapted = useMemo(
    () => (surveyData != null ? adaptFullSurveyToSimulatorInputs(surveyData as FullSurveyModelV1) : null),
    [surveyData],
  );

  // Run the engine once when survey data is present so the compare seed can
  // seed the proposed (right) column with the Atlas recommendation.
  const engineResult = useMemo(
    () => (surveyData != null ? runEngine(surveyData as EngineInputV2_3) : null),
    [surveyData],
  );

  // Compare seed — left = current (surveyed) system, right = proposed recommendation.
  const compareSeed = useMemo(
    () =>
      surveyData != null && engineResult != null
        ? buildCompareSeedFromSurvey(surveyData as FullSurveyModelV1, engineResult.engineOutput)
        : null,
    [surveyData, engineResult],
  );

  // Floor-plan operating assumptions for the simulator badge / overlays.
  const floorplanOperatingAssumptions = useMemo(
    () =>
      floorplanOutput != null
        ? buildFloorplanOperatingAssumptions(
            floorplanOutput,
            (surveyData as EngineInputV2_3 | undefined)?.heatLossWatts,
          )
        : null,
    [floorplanOutput, surveyData],
  );

  // Show dashboard when:
  //   (a) survey-backed entry (surveyAdapted present and stepper not explicitly requested), or
  //   (b) stepper has completed and config is set.
  const showDashboard = !showStepper && (surveyAdapted != null || config != null);

  // ── Global menu sections (Physics Explainers + Energy Literacy) ─────────────
  // Registered when the dashboard is shown so they appear in the global menu
  // instead of inline below the simulator panels.
  const { setContextMenuSections } = useGlobalMenu();

  const dashboardMenuSections = useMemo<GlobalMenuSection[]>(
    () => [
      { id: 'physics-explainers', label: 'Physics Explainers', content: <ExplainerPanel /> },
      { id: 'energy-literacy',    label: 'Energy Literacy',    content: <EnergyLiteracyPanel /> },
    ],
    [],
  );

  useEffect(() => {
    if (!showDashboard) {
      setContextMenuSections([]);
      return;
    }
    setContextMenuSections(dashboardMenuSections);
    return () => setContextMenuSections([]);
  }, [showDashboard, dashboardMenuSections, setContextMenuSections]);

  if (showDashboard) {
    const isSurveyBacked = surveyAdapted != null && !config;
    const initialSystemChoice = surveyAdapted != null && isSurveyBacked
      ? surveyAdapted.systemChoice
      : (config?.systemChoice ?? 'combi');

    // Build initialSystemInputs:
    // - Survey-backed: use surveyAdapted.systemInputs (occupancyProfile derived from survey)
    // - Stepper-based: derive occupancyProfile from the numeric config.occupancy entered in the
    //   stepper, and also wire controlStrategy and condition from the stepper config.
    const initialSystemInputs: Partial<SystemInputs> | undefined = (() => {
      if (surveyAdapted != null && isSurveyBacked) return surveyAdapted.systemInputs;
      if (config == null) return undefined;
      const occupancyProfile: OccupancyProfile =
        config.occupancy >= 5 ? 'family' :
        config.occupancy >= 3 ? 'steady_home' :
        'professional';
      return {
        occupancyProfile,
        controlStrategy: config.controlStrategy,
        systemCondition: config.condition === 'poor' ? 'sludged' : 'clean',
      };
    })();

    return (
      <div className="hub-page">
        <div className="hub-page__header">
          {onBack && (
            <button className="hub-back-btn" onClick={onBack}>← Back</button>
          )}
          {isSurveyBacked ? (
            <button
              className="hub-back-btn"
              onClick={onEditSetup != null ? onEditSetup : () => setShowStepper(true)}
              aria-label="Edit simulator setup"
            >
              ⚙ Edit setup
            </button>
          ) : (
            <button
              className="hub-back-btn"
              onClick={() => { setConfig(null); setShowStepper(true); }}
              aria-label="Home"
            >
              ⚙ Home
            </button>
          )}
          {onOpenSystemLab && (
            <button
              className="hub-back-btn"
              onClick={onOpenSystemLab}
              aria-label="Open System Summary"
            >
              🔭 System Summary
            </button>
          )}
          {onOpenPresentation != null && isSurveyBacked && (
            <button
              className="hub-back-btn"
              onClick={onOpenPresentation}
              aria-label="Open in-room presentation"
            >
              ▶ Presentation
            </button>
          )}
          <div>
            <h1 className="hub-page__title">Simulator</h1>
            <p className="hub-page__subtitle">Live taps, heating, and full system diagram</p>
          </div>
        </div>

        {/* ── Canonical SimulatorDashboard — the one true simulator surface ── */}
        <SimulatorDashboard
          initialSystemChoice={initialSystemChoice}
          initialSystemInputs={initialSystemInputs}
          surveyBacked={isSurveyBacked}
          defaultMode={isSurveyBacked ? 'compare' : 'single'}
          initialProposedSystemChoice={compareSeed?.right.systemChoice}
          initialProposedSystemInputs={compareSeed?.right.systemInputs}
          compareLabels={
            compareSeed != null
              ? {
                  current:  SYSTEM_CHOICE_LABEL[compareSeed.left.systemChoice]  ?? 'Current system',
                  proposed: SYSTEM_CHOICE_LABEL[compareSeed.right.systemChoice] ?? 'Proposed system',
                }
              : undefined
          }
          floorplanOperatingAssumptions={floorplanOperatingAssumptions ?? undefined}
        />

      </div>
    );
  }

  // Show stepper (either standalone entry or "Edit setup" from survey-backed mode).
  return (
    <div className="hub-page">
      <div className="hub-page__header">
        {onBack && (
          <button className="hub-back-btn" onClick={onBack}>← Back</button>
        )}
        {surveyAdapted != null && (
          <button
            className="hub-back-btn"
            onClick={() => setShowStepper(false)}
            aria-label="Back to setup"
          >
            ← Back to setup
          </button>
        )}
        <div>
          <h1 className="hub-page__title">Simulator</h1>
          <p className="hub-page__subtitle">Live taps, heating, and full system diagram</p>
        </div>
      </div>

      <SimulatorStepper
        onComplete={(cfg) => {
          setConfig(cfg);
          setShowStepper(false);
        }}
      />
    </div>
  );
}
