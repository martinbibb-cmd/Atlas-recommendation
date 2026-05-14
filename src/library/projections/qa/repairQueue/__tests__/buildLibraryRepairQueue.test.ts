import { describe, expect, it } from 'vitest';
import { buildLibraryRepairQueue } from '../buildLibraryRepairQueue';
import type { ProjectionSafetyRepairItemV1, ProjectionSafetyRepairPlanV1 } from '../../buildProjectionSafetyRepairPlan';

function makeRepairPlan(repairItems: readonly ProjectionSafetyRepairItemV1[]): ProjectionSafetyRepairPlanV1 {
  return {
    unsafe: repairItems.length > 0,
    repairItems,
    affectedConceptIds: [...new Set(repairItems.flatMap((item) => item.linkedConceptIds))],
    affectedCardIds: [...new Set(repairItems.flatMap((item) => item.linkedCardIds))],
    suggestedAudienceChanges: [],
    suggestedReplacementCopy: [],
  };
}

describe('buildLibraryRepairQueue', () => {
  it('maps blocker repairs to blocker queue items', () => {
    const queue = buildLibraryRepairQueue(makeRepairPlan([
      {
        repairId: 'copy:card-1:fill-pressure',
        severity: 'blocker',
        source: 'Customer-visible technical-only wording in card "System fill pressure note"',
        kind: 'replacement_copy',
        recommendation: 'Rewrite this card in customer outcome wording.',
        linkedConceptIds: ['sealed_system_conversion'],
        linkedCardIds: ['card-1'],
        linkedTaskIds: ['task-1'],
      },
    ]));

    expect(queue.queueItems).toHaveLength(1);
    expect(queue.queueItems[0]?.priority).toBe('blocker');
  });

  it('maps missing diagrams to diagram coverage queue items', () => {
    const queue = buildLibraryRepairQueue(makeRepairPlan([
      {
        repairId: 'missing:diagrams',
        severity: 'warning',
        source: 'No diagrams included in customer projection',
        kind: 'content_gap',
        recommendation: 'Add diagram coverage for customer-visible concepts in this projection.',
        linkedConceptIds: ['sealed_system_conversion'],
        linkedCardIds: [],
        linkedTaskIds: [],
      },
    ]));

    expect(queue.queueItems[0]?.area).toBe('diagram_coverage');
  });

  it('maps lived-experience warnings to content queue items', () => {
    const queue = buildLibraryRepairQueue(makeRepairPlan([
      {
        repairId: 'missing:what_you_may_notice',
        severity: 'warning',
        source: 'No "what you may notice" content found in customer projection',
        kind: 'content_gap',
        recommendation: 'Add a lived-experience card that includes "what you may notice" guidance.',
        linkedConceptIds: ['pressure_vs_storage'],
        linkedCardIds: [],
        linkedTaskIds: [],
      },
    ]));

    expect(queue.queueItems[0]?.area).toBe('lived_experience_content');
  });

  it('deduplicates queue items for the same concept and area', () => {
    const queue = buildLibraryRepairQueue(makeRepairPlan([
      {
        repairId: 'copy:card-1:fill-pressure',
        severity: 'blocker',
        source: 'Customer-visible technical-only wording in card "System fill pressure note"',
        kind: 'replacement_copy',
        recommendation: 'Rewrite this card in customer outcome wording.',
        linkedConceptIds: ['sealed_system_conversion'],
        linkedCardIds: ['card-1'],
        linkedTaskIds: ['task-1'],
      },
      {
        repairId: 'copy:card-2:zone-valve',
        severity: 'blocker',
        source: 'Customer-visible technical-only wording in card "Zone valve operation"',
        kind: 'replacement_copy',
        recommendation: 'Rewrite this card in customer outcome wording.',
        linkedConceptIds: ['sealed_system_conversion'],
        linkedCardIds: ['card-2'],
        linkedTaskIds: ['task-2'],
      },
    ]));

    expect(queue.queueItems).toHaveLength(1);
    expect(queue.queueItems[0]?.affectedCardIds).toEqual(['card-1', 'card-2']);
    expect(queue.queueItems[0]?.linkedTaskIds).toEqual(['task-1', 'task-2']);
  });
});
