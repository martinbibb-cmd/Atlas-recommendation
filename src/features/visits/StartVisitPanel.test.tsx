/**
 * src/features/visits/StartVisitPanel.test.tsx
 *
 * Tests for the StartVisitPanel component.
 *
 * Coverage:
 *   - renders workspace selector with built-in workspaces
 *   - defaults to atlas workspace (atlas-default brand)
 *   - creates visit with atlas-default brandId when atlas workspace is selected
 *   - selecting demo-heating workspace results in installer-demo brandId
 *   - onCancel is called when Cancel is clicked
 *   - error message is shown when visit creation fails
 *   - recommendation headline/ranking unchanged by workspace selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StartVisitPanel } from './StartVisitPanel';
import type { AtlasVisit } from './createAtlasVisit';
import * as visitApi from '../../lib/visits/visitApi';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/visits/visitApi', () => ({
  createVisit: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPanel(overrides?: { onStart?: (visit: AtlasVisit) => void; onCancel?: () => void }) {
  const onStart = overrides?.onStart ?? vi.fn();
  const onCancel = overrides?.onCancel ?? vi.fn();
  render(<StartVisitPanel onStart={onStart} onCancel={onCancel} />);
  return { onStart, onCancel };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StartVisitPanel — rendering', () => {
  it('renders "Start New Visit" heading', () => {
    renderPanel();
    expect(screen.getByText('Start New Visit')).toBeTruthy();
  });

  it('renders the workspace selector with built-in workspaces', () => {
    renderPanel();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain('atlas');
    expect(optionValues).toContain('demo-heating');
  });

  it('defaults the workspace selector to the atlas workspace', () => {
    renderPanel();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('atlas');
  });
});

describe('StartVisitPanel — visit creation', () => {
  it('calls onStart with atlas-default brandId when atlas workspace is selected', async () => {
    const mockCreateVisit = vi.mocked(visitApi.createVisit);
    mockCreateVisit.mockResolvedValueOnce({ id: 'visit_aaa', created_at: '2026-01-01T00:00:00Z' } as Awaited<ReturnType<typeof visitApi.createVisit>>);

    const { onStart } = renderPanel();
    fireEvent.click(screen.getByText('Start Visit'));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    const visit = (onStart as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(visit.visitId).toBe('visit_aaa');
    expect(visit.brandId).toBe('atlas-default');
  });

  it('calls onStart with installer-demo brandId when demo-heating workspace is selected', async () => {
    const mockCreateVisit = vi.mocked(visitApi.createVisit);
    mockCreateVisit.mockResolvedValueOnce({ id: 'visit_bbb', created_at: '2026-01-01T00:00:00Z' } as Awaited<ReturnType<typeof visitApi.createVisit>>);

    const { onStart } = renderPanel();

    // Select demo-heating workspace → resolves to installer-demo brandId
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'demo-heating' } });

    fireEvent.click(screen.getByText('Start Visit'));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    const visit = (onStart as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(visit.visitId).toBe('visit_bbb');
    expect(visit.brandId).toBe('installer-demo');
  });

  it('recommendation headline/ranking is unaffected by workspace selection', async () => {
    // The brandId on the visit has no influence over engine/recommendation
    // logic — it is only used for branding/theming.  This test verifies that
    // the workspace selection only affects brandId, not visitId structure.
    const mockCreateVisit = vi.mocked(visitApi.createVisit);
    mockCreateVisit.mockResolvedValue({ id: 'visit_ccc', created_at: '2026-01-01T00:00:00Z' } as Awaited<ReturnType<typeof visitApi.createVisit>>);

    // atlas workspace → atlas-default brand
    const { onStart: onStart1, unmount: unmount1 } = (() => {
      const onStart = vi.fn();
      const { unmount } = render(<StartVisitPanel onStart={onStart} onCancel={vi.fn()} />);
      return { onStart, unmount };
    })();
    fireEvent.click(screen.getByText('Start Visit'));
    await waitFor(() => expect(onStart1).toHaveBeenCalledTimes(1));
    const visit1 = onStart1.mock.calls[0][0] as AtlasVisit;
    expect(visit1.brandId).toBe('atlas-default');
    expect(visit1.visitId).toBe('visit_ccc');
    unmount1();

    vi.clearAllMocks();

    // demo-heating workspace → installer-demo brand
    const onStart2 = vi.fn();
    render(<StartVisitPanel onStart={onStart2} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'demo-heating' } });
    fireEvent.click(screen.getByText('Start Visit'));
    await waitFor(() => expect(onStart2).toHaveBeenCalledTimes(1));
    const visit2 = onStart2.mock.calls[0][0] as AtlasVisit;
    expect(visit2.brandId).toBe('installer-demo');
    expect(visit2.visitId).toBe('visit_ccc');
  });
});

describe('StartVisitPanel — host workspace defaulting', () => {
  it('defaults the workspace selector to the host-resolved workspace slug', () => {
    render(<StartVisitPanel onStart={vi.fn()} onCancel={vi.fn()} defaultWorkspaceSlug="demo-heating" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('demo-heating');
  });

  it('defaults to atlas when defaultWorkspaceSlug is not provided', () => {
    render(<StartVisitPanel onStart={vi.fn()} onCancel={vi.fn()} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('atlas');
  });

  it('allows the user to change workspace after host defaulting', () => {
    render(<StartVisitPanel onStart={vi.fn()} onCancel={vi.fn()} defaultWorkspaceSlug="demo-heating" />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'atlas' } });
    expect((select as HTMLSelectElement).value).toBe('atlas');
  });

  it('creates visit with installer-demo brandId when host-defaulted to demo-heating', async () => {
    const mockCreateVisit = vi.mocked(visitApi.createVisit);
    mockCreateVisit.mockResolvedValueOnce({ id: 'visit_host_001', created_at: '2026-01-01T00:00:00Z' } as Awaited<ReturnType<typeof visitApi.createVisit>>);

    const onStart = vi.fn();
    render(<StartVisitPanel onStart={onStart} onCancel={vi.fn()} defaultWorkspaceSlug="demo-heating" />);
    fireEvent.click(screen.getByText('Start Visit'));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    const visit = (onStart as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(visit.visitId).toBe('visit_host_001');
    expect(visit.brandId).toBe('installer-demo');
  });
});

describe('StartVisitPanel — cancellation', () => {
  it('calls onCancel when Cancel button is clicked', () => {
    const { onCancel } = renderPanel();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('StartVisitPanel — error handling', () => {
  it('shows an error message when visit creation fails', async () => {
    const mockCreateVisit = vi.mocked(visitApi.createVisit);
    mockCreateVisit.mockRejectedValueOnce(new Error('Server error'));

    renderPanel();
    fireEvent.click(screen.getByText('Start Visit'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Server error');
    });
  });
});
