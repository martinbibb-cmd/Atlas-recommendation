/**
 * QuotePlannerStepper.tsx
 *
 * Main stepper shell for the Atlas Quote Planner.
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
import { QuotePlannerProgress } from './QuotePlannerProgress';
import { CurrentSystemStep } from './steps/CurrentSystemStep';
import { ProposedSystemStep } from './steps/ProposedSystemStep';
import { JobTypeStep } from './steps/JobTypeStep';
import { PlaceLocationsStep } from './steps/PlaceLocationsStep';
import { classifyQuoteJob } from '../calculators/jobClassification';
import { uiLabelToFamily } from './quotePlannerUiTypes';
import type { UiCurrentSystemLabel, UiProposedSystemLabel } from './quotePlannerUiTypes';
import type { QuoteJobClassificationV1 } from '../calculators/quotePlannerTypes';
import type { QuotePlanLocationV1 } from '../model/QuoteInstallationPlanV1';
import './quotePlannerStyles.css';

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
  current_system:   'Current',
  proposed_system:  'Proposed',
  job_type:         'Job type',
  place_locations:  'Locations',
  flue_plan:        'Flue',
  condensate_plan:  'Condensate',
  pipework_plan:    'Pipework',
  generated_scope:  'Scope',
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

// ─── QuotePlannerStepper ──────────────────────────────────────────────────────

export interface QuotePlannerStepperProps {
  /**
   * Called when the engineer taps Back on the first step (exits the planner).
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

export function QuotePlannerStepper({
  onBack,
  seedProposedSystem,
  floorPlanUri,
}: QuotePlannerStepperProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCurrentSystem, setSelectedCurrentSystem] =
    useState<UiCurrentSystemLabel | null>(null);
  const [selectedProposedSystem, setSelectedProposedSystem] =
    useState<UiProposedSystemLabel | null>(seedProposedSystem ?? null);
  const [locations, setLocations] = useState<QuotePlanLocationV1[]>([]);

  // Derive job classification whenever system selections change.
  const jobClassification = useMemo(
    () => deriveClassification(selectedCurrentSystem, selectedProposedSystem),
    [selectedCurrentSystem, selectedProposedSystem],
  );

  const totalSteps = STEP_IDS.length;
  const stepId = STEP_IDS[currentStep];

  // Next is disabled when the active step requires a selection and none is made.
  const canAdvance: boolean = (() => {
    if (stepId === 'current_system') return selectedCurrentSystem !== null;
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

  // ── Render active step ──────────────────────────────────────────────────────

  function renderStep() {
    switch (stepId) {
      case 'current_system':
        return (
          <CurrentSystemStep
            selected={selectedCurrentSystem}
            onSelect={(val) => {
              setSelectedCurrentSystem(val);
              // When the engineer selects a system, clear any stale proposed
              // selection that was based on a previous current-system choice —
              // unless the proposed selection was seeded from the recommendation.
              if (seedProposedSystem == null) {
                setSelectedProposedSystem(null);
              }
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
          <>
            <h2 className="qp-step-heading">Flue plan</h2>
            <PlaceholderStep icon="🔩" label="Flue route planning coming in the next release." />
          </>
        );

      case 'condensate_plan':
        return (
          <>
            <h2 className="qp-step-heading">Condensate plan</h2>
            <PlaceholderStep icon="🪣" label="Condensate route planning coming in the next release." />
          </>
        );

      case 'pipework_plan':
        return (
          <>
            <h2 className="qp-step-heading">Pipework plan</h2>
            <PlaceholderStep icon="🔧" label="Pipework route planning coming in the next release." />
          </>
        );

      case 'generated_scope':
        return (
          <>
            <h2 className="qp-step-heading">Generated scope</h2>
            <PlaceholderStep icon="📋" label="Scope generation coming in the next release." />
          </>
        );
    }
  }

  return (
    <div className="qp-page">
      <QuotePlannerProgress steps={STEP_LABEL_LIST} currentStep={currentStep} />
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
