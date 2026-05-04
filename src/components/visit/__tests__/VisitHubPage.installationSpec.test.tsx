/**
 * VisitHubPage.installationSpec.test.tsx
 *
 * Regression tests for the Installation Specification entry in the Visit Hub.
 *
 * Covers:
 *   1. The button label is exactly "Installation Specification" (correct capitalisation).
 *   2. The button does NOT use contractor/planner/planning wording.
 *   3. Clicking the button calls onOpenInstallationSpecification without throwing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function makeInProgressVisit(): VisitMeta & { working_payload: Record<string, unknown> } {
  return {
    id: 'visit-spec-test-001',
    created_at: '2024-06-01T10:00:00.000Z',
    updated_at: '2024-06-01T11:00:00.000Z',
    status: 'survey_started',
    customer_name: 'Jane Doe',
    address_line_1: '1 Test Road',
    postcode: 'AB1 2CD',
    current_step: null,
    visit_reference: null,
    completed_at: null,
    completion_method: null,
    working_payload: {},
  };
}

const BASE_PROPS = {
  visitId: 'visit-spec-test-001',
  onBack: vi.fn(),
  onResumeSurvey: vi.fn(),
  onOpenPresentation: vi.fn(),
  onOpenReport: vi.fn(),
  onOpenInstallationSpecification: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VisitHubPage — Installation Specification button', () => {
  it('renders the Installation Specification button with correct capitalisation', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeInProgressVisit());

    render(<VisitHubPage {...BASE_PROPS} />);

    const btn = await screen.findByTestId('open-installation-specification-btn');
    expect(btn.textContent).toContain('Installation Specification');
  });

  it('does NOT label the button with lowercase "specification"', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeInProgressVisit());

    render(<VisitHubPage {...BASE_PROPS} />);

    const btn = await screen.findByTestId('open-installation-specification-btn');
    // Must not end with lowercase "specification" — enforce capital S.
    expect(btn.textContent).not.toMatch(/[Ii]nstallation specification$/);
  });

  it('does NOT label the button with planner/planning/contractor wording', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeInProgressVisit());

    render(<VisitHubPage {...BASE_PROPS} />);

    const btn = await screen.findByTestId('open-installation-specification-btn');
    const text = btn.textContent ?? '';
    expect(text).not.toMatch(/planner/i);
    expect(text).not.toMatch(/planning/i);
    expect(text).not.toMatch(/contractor/i);
    expect(text).not.toMatch(/quote/i);
  });

  it('clicking the button calls onOpenInstallationSpecification without throwing', async () => {
    const { getVisit } = await import('../../../lib/visits/visitApi');
    vi.mocked(getVisit).mockResolvedValue(makeInProgressVisit());

    const onOpenInstallationSpecification = vi.fn();
    render(<VisitHubPage {...BASE_PROPS} onOpenInstallationSpecification={onOpenInstallationSpecification} />);

    const btn = await screen.findByTestId('open-installation-specification-btn');
    await userEvent.click(btn);
    expect(onOpenInstallationSpecification).toHaveBeenCalledTimes(1);
  });
});
