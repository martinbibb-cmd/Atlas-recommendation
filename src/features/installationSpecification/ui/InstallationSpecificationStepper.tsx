/**
 * InstallationSpecificationStepper.tsx
 *
 * Main stepper shell for the Atlas Installation Specification.
 *
 * Manages the draft state (current system, proposed system, derived job
 * classification) and renders the active step with Back / Next navigation.
 *
 * Steps 1–3 are fully interactive; steps 4–8 show placeholder content until
 * later PRs provide the route-drawing UI.
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
import { PipeworkPlanStep } from './steps/PipeworkPlanStep';
import { GeneratedScopeStep } from './steps/GeneratedScopeStep';
import { classifyQuoteJob } from '../calculators/jobClassification';
import { uiLabelToFamily } from './installationSpecificationUiTypes';
import type { UiCurrentSystemLabel, UiProposedSystemLabel } from './installationSpecificationUiTypes';
import type { QuoteJobClassificationV1 } from '../calculators/quotePlannerTypes';
import type {
  QuoteInstallationPlanV1,
  QuotePlanLocationV1,
  QuotePlanCandidateFlueRouteV1,
  QuotePlanPipeworkRouteV1,
  QuoteScopeItemV1,
} from '../model/QuoteInstallationPlanV1';
import './installationSpecificationStyles.css';

// ─── Step definitions ─────────────────────────────────────────────────────────

/** The ordered list of step identifiers. */
const STEP_IDS = [
  'current_system',
  'proposed_system',
  'job_type',
  'place_locations',
  'flue_plan',
  'condensate_plan',
  'pipework_plan',
  'generated_scope',
] as const;

type StepId = typeof STEP_IDS[number];

/** Short display labels shown in the progress pill strip. */
const STEP_LABELS: Record<StepId, string> = {
  current_system:   'Current system',
  proposed_system:  'Proposed system',
  job_type:         'Location change',
  place_locations:  'Key locations',
  flue_plan:        'Flue specification',
  condensate_plan:  'Condensate specification',
  pipework_plan:    'Pipework specification',
  generated_scope:  'Generated scope',
};

const STEP_LABEL_LIST = STEP_IDS.map((id) => STEP_LABELS[id]);

// ─── Placeholder steps ────────────────────────────────────────────────────────

interface PlaceholderStepProps {
  icon: string;
  label: string;
}

function PlaceholderStep({ icon, label }: PlaceholderStepProps) {
  return (
    <>
      <div className="qp-placeholder">
        <span className="qp-placeholder__icon" aria-hidden="true">{icon}</span>
        <span className="qp-placeholder__label">{label}</span>
      </div>
    </>
  );
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
  const [locations, setLocations] = useState<QuotePlanLocationV1[]>([]);
  const [flueRoute, setFlueRoute] = useState<QuotePlanCandidateFlueRouteV1 | null>(null);
  const [pipeworkRoutes, setPipeworkRoutes] = useState<QuotePlanPipeworkRouteV1[]>([]);

  // Derive job classification whenever system selections change.
  const jobClassification = useMemo(
    () => deriveClassification(selectedCurrentSystem, selectedProposedSystem),
    [selectedCurrentSystem, selectedProposedSystem],
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
    pipeworkRoutes,
    jobClassification,
    generatedScope:  [],
  }), [
    selectedCurrentSystem,
    selectedProposedSystem,
    locations,
    flueRoute,
    pipeworkRoutes,
    jobClassification,
  ]);

  const totalSteps = STEP_IDS.length;
  const stepId = STEP_IDS[currentStep];

  // Next is disabled when the active step requires a selection and none is made.
  // When the exception path is taken (unknown), a note must be provided.
  const canAdvance: boolean = (() => {
    if (stepId === 'current_system') {
      if (selectedCurrentSystem === null) return false;
      if (selectedCurrentSystem === 'unknown') return exceptionNote.trim().length > 0;
      return true;
    }
    if (stepId === 'proposed_system') return selectedProposedSystem !== null;
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
    const index = STEP_IDS.indexOf(sourceStepId);
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
          <>
            <h2 className="qp-step-heading">Condensate specification</h2>
            <PlaceholderStep icon="🪣" label="Condensate route planning coming in the next release." />
          </>
        );

      case 'pipework_plan':
        return (
          <PipeworkPlanStep
            pipeworkRoutes={pipeworkRoutes}
            onRoutesChange={setPipeworkRoutes}
            floorPlanUri={floorPlanUri}
          />
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
      <SpecificationProgress steps={STEP_LABEL_LIST} currentStep={currentStep} />
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
