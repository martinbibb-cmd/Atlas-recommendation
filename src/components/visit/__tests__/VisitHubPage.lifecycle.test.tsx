/**
 * VisitHubPage.lifecycle.test.tsx
 *
 * PR 16 — lifecycle-aware body panels.
 *
 * Covers:
 *   - Completed state body shows the "closed" hint and survey-record collapse;
 *     does NOT render an active VoiceNotesPanel entry form
 *   - In-progress state body shows the "Survey assist" label and VoiceNotesPanel
 *   - Ready-to-complete state body shows the collapsed engineer-notes section
 *     and the "Survey assist" label
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VisitHubPage from '../VisitHubPage';
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
    v.status === 'recommendation_ready' || v.status === 'complete' || v.status === 'quoted' || v.status === 'installed',
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

vi.mock('../../../features/scanHandoff', () => ({
  useScanCaptureForVisit: vi.fn().mockReturnValue(null),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVisitResponse(overrides: Partial<VisitMeta & { working_payload: Record<string, unknown> }> = {}) {
  return {
    id: 'visit-test-001',
    created_at: '2024-01-01T10:00:00.000Z',
    updated_at: '2024-01-15T14:30:00.000Z',
    status: 'survey_started',
    customer_name: 'Test Customer',
    address_line_1: '1 Test Road',
    postcode: 'AB1 2CD',
    current_step: null,
    visit_reference: null,
    completed_at: null,
    completion_method: null,
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
};

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VisitHubPage — completed state body (PR 16)', () => {
  it('shows the "Survey capture is closed" hint in the completed body', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(
      makeVisitResponse({
        status: 'recommendation_ready',
        completed_at: '2024-01-15T14:30:00.000Z',
        completion_method: 'manual_pwa',
      })
    );

    render(<VisitHubPage {...BASE_PROPS} />);
    expect(await screen.findByTestId('visit-hub-body-completed-hint')).toBeTruthy();
  });

  it('does NOT render the VoiceNotesPanel entry form in the completed body', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(
      makeVisitResponse({
        status: 'recommendation_ready',
        completed_at: '2024-01-15T14:30:00.000Z',
        completion_method: 'manual_pwa',
      })
    );

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-completed-hint');
    expect(screen.queryByTestId('voice-notes-panel')).toBeNull();
  });

  it('shows the survey-record collapse (VisitReplayPanel demoted) in completed body', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(
      makeVisitResponse({
        status: 'recommendation_ready',
        completed_at: '2024-01-15T14:30:00.000Z',
        completion_method: 'manual_pwa',
      })
    );

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-completed-hint');
    expect(screen.getByTestId('survey-record-collapse')).toBeTruthy();
  });

  it('renders captured evidence panel when scan handoff evidence graph exists', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    const { useScanCaptureForVisit } = await import('../../../features/scanHandoff');
    vi.mocked(getVisit).mockResolvedValue(
      makeVisitResponse({
        status: 'recommendation_ready',
        completed_at: '2024-01-15T14:30:00.000Z',
        completion_method: 'manual_pwa',
      })
    );
    vi.mocked(useScanCaptureForVisit).mockReturnValue({
      spatialEvidenceGraph: {
        rooms: [
          {
            id: 'room-kitchen',
            name: 'Kitchen',
            capturePoints: [{ capturePointId: 'cp-kitchen-1', anchorConfidence: 0.8 }],
          },
        ],
      },
      unresolvedEvidence: [
        { id: 'u1', type: 'pending-photo', capturePointId: 'cp-kitchen-1' },
      ],
    } as unknown as import('../../../features/scanImport/contracts/sessionCaptureV2').SessionCaptureV2);

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-completed-hint');
    expect(screen.getByTestId('captured-evidence-panel')).toBeTruthy();
    expect(screen.getByTestId('captured-evidence-capture-point-cp-kitchen-1')).toBeTruthy();
    expect(screen.getByText(/Unresolved evidence/i)).toBeTruthy();
  });
});

describe('VisitHubPage — in-progress state body (PR 16)', () => {
  it('shows the "Survey assist" label in the in-progress body', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeVisitResponse({ status: 'survey_started' }));

    render(<VisitHubPage {...BASE_PROPS} />);
    expect(await screen.findByTestId('visit-hub-body-in-progress-label')).toBeTruthy();
  });

  it('renders VoiceNotesPanel in the in-progress body', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeVisitResponse({ status: 'survey_started' }));

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-in-progress-label');
    expect(screen.getByTestId('voice-notes-panel')).toBeTruthy();
  });
});

describe('VisitHubPage — ready-to-complete state body (PR 16)', () => {
  it('shows the "Survey assist" label in the ready-to-complete body', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(
      makeVisitResponse({ status: 'recommendation_ready', completed_at: null })
    );

    render(<VisitHubPage {...BASE_PROPS} />);
    expect(await screen.findByTestId('visit-hub-body-ready-label')).toBeTruthy();
  });

  it('renders the engineer-notes collapse in the ready-to-complete body', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(
      makeVisitResponse({ status: 'recommendation_ready', completed_at: null })
    );

    render(<VisitHubPage {...BASE_PROPS} />);
    await screen.findByTestId('visit-hub-body-ready-label');
    expect(screen.getByTestId('engineer-notes-collapse')).toBeTruthy();
  });
});
