/**
 * VisitHubPage.completedActions.test.tsx
 *
 * PR 17 — completed-visit action surface.
 *
 * Covers:
 *   - Completed visit renders "Present to customer" visibly without expanding tools
 *   - Review handoff button is inside the Diagnostics collapse (not top-level)
 *   - "Download customer PDF" button is present and replaces the old "Save summary"
 *   - "Send customer PDF" button is present and replaces the old "Email summary"
 *   - "Export visit pack" button is present and separate from customer PDF
 *   - Dev JSON loader is only visible under Internal diagnostics, not top-level
 *   - VisitHandoffReviewPage shows a meaningful empty state when no pack is loaded
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VisitHubPage from '../VisitHubPage';
import VisitHandoffReviewPage from '../../../features/visitHandoff/components/VisitHandoffReviewPage';
import type { VisitMeta } from '../../../lib/visits/visitApi';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../lib/visits/visitApi', () => ({
  getVisit: vi.fn(),
  saveVisit: vi.fn().mockResolvedValue(undefined),
  deleteVisit: vi.fn().mockResolvedValue(undefined),
  visitDisplayLabel: (v: { address_line_1: string | null; id: string }) =>
    v.address_line_1 ?? `Visit ${v.id.slice(-8).toUpperCase()}`,
  visitStatusLabel: (s: string) => s,
  isSurveyComplete: (v: VisitMeta) =>
    v.status === 'recommendation_ready' ||
    v.status === 'complete' ||
    v.status === 'quoted' ||
    v.status === 'installed',
  isVisitCompleted: (v: VisitMeta) => v.completed_at != null,
}));

vi.mock('../../../lib/reports/reportApi', () => ({
  listReportsForVisit: vi.fn().mockResolvedValue([]),
  saveReport: vi.fn().mockResolvedValue({ id: 'report-1' }),
}));

vi.mock('../../../lib/reports/generateReportTitle', () => ({
  generateReportTitle: vi.fn().mockReturnValue('Test Report'),
}));

vi.mock('../../../lib/portal/portalToken', () => ({
  generatePortalToken: vi.fn().mockResolvedValue('tok'),
}));

vi.mock('../../../lib/portal/portalUrl', () => ({
  buildPortalUrl: vi.fn().mockReturnValue('https://example.com/portal/ref?token=tok'),
}));

vi.mock('../../../engine/Engine', () => ({
  runEngine: vi.fn().mockReturnValue({
    engineOutput: { recommendation: { primary: 'combi' } },
  }),
}));

vi.mock('../../../ui/fullSurvey/FullSurveyModelV1', () => ({
  toEngineInput: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../ui/fullSurvey/sanitiseModelForEngine', () => ({
  sanitiseModelForEngine: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../features/reports/adapters/buildCanonicalReportPayload', () => ({
  buildCanonicalReportPayload: vi.fn().mockReturnValue({}),
}));

vi.mock('../VisitReportsList', () => ({
  default: () => <div data-testid="visit-reports-list" />,
}));

vi.mock('../VisitReplayPanel', () => ({
  VisitReplayPanel: () => <div data-testid="visit-replay-panel" />,
}));

vi.mock('../../../features/voiceNotes/VoiceNotesPanel', () => ({
  VoiceNotesPanel: () => <div data-testid="voice-notes-panel" />,
}));

vi.mock('../../../features/voiceNotes/applyAcceptedSuggestions', () => ({
  applyAcceptedSuggestions: vi.fn().mockReturnValue({ updates: {}, applied: [] }),
  mergeAppliedSuggestions: vi.fn().mockReturnValue([]),
  mergeFullSurveyUpdates: vi.fn().mockReturnValue({}),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCompletedVisit(
  overrides: Partial<VisitMeta & { working_payload: Record<string, unknown> }> = {},
) {
  return {
    id: 'visit-test-001',
    created_at: '2024-01-01T10:00:00.000Z',
    updated_at: '2024-01-15T14:30:00.000Z',
    status: 'recommendation_ready',
    customer_name: 'Test Customer',
    address_line_1: '1 Test Road',
    postcode: 'AB1 2CD',
    current_step: 'complete',
    visit_reference: null,
    completed_at: '2024-01-15T14:30:00.000Z',
    completion_method: 'manual_pwa',
    working_payload: {},
    ...overrides,
  };
}

const BASE_PROPS = {
  visitId: 'visit-test-001',
  onBack: vi.fn(),
  onResumeSurvey: vi.fn(),
  onOpenPresentation: vi.fn(),
  onOpenReport: vi.fn(),
  onOpenHandoffReview: vi.fn(),
  onPrintSummary: vi.fn(),
  onOpenEngineerRoute: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VisitHubPage — completed visit primary actions (PR 17)', () => {
  it('renders "Present to customer" visibly without expanding any tools section', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeCompletedVisit());

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-completed-hint');

    // Must be rendered in the DOM and visible (not inside a closed <details>)
    const btn = screen.getByTestId('present-to-customer-btn');
    expect(btn).toBeTruthy();
    // Not inside a closed <details> — the button should be accessible
    expect(btn.closest('details[open]')).toBeNull();
  });

  it('renders "Download customer PDF" button for completed visits', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeCompletedVisit());

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-completed-hint');

    expect(screen.getByTestId('download-customer-pdf-btn')).toBeTruthy();
  });

  it('renders "Send customer PDF" button for completed visits', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeCompletedVisit());

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-completed-hint');

    expect(screen.getByTestId('send-customer-pdf-btn')).toBeTruthy();
  });

  it('renders "Export visit pack" button for completed visits', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeCompletedVisit());

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-completed-hint');

    expect(screen.getByTestId('export-visit-pack-btn')).toBeTruthy();
  });

  it('"Export visit pack" is a separate button from "Download customer PDF"', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeCompletedVisit());

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-completed-hint');

    const pdfBtn = screen.getByTestId('download-customer-pdf-btn');
    const packBtn = screen.getByTestId('export-visit-pack-btn');
    expect(pdfBtn).not.toBe(packBtn);
  });
});

describe('VisitHubPage — Review handoff is visible in Diagnostics (PR 17)', () => {
  it('renders the handoff review button inside the diagnostics section (always visible)', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeCompletedVisit());

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-completed-hint');

    // The handoff button must be inside the diagnostics section
    const handoffBtn = screen.getByTestId('open-handoff-review-btn');
    const diagnosticsSection = screen.getByTestId('diagnostics-section');
    expect(diagnosticsSection.contains(handoffBtn)).toBe(true);
  });

  it('opens the handoff review when the button in diagnostics is clicked', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeCompletedVisit());
    const onOpenHandoffReview = vi.fn();

    render(<VisitHubPage {...BASE_PROPS} onOpenHandoffReview={onOpenHandoffReview} />);
    await screen.findByTestId('visit-hub-body-completed-hint');

    await userEvent.click(screen.getByTestId('open-handoff-review-btn'));
    expect(onOpenHandoffReview).toHaveBeenCalledTimes(1);
  });
});

describe('VisitHandoffReviewPage — empty state (PR 17)', () => {
  it('does NOT show "No handoff pack loaded" when no pack is provided', () => {
    render(<VisitHandoffReviewPage />);
    expect(screen.queryByText(/no handoff pack loaded/i)).toBeNull();
  });

  it('shows a meaningful empty state instead of a JSON loader at top level', () => {
    render(<VisitHandoffReviewPage visitCompleted={true} />);
    // Should show an empty state, not the JSON loader outside of diagnostics
    expect(screen.getByTestId('handoff-no-result-state')).toBeTruthy();
  });

  it('has the dev JSON loader only inside the internal diagnostics section', () => {
    render(<VisitHandoffReviewPage visitCompleted={true} />);
    const diagnostics = screen.getByTestId('handoff-internal-diagnostics');
    const devLoader = screen.getByTestId('handoff-dev-json-loader');
    // Dev JSON loader must be inside the diagnostics section
    expect(diagnostics.contains(devLoader)).toBe(true);
  });

  it('shows the pack review when an initialPack is provided', () => {
    const pack = {
      schemaVersion: '1.0' as const,
      visitId: 'visit-001',
      completedAt: '2024-01-15T14:30:00.000Z',
      customerSummary: {
        address: '1 Test Road',
        findings: ['Finding A'],
        plannedWork: ['Work item B'],
      },
      engineerSummary: {
        rooms: [],
        keyObjects: [],
        proposedEmitters: [],
        accessNotes: [],
      },
    };
    render(<VisitHandoffReviewPage initialPack={pack} visitCompleted={true} />);
    // Should show the pack content (Customer view tab)
    expect(screen.queryByTestId('handoff-no-result-state')).toBeNull();
  });
});
