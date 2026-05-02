/**
 * src/features/visits/StartVisitPanel.test.tsx
 *
 * Tests for the StartVisitPanel component.
 *
 * Coverage:
 *   - renders brand selector with options from BRAND_PROFILES
 *   - defaults to atlas-default brand
 *   - creates visit with selected brandId on submit
 *   - installer-demo brand selection results in onStart receiving installer-demo brandId
 *   - onCancel is called when Cancel is clicked
 *   - error message is shown when visit creation fails
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

  it('renders the brand selector with registered brands', () => {
    renderPanel();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    // At minimum atlas-default should be present
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain('atlas-default');
    expect(optionValues).toContain('installer-demo');
  });

  it('defaults the brand selector to atlas-default', () => {
    renderPanel();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('atlas-default');
  });
});

describe('StartVisitPanel — visit creation', () => {
  it('calls onStart with atlas-default brandId when no brand is changed', async () => {
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

  it('calls onStart with installer-demo brandId when installer-demo is selected', async () => {
    const mockCreateVisit = vi.mocked(visitApi.createVisit);
    mockCreateVisit.mockResolvedValueOnce({ id: 'visit_bbb', created_at: '2026-01-01T00:00:00Z' } as Awaited<ReturnType<typeof visitApi.createVisit>>);

    const { onStart } = renderPanel();

    // Select installer-demo
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'installer-demo' } });

    fireEvent.click(screen.getByText('Start Visit'));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    const visit = (onStart as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(visit.visitId).toBe('visit_bbb');
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
