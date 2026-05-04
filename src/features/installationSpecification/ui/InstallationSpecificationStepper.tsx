/**
 * InstallationSpecificationStepper.tsx
 *
 * Main stepper shell for the Atlas Installation Specification.
 *
 * Manages draft state across the specification steps and renders the active
 * step with Back / Next navigation.
 *
 * Step sequence (active steps derived from proposed system selection):
 *   1.  current_system_summary  — read-only current system from canonical survey
 *   2.  proposed_heat_source    — proposed heat source (always)
 *   3.  proposed_hot_water      — proposed hot-water arrangement (skipped for proposed combi)
 *   4.  job_type                — derived classification (always)
 *   5.  place_locations         — key locations (always)
 *   [for gas boiler proposed]:
 *   6.  flue_plan
 *   7.  condensate_plan
 *   8.  pipework_plan
 *   [for heat pump proposed]:
 *   6.  outdoor_unit_siting
 *   7.  hydraulic_route
 *   8.  electrical_supply
 *   9.  generated_scope         — always (last step)
 *
 * Design rules:
 *   - Current system data comes exclusively from the canonicalCurrentSystem prop.
 *     The stepper does NOT collect current system data — the canonical survey is
 *     the single source of truth.
 *   - "Correct canonical survey" navigates back to the survey flow via onCorrectSurvey.
 *   - Proposed specification is seeded from Atlas recommendation via seedProposedSystem.
 */

import { useState, useMemo } from 'react';
import { SpecificationProgress } from './SpecificationProgress';
import { CurrentSystemSummaryStep } from './steps/CurrentSystemSummaryStep';
import { ProposedSystemStep } from './steps/ProposedSystemStep';
import { ProposedHotWaterStep } from './steps/ProposedHotWaterStep';
import { JobTypeStep } from './steps/JobTypeStep';
import { PlaceLocationsStep } from './steps/PlaceLocationsStep';
import { FluePlanStep } from './steps/FluePlanStep';
import { CondensateSpecificationStep } from './steps/CondensateSpecificationStep';
import { PipeworkPlanStep } from './steps/PipeworkPlanStep';
import { GeneratedScopeStep } from './steps/GeneratedScopeStep';
import { classifyQuoteJob } from '../calculators/jobClassification';
import { buildQuoteScopeFromInstallationPlan } from '../scope/buildQuoteScopeFromInstallationPlan';
import {
  heatSourceToFamily,
  isProposedCombi,
  isGasBoilerProposedHeatSource,
  proposedHeatSourceToKind,
  proposedHotWaterToKind,
  currentHeatSourceToKind,
  currentHotWaterToKind,
  kindToProposedHeatSource,
  kindToProposedHotWater,
} from './installationSpecificationUiTypes';
import type {
  CanonicalCurrentSystemSummary,
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
  InstallationSpecificationSystemV1,
  InstallationSpecificationOptionV1,
  InstallationSpecificationFinishResultV1,
  InstallationSpecificationOptionStatusV1,
} from '../model/QuoteInstallationPlanV1';
import type { ObjectPinV2 } from '../../scanImport/contracts/sessionCaptureV2';
import './installationSpecificationStyles.css';

// ─── Step ID types ────────────────────────────────────────────────────────────

type StepId =
  | 'current_system_summary'
  | 'proposed_heat_source'
  | 'proposed_hot_water'
  | 'job_type'
  | 'place_locations'
  | 'flue_plan'
  | 'condensate_plan'
  | 'pipework_plan'
  | 'outdoor_unit_siting'
  | 'hydraulic_route'
  | 'electrical_supply'
  | 'generated_scope';

/** Short display labels shown in the progress pill strip. */
const STEP_LABELS: Record<StepId, string> = {
  current_system_summary:  'Current system',
  proposed_heat_source:    'Proposed heat source',
  proposed_hot_water:      'Proposed hot water',
  job_type:                'Location change',
  place_locations:         'Key locations',
  flue_plan:               'Flue specification',
  condensate_plan:         'Condensate specification',
  pipework_plan:           'Pipework specification',
  outdoor_unit_siting:     'Outdoor unit siting',
  hydraulic_route:         'Hydraulic route',
  electrical_supply:       'Electrical supply',
  generated_scope:         'Generated scope',
};

// ─── Active step derivation ───────────────────────────────────────────────────

