import type { ProjectionSafetyRepairItemV1, ProjectionSafetyRepairPlanV1 } from '../buildProjectionSafetyRepairPlan';
import type {
  LibraryRepairQueueAreaV1,
  LibraryRepairQueueItemV1,
  LibraryRepairQueuePriorityV1,
  LibraryRepairQueueStatusV1,
  LibraryRepairQueueV1,
} from './LibraryRepairQueueItemV1';

const PRIORITY_ORDER: readonly LibraryRepairQueuePriorityV1[] = ['blocker', 'high', 'medium', 'low'];

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function toQueuePriority(item: ProjectionSafetyRepairItemV1): LibraryRepairQueuePriorityV1 {
  return item.severity === 'blocker' ? 'blocker' : 'medium';
}

function toQueueArea(item: ProjectionSafetyRepairItemV1): LibraryRepairQueueAreaV1 {
  if (item.kind === 'audience_change') return 'audience_routing';
  if (item.kind === 'replacement_copy') return 'copy_rewrite';
  if (item.repairId === 'missing:diagrams') return 'diagram_coverage';
  if (item.repairId === 'missing:what_you_may_notice') return 'lived_experience_content';
  return 'taxonomy_mapping';
}

function buildScopeLabel(item: ProjectionSafetyRepairItemV1): string {
  if (item.linkedConceptIds.length === 1) return `concept ${item.linkedConceptIds[0]}`;
  if (item.linkedConceptIds.length > 1) return `${item.linkedConceptIds.length} concepts`;
  if (item.linkedCardIds.length === 1) return `card ${item.linkedCardIds[0]}`;
  if (item.linkedCardIds.length > 1) return `${item.linkedCardIds.length} cards`;
  return 'library content';
}

function buildQueueTitle(area: LibraryRepairQueueAreaV1, item: ProjectionSafetyRepairItemV1): string {
  const scopeLabel = buildScopeLabel(item);
  switch (area) {
    case 'audience_routing':
      return `Route ${scopeLabel} to the correct audience`;
    case 'copy_rewrite':
      return `Rewrite ${scopeLabel} in customer-facing language`;
    case 'diagram_coverage':
      return `Add diagram coverage for ${scopeLabel}`;
    case 'lived_experience_content':
      return `Add lived-experience content for ${scopeLabel}`;
    case 'taxonomy_mapping':
      return `Review taxonomy mapping for ${scopeLabel}`;
  }
}

function buildQueueGroupingKey(area: LibraryRepairQueueAreaV1, item: ProjectionSafetyRepairItemV1): string {
  const conceptIds = uniqueValues(item.linkedConceptIds).sort();
  if (conceptIds.length > 0) return `${area}:concept:${conceptIds.join('|')}`;

  const cardIds = uniqueValues(item.linkedCardIds).sort();
  if (cardIds.length > 0) return `${area}:card:${cardIds.join('|')}`;

  return `${area}:repair:${item.repairId}`;
}

function buildQueueItemId(groupingKey: string): string {
  return `library-repair:${groupingKey.replace(/[^a-z0-9|:]+/gi, '_')}`;
}

function mergePriority(
  left: LibraryRepairQueuePriorityV1,
  right: LibraryRepairQueuePriorityV1,
): LibraryRepairQueuePriorityV1 {
  return PRIORITY_ORDER.indexOf(left) <= PRIORITY_ORDER.indexOf(right) ? left : right;
}

function mergeText(left: string, right: string): string {
  return uniqueValues([left, right].filter((value) => value.trim().length > 0)).join(' • ');
}

function buildQueueItem(item: ProjectionSafetyRepairItemV1): LibraryRepairQueueItemV1 {
  const area = toQueueArea(item);
  const groupingKey = buildQueueGroupingKey(area, item);
  const status: LibraryRepairQueueStatusV1 = 'open';
  return {
    queueItemId: buildQueueItemId(groupingKey),
    sourceRepairItemId: item.repairId,
    area,
    priority: toQueuePriority(item),
    title: buildQueueTitle(area, item),
    description: item.source,
    affectedConceptIds: uniqueValues(item.linkedConceptIds),
    affectedCardIds: uniqueValues(item.linkedCardIds),
    linkedTaskIds: uniqueValues(item.linkedTaskIds),
    suggestedChange: item.recommendation,
    status,
  };
}

export function buildLibraryRepairQueue(repairPlan: ProjectionSafetyRepairPlanV1): LibraryRepairQueueV1 {
  const queueItemsByKey = new Map<string, LibraryRepairQueueItemV1>();

  for (const item of repairPlan.repairItems) {
    const queueItem = buildQueueItem(item);
    const existing = queueItemsByKey.get(queueItem.queueItemId);

    if (!existing) {
      queueItemsByKey.set(queueItem.queueItemId, queueItem);
      continue;
    }

    queueItemsByKey.set(queueItem.queueItemId, {
      ...existing,
      priority: mergePriority(existing.priority, queueItem.priority),
      description: mergeText(existing.description, queueItem.description),
      affectedConceptIds: uniqueValues([...existing.affectedConceptIds, ...queueItem.affectedConceptIds]),
      affectedCardIds: uniqueValues([...existing.affectedCardIds, ...queueItem.affectedCardIds]),
      linkedTaskIds: uniqueValues([...existing.linkedTaskIds, ...queueItem.linkedTaskIds]),
      suggestedChange: mergeText(existing.suggestedChange, queueItem.suggestedChange),
    });
  }

  return {
    queueItems: [...queueItemsByKey.values()],
  };
}
