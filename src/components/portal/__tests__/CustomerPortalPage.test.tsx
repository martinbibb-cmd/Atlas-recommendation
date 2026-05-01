import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CustomerPortalPage from '../CustomerPortalPage';
import type { ReportDetail } from '../../../lib/reports/reportApi';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

vi.mock('../../../lib/portal/portalToken', () => ({ validatePortalToken: vi.fn(async (_r: string, token?: string) => token === 'valid-token' ? 'valid' : 'invalid') }));

/**
 * Complete enough engine input to run the engine without errors.
 * Includes currentHeatSourceType so the runner selection is deterministic.
 */
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
  currentHeatSourceType: 'combi',
  dhwStorageType: 'none',
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
    surveyData: STUB_ENGINE_INPUT as unknown as ReportDetail['payload']['surveyData'],
    engineInput: STUB_ENGINE_INPUT,
    // engineOutput is intentionally absent — the portal re-runs the engine from
    // engineInput and does not rely on any persisted engine output.
    engineOutput: null as unknown as ReportDetail['payload']['engineOutput'],
    decisionSynthesis: null,
  },
};

function mockFetchSuccess(report: ReportDetail) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, report }) } as unknown as Response);
}
function mockFetch404() {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ ok: false, error: 'Report not found' }) } as unknown as Response);
}

/** Helper: wait for data to load and navigate past the welcome screen to the presentation view. */
async function openPresentationView() {
  await waitFor(() => expect(screen.getByTestId('portal-welcome')).toBeTruthy());
  fireEvent.click(screen.getByTestId('portal-welcome-presentation'));
  await waitFor(() => expect(screen.getByTestId('presentation-deck')).toBeTruthy());
}

beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('scrollTo', vi.fn()); });

describe('CustomerPortalPage', () => {
  it('renders token error when token is missing', async () => {
    render(<CustomerPortalPage reference="test-ref" />);
    await waitFor(() => expect(screen.getByTestId('portal-token-error')).toBeTruthy());
  });

  it('renders portal error on 404', async () => {
    mockFetch404();
    render(<CustomerPortalPage reference="missing-ref" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-error')).toBeTruthy());
  });

  it('shows a welcome page with two view choices after loading', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-welcome')).toBeTruthy());
    expect(screen.getByTestId('portal-welcome-insight')).toBeTruthy();
    expect(screen.getByTestId('portal-welcome-presentation')).toBeTruthy();
    // Portal header with postcode shown on welcome page too
    expect(screen.getByTestId('portal-hero')).toBeTruthy();
    expect(screen.getAllByText('SW1A 1AA').length).toBeGreaterThan(0);
  });

  it('renders the canonical presentation deck — same pages as the in-room presentation', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await openPresentationView();

    expect(screen.getByTestId('customer-portal')).toBeTruthy();

    // Portal header with postcode
    expect(screen.getByTestId('portal-hero')).toBeTruthy();
    expect(screen.getAllByText('SW1A 1AA').length).toBeGreaterThan(0);

    // Canonical presentation deck — identical to the in-room view
    expect(screen.getByTestId('presentation-deck')).toBeTruthy();

    // Deck navigation present
    expect(screen.getByRole('navigation', { name: 'Deck navigation' })).toBeTruthy();

    // No "Back" button that would navigate away to other reports or survey
    const backBtns = screen.queryAllByText('← Back');
    // The only ← Back buttons that may appear are within-deck navigation
    // (prev slide), not navigation to survey or other reports.
    for (const btn of backBtns) {
      expect(btn.closest('[data-testid="customer-portal"]')).toBeTruthy();
    }
  });

  it('navigates to the simulator page and opens the live simulator', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await openPresentationView();

    // Navigate to the last slide (Proof / simulator page) via progress dots
    const nav = screen.getByRole('navigation', { name: 'Deck navigation' });
    const dots = nav.querySelectorAll('button');
    // Click the last dot to jump directly to the simulator page
    const lastDot = dots[dots.length - 1];
    fireEvent.click(lastDot);

    // Simulator CTA should now be visible
    await waitFor(() => expect(screen.getByText('Open simulator →')).toBeTruthy());

    // Simulator is not yet rendered
    expect(document.querySelector('[data-testid="portal-unified-simulator"]')).toBeNull();

    // Click the CTA to launch the inline simulator
    fireEvent.click(screen.getByText('Open simulator →'));

    // Simulator section should now be visible
    await waitFor(() => expect(screen.getByTestId('portal-unified-simulator')).toBeTruthy());
    expect(screen.getByTestId('unified-simulator-view')).toBeTruthy();
  });

  it('clicking the print button shows PrintableRecommendationPage in portal mode', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await openPresentationView();

    // Navigate to simulator page and open it
    const nav = screen.getByRole('navigation', { name: 'Deck navigation' });
    const dots = nav.querySelectorAll('button');
    fireEvent.click(dots[dots.length - 1]);
    await waitFor(() => expect(screen.getByText('Open simulator →')).toBeTruthy());
    fireEvent.click(screen.getByText('Open simulator →'));
    await waitFor(() => expect(screen.getByTestId('unified-simulator-view')).toBeTruthy());

    const printBtn = screen.getByTestId('print-report-btn');
    fireEvent.click(printBtn);
    // After clicking, PrintableRecommendationPage should replace the simulator view.
    await waitFor(() => expect(screen.getByLabelText('Back to advice page')).toBeTruthy());
    expect(document.querySelector('[data-testid="unified-simulator-view"]')).toBeNull();
  });

  it('portal mode hides expert-only inputs (mains pressure, mains flow, boiler output)', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await openPresentationView();

    // Navigate to simulator page and open it
    const nav = screen.getByRole('navigation', { name: 'Deck navigation' });
    const dots = nav.querySelectorAll('button');
    fireEvent.click(dots[dots.length - 1]);
    await waitFor(() => expect(screen.getByText('Open simulator →')).toBeTruthy());
    fireEvent.click(screen.getByText('Open simulator →'));
    await waitFor(() => expect(screen.getByTestId('unified-simulator-view')).toBeTruthy());

    // Expert-only labels must not appear in the portal simulator inputs
    expect(screen.queryByText('Mains pressure')).toBeNull();
    expect(screen.queryByText('Mains flow')).toBeNull();
    expect(screen.queryByText('Boiler output')).toBeNull();
    expect(screen.queryByText('Actual heat loss')).toBeNull();
  });
});

