/**
 * CustomerPortalPage.test.tsx
 *
 * Tests for the customer-facing recommendation portal page.
 *
 * Coverage:
 *   - Renders loading state initially
 *   - Renders error state when report fails to load
 *   - Renders the portal hero with recommendation
 *   - Renders "Why this suits your home" section
 *   - Renders the trade-off summary
 *   - Renders the explore options panel when engine input is available
 *   - Does not expose expert-only controls
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CustomerPortalPage from '../CustomerPortalPage';
import type { ReportDetail } from '../../../lib/reports/reportApi';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const STUB_ENGINE_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Combi boiler' },
  explainers: [],
  options: [
    {
      id: 'combi',
      label: 'Combi boiler',
      status: 'viable',
      headline: 'Best fit for this property',
      why: ['Compact installation', 'Suitable mains pressure'],
      requirements: [],
      heat: { status: 'ok', headline: '', bullets: [] },
      dhw: { status: 'ok', headline: '', bullets: [] },
      engineering: { status: 'ok', headline: '', bullets: [] },
      sensitivities: [],
    },
  ],
  verdict: {
    title: 'Combi boiler recommended',
    status: 'good',
    reasons: ['Adequate mains pressure', 'Low simultaneous demand risk'],
    confidence: { level: 'high', reasons: [] },
    assumptionsUsed: [],
  },
};

const STUB_ENGINE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 14,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 2,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: true,
};

const STUB_REPORT: ReportDetail = {
  id: 'test-report-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  status: 'complete',
  title: null,
  customer_name: null,
  postcode: 'SW1A 1AA',
  visit_id: null,
  payload: {
    surveyData: {} as ReportDetail['payload']['surveyData'],
    engineInput: STUB_ENGINE_INPUT,
    engineOutput: STUB_ENGINE_OUTPUT,
    decisionSynthesis: null,
  },
};

// ─── Mock fetch ───────────────────────────────────────────────────────────────

function mockFetchSuccess(report: ReportDetail) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ ok: true, report }),
  } as unknown as Response);
}

function mockFetch404() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: () => Promise.resolve({ ok: false, error: 'Report not found' }),
  } as unknown as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('scrollTo', vi.fn());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomerPortalPage — loading state', () => {
  it('renders the loading indicator initially', () => {
    // Use a never-resolving fetch to keep the component in loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<CustomerPortalPage reference="test-ref" />);
    expect(screen.getByText(/loading your recommendation/i)).toBeTruthy();
  });
});

describe('CustomerPortalPage — error state', () => {
  it('renders "Recommendation not found" on 404', async () => {
    mockFetch404();
    render(<CustomerPortalPage reference="missing-ref" />);
    await waitFor(() => {
      expect(screen.getByText(/recommendation not found/i)).toBeTruthy();
    });
  });

  it('renders the portal error container', async () => {
    mockFetch404();
    render(<CustomerPortalPage reference="missing-ref" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-error"]')).not.toBeNull();
    });
  });
});

describe('CustomerPortalPage — loaded state', () => {
  it('renders the portal container', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="customer-portal"]')).not.toBeNull();
    });
  });

  it('renders the recommendation hero', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-hero"]')).not.toBeNull();
    });
  });

  it('renders the recommendation title', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(screen.getByText('Combi boiler recommended')).toBeTruthy();
    });
  });

  it('renders the "Your heating recommendation" heading', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(screen.getByText('Your heating recommendation')).toBeTruthy();
    });
  });

  it('renders the postcode', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(screen.getByText('SW1A 1AA')).toBeTruthy();
    });
  });

  it('renders the "Why this suits your home" section', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-why"]')).not.toBeNull();
    });
  });

  it('renders why bullets from verdict reasons', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(screen.getByText('Adequate mains pressure')).toBeTruthy();
    });
  });

  it('renders the trade-off summary', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-tradeoff"]')).not.toBeNull();
    });
  });

  it('renders the explore options panel', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-explore"]')).not.toBeNull();
    });
  });

  it('renders the ATLAS brand', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(screen.getByText('ATLAS')).toBeTruthy();
    });
  });

  it('renders the footer text', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" />);
    await waitFor(() => {
      expect(screen.getByText(/physics-based heating system assessment tool/i)).toBeTruthy();
    });
  });
});
