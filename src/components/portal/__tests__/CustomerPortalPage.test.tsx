import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CustomerPortalPage from '../CustomerPortalPage';
import type { ReportDetail } from '../../../lib/reports/reportApi';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

vi.mock('../../../lib/portal/portalToken', () => ({ validatePortalToken: vi.fn(async (_r: string, token?: string) => token === 'valid-token' ? 'valid' : 'invalid') }));

const STUB_ENGINE_OUTPUT: EngineOutputV1 = {
  eligibility: [], redFlags: [], recommendation: { primary: 'Combi boiler' }, explainers: [],
  options: [
    { id: 'combi', label: 'Combi boiler', status: 'viable', headline: 'Best fit', why: ['Compact installation'], requirements: [], heat: { status: 'ok', headline: 'Good heat output', bullets: ['Adequate for home'] }, dhw: { status: 'ok', headline: 'Meets hot water demand', bullets: ['Sufficient flow rate'] }, engineering: { status: 'ok', headline: 'Straightforward installation', bullets: [] }, sensitivities: [], typedRequirements: { mustHave: ['New flue'], likelyUpgrades: [], niceToHave: [] } },
    { id: 'stored_unvented', label: 'Unvented cylinder', status: 'caution', headline: 'Alternative option', why: ['Higher storage capacity'], requirements: [], heat: { status: 'ok', headline: '', bullets: [] }, dhw: { status: 'caution', headline: 'Higher upfront cost', bullets: [] }, engineering: { status: 'ok', headline: '', bullets: [] }, sensitivities: [], typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] } },
  ],
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

  it('renders the guided closing journey with findings, recommendation, why-fits, alternatives and scenarios', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('customer-portal')).toBeTruthy());

    // Hero section
    expect(screen.getByTestId('portal-hero')).toBeTruthy();
    expect(screen.getAllByText('SW1A 1AA').length).toBeGreaterThan(0);

    // Section A — Findings
    expect(screen.getByTestId('portal-findings-section')).toBeTruthy();
    expect(screen.getByText('What we found in your home')).toBeTruthy();

    // Section B — Recommendation (clear, singular)
    expect(screen.getByTestId('portal-recommendation-section')).toBeTruthy();
    expect(screen.getByTestId('portal-recommendation-title')).toBeTruthy();
    expect(screen.getByText('Atlas recommends')).toBeTruthy();

    // Section C — Why fits
    expect(screen.getByTestId('portal-why-fits-section')).toBeTruthy();
    expect(screen.getByText('Why this fits your home')).toBeTruthy();

    // Section E — Alternatives (caution option is present in stub)
    expect(screen.getByTestId('portal-alternatives-section')).toBeTruthy();
    expect(screen.getByText('Other options considered')).toBeTruthy();

    // Section F — Scenarios (shown before simulator is opened)
    expect(screen.getByTestId('portal-scenario-section')).toBeTruthy();
    expect(screen.getByText('See how it behaves in your home')).toBeTruthy();
  });

  it('opens the live simulator after clicking a scenario CTA button', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-scenario-cta-more_hot_water')).toBeTruthy());

    // Simulator is not yet rendered
    expect(document.querySelector('[data-testid="portal-unified-simulator"]')).toBeNull();

    // Click a scenario CTA to launch the simulator
    fireEvent.click(screen.getByTestId('portal-scenario-cta-more_hot_water'));

    // Now the simulator section should be visible
    await waitFor(() => expect(screen.getByTestId('portal-unified-simulator')).toBeTruthy());
    expect(screen.getByTestId('unified-simulator-view')).toBeTruthy();
    expect(screen.getByTestId('performance-outcomes-panel')).toBeTruthy();
    expect(screen.getByTestId('advice-panel')).toBeTruthy();

    // Scenario section should be replaced by the simulator
    expect(document.querySelector('[data-testid="portal-scenario-section"]')).toBeNull();
  });

  it('clicking the print button shows PrintableRecommendationPage in portal mode', async () => {
    mockFetchSuccess(STUB_REPORT);
    render(<CustomerPortalPage reference="test-report-1" token="valid-token" />);
    await waitFor(() => expect(screen.getByTestId('portal-scenario-cta-more_hot_water')).toBeTruthy());

    // First open the simulator
    fireEvent.click(screen.getByTestId('portal-scenario-cta-more_hot_water'));
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
    await waitFor(() => expect(screen.getByTestId('portal-scenario-cta-more_hot_water')).toBeTruthy());

    // Open the simulator first
    fireEvent.click(screen.getByTestId('portal-scenario-cta-more_hot_water'));
    await waitFor(() => expect(screen.getByTestId('unified-simulator-view')).toBeTruthy());

    // Expert-only labels must not appear in the portal simulator inputs
    expect(screen.queryByText('Mains pressure')).toBeNull();
    expect(screen.queryByText('Mains flow')).toBeNull();
    expect(screen.queryByText('Boiler output')).toBeNull();
    expect(screen.queryByText('Actual heat loss')).toBeNull();
  });
});
