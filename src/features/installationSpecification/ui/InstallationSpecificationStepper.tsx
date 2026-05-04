/**
 * InstallationSpecificationStepper.tsx
 *
 * Main stepper shell for the Atlas Installation Specification.
 *
 * Manages draft state across the layered system selection steps and renders
 * the active step with Back / Next navigation.
 *
 * Step sequence (active steps derived from selections):
 *   1.  current_system       — existence: has/no/partial wet heating
 *   2.  current_heat_source  — heat-source appliance (skipped when no_wet_heating)
 *   3.  current_hot_water    — cylinder/storage type (skipped for combi or no source)
 *   4.  current_primary_circuit — primary circuit type (skipped for non-boiler sources)
 *   5.  proposed_heat_source — proposed heat source (always)
 *   6.  proposed_hot_water   — proposed hot-water arrangement (skipped for proposed combi)
 *   7.  job_type             — derived classification (always)
 *   8.  place_locations      — key locations (always)
 *   [for gas boiler proposed]:
 *   9.  flue_plan
 *   10. condensate_plan
 *   11. pipework_plan
 *   [for heat pump proposed]:
 *   9.  outdoor_unit_siting
 *   10. hydraulic_route
 *   11. electrical_supply
 *   12. generated_scope      — always (last step)
 */

import { useState, useMemo } from 'react';
import { SpecificationProgress } from './SpecificationProgress';
import { CurrentSystemStep } from './steps/CurrentSystemStep';
import { CurrentHeatSourceStep } from './steps/CurrentHeatSourceStep';
import { CurrentHotWaterStep } from './steps/CurrentHotWaterStep';
import { CurrentPrimaryCircuitStep } from './steps/CurrentPrimaryCircuitStep';
import { ProposedSystemStep } from './steps/ProposedSystemStep';
import { ProposedHotWaterStep } from './steps/ProposedHotWaterStep';
import { JobTypeStep } from './steps/JobTypeStep';
import { PlaceLocationsStep } from './steps/PlaceLocationsStep';
import { FluePlanStep } from './steps/FluePlanStep';
import { CondensateSpecificationStep } from './steps/CondensateSpecificationStep';
import { PipeworkPlanStep } from './steps/PipeworkPlanStep';
import { GeneratedScopeStep } from './steps/GeneratedScopeStep';
import { classifyQuoteJob } from '../calculators/jobClassification';
import {
  heatSourceToFamily,
  isCombiHeatSource,
  isProposedCombi,
  isBoilerHeatSource,
  isGasBoilerProposedHeatSource,
} from './installationSpecificationUiTypes';
import type {
  UiExistenceLabel,
  UiCurrentHeatSourceLabel,
  UiCurrentHotWaterLabel,
  UiCurrentPrimaryCircuitLabel,
  UiProposedHeatSourceLabel,
  UiProposedHotWaterLabel,
} from './installationSpecificationUiTypes';
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

// ─── Step ID types ────────────────────────────────────────────────────────────

const ALL_STEP_IDS = [
  'current_system',
  'current_heat_source',
  'current_hot_water',
  'current_primary_circuit',
  'proposed_heat_source',
  'proposed_hot_water',
  'job_type',
  'place_locations',
  'flue_plan',
  'condensate_plan',
  'pipework_plan',
  'outdoor_unit_siting',
  'hydraulic_route',
  'electrical_supply',
  'generated_scope',
] as const;

type StepId = typeof ALL_STEP_IDS[number];

/** Short display labels shown in the progress pill strip. */
const STEP_LABELS: Record<StepId, string> = {
  current_system:           'Current system',
  current_heat_source:      'Current heat source',
  current_hot_water:        'Current hot water',
  current_primary_circuit:  'Primary circuit',
  proposed_heat_source:     'Proposed heat source',
  proposed_hot_water:       'Proposed hot water',
  job_type:                 'Location change',
  place_locations:          'Key locations',
  flue_plan:                'Flue specification',
  condensate_plan:          'Condensate specification',
  pipework_plan:            'Pipework specification',
  outdoor_unit_siting:      'Outdoor unit siting',
  hydraulic_route:          'Hydraulic route',
  electrical_supply:        'Electrical supply',
  generated_scope:          'Generated scope',
};

// ─── Active step derivation ───────────────────────────────────────────────────

/**
 * Derive the ordered list of active step IDs from the current selection state.
 *
 * Steps are omitted (skipped) based on:
 * - current_heat_source: skip when existence is 'no_wet_heating'
 * - current_hot_water: skip when current heat source is combi/storage_combi/none/direct_electric/warm_air
 * - current_primary_circuit: skip when current heat source is not a boiler type
 * - proposed_hot_water: skip when proposed heat source is combi/storage_combi or not yet set
 * - flue/condensate/pipework: only for gas boiler proposed
 * - outdoor_unit/hydraulic/electrical: only for heat pump proposed
 */