/**
 * Derive the ordered list of active step IDs from the proposed system selection.
 *
 * Steps are omitted (skipped) based on:
 * - proposed_hot_water: skip when proposed heat source is combi/storage_combi or not yet set
 * - flue/condensate/pipework: only for gas boiler proposed
 * - outdoor_unit/hydraulic/electrical: only for heat pump proposed
 */
function getActiveStepIds(
  proposedHeatSource: UiProposedHeatSourceLabel | null,
): StepId[] {
  const steps: StepId[] = ['current_system_summary', 'proposed_heat_source'];

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
  canonicalHeatSource: CanonicalCurrentSystemSummary['heatSource'],
  proposedHeatSource: UiProposedHeatSourceLabel | null,
): QuoteJobClassificationV1 {
  const currentFamily = canonicalHeatSource != null ? heatSourceToFamily(canonicalHeatSource) : 'unknown';
  const proposedFamily = proposedHeatSource != null ? heatSourceToFamily(proposedHeatSource) : 'unknown';
  return classifyQuoteJob(
    { family: currentFamily },
    { family: proposedFamily },
  );
}

// ─── Spec builders ────────────────────────────────────────────────────────────

/**
 * Build the layered proposed-system spec for the plan snapshot.
 * Called whenever the surveyor has selected a proposed heat source.
 * Populated as soon as proposedHeatSource is set so partial scope can be generated.
 */
function buildProposedSpec(
  proposedHeatSource: UiProposedHeatSourceLabel,
  proposedHotWater: UiProposedHotWaterLabel | null,
): InstallationSpecificationSystemV1 {
  const heatSourceKind = proposedHeatSourceToKind(proposedHeatSource);
  const hotWaterKind = isProposedCombi(proposedHeatSource)
    ? 'instantaneous_from_combi'
    : proposedHotWater != null
      ? proposedHotWaterToKind(proposedHotWater)
      : 'none';
  return {
    heatSource: { kind: heatSourceKind },
    hotWater:   { kind: hotWaterKind },
  };
}

/**
 * Build the layered current-system spec from canonical survey data.
 * Used to populate scope generation with removal and conversion decisions.
 */
function buildCurrentSpec(
  canonical: CanonicalCurrentSystemSummary | null | undefined,
): InstallationSpecificationSystemV1 | undefined {
  if (canonical?.heatSource == null) return undefined;
  return {
    heatSource:     { kind: currentHeatSourceToKind(canonical.heatSource) },
    hotWater:       { kind: canonical.hotWater != null ? currentHotWaterToKind(canonical.hotWater) : 'none' },
    primaryCircuit: canonical.primaryCircuit != null ? { kind: canonical.primaryCircuit } : undefined,
  };
}

// ─── Option status derivation ─────────────────────────────────────────────────

/**
 * Derive the lifecycle status for a specification option from its generated scope.
 *
 * complete         — scope items present and no items need verification.
 * needs_decision   — scope items present but one or more need on-site verification.
 * in_progress      — no scope items generated yet.
 */
function deriveOptionStatus(scope: QuoteScopeItemV1[]): InstallationSpecificationOptionStatusV1 {
  if (scope.length === 0) return 'in_progress';
  if (scope.some((i) => i.needsVerification)) return 'needs_decision';
  return 'complete';
}

// ─── InstallationSpecificationStepper ────────────────────────────────────────

