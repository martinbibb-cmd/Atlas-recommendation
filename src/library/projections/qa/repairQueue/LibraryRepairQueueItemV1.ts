export type LibraryRepairQueueAreaV1 =
  | 'audience_routing'
  | 'copy_rewrite'
  | 'diagram_coverage'
  | 'lived_experience_content'
  | 'taxonomy_mapping';

export type LibraryRepairQueuePriorityV1 = 'blocker' | 'high' | 'medium' | 'low';

export type LibraryRepairQueueStatusV1 = 'open' | 'in_progress' | 'done' | 'accepted_risk';

export interface LibraryRepairQueueItemV1 {
  readonly queueItemId: string;
  readonly sourceRepairItemId: string;
  readonly area: LibraryRepairQueueAreaV1;
  readonly priority: LibraryRepairQueuePriorityV1;
  readonly title: string;
  readonly description: string;
  readonly affectedConceptIds: readonly string[];
  readonly affectedCardIds: readonly string[];
  readonly linkedTaskIds: readonly string[];
  readonly suggestedChange: string;
  readonly status: LibraryRepairQueueStatusV1;
}

export interface LibraryRepairQueueV1 {
  readonly queueItems: readonly LibraryRepairQueueItemV1[];
}
