import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CustomerPortalPage from '../CustomerPortalPage';
import type { ReportDetail } from '../../../lib/reports/reportApi';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

vi.mock('../../../lib/portal/portalToken', () => ({ validatePortalToken: vi.fn(async (_r: string, token?: string) => token === 'valid-token' ? 'valid' : 'invalid') }));

const STUB_ENGINE_OUTPUT: EngineOutputV1 = {
  eligibility: [], redFlags: [], recommendation: { primary: 'Combi boiler' }, explainers: [],
  options: [{ id: 'combi', label: 'Combi boiler', status: 'viable', headline: 'Best fit', why: ['Compact installation'], requirements: [], heat: { status: 'ok', headline: '', bullets: [] }, dhw: { status: 'ok', headline: '', bullets: [] }, engineering: { status: 'ok', headline: '', bullets: [] }, sensitivities: [] }],
  verdict: { title: 'Combi boiler recommended', status: 'good', reasons: ['Adequate mains pressure'], confidence: { level: 'high', reasons: [] }, assumptionsUsed: [] },
};
const STUB_ENGINE_INPUT: EngineInputV2_3 = { postcode: 'SW1A 1AA', dynamicMainsPressure: 2.5, mainsDynamicFlowLpm: 14, primaryPipeDiameter: 22, heatLossWatts: 8000, radiatorCount: 10, bathroomCount: 1, occupancyCount: 2, hasLoftConversion: false, returnWaterTemp: 45, occupancySignature: 'professional', buildingMass: 'medium', highOccupancy: false, preferCombi: true };
const STUB_REPORT: ReportDetail = { id: 'test-report-1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', status: 'complete', title: null, customer_name: null, postcode: 'SW1A 1AA', visit_id: null, payload: { surveyData: STUB_ENGINE_INPUT as unknown as ReportDetail['payload']['surveyData'], engineInput: STUB_ENGINE_INPUT, engineOutput: STUB_ENGINE_OUTPUT, decisionSynthesis: null } };

function mockFetchSuccess(report: ReportDetail) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, report }) } as unknown as Response);
}
function mockFetch404() {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ ok: false, error: 'Report not found' }) } as unknown as Response);
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

  it('renders the unified portal when the report loads', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('customer-portal')).toBeTruthy());
    expect(screen.getByText('Glass Box Portal')).toBeTruthy();
    expect(screen.getByTestId('portal-hero')).toBeTruthy();
    expect(screen.getByTestId('portal-unified-simulator')).toBeTruthy();
    expect(screen.getByTestId('unified-simulator-view')).toBeTruthy();
    expect(screen.getByTestId('performance-outcomes-panel')).toBeTruthy();
    expect(screen.getByTestId('advice-panel')).toBeTruthy();
    expect(screen.getByText('SW1A 1AA')).toBeTruthy();
  });

  it('clicking the print button shows PrintableRecommendationPage in portal mode', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('unified-simulator-view')).toBeTruthy());
    const printBtn = screen.getByTestId('print-report-btn');
    fireEvent.click(printBtn);
    // After clicking, PrintableRecommendationPage should replace the simulator view.
    // The printable page renders a back button and print button in its toolbar.
    await waitFor(() => expect(screen.getByLabelText('Back to advice page')).toBeTruthy());
    // The original simulator view should no longer be visible.
    expect(document.querySelector('[data-testid="unified-simulator-view"]')).toBeNull();
  });

  it('portal mode hides expert-only inputs (mains pressure, mains flow, boiler output)', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('unified-simulator-view')).toBeTruthy());
    // Expert-only labels must not appear in the portal simulator inputs
    expect(screen.queryByText('Mains pressure')).toBeNull();
    expect(screen.queryByText('Mains flow')).toBeNull();
    expect(screen.queryByText('Boiler output')).toBeNull();
    expect(screen.queryByText('Actual heat loss')).toBeNull();
  });
});
