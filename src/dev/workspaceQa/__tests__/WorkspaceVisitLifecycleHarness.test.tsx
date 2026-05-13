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
});
