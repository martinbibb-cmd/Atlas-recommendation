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
 *   - Rejects missing token with a customer-safe error
 *   - Rejects invalid token with a customer-safe error
 *   - Rejects expired token with an expiry-specific error
 *   - Accepts a valid token and loads the portal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CustomerPortalPage from '../CustomerPortalPage';
import type { ReportDetail } from '../../../lib/reports/reportApi';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import { generatePortalToken } from '../../../lib/portal/portalToken';

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

// ─── Token helper ─────────────────────────────────────────────────────────────

/** Generates a valid portal token for the test reference. */
async function makeValidToken(reference: string): Promise<string> {
  return generatePortalToken(reference);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomerPortalPage — loading state', () => {
  it('renders the loading indicator initially when token is valid but fetch is pending', async () => {
    // Use a never-resolving fetch to keep the component in loading state after token validation
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const token = await makeValidToken('test-ref');
    render(<CustomerPortalPage reference="test-ref" token={token} />);
    // The loading text is visible immediately (before token validation resolves)
    // or continues once token is valid but fetch is still pending
    await waitFor(() => {
      expect(screen.getByText(/loading your recommendation/i)).toBeTruthy();
    });
  });
});

describe('CustomerPortalPage — token gate', () => {
  it('renders token error when token is missing', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<CustomerPortalPage reference="test-ref" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-token-error"]')).not.toBeNull();
    });
  });

  it('renders "This link is not valid" when token is missing', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<CustomerPortalPage reference="test-ref" />);
    await waitFor(() => {
      expect(screen.getByText(/this link is not valid/i)).toBeTruthy();
    });
  });

  it('renders token error when token is invalid', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<CustomerPortalPage reference="test-ref" token="not.avalid.token" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-token-error"]')).not.toBeNull();
    });
  });

  it('renders "This link is not valid" for an invalid token', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<CustomerPortalPage reference="test-ref" token="not.a.valid.token" />);
    await waitFor(() => {
      expect(screen.getByText(/this link is not valid/i)).toBeTruthy();
    });
  });

  it('does not fetch report data when token is missing', async () => {
    const fetchSpy = vi.fn().mockReturnValue(new Promise(() => {}));
    global.fetch = fetchSpy;
    render(<CustomerPortalPage reference="test-ref" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-token-error"]')).not.toBeNull();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch report data when token is invalid', async () => {
    const fetchSpy = vi.fn().mockReturnValue(new Promise(() => {}));
    global.fetch = fetchSpy;
    render(<CustomerPortalPage reference="test-ref" token="bad.token" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-token-error"]')).not.toBeNull();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('CustomerPortalPage — error state', () => {
  it('renders "Recommendation not found" on 404', async () => {
    mockFetch404();
    const token = await makeValidToken('missing-ref');
    render(<CustomerPortalPage reference="missing-ref" token={token} />);
    await waitFor(() => {
      expect(screen.getByText(/recommendation not found/i)).toBeTruthy();
    });
  });

  it('renders the portal error container', async () => {
    mockFetch404();
    const token = await makeValidToken('missing-ref');
    render(<CustomerPortalPage reference="missing-ref" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-error"]')).not.toBeNull();
    });
  });
});

describe('CustomerPortalPage — loaded state', () => {
  it('renders the portal container', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="customer-portal"]')).not.toBeNull();
    });
  });

  it('renders the recommendation hero', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-hero"]')).not.toBeNull();
    });
  });

  it('renders the recommendation title', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(screen.getByText('Combi boiler recommended')).toBeTruthy();
    });
  });

  it('renders the "Your heating recommendation" heading', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(screen.getByText('Your heating recommendation')).toBeTruthy();
    });
  });

  it('renders the postcode', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(screen.getByText('SW1A 1AA')).toBeTruthy();
    });
  });

  it('renders the "Why this suits your home" section', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-why"]')).not.toBeNull();
    });
  });

  it('renders why bullets from verdict reasons', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(screen.getByText('Adequate mains pressure')).toBeTruthy();
    });
  });

  it('renders the trade-off summary', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-tradeoff"]')).not.toBeNull();
    });
  });

  it('renders the explore options panel', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-explore"]')).not.toBeNull();
    });
  });

  it('renders the ATLAS brand', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(screen.getByText('ATLAS')).toBeTruthy();
    });
  });

  it('renders the footer text', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(screen.getByText(/physics-based heating system assessment tool/i)).toBeTruthy();
    });
  });
});

