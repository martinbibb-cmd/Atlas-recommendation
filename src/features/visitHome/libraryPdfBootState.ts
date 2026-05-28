export type LibraryPdfBootState =
  | 'loading_visit'
  | 'visit_not_found'
  | 'recommendation_missing'
  | 'rebuilding_customer_pack'
  | 'ready'
  | 'blocked';

export interface ResolveLibraryPdfBootStateInput {
  readonly explicitVisitId?: string;
  readonly hydrationComplete: boolean;
  readonly visitLoaded: boolean;
  readonly recommendationReady: boolean;
  readonly customerJourneyPackReady: boolean;
}

export function resolveLibraryPdfBootState(
  input: ResolveLibraryPdfBootStateInput,
): LibraryPdfBootState {
  if (input.explicitVisitId == null || input.explicitVisitId.trim().length === 0) {
    return 'blocked';
  }
  if (!input.hydrationComplete) {
    return 'loading_visit';
  }
  if (!input.visitLoaded) {
    return 'visit_not_found';
  }
  if (!input.recommendationReady) {
    return 'recommendation_missing';
  }
  if (!input.customerJourneyPackReady) {
    return 'rebuilding_customer_pack';
  }
  return 'ready';
}

export function shouldResolveLibraryPdfSource(state: LibraryPdfBootState): boolean {
  return state === 'ready';
}
