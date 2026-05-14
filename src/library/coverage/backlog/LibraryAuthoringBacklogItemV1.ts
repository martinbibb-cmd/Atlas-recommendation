import type { LibraryCoverageAuditV1 } from '../LibraryCoverageAuditV1';

export type LibraryAuthoringGapTypeV1 =
  | 'diagram'
  | 'animation'
  | 'print_card'
  | 'lived_experience'
  | 'misconception_reality'
  | 'what_you_may_notice'
  | 'journey_routing'
  | 'projection_safety';

export type LibraryAuthoringBacklogPriorityV1 = 'blocker' | 'high' | 'medium' | 'low';

export type LibraryAuthoringBacklogStatusV1 = 'open' | 'in_progress' | 'done' | 'accepted_risk';

export interface LibraryAuthoringBacklogItemV1 {
  readonly backlogItemId: string;
  readonly conceptId: string;
  readonly title: string;
  readonly gapType: LibraryAuthoringGapTypeV1;
  readonly priority: LibraryAuthoringBacklogPriorityV1;
  readonly suggestedAction: string;
  readonly affectedAudiences: readonly string[];
  readonly relatedJourneyIds: readonly string[];
  readonly status: LibraryAuthoringBacklogStatusV1;
}

export interface LibraryAuthoringBacklogV1 {
  readonly sourceCoverageAudit: Pick<LibraryCoverageAuditV1, 'schemaVersion' | 'generatedAt'>;
  readonly backlogItems: readonly LibraryAuthoringBacklogItemV1[];
}