function getActiveStepIds(
  existenceLabel: UiExistenceLabel | null,
  currentHeatSource: UiCurrentHeatSourceLabel | null,
  proposedHeatSource: UiProposedHeatSourceLabel | null,
): StepId[] {
  const steps: StepId[] = ['current_system'];

  // current_heat_source — skip when no wet heating
  const hasWetHeating = existenceLabel === 'has_wet_heating' || existenceLabel === 'partial_abandoned';
  if (hasWetHeating) {
    steps.push('current_heat_source');
  }

  // current_hot_water — skip for combi, direct_electric, warm_air, none, or when no heat source
  if (
    hasWetHeating &&
    currentHeatSource != null &&
    !isCombiHeatSource(currentHeatSource) &&
    currentHeatSource !== 'none' &&
    currentHeatSource !== 'direct_electric' &&
    currentHeatSource !== 'warm_air'
  ) {
    steps.push('current_hot_water');
  }

  // current_primary_circuit — only for boiler-type heat sources
  if (
    hasWetHeating &&
    currentHeatSource != null &&
    isBoilerHeatSource(currentHeatSource)
  ) {
    steps.push('current_primary_circuit');
  }

  // Proposed heat source — always
  steps.push('proposed_heat_source');

  // proposed_hot_water — skip when proposed is combi or storage_combi
  if (
    proposedHeatSource != null &&
    !isProposedCombi(proposedHeatSource)
  ) {
    steps.push('proposed_hot_water');
  }

  // Job type — always
  steps.push('job_type');

  // Place locations — always
  steps.push('place_locations');

  // Route steps depend on proposed heat source
  if (proposedHeatSource === 'heat_pump') {
    steps.push('outdoor_unit_siting', 'hydraulic_route', 'electrical_supply');
  } else {
    // Gas boiler or other — show flue/condensate/pipework
    steps.push('flue_plan', 'condensate_plan', 'pipework_plan');
  }

  // Generated scope — always
  steps.push('generated_scope');

  return steps;
}

// ─── Classification derivation ────────────────────────────────────────────────

function deriveClassification(
  currentHeatSource: UiCurrentHeatSourceLabel | null,
  proposedHeatSource: UiProposedHeatSourceLabel | null,
): QuoteJobClassificationV1 {
  const currentFamily = currentHeatSource != null ? heatSourceToFamily(currentHeatSource) : 'unknown';
  const proposedFamily = proposedHeatSource != null ? heatSourceToFamily(proposedHeatSource) : 'unknown';
  return classifyQuoteJob(
    { family: currentFamily },
    { family: proposedFamily },
  );
}

// ─── InstallationSpecificationStepper ────────────────────────────────────────

export interface InstallationSpecificationStepperProps {
  /** Called when the engineer taps Back on the first step (exits the specification). */
  onBack: () => void;
  /**
   * Optional proposed heat-source value seeded from the Atlas recommendation.
   * When provided, ProposedSystemStep pre-selects this tile and shows an "Atlas Pick" badge.
   */
  seedProposedSystem?: UiProposedHeatSourceLabel | null;
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

  // Step 1: existence
  const [existenceLabel, setExistenceLabel] = useState<UiExistenceLabel | null>(null);
  const [existenceExceptionNote, setExistenceExceptionNote] = useState('');

  // Step 2: current heat source
  const [currentHeatSource, setCurrentHeatSource] = useState<UiCurrentHeatSourceLabel | null>(null);
  const [heatSourceExceptionNote, setHeatSourceExceptionNote] = useState('');

  // Step 3: current hot water
  const [currentHotWater, setCurrentHotWater] = useState<UiCurrentHotWaterLabel | null>(null);

  // Step 4: current primary circuit
  const [currentPrimaryCircuit, setCurrentPrimaryCircuit] = useState<UiCurrentPrimaryCircuitLabel | null>(null);

  // Step 5: proposed heat source
  const [proposedHeatSource, setProposedHeatSource] = useState<UiProposedHeatSourceLabel | null>(
    seedProposedSystem ?? null,
  );
  const [ashpExceptionNote, setAshpExceptionNote] = useState('');

  // Step 6: proposed hot water
  const [proposedHotWater, setProposedHotWater] = useState<UiProposedHotWaterLabel | null>(null);

  // Other plan state
  const [locations, setLocations] = useState<QuotePlanLocationV1[]>([]);
  const [flueRoute, setFlueRoute] = useState<QuotePlanCandidateFlueRouteV1 | null>(null);
  const [condensateRoute, setCondensateRoute] = useState<QuotePlanCondensateRouteV1 | undefined>(undefined);
  const [pipeworkRoutes, setPipeworkRoutes] = useState<QuotePlanPipeworkRouteV1[]>([]);

  // Derive active step list from current selections.
  const stepIds = useMemo(
    () => getActiveStepIds(existenceLabel, currentHeatSource, proposedHeatSource),
    [existenceLabel, currentHeatSource, proposedHeatSource],
  );

