/**
 * InstallationSpecificationStepper.tsx
 *
 * Main stepper shell for the Atlas Installation Specification.
 *
 * Manages the draft state (current system, proposed system, derived job
 * classification) and renders the active step with Back / Next navigation.
 *
 * The active step list is derived from the proposed system family:
 *   - Gas boiler families: current system → proposed system → job type →
 *     key locations → flue → condensate → pipework → scope
 *   - Heat pump:           current system → proposed system → job type →
 *     key locations → outdoor unit siting → hydraulic route →
 *     electrical supply → scope
 *
 * Design rules:
 *   - Does not alter any recommendation decision.
 *   - Does not add customer-facing output surfaces.
 *   - Classification is derived deterministically from the two system selections.
 *   - seedFamily (optional) pre-fills ProposedSystemStep from the recommendation.
 */

import { useState, useMemo } from 'react';
import { SpecificationProgress } from './SpecificationProgress';
import { CurrentSystemStep } from './steps/CurrentSystemStep';
import { ProposedSystemStep } from './steps/ProposedSystemStep';
import { JobTypeStep } from './steps/JobTypeStep';
import { PlaceLocationsStep } from './steps/PlaceLocationsStep';
import { FluePlanStep } from './steps/FluePlanStep';
import { CondensateSpecificationStep } from './steps/CondensateSpecificationStep';
import { PipeworkPlanStep } from './steps/PipeworkPlanStep';
import { GeneratedScopeStep } from './steps/GeneratedScopeStep';
import { classifyQuoteJob } from '../calculators/jobClassification';
import { uiLabelToFamily, isGasBoilerProposedValue } from './installationSpecificationUiTypes';
import type { UiCurrentSystemLabel, UiProposedSystemLabel } from './installationSpecificationUiTypes';
import type { QuoteJobClassificationV1 } from '../calculators/quotePlannerTypes';
import type {
  QuoteInstallationPlanV1,
  QuotePlanLocationV1,
  QuotePlanCandidateFlueRouteV1,
  QuotePlanPipeworkRouteV1,
  QuotePlanCondensateRouteV1,
  QuoteScopeItemV1,
} from '../model/QuoteInstallationPlanV1';
import './installationSpecificationStyles.css';

// ─── Step definitions ─────────────────────────────────────────────────────────

/** Steps used for gas boiler specification paths. */
const GAS_BOILER_STEP_IDS = [
  'current_system',
  'proposed_system',
  'job_type',
  'place_locations',
  'flue_plan',
  'condensate_plan',
  'pipework_plan',
  'generated_scope',
] as const;

/** Steps used for heat-pump specification paths. */
const HEAT_PUMP_STEP_IDS = [
  'current_system',
  'proposed_system',
  'job_type',
  'place_locations',
  'outdoor_unit_siting',
  'hydraulic_route',
  'electrical_supply',
  'generated_scope',
] as const;

type GasBoilerStepId = typeof GAS_BOILER_STEP_IDS[number];
type HeatPumpStepId  = typeof HEAT_PUMP_STEP_IDS[number];
type StepId = GasBoilerStepId | HeatPumpStepId;

/** Short display labels shown in the progress pill strip. */
const STEP_LABELS: Record<StepId, string> = {
  current_system:      'Current system',
  proposed_system:     'Proposed system',
  job_type:            'Location change',
  place_locations:     'Key locations',
  flue_plan:           'Flue specification',
  condensate_plan:     'Condensate specification',
  pipework_plan:       'Pipework specification',
  outdoor_unit_siting: 'Outdoor unit siting',
  hydraulic_route:     'Hydraulic route',
  electrical_supply:   'Electrical supply',
  generated_scope:     'Generated scope',
};

/** Returns the ordered step ID list for the given proposed system. */
function getStepIds(proposedLabel: UiProposedSystemLabel | null): readonly StepId[] {
  return proposedLabel === 'heat_pump' ? HEAT_PUMP_STEP_IDS : GAS_BOILER_STEP_IDS;
}

// ─── Classification derivation ────────────────────────────────────────────────

function deriveClassification(
  currentLabel: UiCurrentSystemLabel | null,
  proposedLabel: UiProposedSystemLabel | null,
): QuoteJobClassificationV1 {
  const currentFamily = currentLabel != null ? uiLabelToFamily(currentLabel) : 'unknown';
  const proposedFamily = proposedLabel != null ? uiLabelToFamily(proposedLabel) : 'unknown';
  return classifyQuoteJob(
    { family: currentFamily },
    { family: proposedFamily },
  );
}

// ─── InstallationSpecificationStepper ────────────────────────────────────────