// ─── Branding ─────────────────────────────────────────────────────────────────

describe('CustomerPortalPage — branding', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('scrollTo', vi.fn()); });

  it('renders atlas-default brand header (company name "Atlas") when no brandId supplied', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-welcome')).toBeTruthy());

    // BrandedHeader rendered inside portal-hero
    const header = screen.getByTestId('branded-header');
    expect(header).toBeTruthy();
    expect(screen.getByTestId('branded-header-company').textContent).toBe('Atlas');
  });

  it('renders installer-demo company name when brandId="installer-demo"', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" brandId="installer-demo" />);
    await waitFor(() => expect(screen.getByTestId('portal-welcome')).toBeTruthy());

    expect(screen.getByTestId('branded-header-company').textContent).toBe('Demo Heating Co');
  });

  it('shows installer contact in header when showInstallerContact is true (installer-demo)', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" brandId="installer-demo" />);
    await waitFor(() => expect(screen.getByTestId('portal-welcome')).toBeTruthy());

    expect(screen.getByTestId('branded-header-contact')).toBeTruthy();
  });

  it('hides installer contact when showInstallerContact is false (atlas-default)', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-welcome')).toBeTruthy());

    expect(screen.queryByTestId('branded-header-contact')).toBeNull();
  });

  it('renders branded footer on the welcome page', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-welcome')).toBeTruthy());

    expect(screen.getByTestId('branded-footer')).toBeTruthy();
    expect(screen.getByTestId('branded-footer-company').textContent).toBe('Atlas');
  });

  it('recommendation headline is unchanged regardless of brand', async () => {
    // Both atlas-default and installer-demo must produce the same recommendation
    // headline because brand never touches recommendation logic.
    mockFetchSuccess(STUB_REPORT);
    const { unmount } = render(
      <CustomerPortalPage reference="test-report-1" token="valid-token" />,
    );
    await openPresentationView();
    // Collect page labels — these come from the engine, not the brand
    const nav = screen.getByRole('navigation', { name: 'Deck navigation' });
    const defaultLabels = Array.from(nav.querySelectorAll('button[aria-label^="Go to page:"]'))
      .map(b => b.getAttribute('aria-label'));
    unmount();

    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" brandId="installer-demo" />);
    await openPresentationView();
    const nav2 = screen.getByRole('navigation', { name: 'Deck navigation' });
    const demoBrandLabels = Array.from(nav2.querySelectorAll('button[aria-label^="Go to page:"]'))
      .map(b => b.getAttribute('aria-label'));

    // Slide labels are driven by the engine — must be identical for both brands
    expect(defaultLabels).toEqual(demoBrandLabels);
  });
});