export interface InstallationSpecificationStepperProps {
  /** Called when the surveyor taps Back on the first step (exits the specification). */
  onBack: () => void;
  /**
   * Called when the surveyor taps "Correct canonical survey".
   * Should navigate back to the survey flow — must not silently edit spec data.
   */
  onCorrectSurvey?: () => void;
  /**
   * Current system data from the canonical survey.
   * When absent or fields are null, the summary step shows
   * "Missing from canonical survey" for those fields.
   * The stepper does NOT collect this data — it reads it from here only.
   */
  canonicalCurrentSystem?: CanonicalCurrentSystemSummary | null;
  /**
   * Optional proposed heat-source value seeded from the Atlas recommendation.
   * When provided, ProposedSystemStep pre-selects this tile and shows an "Atlas selected" badge.
   */
  seedProposedSystem?: UiProposedHeatSourceLabel | null;
  /**
   * Optional floor-plan image URI (from the scan session).
   * When provided, the Place Locations step shows the floor plan overlay.
   */
  floorPlanUri?: string;
  /**
   * Object pins captured during the scan session.
   * When provided, pins with recognised types (boiler, cylinder, gas_meter, flue)
   * are surfaced as "Suggested Location" cards in the Place Locations step.
   */
  scanObjectPins?: ObjectPinV2[];
  /**
   * Stable identifier of the specification option being edited.
   * When provided, Finish updates this option rather than creating a new one.
   */
  optionId?: string;
  /**
   * Human-readable label for the option being edited (e.g. "Option A").
   * Used in the Finish result.  Defaults to 'Option' when absent.
   */
  optionLabel?: string;
  /**
   * ISO-8601 creation timestamp for the option being edited.
   * Preserved verbatim in the Finish result.  Defaults to now when absent.
   */
  optionCreatedAt?: string;
  /**
   * Source of the option being edited.
   * Preserved verbatim in the Finish result.  Defaults to 'surveyor_variant'.
   */
  optionSource?: InstallationSpecificationOptionV1['source'];
  /**
   * Whether this option is the Atlas-recommended route.
   * Preserved verbatim in the Finish result.
   */
  optionIsRecommended?: boolean;
  /**
   * Existing specification option to restore stepper state from.
   * When provided, the stepper is pre-populated with the option's plan data.
   */
  initialPlan?: QuoteInstallationPlanV1;
  /**
   * Called when the surveyor taps Finish on the last step.
   * Receives the built option with generated scope and derived status.
   * Must never be a no-op — if absent the stepper falls back to onBack.
   */
  onFinish?: (result: InstallationSpecificationFinishResultV1) => void;
}

