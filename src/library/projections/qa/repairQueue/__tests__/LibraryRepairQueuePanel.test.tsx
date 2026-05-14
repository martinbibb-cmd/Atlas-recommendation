import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LibraryRepairQueuePanel } from '../LibraryRepairQueuePanel';
import type { ProjectionSafetyRepairPlanV1 } from '../../buildProjectionSafetyRepairPlan';

const REPAIR_PLAN: ProjectionSafetyRepairPlanV1 = {
  unsafe: true,
  repairItems: [
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
  ],
  affectedConceptIds: ['sealed_system_conversion'],
  affectedCardIds: ['card-1'],
  suggestedAudienceChanges: [],
  suggestedReplacementCopy: [],
};

describe('LibraryRepairQueuePanel', () => {
  it('status changes stay local to the rendered panel instance', () => {
    const firstRender = render(<LibraryRepairQueuePanel repairPlan={REPAIR_PLAN} />);

    const firstStatusSelect = screen.getByTestId(
      'library-repair-queue-status-library-repair:copy_rewrite:concept:sealed_system_conversion',
    ) as HTMLSelectElement;

    fireEvent.change(firstStatusSelect, { target: { value: 'in_progress' } });
    expect(firstStatusSelect.value).toBe('in_progress');

    firstRender.unmount();
    render(<LibraryRepairQueuePanel repairPlan={REPAIR_PLAN} />);

    const secondStatusSelect = screen.getByTestId(
      'library-repair-queue-status-library-repair:copy_rewrite:concept:sealed_system_conversion',
    ) as HTMLSelectElement;

    expect(secondStatusSelect.value).toBe('open');
  });
});
