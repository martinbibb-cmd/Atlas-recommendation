import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { PortalVisitContextV1 } from '../../contracts/PortalVisitContextV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { GeneratedOutputsV1, CanonicalRecommendationSnapshotV1 } from '../../lib/storage/visitReviewLifecycle';
import type { ResolveCustomerDocumentSourceResultV1 } from '../../library/portal/pdf/CustomerDocumentSourceV1';
import type { PortalJourneyPrintModelV1 } from '../../library/portal/pdf/buildPortalJourneyPrintModel';

export type LibraryPdfBootStatus =
  | 'loading_visit'
  | 'visit_not_found'
  | 'recommendation_missing'
  | 'rebuilding_customer_pack'
  | 'ready'
  | 'blocked';

export interface LibraryPdfHydratedSnapshot {
  readonly visitId: string;
  readonly visitReference?: string;
  readonly recommendationSnapshot?: CanonicalRecommendationSnapshotV1;
  readonly engineOutput?: EngineOutputV1;
  readonly scenarios?: ScenarioResult[];
  readonly decision?: AtlasDecisionV1;
  readonly customerSummary?: CustomerSummaryV1;
  readonly acceptedScenarioId?: string;
  readonly generatedOutputs?: Partial<GeneratedOutputsV1>;
  readonly portalVisitContext?: Pick<PortalVisitContextV1, 'addressSummary' | 'personalDataMode'>;
  readonly surveyModel?: FullSurveyModelV1;
  readonly engineInput?: EngineInputV2_3;
}

export interface LibraryPdfReadyState {
  readonly status: 'ready';
  readonly hydratedSnapshot: LibraryPdfHydratedSnapshot;
  readonly generatedOutputs: GeneratedOutputsV1;
  readonly source: ResolveCustomerDocumentSourceResultV1 & { readonly ok: true };
  readonly printModel: PortalJourneyPrintModelV1;
}

export type LibraryPdfBootResult =
  | LibraryPdfReadyState
  | {
      readonly status: 'loading_visit' | 'rebuilding_customer_pack';
    }
  | {
      readonly status: 'visit_not_found' | 'recommendation_missing' | 'blocked';
      readonly message: string;
      readonly missingFields?: readonly string[];
    };

export interface RunLibraryPdfBootStateInput {
  readonly visitId?: string | null;
  readonly hydrateVisitById: (visitId: string) => Promise<LibraryPdfHydratedSnapshot | null> | LibraryPdfHydratedSnapshot | null;
  readonly enrichGeneratedOutputs: (snapshot: LibraryPdfHydratedSnapshot) => GeneratedOutputsV1;
  readonly resolveDocumentSource: (input: {
    readonly snapshot: LibraryPdfHydratedSnapshot;
    readonly generatedOutputs: GeneratedOutputsV1;
  }) => ResolveCustomerDocumentSourceResultV1;
  readonly isFallbackOnlyPrintModel: (model: PortalJourneyPrintModelV1) => boolean;
  readonly explicitVisitId: boolean;
  readonly onTransition?: (state: LibraryPdfBootResult) => void;
}

const VISIT_LOAD_ERROR_MESSAGE =
  'Customer PDF could not be prepared because this visit could not be loaded.';
const VISIT_ID_MISSING_MESSAGE =
  'Customer PDF could not be prepared because no visit was specified.';
const VISIT_DATA_INCOMPLETE_MESSAGE =
  'Customer PDF could not be prepared because this visit data is incomplete.';

const RECOMMENDATION_MISSING_MESSAGE =
  'Customer PDF could not be prepared because the recommendation has not been regenerated for this visit.';

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecommendationMissing(missingFields: readonly string[]): boolean {
  const recommendationFieldSet = new Set([
    'acceptedScenarioId',
    'selectedSystemLabel',
    'dhwStrategy',
    'topologyType',
    'customerJourneyPack',
  ]);
  return missingFields.some((field) => recommendationFieldSet.has(field));
}

export async function runLibraryPdfBootState(
  input: RunLibraryPdfBootStateInput,
): Promise<LibraryPdfBootResult> {
  if (!hasText(input.visitId)) {
    return {
      status: 'blocked',
      message: VISIT_ID_MISSING_MESSAGE,
    };
  }

  const loadingState: LibraryPdfBootResult = { status: 'loading_visit' };
  input.onTransition?.(loadingState);
  await Promise.resolve();

  const hydratedSnapshot = await input.hydrateVisitById(input.visitId);
  if (hydratedSnapshot == null) {
    return {
      status: 'visit_not_found',
      message: VISIT_LOAD_ERROR_MESSAGE,
    };
  }

  const rebuildingState: LibraryPdfBootResult = { status: 'rebuilding_customer_pack' };
  input.onTransition?.(rebuildingState);
  const generatedOutputs = input.enrichGeneratedOutputs(hydratedSnapshot);
  const source = input.resolveDocumentSource({
    snapshot: hydratedSnapshot,
    generatedOutputs,
  });
  if (!source.ok) {
    if (isRecommendationMissing(source.missingFields)) {
      return {
        status: 'recommendation_missing',
        message: RECOMMENDATION_MISSING_MESSAGE,
        missingFields: source.missingFields,
      };
    }
    return {
      status: 'blocked',
      message: VISIT_DATA_INCOMPLETE_MESSAGE,
      missingFields: source.missingFields,
    };
  }

  const printModel = source.source.customerJourneyPack.staticPdf;
  if (input.explicitVisitId && input.isFallbackOnlyPrintModel(printModel)) {
    return {
      status: 'blocked',
      message: RECOMMENDATION_MISSING_MESSAGE,
    };
  }

  return {
    status: 'ready',
    hydratedSnapshot,
    generatedOutputs,
    source,
    printModel,
  };
}