  const stepLabelList = useMemo(
    () => stepIds.map((id) => STEP_LABELS[id]),
    [stepIds],
  );

  // Derive job classification.
  const jobClassification = useMemo(
    () => deriveClassification(currentHeatSource, proposedHeatSource),
    [currentHeatSource, proposedHeatSource],
  );

  // Whether the current heat source is heat pump and proposed is gas — exception needed.
  const isHeatPumpToGasException =
    currentHeatSource === 'heat_pump' &&
    proposedHeatSource != null &&
    isGasBoilerProposedHeatSource(proposedHeatSource);

  // Build plan snapshot for scope generation.
  const planSnapshot = useMemo<QuoteInstallationPlanV1>(() => ({
    planId:         'stepper-snapshot',
    createdAt:      '',
    currentSystem:  {
      family: currentHeatSource != null ? heatSourceToFamily(currentHeatSource) : 'unknown',
    },
    proposedSystem: {
      family: proposedHeatSource != null ? heatSourceToFamily(proposedHeatSource) : 'unknown',
    },
    locations,
    routes:         [],
    flueRoutes:     flueRoute ? [flueRoute] : [],
    condensateRoute,
    pipeworkRoutes,
    jobClassification,
    generatedScope: [],
  }), [
    currentHeatSource,
    proposedHeatSource,
    locations,
    flueRoute,
    condensateRoute,
    pipeworkRoutes,
    jobClassification,
  ]);

  const totalSteps = stepIds.length;
  const stepId = stepIds[currentStep];

  // Whether the current step has been completed (enables Next button).
  const canAdvance: boolean = (() => {
    switch (stepId) {
      case 'current_system': {
        if (existenceLabel === null) {
          // Allow advance via exception only if note is non-empty.
          return existenceExceptionNote.trim().length > 0;
        }
        return true;
      }
      case 'current_heat_source': {
        if (currentHeatSource === null) return heatSourceExceptionNote.trim().length > 0;
        return true;
      }
      case 'current_hot_water':
        return currentHotWater !== null;
      case 'current_primary_circuit':
        return currentPrimaryCircuit !== null;
      case 'proposed_heat_source': {
        if (proposedHeatSource === null) return false;
        if (isHeatPumpToGasException) return ashpExceptionNote.trim().length > 0;
        return true;
      }
      case 'proposed_hot_water':
        return proposedHotWater !== null;
      default:
        return true;
    }
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
            selected={existenceLabel}
            exceptionNote={existenceExceptionNote}
            onSelect={(val) => {
              setExistenceLabel(val);
              setExistenceExceptionNote('');
              // When no wet heating, clear dependent selections.
              if (val === 'no_wet_heating') {
                setCurrentHeatSource(null);
                setCurrentHotWater(null);
                setCurrentPrimaryCircuit(null);
              }
            }}
            onExceptionNoteChange={setExistenceExceptionNote}
            onClearSelection={() => {
              setExistenceLabel(null);
              setExistenceExceptionNote('');
            }}
          />
        );

      case 'current_heat_source':
        return (
          <CurrentHeatSourceStep
            selected={currentHeatSource}
            exceptionNote={heatSourceExceptionNote}
            onSelect={(val) => {
              setCurrentHeatSource(val);
              setHeatSourceExceptionNote('');
              // Clear downstream selections when heat source changes.
              setCurrentHotWater(null);
              setCurrentPrimaryCircuit(null);
            }}
            onExceptionNoteChange={setHeatSourceExceptionNote}
            onClearSelection={() => {
              setCurrentHeatSource(null);
              setHeatSourceExceptionNote('');
            }}
          />
        );

      case 'current_hot_water':
        return (
          <CurrentHotWaterStep
            selected={currentHotWater}
            onSelect={setCurrentHotWater}
          />
        );

      case 'current_primary_circuit':
        return (
          <CurrentPrimaryCircuitStep
            selected={currentPrimaryCircuit}
            onSelect={setCurrentPrimaryCircuit}
          />
        );

      case 'proposed_heat_source':
        return (
          <ProposedSystemStep
            selected={proposedHeatSource}
            seedValue={seedProposedSystem}
            currentHeatSource={currentHeatSource}
            onSelect={(val) => {
              setProposedHeatSource(val);
              // Clear proposed hot water when proposed heat source changes.
              setProposedHotWater(null);
            }}
            ashpExceptionNote={ashpExceptionNote}
            onAshpExceptionNoteChange={setAshpExceptionNote}
          />
        );

      case 'proposed_hot_water':
        return (
          <ProposedHotWaterStep
            proposedHeatSource={proposedHeatSource!}
            selected={proposedHotWater}
            onSelect={setProposedHotWater}
          />
        );

      case 'job_type':
        return (
          <JobTypeStep
            classification={jobClassification}
            currentHeatSource={currentHeatSource}
            proposedHeatSource={proposedHeatSource}
            proposedHotWater={proposedHotWater}
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