export function InstallationSpecificationStepper({
  onBack,
  onCorrectSurvey,
  canonicalCurrentSystem,
  seedProposedSystem,
  floorPlanUri,
  scanObjectPins,
  optionId,
  optionLabel = 'Option',
  optionCreatedAt,
  optionSource = 'surveyor_variant',
  optionIsRecommended,
  initialPlan,
  onFinish,
}: InstallationSpecificationStepperProps) {
  const [currentStep, setCurrentStep] = useState(0);
  // Show a save-confirmation banner briefly after Finish.
  const [savedBanner, setSavedBanner] = useState(false);

  // Restore proposed heat source from initialPlan when editing an existing option,
  // otherwise seed from Atlas recommendation prop.
  const restoredProposedHeatSource = useMemo<UiProposedHeatSourceLabel | null>(() => {
    if (initialPlan?.proposedSpec?.heatSource) {
      return kindToProposedHeatSource(initialPlan.proposedSpec.heatSource.kind);
    }
    return seedProposedSystem ?? null;
  }, [initialPlan, seedProposedSystem]);

  const restoredProposedHotWater = useMemo<UiProposedHotWaterLabel | null>(() => {
    if (initialPlan?.proposedSpec?.hotWater) {
      return kindToProposedHotWater(initialPlan.proposedSpec.hotWater.kind);
    }
    return null;
  }, [initialPlan]);

  // Proposed heat source — seeded from Atlas recommendation or restored from plan
  const [proposedHeatSource, setProposedHeatSource] = useState<UiProposedHeatSourceLabel | null>(
    restoredProposedHeatSource,
  );
  const [ashpExceptionNote, setAshpExceptionNote] = useState('');

  // Proposed hot water — restored from plan when editing
  const [proposedHotWater, setProposedHotWater] = useState<UiProposedHotWaterLabel | null>(
    restoredProposedHotWater,
  );

  // Other plan state — restored from initialPlan when editing
  const [locations, setLocations] = useState<QuotePlanLocationV1[]>(
    initialPlan?.locations ?? [],
  );
  const [flueRoute, setFlueRoute] = useState<QuotePlanCandidateFlueRouteV1 | null>(
    initialPlan?.flueRoutes?.[0] ?? null,
  );
  const [condensateRoute, setCondensateRoute] = useState<QuotePlanCondensateRouteV1 | undefined>(
    initialPlan?.condensateRoute,
  );
  const [pipeworkRoutes, setPipeworkRoutes] = useState<QuotePlanPipeworkRouteV1[]>(
    initialPlan?.pipeworkRoutes ?? [],
  );

  // Derive active step list from proposed system selection.
  const stepIds = useMemo(
    () => getActiveStepIds(proposedHeatSource),
    [proposedHeatSource],
  );

  const stepLabelList = useMemo(
    () => stepIds.map((id) => STEP_LABELS[id]),
    [stepIds],
  );

  // Derive job classification.
  const jobClassification = useMemo(
    () => deriveClassification(canonicalCurrentSystem?.heatSource ?? null, proposedHeatSource),
    [canonicalCurrentSystem, proposedHeatSource],
  );

  // Whether the current canonical heat source is heat pump and proposed is gas — exception needed.
  const isHeatPumpToGasException =
    canonicalCurrentSystem?.heatSource === 'heat_pump' &&
    proposedHeatSource != null &&
    isGasBoilerProposedHeatSource(proposedHeatSource);

  // Build layered spec objects for scope generation.
  const proposedSpec = useMemo<InstallationSpecificationSystemV1 | undefined>(() => {
    if (proposedHeatSource == null) return undefined;
    return buildProposedSpec(proposedHeatSource, proposedHotWater);
  }, [proposedHeatSource, proposedHotWater]);

  const currentSpec = useMemo<InstallationSpecificationSystemV1 | undefined>(
    () => buildCurrentSpec(canonicalCurrentSystem),
    [canonicalCurrentSystem],
  );

  // Build plan snapshot for scope generation.
  // proposedSpec is set as soon as proposed heat source is selected, enabling
  // partial scope display before all steps are complete.
  const planSnapshot = useMemo<QuoteInstallationPlanV1>(() => ({
    planId:           'stepper-snapshot',
    createdAt:        '',
    currentSystem:    {
      family: canonicalCurrentSystem?.heatSource != null
        ? heatSourceToFamily(canonicalCurrentSystem.heatSource)
        : 'unknown',
    },
    proposedSystem:   {
      family: proposedHeatSource != null ? heatSourceToFamily(proposedHeatSource) : 'unknown',
    },
    currentSpec,
    proposedSpec,
    locations,
    routes:           [],
    flueRoutes:       flueRoute ? [flueRoute] : [],
    condensateRoute,
    pipeworkRoutes,
    jobClassification,
    generatedScope:   [],
  }), [
    canonicalCurrentSystem,
    proposedHeatSource,
    proposedSpec,
    currentSpec,
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
      case 'current_system_summary':
        // Read-only step — always can advance.
        return true;
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

  /**
   * Build and save the current specification option, then notify the caller.
   * This is the Finish action — it must never be a no-op.
   *
   * If onFinish is provided it is called with the built result.
   * If onFinish is absent, falls back to onBack so the app is never locked.
   */
  function handleFinish() {
    const now = new Date().toISOString();
    const scope = buildQuoteScopeFromInstallationPlan(planSnapshot);
    const status = deriveOptionStatus(scope);

    const id = optionId ?? `opt-${now.replace(/[^0-9]/g, '')}`;

    const option: InstallationSpecificationOptionV1 = {
      id,
      label: optionLabel,
      createdAt: optionCreatedAt ?? now,
      updatedAt: now,
      status,
      source: optionSource,
      isRecommended: optionIsRecommended,
      specification: { ...planSnapshot, planId: id },
      generatedScope: scope,
    };

    const result: InstallationSpecificationFinishResultV1 = { option, generatedScope: scope, status };

    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);

    if (onFinish) {
      onFinish(result);
    } else {
      // Fallback — never lock the user inside the stepper.
      onBack();
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
      case 'current_system_summary':
        return (
          <CurrentSystemSummaryStep
            summary={canonicalCurrentSystem ?? null}
            onCorrectSurvey={onCorrectSurvey}
          />
        );

      case 'proposed_heat_source':
        return (
          <ProposedSystemStep
            selected={proposedHeatSource}
            seedValue={seedProposedSystem}
            currentHeatSource={canonicalCurrentSystem?.heatSource ?? null}
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
        if (proposedHeatSource == null) return null;
        return (
          <ProposedHotWaterStep
            proposedHeatSource={proposedHeatSource}
            selected={proposedHotWater}
            onSelect={setProposedHotWater}
          />
        );

      case 'job_type':
        return (
          <JobTypeStep
            classification={jobClassification}
            currentHeatSource={canonicalCurrentSystem?.heatSource ?? null}
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
            scanObjectPins={scanObjectPins}
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
      {savedBanner && (
        <div
          className="spec-saved-banner"
          role="status"
          aria-live="polite"
          data-testid="spec-saved-banner"
        >
          ✓ Installation Specification saved.
        </div>
      )}
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
          onClick={currentStep < totalSteps - 1 ? handleNext : handleFinish}
          disabled={!canAdvance}
          aria-disabled={!canAdvance}
        >
          {currentStep < totalSteps - 1 ? 'Next →' : 'Finish'}
        </button>
      </div>
    </div>
  );
}

