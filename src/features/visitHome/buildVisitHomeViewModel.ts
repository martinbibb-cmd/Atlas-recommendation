import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { detectVisitJourney, type VisitJourneyInfo } from './detectVisitJourney';

export type VisitHomeSurfaceStatus = 'ready' | 'needs-review' | 'blocked';

export interface BuildVisitHomeViewModelInput {
  readonly engineResult?: EngineOutputV1;
  readonly acceptedScenario?: ScenarioResult;
  readonly scenarios?: ScenarioResult[];
  readonly surveyModel?: FullSurveyModelV1;
  readonly recommendationSummary?: CustomerSummaryV1;
  readonly workflowReadiness: {
    readonly hasVisit: boolean;
    readonly libraryUnsafe: boolean;
    readonly installationSpecOptionCount: number;
  };
  readonly outputAvailability: {
    readonly hasPortalOutput: boolean;
    readonly hasSupportingPdfOutput: boolean;
    readonly hasHandoffReview: boolean;
    readonly hasExportPackage: boolean;
  };
  readonly simulatorAvailability: {
    readonly hasSimulatorSurface: boolean;
  };
}

export interface VisitHomeViewModel {
  readonly hasRecommendation: boolean;
  readonly hasAcceptedScenario: boolean;
  readonly hasSurveyModel: boolean;
  readonly recommendationStatus: VisitHomeSurfaceStatus;
  readonly portalStatus: VisitHomeSurfaceStatus;
  readonly supportingPdfStatus: VisitHomeSurfaceStatus;
  readonly simulatorStatus: VisitHomeSurfaceStatus;
  readonly implementationStatus: VisitHomeSurfaceStatus;
  readonly handoffStatus: VisitHomeSurfaceStatus;
  readonly exportStatus: VisitHomeSurfaceStatus;
  readonly portalMissingMessage?: string;
  readonly supportingPdfMissingMessage?: string;
  readonly journeyInfo: VisitJourneyInfo;
  readonly hero: {
    readonly selectedSystem: string;
    readonly journeyArchetype: string;
    readonly keyExpectationDelta: string;
    readonly keyConstraints: readonly string[];
    readonly confidenceReadiness: VisitHomeSurfaceStatus;
  };
}

function titleCaseRecommendation(systemId: string): string {
  const normalised = systemId
    .replace(/[_-]+/g, ' ')
    .replace(/\bashp\b/gi, 'ASHP')
    .trim();
  if (normalised.length === 0) return 'Recommended system';
  return normalised
    .split(' ')
    .map((part) => (part === 'ASHP' ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`))
    .join(' ');
}

function resolveSelectedSystem(
  recommendationSummary: CustomerSummaryV1 | undefined,
  acceptedScenario: ScenarioResult | undefined,
  engineResult: EngineOutputV1 | undefined,
): string {
  if (recommendationSummary?.recommendedSystemLabel) return recommendationSummary.recommendedSystemLabel;
  if (acceptedScenario?.display?.title) return acceptedScenario.display.title;
  if (acceptedScenario?.system.summary) return acceptedScenario.system.summary;
  if (engineResult?.recommendation?.primary) return titleCaseRecommendation(engineResult.recommendation.primary);
  return 'Recommendation pending';
}

export function buildVisitHomeViewModel(input: BuildVisitHomeViewModelInput): VisitHomeViewModel {
  const hasRecommendation =
    input.acceptedScenario != null ||
    input.recommendationSummary != null ||
    input.engineResult?.recommendation?.primary != null;
  const hasAcceptedScenario = input.acceptedScenario != null;
  const hasSurveyModel = input.surveyModel != null;
  const hasVisit = input.workflowReadiness.hasVisit;
  const libraryUnsafe = input.workflowReadiness.libraryUnsafe;

  const systemCircuit =
    input.surveyModel?.fullSurvey?.heatingCondition?.systemCircuitType ??
    (input.surveyModel?.currentSystem?.heatingSystemType as 'open_vented' | 'sealed' | 'unknown' | undefined);
  const journeyInfo = detectVisitJourney(input.engineResult, input.scenarios, systemCircuit);

  const recommendationStatus: VisitHomeSurfaceStatus = hasRecommendation
    ? 'ready'
    : hasVisit
    ? 'needs-review'
    : 'blocked';

  const portalStatus: VisitHomeSurfaceStatus = libraryUnsafe
    ? 'blocked'
    : input.outputAvailability.hasPortalOutput
    ? 'ready'
    : hasRecommendation
    ? 'needs-review'
    : 'blocked';

  const supportingPdfStatus: VisitHomeSurfaceStatus = libraryUnsafe
    ? 'blocked'
    : input.outputAvailability.hasSupportingPdfOutput
    ? 'ready'
    : hasRecommendation
    ? 'needs-review'
    : 'blocked';

  const simulatorStatus: VisitHomeSurfaceStatus = !input.simulatorAvailability.hasSimulatorSurface
    ? 'blocked'
    : hasAcceptedScenario && hasSurveyModel
    ? 'ready'
    : hasRecommendation
    ? 'needs-review'
    : 'blocked';

  const implementationStatus: VisitHomeSurfaceStatus =
    input.workflowReadiness.installationSpecOptionCount > 0
      ? 'ready'
      : hasRecommendation
      ? 'needs-review'
      : 'blocked';

  const handoffStatus: VisitHomeSurfaceStatus = hasVisit && hasRecommendation
    ? input.outputAvailability.hasHandoffReview ? 'ready' : 'needs-review'
    : 'blocked';

  const exportStatus: VisitHomeSurfaceStatus = hasVisit && hasRecommendation
    ? input.outputAvailability.hasExportPackage ? 'ready' : 'needs-review'
    : 'blocked';

  const keyExpectationDelta =
    input.recommendationSummary?.whyThisWins?.[0] ??
    input.recommendationSummary?.plainEnglishDecision ??
    input.acceptedScenario?.dayToDayOutcomes?.[0] ??
    journeyInfo.description ??
    'Recommendation context is ready for review.';

  const keyConstraints =
    input.recommendationSummary?.hardConstraints?.slice(0, 3) ??
    input.recommendationSummary?.requiredChecks?.slice(0, 3) ??
    input.acceptedScenario?.keyConstraints?.slice(0, 3) ??
    [];

  const confidenceReadiness: VisitHomeSurfaceStatus = hasAcceptedScenario && hasSurveyModel
    ? 'ready'
    : hasRecommendation
    ? 'needs-review'
    : 'blocked';

  return {
    hasRecommendation,
    hasAcceptedScenario,
    hasSurveyModel,
    recommendationStatus,
    portalStatus,
    supportingPdfStatus,
    simulatorStatus,
    implementationStatus,
    handoffStatus,
    exportStatus,
    portalMissingMessage:
      hasRecommendation && portalStatus === 'needs-review'
        ? 'Customer portal not generated yet.'
        : undefined,
    supportingPdfMissingMessage:
      hasRecommendation && supportingPdfStatus === 'needs-review'
        ? 'Supporting PDF not generated yet.'
        : undefined,
    journeyInfo,
    hero: {
      selectedSystem: resolveSelectedSystem(input.recommendationSummary, input.acceptedScenario, input.engineResult),
      journeyArchetype: journeyInfo.archetype == null ? 'Journey pending' : journeyInfo.label,
      keyExpectationDelta,
      keyConstraints,
      confidenceReadiness,
    },
  };
}
