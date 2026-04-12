/**
 * EngineerPreinstallPage.test.tsx
 *
 * PR11 — Smoke and render tests for EngineerPreinstallPage.
 *
 * Coverage:
 *   - Shows loading state initially
 *   - Shows error state when visit fetch fails
 *   - Renders all engineer panels once loaded with a report payload
 *   - Shows "no data" state when no report is available
 *   - Renders VisitReplayPanel regardless of engine data
 *   - Back button calls onBack
 *   - Visit replay integration smoke test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import EngineerPreinstallPage from '../EngineerPreinstallPage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the visit and report API modules so tests don't make real fetch calls.
vi.mock('../../../lib/visits/visitApi', () => ({
  getVisit: vi.fn(),
  visitStatusLabel: (status: string) => {
    const map: Record<string, string> = {
      recommendation_ready: 'Recommendation ready',
      new: 'New',
    };
    return map[status] ?? status;
  },
  visitDisplayLabel: (v: { id: string; visit_reference: string | null; address_line_1: string | null }) =>
    v.visit_reference ?? v.address_line_1 ?? `Visit ${v.id.slice(-8).toUpperCase()}`,
}));

vi.mock('../../../lib/reports/reportApi', () => ({
  listReportsForVisit: vi.fn(),
  getReport: vi.fn(),
}));

import { getVisit } from '../../../lib/visits/visitApi';
import { listReportsForVisit, getReport } from '../../../lib/reports/reportApi';

const mockGetVisit = vi.mocked(getVisit);
const mockListReports = vi.mocked(listReportsForVisit);
const mockGetReport = vi.mocked(getReport);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVisitDetail(overrides: Record<string, unknown> = {}) {
  return {
    id:              'visit-1',
    created_at:      '2024-01-01T00:00:00Z',
    updated_at:      '2024-01-02T00:00:00Z',
    status:          'recommendation_ready',
    customer_name:   'Test Customer',
    address_line_1:  '10 Test Road',
    postcode:        'E1 6AN',
    current_step:    'complete',
    visit_reference: 'JOB-42',
    working_payload: {
      postcode: 'E1 6AN',
      fullSurvey: { voiceNotes: [] },
    },
    ...overrides,
  };
}

function makeReportMeta() {
  return {
    id:           'report-1',
    created_at:   '2024-01-02T00:00:00Z',
    updated_at:   '2024-01-02T00:00:00Z',
    status:       'complete',
    title:        null,
    customer_name: null,
    postcode:     'E1 6AN',
    visit_id:     'visit-1',
  };
}

function makeReportDetail() {
  return {
    ...makeReportMeta(),
    payload: {
      schemaVersion: '2.0',
      atlasProperty: {
        version:    '1.0',
        propertyId: 'prop-1',
        visitId:    'visit-1',
        createdAt:  '2024-01-01T00:00:00Z',
        updatedAt:  '2024-01-02T00:00:00Z',
        status:     'report_ready',
        sourceApps: ['atlas_mind'],
        property: {
          address1: '10 Test Road',
          postcode: 'E1 6AN',
        },
        capture: {},
        building: {
          floors: [], rooms: [], zones: [], boundaries: [], openings: [],
          emitters: [], systemComponents: [], pipeRoutes: [],
        },
        household: {},
        currentSystem: {
          family: { value: 'combi', confidence: 'high', source: 'engineer' },
        },
        evidence: {
          photos:     [{ photoId: 'p1', capturedAt: '2024-01-01T10:00:00Z' }],
          voiceNotes: [],
          textNotes:  [],
          qaFlags:    [],
          events:     [],
        },
      },
      engineRun: {
        engineOutput: {
          options: [
            { id: 'stored_unvented', status: 'viable', constraints: [] },
            { id: 'combi', status: 'not_viable', constraints: [] },
          ],
        },
      },
      presentationState: null,
      decisionSynthesis:  null,
    },
  };
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('EngineerPreinstallPage — loading state', () => {
  beforeEach(() => {
    mockGetVisit.mockReturnValue(new Promise(() => {/* never resolves */}));
    mockListReports.mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('shows loading state initially', () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    expect(screen.getByTestId('engineer-preinstall-loading')).toBeInTheDocument();
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('EngineerPreinstallPage — error state', () => {
  beforeEach(() => {
    mockGetVisit.mockRejectedValue(new Error('Visit not found'));
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('shows error state when visit fetch fails', async () => {
    render(<EngineerPreinstallPage visitId="visit-x" onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('engineer-preinstall-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/visit not found/i)).toBeInTheDocument();
  });

  it('back button calls onBack from error state', async () => {
    const onBack = vi.fn();
    render(<EngineerPreinstallPage visitId="visit-x" onBack={onBack} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-error'));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// ─── Loaded with report ────────────────────────────────────────────────────────

describe('EngineerPreinstallPage — loaded with report', () => {
  beforeEach(() => {
    mockGetVisit.mockResolvedValue(makeVisitDetail());
    mockListReports.mockResolvedValue([makeReportMeta()]);
    mockGetReport.mockResolvedValue(makeReportDetail() as ReturnType<typeof makeReportDetail>);
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('renders the main page after loading', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('engineer-preinstall-page')).toBeInTheDocument();
  });

  it('renders job summary card', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('engineer-job-summary')).toBeInTheDocument();
  });

  it('renders layout summary panel', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('engineer-layout-summary')).toBeInTheDocument();
  });

  it('renders current system panel', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('engineer-current-system')).toBeInTheDocument();
  });

  it('renders required work panel', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('engineer-required-work')).toBeInTheDocument();
  });

  it('renders warnings panel', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('engineer-warnings')).toBeInTheDocument();
  });

  it('renders evidence panel', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('engineer-evidence')).toBeInTheDocument();
  });

  it('visit replay panel is always present', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('visit-replay-panel')).toBeInTheDocument();
  });
});

// ─── Loaded with no report ────────────────────────────────────────────────────

describe('EngineerPreinstallPage — loaded with no report', () => {
  beforeEach(() => {
    mockGetVisit.mockResolvedValue(makeVisitDetail());
    mockListReports.mockResolvedValue([]);
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('shows no-data message when working payload has no engine output', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('engineer-preinstall-no-data')).toBeInTheDocument();
  });

  it('visit replay panel is still present even without engine data', async () => {
    render(<EngineerPreinstallPage visitId="visit-1" onBack={() => {}} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    expect(screen.getByTestId('visit-replay-panel')).toBeInTheDocument();
  });
});

// ─── Back button ──────────────────────────────────────────────────────────────

describe('EngineerPreinstallPage — navigation', () => {
  beforeEach(() => {
    mockGetVisit.mockResolvedValue(makeVisitDetail());
    mockListReports.mockResolvedValue([]);
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('back button in header calls onBack', async () => {
    const onBack = vi.fn();
    render(<EngineerPreinstallPage visitId="visit-1" onBack={onBack} />);
    await waitFor(() => screen.getByTestId('engineer-preinstall-page'));
    fireEvent.click(screen.getByRole('button', { name: /back to visit hub/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