export interface InstallationSpecificationStepperProps {
  /**
   * Called when the engineer taps Back on the first step (exits the specification).
   */
  onBack: () => void;
  /**
   * Optional proposed-system value seeded from the Atlas recommendation.
   * When provided, ProposedSystemStep pre-selects this tile and shows an
   * "Atlas Pick" badge.  Does not change the recommendation decision.
   */
  seedProposedSystem?: UiProposedSystemLabel | null;
  /**
   * Optional floor-plan image URI (from the scan session).
   * When provided, the Place Locations step shows the floor plan overlay.
   */
  floorPlanUri?: string;
}

export function InstallationSpecificationStepper({
  onBack,
  seedProposedSystem,
  floorPlanUri,
}: InstallationSpecificationStepperProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCurrentSystem, setSelectedCurrentSystem] =
    useState<UiCurrentSystemLabel | null>(null);
  const [selectedProposedSystem, setSelectedProposedSystem] =
    useState<UiProposedSystemLabel | null>(seedProposedSystem ?? null);
  // Exception-path note — required when selectedCurrentSystem === 'unknown'.
  const [exceptionNote, setExceptionNote] = useState('');
  // ASHP-to-gas override note — required when current is heat_pump and surveyor
  // selects a gas system via the technical review exception.
  const [ashpExceptionNote, setAshpExceptionNote] = useState('');
  const [locations, setLocations] = useState<QuotePlanLocationV1[]>([]);
  const [flueRoute, setFlueRoute] = useState<QuotePlanCandidateFlueRouteV1 | null>(null);
  const [condensateRoute, setCondensateRoute] = useState<QuotePlanCondensateRouteV1 | undefined>(undefined);
  const [pipeworkRoutes, setPipeworkRoutes] = useState<QuotePlanPipeworkRouteV1[]>([]);

  // Derive job classification whenever system selections change.
  const jobClassification = useMemo(
    () => deriveClassification(selectedCurrentSystem, selectedProposedSystem),
    [selectedCurrentSystem, selectedProposedSystem],
  );

  // Active step list derived from proposed system family.
  const stepIds = useMemo(
    () => getStepIds(selectedProposedSystem),
    [selectedProposedSystem],
  );
  const stepLabelList = useMemo(
    () => stepIds.map((id) => STEP_LABELS[id]),
    [stepIds],
  );

  // Build a minimal plan snapshot for scope generation.  Only the fields
  // consumed by buildQuoteScopeFromInstallationPlan are populated here.
  const planSnapshot = useMemo<QuoteInstallationPlanV1>(() => ({
    planId:          'stepper-snapshot',
    createdAt:       '',
    currentSystem:   {
      family: selectedCurrentSystem != null ? uiLabelToFamily(selectedCurrentSystem) : 'unknown',
    },
    proposedSystem:  {
      family: selectedProposedSystem != null ? uiLabelToFamily(selectedProposedSystem) : 'unknown',
    },
    locations,
    routes:          [],
    flueRoutes:      flueRoute ? [flueRoute] : [],
    condensateRoute,
    pipeworkRoutes,
    jobClassification,
    generatedScope:  [],
  }), [
    selectedCurrentSystem,
    selectedProposedSystem,
    locations,
    flueRoute,
    condensateRoute,
    pipeworkRoutes,
    jobClassification,
  ]);

  const totalSteps = stepIds.length;
  const stepId = stepIds[currentStep];

  // Whether the current system is heat_pump and the surveyor has selected a gas system
  // via the ASHP exception flow — requires a non-empty exception note.
  const isHeatPumpToGasException =
    selectedCurrentSystem === 'heat_pump' &&
    selectedProposedSystem != null &&
    isGasBoilerProposedValue(selectedProposedSystem);

  // Next is disabled when the active step requires a selection and none is made.
  const canAdvance: boolean = (() => {
    if (stepId === 'current_system') {
      if (selectedCurrentSystem === null) return false;
      if (selectedCurrentSystem === 'unknown') return exceptionNote.trim().length > 0;
      return true;
    }
    if (stepId === 'proposed_system') {
      if (selectedProposedSystem === null) return false;
      // ASHP → gas requires the exception note.
      if (isHeatPumpToGasException) return ashpExceptionNote.trim().length > 0;
      return true;
    }
    return true;
  })();

  function handleBack() {
    if (currentStep === 0) {
      onBack();
    } else {
      setCurrentStep((s) => s - 1);
    }
  }

  function handleNext() {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  }

  // Navigate back to the step identified by a source step ID from a scope item.
  function handleNavigateToStep(sourceStepId: NonNullable<QuoteScopeItemV1['sourceStepId']>) {
    const index = stepIds.indexOf(sourceStepId as StepId);
    if (index !== -1) {
      setCurrentStep(index);
    }
  }

  // ── Render active step ──────────────────────────────────────────────────────

  function renderStep() {
    switch (stepId) {
      case 'current_system':
        return (
          <CurrentSystemStep
            selected={selectedCurrentSystem}
            exceptionNote={exceptionNote}
            onSelect={(val) => {
              setSelectedCurrentSystem(val);
              // Clear stale proposed selection unless it was seeded from the recommendation.
              if (seedProposedSystem == null) {
                setSelectedProposedSystem(null);
              }
              // Clear the exception note when a real system tile is selected.
              if (val !== 'unknown') {
                setExceptionNote('');
              }
            }}
            onExceptionNoteChange={setExceptionNote}
            onClearSelection={() => {
              setSelectedCurrentSystem(null);
              setExceptionNote('');
            }}
          />
        );

      case 'proposed_system':
        return (
          <ProposedSystemStep
            selected={selectedProposedSystem}
            seedValue={seedProposedSystem}
            currentSystemLabel={selectedCurrentSystem}
            onSelect={setSelectedProposedSystem}
            ashpExceptionNote={ashpExceptionNote}
            onAshpExceptionNoteChange={setAshpExceptionNote}
          />
        );

      case 'job_type':
        return (
          <JobTypeStep
            classification={jobClassification}
            currentSystemLabel={selectedCurrentSystem}
            proposedSystemLabel={selectedProposedSystem}
          />
        );

      case 'place_locations':
        return (
          <PlaceLocationsStep
            locations={locations}
            onLocationsChange={setLocations}
            floorPlanUri={floorPlanUri}
            jobClassification={jobClassification}
          />
        );

      case 'flue_plan':
        return (
          <FluePlanStep
            flueRoute={flueRoute}
            onFlueRouteChange={setFlueRoute}
            locations={locations}
          />
        );

      case 'condensate_plan':
        return (
          <CondensateSpecificationStep
            condensateRoute={condensateRoute ?? null}
            onCondensateRouteChange={(route) => setCondensateRoute(route)}
          />
        );

      case 'pipework_plan':
        return (
          <PipeworkPlanStep
            pipeworkRoutes={pipeworkRoutes}
            onRoutesChange={setPipeworkRoutes}
            floorPlanUri={floorPlanUri}
          />
        );

      case 'outdoor_unit_siting':
        return (
          <div className="spec-ashp-placeholder" data-testid="ashp-outdoor-unit-siting">
            <h2 className="qp-step-heading">Outdoor unit siting</h2>
            <p className="qp-step-subheading">
              Specify the proposed outdoor unit location, access requirements, and siting constraints.
            </p>
            <p className="qp-context-hint">
              Outdoor unit siting detail — not yet specified.
            </p>
          </div>
        );

      case 'hydraulic_route':
        return (
          <div className="spec-ashp-placeholder" data-testid="ashp-hydraulic-route">
            <h2 className="qp-step-heading">Hydraulic route</h2>
            <p className="qp-step-subheading">
              Specify the hydraulic connection route from the outdoor unit to the indoor unit or cylinder.
            </p>
            <p className="qp-context-hint">
              Hydraulic route detail — not yet specified.
            </p>
          </div>
        );

      case 'electrical_supply':
        return (
          <div className="spec-ashp-placeholder" data-testid="ashp-electrical-supply">
            <h2 className="qp-step-heading">Electrical supply</h2>
            <p className="qp-step-subheading">
              Specify the electrical supply route and supply requirements for the outdoor unit.
            </p>
            <p className="qp-context-hint">
              Electrical supply route — not yet specified.
            </p>
          </div>
        );

      case 'generated_scope':
        return (
          <GeneratedScopeStep
            plan={planSnapshot}
            onNavigateToStep={handleNavigateToStep}
          />
        );
    }
  }

  return (
    <div className="qp-page">
      <SpecificationProgress steps={stepLabelList} currentStep={currentStep} />
      <div className="qp-content">
        {renderStep()}
      </div>
      <div className="qp-nav">
        <button type="button" className="qp-nav__back" onClick={handleBack}>
          ← Back
        </button>
        <button
          type="button"
          className="qp-nav__next"
          onClick={handleNext}
          disabled={!canAdvance}
          aria-disabled={!canAdvance}
        >
          {currentStep < totalSteps - 1 ? 'Next →' : 'Finish'}
        </button>
      </div>
    </div>
  );
}

