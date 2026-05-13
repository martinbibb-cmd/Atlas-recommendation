import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspaceVisitLifecycleHarness from '../WorkspaceVisitLifecycleHarness';
import { getWorkspaceVisitLifecycleScenariosV1 } from '../WorkspaceVisitLifecycleScenarioV1';

describe('WorkspaceVisitLifecycleHarness', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:workspace-qa-release-gate');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders the release gate report for all scenarios', async () => {
    render(<WorkspaceVisitLifecycleHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('workspace-qa-release-gate-overall-status')).toBeTruthy(),
    );

    expect(screen.getByTestId('workspace-qa-release-gate-report')).toBeTruthy();
    expect(screen.getByTestId('workspace-qa-release-gate-scenarios').querySelectorAll('tbody tr')).toHaveLength(
      getWorkspaceVisitLifecycleScenariosV1().length,
    );
  });

  it('exports release gate JSON including scenario results', async () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', { value: clickSpy });
      }
      return element;
    });

    render(<WorkspaceVisitLifecycleHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('workspace-qa-release-gate-export-json')).not.toHaveAttribute('disabled'),
    );

    fireEvent.click(screen.getByTestId('workspace-qa-release-gate-export-json'));

    expect(global.URL.createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();

    const blob = vi.mocked(global.URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    const json = await blob.text();
    const report = JSON.parse(json) as { scenarioResults: unknown[] };

    expect(Array.isArray(report.scenarioResults)).toBe(true);
    expect(report.scenarioResults.length).toBe(getWorkspaceVisitLifecycleScenariosV1().length);
  });

  it('changing checklist action status updates the action selector value', async () => {
    render(<WorkspaceVisitLifecycleHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('workspace-qa-trial-readiness-status-workspace-create-join-flow')).toBeTruthy(),
    );

    const statusSelect = screen.getByTestId(
      'workspace-qa-trial-readiness-status-workspace-create-join-flow',
    ) as HTMLSelectElement;

    fireEvent.change(statusSelect, { target: { value: 'in_progress' } });

    expect(statusSelect.value).toBe('in_progress');
  });

  it('accepted-risk actions stay visible with badge', async () => {
    render(<WorkspaceVisitLifecycleHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('workspace-qa-trial-readiness-status-workspace-create-join-flow')).toBeTruthy(),
    );

    fireEvent.change(screen.getByTestId('workspace-qa-trial-readiness-status-workspace-create-join-flow'), {
      target: { value: 'accepted_risk' },
    });

    expect(screen.getByTestId('workspace-qa-trial-readiness-row-workspace-create-join-flow')).toBeTruthy();
    expect(screen.getByTestId('workspace-qa-trial-readiness-accepted-risk-workspace-create-join-flow')).toBeTruthy();
  });

  it('done actions are collapsed by default in the done section', async () => {
    render(<WorkspaceVisitLifecycleHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('workspace-qa-trial-readiness-status-workspace-create-join-flow')).toBeTruthy(),
    );

    fireEvent.change(screen.getByTestId('workspace-qa-trial-readiness-status-workspace-create-join-flow'), {
      target: { value: 'done' },
    });

    expect(screen.queryByTestId('workspace-qa-trial-readiness-row-workspace-create-join-flow')).toBeNull();
    expect(screen.getByText('Done (1)')).toBeTruthy();
    expect(screen.getByTestId('workspace-qa-trial-readiness-done-section')).not.toHaveAttribute('open');
  });

  it('live blocker count updates when blocker action status changes', async () => {
    const { container } = render(<WorkspaceVisitLifecycleHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('workspace-qa-trial-readiness-status-workspace-create-join-flow')).toBeTruthy(),
    );

    const blockerCountLabel = screen.getByTestId('workspace-qa-trial-readiness-blocker-count');
    expect(blockerCountLabel.textContent).toMatch(/Live blockers open:\s*\d+/);
    const initialCount = Number(blockerCountLabel.textContent?.match(/(\d+)$/)?.[1] ?? '0');

    const priorityCells = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid^="workspace-qa-trial-readiness-priority-"]'),
    );
    const blockerCell = priorityCells.find((cell) => cell.textContent === 'blocker');
    const actionId =
      blockerCell?.dataset.testid?.replace('workspace-qa-trial-readiness-priority-', '') ??
      'workspace-create-join-flow';

    fireEvent.change(screen.getByTestId(`workspace-qa-trial-readiness-status-${actionId}`), { target: { value: 'done' } });

    const nextCount = Number(screen.getByTestId('workspace-qa-trial-readiness-blocker-count').textContent?.match(/(\d+)$/)?.[1] ?? '0');
    if (blockerCell) {
      expect(nextCount).toBe(Math.max(initialCount - 1, 0));
      return;
    }
    expect(nextCount).toBe(initialCount);
  });

  it('exports trial-readiness review JSON including review note and status', async () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', { value: clickSpy });
      }
      return element;
    });

    render(<WorkspaceVisitLifecycleHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('workspace-qa-trial-readiness-status-workspace-create-join-flow')).toBeTruthy(),
    );

    fireEvent.change(screen.getByTestId('workspace-qa-trial-readiness-status-workspace-create-join-flow'), {
      target: { value: 'in_progress' },
    });
    fireEvent.change(screen.getByTestId('workspace-qa-trial-readiness-note-workspace-create-join-flow'), {
      target: { value: 'Needs customer support walkthrough evidence' },
    });

    fireEvent.click(screen.getByTestId('workspace-qa-trial-readiness-export-json'));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    const blob = vi.mocked(global.URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob;
    const json = await blob.text();
    const payload = JSON.parse(json) as Array<{
      action: { actionId: string };
      reviewState: null | { status: string; reviewerNote?: string };
    }>;

    const updated = payload.find((entry) => entry.action.actionId === 'workspace-create-join-flow');
    expect(updated?.reviewState?.status).toBe('in_progress');
    expect(updated?.reviewState?.reviewerNote).toBe('Needs customer support walkthrough evidence');
  });
});