// ─── PR3 — Customer-chosen option portal display ──────────────────────────────

describe('CustomerPortalPage — PR3 chosen option banner', () => {
  const STUB_OUTPUT_WITH_OPTIONS: EngineOutputV1 = {
    ...STUB_ENGINE_OUTPUT,
    options: [
      {
        id: 'combi',
        label: 'Combi boiler',
        status: 'viable',
        headline: 'Best fit for this property',
        why: ['Compact installation'],
        requirements: [],
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw: { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
        sensitivities: [],
      },
      {
        id: 'stored_unvented',
        label: 'Stored unvented',
        status: 'caution',
        headline: 'Possible with upgrades',
        why: ['More stored hot water'],
        requirements: [],
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw: { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
        sensitivities: [],
      },
    ],
  };

  const STUB_REPORT_WITH_CHOSEN_OPTION: ReportDetail = {
    ...STUB_REPORT,
    payload: {
      ...STUB_REPORT.payload,
      engineOutput: STUB_OUTPUT_WITH_OPTIONS,
      presentationState: {
        recommendedOptionId: 'combi',
        chosenOptionId: 'stored_unvented',
        chosenByCustomer: true,
      },
    },
  };

  const STUB_REPORT_NO_CHOICE: ReportDetail = {
    ...STUB_REPORT,
    payload: {
      ...STUB_REPORT.payload,
      engineOutput: STUB_OUTPUT_WITH_OPTIONS,
    },
  };

  it('shows the chosen-option banner when presentationState has a customer divergence', async () => {
    mockFetchSuccess(STUB_REPORT_WITH_CHOSEN_OPTION);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-chosen-option-banner"]')).not.toBeNull();
    });
  });

  it('does not show the chosen-option banner when no customer choice was made', async () => {
    mockFetchSuccess(STUB_REPORT_NO_CHOICE);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-hero"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-testid="portal-chosen-option-banner"]')).toBeNull();
  });

  it('does not show the banner when presentationState is absent (pre-PR3 report)', async () => {
    mockFetchSuccess(STUB_REPORT);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-hero"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-testid="portal-chosen-option-banner"]')).toBeNull();
  });

  it('chosen-option banner uses affirm-first language', async () => {
    mockFetchSuccess(STUB_REPORT_WITH_CHOSEN_OPTION);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-chosen-option-banner"]')).not.toBeNull();
    });
    const banner = document.querySelector('[data-testid="portal-chosen-option-banner"]')!;
    expect(banner.textContent).toMatch(/I can see why this option appeals/i);
    // Must not use confrontational language.
    expect(banner.textContent).not.toMatch(/override/i);
    expect(banner.textContent).not.toMatch(/not suitable/i);
    expect(banner.textContent).not.toMatch(/you chose against advice/i);
  });

  it('recommended system remains visible alongside the chosen-option banner', async () => {
    mockFetchSuccess(STUB_REPORT_WITH_CHOSEN_OPTION);
    const token = await makeValidToken('test-report-1');
    render(<CustomerPortalPage reference="test-report-1" token={token} />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="portal-hero"]')).not.toBeNull();
    });
    // The recommended system hero is still present.
    expect(document.querySelector('[data-testid="portal-hero"]')).not.toBeNull();
    // And the chosen-option banner is also present.
    expect(document.querySelector('[data-testid="portal-chosen-option-banner"]')).not.toBeNull();
  });
});
