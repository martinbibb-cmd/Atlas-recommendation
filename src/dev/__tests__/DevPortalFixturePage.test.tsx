/**
 * DevPortalFixturePage.test.tsx
 *
 * Tests for the dev-only portal fixture launcher at /dev/portal-fixtures.
 *
 * These tests verify that:
 *   1. The fixture launcher renders with all expected fixture buttons.
 *   2. Clicking a fixture opens the real portal choice screen.
 *   3. From the choice screen, Insight opens the real InsightPackDeck.
 *   4. The stored/unvented fixture shows PressureVsStoragePortalSection.
 *   5. DevPortalFixturePage is registered as dev_only (not exposed on production routes).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import DevPortalFixturePage, { PORTAL_FIXTURES } from '../DevPortalFixturePage';
import { DEV_ROUTE_REGISTRY } from '../devRouteRegistry';
import { runEngine } from '../../engine/Engine';
import { buildScenariosFromEngineOutput } from '../../engine/modules/buildScenariosFromEngineOutput';
import { buildDecisionFromScenarios } from '../../engine/modules/buildDecisionFromScenarios';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('scrollTo', vi.fn());
});

describe('DevPortalFixturePage — fixture launcher', () => {
  it('renders the fixture launcher with the dev banner', () => {
    render(<DevPortalFixturePage />);
    expect(screen.getByTestId('dev-portal-fixture-launcher')).toBeTruthy();
    expect(screen.getByTestId('dev-fixture-banner')).toBeTruthy();
    expect(screen.getByText(/Dev fixture portal — not customer data/i)).toBeTruthy();
  });

  it('renders all 5 fixture cards', () => {
    render(<DevPortalFixturePage />);
    const cards = screen.getAllByTestId('fixture-card');
    expect(cards.length).toBe(5);
  });

  it('renders "Open portal", "Open Insight", "Open In-room presentation", "Open implementation pack", and "Copy portal URL" for each fixture', () => {
    render(<DevPortalFixturePage />);
    for (const fixture of PORTAL_FIXTURES) {
      expect(screen.getByTestId(`fixture-open-${fixture.id}`)).toBeTruthy();
      expect(screen.getByTestId(`fixture-insight-${fixture.id}`)).toBeTruthy();
      expect(screen.getByTestId(`fixture-presentation-${fixture.id}`)).toBeTruthy();
      expect(screen.getByTestId(`fixture-implementation-${fixture.id}`)).toBeTruthy();
      expect(screen.getByTestId(`fixture-copy-url-${fixture.id}`)).toBeTruthy();
    }
  });

  it('shows "Open PDF comparison" for open-vented and heat-pump fixtures only', () => {
    render(<DevPortalFixturePage />);
    expect(screen.getByTestId('fixture-pdf-comparison-open_vented_to_sealed_unvented')).toBeTruthy();
    expect(screen.getByTestId('fixture-pdf-comparison-heat_pump_low_temp')).toBeTruthy();
    expect(screen.queryByTestId('fixture-pdf-comparison-combi_1bath')).toBeNull();
    expect(screen.queryByTestId('fixture-pdf-comparison-system_unvented_2bath')).toBeNull();
    expect(screen.queryByTestId('fixture-pdf-comparison-water_pressure_constraint')).toBeNull();
  });

  it('renders a Back button when onBack is provided', () => {
    const onBack = vi.fn();
    render(<DevPortalFixturePage onBack={onBack} />);
    const backBtn = screen.getByTestId('dev-fixture-page-back');
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('DevPortalFixturePage — fixture opens real portal choice screen', () => {
  it('clicking "Open portal" on the combi fixture shows the real portal welcome screen', async () => {
    render(<DevPortalFixturePage />);

    fireEvent.click(screen.getByTestId('fixture-open-combi_1bath'));

    // The dev active label should appear
    await waitFor(() =>
      expect(screen.getByTestId('dev-fixture-active-label')).toBeTruthy(),
    );
    expect(screen.getByText(/Dev fixture portal — not customer data/i)).toBeTruthy();

    // The real portal welcome / choice screen
    await waitFor(() =>
      expect(screen.getByTestId('portal-welcome')).toBeTruthy(),
    );
    expect(screen.getByTestId('portal-welcome-insight')).toBeTruthy();
    expect(screen.getByTestId('portal-welcome-presentation')).toBeTruthy();
  });

  it('"Back to fixtures" button returns to the launcher', async () => {
    render(<DevPortalFixturePage />);

    fireEvent.click(screen.getByTestId('fixture-open-combi_1bath'));
    await waitFor(() => expect(screen.getByTestId('portal-welcome')).toBeTruthy());

    fireEvent.click(screen.getByTestId('dev-fixture-back'));
    expect(screen.getByTestId('dev-portal-fixture-launcher')).toBeTruthy();
    expect(screen.queryByTestId('portal-welcome')).toBeNull();
  });
});

describe('DevPortalFixturePage — Insight opens real InsightPackDeck', () => {
  it('clicking "Open Insight" on any fixture opens InsightPackDeck directly', async () => {
    render(<DevPortalFixturePage />);

    fireEvent.click(screen.getByTestId('fixture-insight-combi_1bath'));

    await waitFor(() => expect(screen.getByTestId('insight-pack-deck')).toBeTruthy());
    // Route trace confirms the real renderer is active
    expect(screen.getByText(/activeRendererComponent: InsightPackDeck/i)).toBeTruthy();
  });

  it('clicking "Open In-room presentation" opens CanonicalPresentationPage directly', async () => {
    render(<DevPortalFixturePage />);

    fireEvent.click(screen.getByTestId('fixture-presentation-combi_1bath'));

    await waitFor(() => expect(screen.getByTestId('presentation-deck')).toBeTruthy());
    expect(screen.getByText(/activeRendererComponent: CanonicalPresentationPage/i)).toBeTruthy();
  });

  it('open-vented Insight shows dev PDF toggle and defaults to current Insight PDF path', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-insight-open_vented_to_sealed_unvented'));
    await waitFor(() => expect(screen.getByTestId('dev-insight-pdf-toggle')).toBeTruthy());
    expect(screen.getByTestId('dev-insight-pdf-toggle-current')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('insight-pack-deck')).toBeTruthy();
  });
});

describe('DevPortalFixturePage — library supporting PDF preview', () => {
  it('renders library preview without debug text in preview container', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-pdf-comparison-open_vented_to_sealed_unvented'));
    const preview = await screen.findByTestId('dev-supporting-pdf-preview');
    expect(within(preview).queryByText(/🔬/)).toBeNull();
    expect(within(preview).queryByText(/not customer data/i)).toBeNull();
    expect(within(preview).queryByText(/content pending/i)).toBeNull();
  });

  it('browser print preview button calls window.print safely', async () => {
    const printSpy = vi.fn();
    vi.stubGlobal('print', printSpy);

    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-pdf-comparison-open_vented_to_sealed_unvented'));
    await waitFor(() => expect(screen.getByTestId('dev-supporting-pdf-print')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dev-supporting-pdf-print'));
    expect(printSpy).toHaveBeenCalledOnce();
  });

  it('shows readiness panel and reports ready to replace', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-pdf-comparison-open_vented_to_sealed_unvented'));

    await waitFor(() => expect(screen.getByTestId('dev-supporting-pdf-readiness-panel')).toBeTruthy());
    expect(screen.getByTestId('dev-supporting-pdf-ready-value')).toHaveTextContent('Yes');
    expect(screen.getByTestId('dev-supporting-pdf-blocking-reasons-none')).toHaveTextContent('None');
  });

  it('keeps current Insight fallback available in comparison mode', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-pdf-comparison-open_vented_to_sealed_unvented'));
    await waitFor(() => expect(screen.getByTestId('dev-supporting-pdf-preview')).toBeTruthy());

    fireEvent.click(screen.getByTestId('dev-insight-pdf-toggle-current'));
    await waitFor(() => expect(screen.getByTestId('insight-pack-deck')).toBeTruthy());
  });

  it('keeps current Insight fallback available in heat-pump comparison mode', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-pdf-comparison-heat_pump_low_temp'));
    await waitFor(() => expect(screen.getByTestId('dev-supporting-pdf-preview')).toBeTruthy());

    fireEvent.click(screen.getByTestId('dev-insight-pdf-toggle-current'));
    await waitFor(() => expect(screen.getByTestId('insight-pack-deck')).toBeTruthy());
  });
});

describe('DevPortalFixturePage — stored/unvented fixture shows PressureVsStoragePortalSection', () => {
  it('system_unvented_2bath fixture shows PressureVsStoragePortalSection in the Insight tab', async () => {
    render(<DevPortalFixturePage />);

    // Open the system + unvented cylinder fixture via Insight shortcut
    fireEvent.click(screen.getByTestId('fixture-insight-system_unvented_2bath'));

    await waitFor(() => expect(screen.getByTestId('insight-pack-deck')).toBeTruthy());

    // Navigate to the Day to Day tab where PressureVsStoragePortalSection lives
    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));

    await waitFor(() =>
      expect(screen.getAllByTestId('pvsp-section').length).toBeGreaterThan(0),
    );
  });
});

describe('DevPortalFixturePage — production route safety', () => {
  it('DevPortalFixturePage is registered as dev_only in DEV_ROUTE_REGISTRY', () => {
    const entry = DEV_ROUTE_REGISTRY.find((r) => r.codeName === 'DevPortalFixturePage');
    expect(entry).toBeTruthy();
    expect(entry?.access).toBe('dev_only');
    expect(entry?.routePath).toBe('/dev/portal-fixtures');
  });

  it('/dev/portal-fixtures does not match the customer portal path pattern (/portal/:reference)', () => {
    // parsePortalPath is used by App.tsx to detect customer portal routes.
    // If this returns non-null for /dev/portal-fixtures, the fixture launcher
    // would be treated as a customer portal and would silently fail.
    const match = '/dev/portal-fixtures'.match(/^\/portal\/([^/]+)$/);
    expect(match).toBeNull();
  });
});

describe('DevPortalFixturePage — implementation pack', () => {
  function getExpectedRecommendedScenarioId(fixtureId: string): string {
    const fixture = PORTAL_FIXTURES.find((candidate) => candidate.id === fixtureId);
    if (!fixture) throw new Error(`Fixture not found: ${fixtureId}`);
    const engineResult = runEngine(fixture.engineInput);
    const scenarios = buildScenariosFromEngineOutput(engineResult.engineOutput);
    const rawType = fixture.engineInput.currentHeatSourceType;
    const boilerType: 'combi' | 'system' | 'regular' =
      rawType === 'system' || rawType === 'regular' ? rawType : 'combi';
    const decision = buildDecisionFromScenarios({
      scenarios,
      boilerType,
      ageYears: fixture.engineInput.currentSystem?.boiler?.ageYears ?? 0,
      occupancyCount: fixture.engineInput.occupancyCount,
      bathroomCount: fixture.engineInput.bathroomCount,
      showerCompatibilityNote: engineResult.engineOutput.showerCompatibilityNote,
    });
    return decision.recommendedScenarioId;
  }

  it('fixture opens implementation pack', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-implementation-pack-shell')).toBeTruthy());
    expect(screen.getByTestId('dev-implementation-pack-panel')).toBeTruthy();
  });

  it('stored/unvented shows G3 qualification', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    const panel = await screen.findByTestId('dev-implementation-pack-panel');
    expect(within(panel).getAllByText(/G3 Unvented Hot Water Installer/i).length).toBeGreaterThan(0);
  });

  it('heat pump shows MCS and emitter review', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-heat_pump_low_temp'));
    const panel = await screen.findByTestId('dev-implementation-pack-panel');
    expect(within(panel).getAllByText(/MCS-Certified Heat Pump Installer/i).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(/Emitter suitability for heat pump flow temperatures has not been confirmed/i).length).toBeGreaterThan(0);
  });

  it('open-vented shows loft capping and filling loop', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-open_vented_to_sealed_unvented'));
    const panel = await screen.findByTestId('dev-implementation-pack-panel');
    expect(within(panel).getByText(/Capping of loft vent and cold-feed pipework/i)).toBeTruthy();
    expect(within(panel).getByText(/Sealed system filling loop/i)).toBeTruthy();
  });

  it('customer copy does not appear in implementation pack', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-combi_1bath'));
    const panel = await screen.findByTestId('dev-implementation-pack-panel');
    expect(within(panel).queryByText(/Choose how you would like to explore your results/i)).toBeNull();
  });

  it('recommendation remains unchanged between fixture engine output and implementation pack', async () => {
    render(<DevPortalFixturePage />);
    const expectedScenarioId = getExpectedRecommendedScenarioId('system_unvented_2bath');
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    const scenario = await screen.findByTestId('dev-implementation-pack-recommendation');
    expect(scenario.textContent).toBe(expectedScenarioId);
  });
});
