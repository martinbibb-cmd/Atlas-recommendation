import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CustomerPortalPage, {
  assertNoLegacyPresentationRenderer,
  CUSTOMER_PORTAL_PHONE_MEDIA_QUERY,
  LEGACY_PORTAL_RENDERER_LEAK_BANNER,
} from '../CustomerPortalPage';
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

const STORED_HOT_WATER_INPUT: EngineInputV2_3 = {
  ...STUB_ENGINE_INPUT,
  bathroomCount: 2,
  occupancyCount: 4,
  peakConcurrentOutlets: 2,
};

function mockFetchSuccess(report: ReportDetail) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, report }) } as unknown as Response);
}
function mockFetch404() {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ ok: false, error: 'Report not found' }) } as unknown as Response);
}

/** Helper: dev fixture flow — wait for choice screen then open presentation preview. */
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

  it('renders customer-safe portal error on 404', async () => {
    mockFetch404();
    render(<CustomerPortalPage reference="missing-ref" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-error')).toBeTruthy());
    expect(screen.queryByText('Report not found')).toBeNull();
    expect(screen.getByText(/Please contact your installer/i)).toBeTruthy();
  });

  it('production portal does not include InsightPackDeck or legacy insight/blueprint sections', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    expect(screen.queryByTestId('insight-pack-deck')).toBeNull();
    expect(screen.queryByTestId('presentation-deck')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Deck navigation' })).toBeNull();
    expect(screen.queryByTestId('pvsp-section')).toBeNull();
    expect(screen.queryByTestId('portal-ai-blob')).toBeNull();
    expect(screen.queryByTestId('share-copy-ai')).toBeNull();
    expect(screen.queryByTestId('share-download-ai')).toBeNull();
  });

  it('loads directly into the portal shell on production route', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    expect(screen.getByTestId('customer-portal-journey-composer')).toBeTruthy();
    expect(screen.getByTestId('portal-hero')).toBeTruthy();
    expect(screen.getByText(/Here’s what Atlas found/i)).toBeTruthy();
    expect(screen.getByText(/currentPortalRoute:/i)).toBeTruthy();
    expect(screen.getByText(/selectedPortalMode: portal/i)).toBeTruthy();
    expect(screen.getByText(/activeRendererComponent: CustomerPortalJourneyComposer/i)).toBeTruthy();
    expect(screen.queryByTestId('dev-portal-fixture-launcher')).toBeNull();
    expect(screen.queryByTestId('portal-legacy-renderer-leak-banner')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByTestId('library-portal-section')).toBeNull();
    expect(screen.queryByText(/AI-enhanced summary/i)).toBeNull();
    expect(screen.queryByText(/gemini|provider|api error|generation failed/i)).toBeNull();
  });

  it('shows customer-safe AI fallback text without provider/debug leakage', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        ok: true,
        report: {
          ...STUB_REPORT,
          payload: {
            ...STUB_REPORT.payload,
            engineInput: null,
          },
        },
      }),
    } as unknown as Response);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-error')).toBeTruthy());
    const errorText = screen.getByTestId('portal-error').textContent ?? '';
    expect(errorText).not.toMatch(/gemini|provider|api error|debug|models\/gemini/i);
  });

  it('phone viewport lands directly in portal mode (no welcome step)', async () => {
    mockFetchSuccess(STUB_REPORT);
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query === CUSTOMER_PORTAL_PHONE_MEDIA_QUERY,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    expect(screen.queryByTestId('portal-welcome')).toBeNull();
    expect(screen.queryByTestId('presentation-deck')).toBeNull();
    expect(screen.getByTestId('portal-page')).toHaveStyle({ overflowX: 'clip' });
    vi.unstubAllGlobals();
  });

  it('falls back to polished summary cards when a portal visual is not production-ready', async () => {
    mockFetchSuccess({
      ...STUB_REPORT,
      payload: {
        ...STUB_REPORT.payload,
        surveyData: STORED_HOT_WATER_INPUT as unknown as ReportDetail['payload']['surveyData'],
        engineInput: STORED_HOT_WATER_INPUT,
      },
    });
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('customer-portal-journey-composer')).toBeTruthy());
    expect(screen.getByTestId('customer-portal-visual-fallback-cylinder-recovery')).toBeTruthy();
    expect(screen.queryByText('Stored hot water recovery timeline')).toBeNull();
  });

  it('renders storytelling-led customer visuals for ageing and scenario comparison', async () => {
    mockFetchSuccess({
      ...STUB_REPORT,
      payload: {
        ...STUB_REPORT.payload,
        surveyData: STORED_HOT_WATER_INPUT as unknown as ReportDetail['payload']['surveyData'],
        engineInput: STORED_HOT_WATER_INPUT,
      },
    });
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('customer-portal-journey-composer')).toBeTruthy());
    expect(screen.getByText('Boiler ageing and response')).toBeTruthy();
    expect(screen.getByText('What each route would feel like at home')).toBeTruthy();
  });

  it('devInitialViewMode=insight reaches the real Insight renderer and shows route trace labels', async () => {
    render(
      <CustomerPortalPage
        reference="test-report-1"
        devFixtureInput={STUB_ENGINE_INPUT}
        devInitialViewMode="insight"
      />,
    );
    await waitFor(() => expect(screen.getByTestId('insight-pack-deck')).toBeTruthy());
    expect(screen.getByText(/selectedPortalMode: insight/i)).toBeTruthy();
    expect(screen.getByText(/activeRendererComponent: InsightPackDeck/i)).toBeTruthy();
    expect(screen.getByText(/insightRendererComponent: InsightPackDeck/i)).toBeTruthy();
  });

  it('devInitialViewMode=presentation opens presentation preview directly', async () => {
    render(
      <CustomerPortalPage
        reference="test-report-1"
        devFixtureInput={STUB_ENGINE_INPUT}
        devInitialViewMode="presentation"
      />,
    );
    await waitFor(() => expect(screen.getByTestId('presentation-deck')).toBeTruthy());
    expect(screen.queryByTestId('portal-welcome')).toBeNull();
    expect(screen.getByText(/selectedPortalMode: presentation/i)).toBeTruthy();
    expect(screen.getByText(/activeRendererComponent: CanonicalPresentationPage/i)).toBeTruthy();
  });

  it('devInitialViewMode=insight mounts CON_C02 section for stored hot water with two bathrooms', async () => {
    render(
      <CustomerPortalPage
        reference="test-report-stored-hot-water"
        devFixtureInput={STORED_HOT_WATER_INPUT}
        devInitialViewMode="insight"
      />,
    );
    await waitFor(() => expect(screen.getByTestId('insight-pack-deck')).toBeTruthy());
    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));

    await waitFor(() => expect(screen.getAllByTestId('pvsp-section').length).toBeGreaterThan(0));
    expect(screen.getByText('Real Insight route using library section')).toBeTruthy();
    expect(screen.getByText(/dailyUseRendererComponent: PressureVsStoragePortalSection/i)).toBeTruthy();
  });

  it('renders the canonical presentation deck — same pages as the in-room presentation', async () => {
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" devFixtureInput={STUB_ENGINE_INPUT} />);
    await openPresentationView();

    expect(screen.getByTestId('customer-portal')).toBeTruthy();

    // Portal header uses safe visit-scoped copy
    expect(screen.getByTestId('portal-hero')).toBeTruthy();
    expect(screen.getAllByText('Your home').length).toBeGreaterThan(0);

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
    expect(screen.getByText(/selectedPortalMode: presentation/i)).toBeTruthy();
    expect(screen.getByText(/activeRendererComponent: CanonicalPresentationPage/i)).toBeTruthy();
    expect(screen.queryByText(/insightRendererComponent:/i)).toBeNull();
    expect(screen.queryByText('Real Insight route using library section')).toBeNull();
  });

  it('hides route trace labels when dev labels are disabled', async () => {
    render(
      <CustomerPortalPage
        reference="test-report-1"
        devFixtureInput={STUB_ENGINE_INPUT}
        showDevTraceLabelsOverride={false}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('portal-welcome')).toBeTruthy());
    expect(screen.queryByTestId('portal-route-trace-labels')).toBeNull();

    fireEvent.click(screen.getByTestId('portal-welcome-presentation'));
    await waitFor(() => expect(screen.getByTestId('presentation-deck')).toBeTruthy());
    expect(screen.queryByTestId('portal-route-trace-labels')).toBeNull();
  });

  it('renders without customer name or address data', async () => {
    mockFetchSuccess({ ...STUB_REPORT, postcode: null, customer_name: null });
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    expect(screen.getAllByText('Your home').length).toBeGreaterThan(0);
    expect(screen.queryByText('SW1A 1AA')).toBeNull();
  });

  it('renders an optional display label safely when provided', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(
      <CustomerPortalPage
        reference="test-report-1"
        token="valid-token"
        portalVisitContextOverride={{
          customerDisplayLabel: 'The Smith household',
          personalDataMode: 'display_label_only',
        }}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    expect(screen.getAllByText('The Smith household').length).toBeGreaterThan(0);
    expect(screen.queryByText('SW1A 1AA')).toBeNull();
  });

  it('keeps journey section headings unchanged when route trace labels are toggled', async () => {
    mockFetchSuccess(STUB_REPORT);
    const { unmount } = render(
      <CustomerPortalPage
        reference="test-report-1"
        token="valid-token"
        showDevTraceLabelsOverride
      />,
    );
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    const labelsWithTrace = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    unmount();

    mockFetchSuccess(STUB_REPORT);
    render(
      <CustomerPortalPage
        reference="test-report-1"
        token="valid-token"
        showDevTraceLabelsOverride={false}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    const labelsWithoutTrace = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

    expect(labelsWithTrace).toEqual(labelsWithoutTrace);
  });

  it('assertNoLegacyPresentationRenderer flags production legacy renderer leakage', () => {
    const result = assertNoLegacyPresentationRenderer({
      isProductionPortalSurface: true,
      selectedPortalMode: 'presentation',
      activeRendererComponent: 'CanonicalPresentationPage',
    });
    expect(result.leakDetected).toBe(true);
    expect(result.message).toBe(LEGACY_PORTAL_RENDERER_LEAK_BANNER);
  });

  it('assertNoLegacyPresentationRenderer passes canonical production portal renderer', () => {
    const result = assertNoLegacyPresentationRenderer({
      isProductionPortalSurface: true,
      selectedPortalMode: 'portal',
      activeRendererComponent: 'CustomerPortalJourneyComposer',
    });
    expect(result.leakDetected).toBe(false);
  });

});

// ─── Branding ─────────────────────────────────────────────────────────────────

describe('CustomerPortalPage — branding', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('scrollTo', vi.fn()); });

  it('renders atlas-default brand header (company name "Atlas") when no brandId supplied', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());

    // BrandedHeader rendered inside portal-hero
    const header = screen.getByTestId('branded-header');
    expect(header).toBeTruthy();
    expect(screen.getByTestId('branded-header-company').textContent).toBe('Atlas');
  });

  it('renders installer-demo company name when brandId="installer-demo"', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" brandId="installer-demo" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());

    expect(screen.getByTestId('branded-header-company').textContent).toBe('Demo Heating Co');
  });

  it('shows installer contact in header when showInstallerContact is true (installer-demo)', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" brandId="installer-demo" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());

    expect(screen.getByTestId('branded-header-contact')).toBeTruthy();
  });

  it('hides installer contact when showInstallerContact is false (atlas-default)', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());

    expect(screen.queryByTestId('branded-header-contact')).toBeNull();
  });

  it('renders branded footer on the welcome page', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());

    expect(screen.getByTestId('branded-footer')).toBeTruthy();
    expect(screen.getByTestId('branded-footer-company').textContent).toBe('Atlas');
  });

  it('recommendation headline is unchanged regardless of brand', async () => {
    mockFetchSuccess(STUB_REPORT);
    const { unmount } = render(
      <CustomerPortalPage reference="test-report-1" token="valid-token" />,
    );
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    const defaultLabels = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    unmount();

    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" brandId="installer-demo" />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    const demoBrandLabels = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

    expect(defaultLabels).toEqual(demoBrandLabels);
  });
});
