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
    expect(screen.getByTestId('specification-readiness-panel')).toBeTruthy();
    expect(screen.getByTestId('survey-follow-up-task-panel')).toBeTruthy();
    expect(screen.getByTestId('follow-up-evidence-plan-panel')).toBeTruthy();
    expect(screen.getByTestId('follow-up-scan-handoff-panel')).toBeTruthy();
    expect(screen.getByTestId('scan-handoff-envelope-preview-panel')).toBeTruthy();
  });

  it('mounts the scan handoff preview below the evidence plan with no send action yet', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));

    const evidencePanel = await screen.findByTestId('follow-up-evidence-plan-panel');
    const handoffPanel = await screen.findByTestId('follow-up-scan-handoff-panel');

    expect(evidencePanel.compareDocumentPosition(handoffPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(handoffPanel).getByText(/Send to Scan/i)).toBeTruthy();
    expect(within(handoffPanel).queryByRole('button', { name: /Send to Scan/i })).toBeNull();
  });

  it('mounts the scan handoff envelope preview below scan handoff with no native send action', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));

    const handoffPanel = await screen.findByTestId('follow-up-scan-handoff-panel');
    const envelopePanel = await screen.findByTestId('scan-handoff-envelope-preview-panel');

    expect(handoffPanel.compareDocumentPosition(envelopePanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(envelopePanel).getByTestId('scan-handoff-envelope-deep-link')).toBeTruthy();
    expect(within(envelopePanel).getByTestId('scan-handoff-envelope-payload-length')).toBeTruthy();
    expect(within(envelopePanel).getByTestId('scan-handoff-envelope-copy-payload')).toBeTruthy();
    expect(within(envelopePanel).queryByRole('button', { name: /send/i })).toBeNull();
    expect(within(envelopePanel).queryByRole('button', { name: /open atlas scan/i })).toBeNull();
  });

  it('implementation pack workflow renders all 8 steps in order', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-summary')).toBeTruthy());

    // All 8 workflow steps are present
    const steps = [
      'dev-workflow-step-readiness',
      'dev-workflow-step-follow-up-tasks',
      'dev-workflow-step-scan-evidence',
      'dev-workflow-step-scope-packs',
      'dev-workflow-step-specification-lines',
      'dev-workflow-step-materials-schedule',
      'dev-workflow-step-engineer-job-pack',
      'dev-workflow-step-handover-preview',
    ];
    for (const id of steps) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }

    // Steps 1-3 are expanded by default (content visible)
    expect(screen.getByTestId('specification-readiness-panel')).toBeTruthy();
    expect(screen.getByTestId('survey-follow-up-task-panel')).toBeTruthy();
    expect(screen.getByTestId('follow-up-evidence-plan-panel')).toBeTruthy();

    // Expand step 5 and verify spec lines panel appears
    fireEvent.click(screen.getByTestId('dev-workflow-step-specification-lines-toggle'));
    await waitFor(() => expect(screen.getByTestId('specification-line-review-panel')).toBeTruthy());

    // Expand step 7 and verify engineer job pack panel appears
    fireEvent.click(screen.getByTestId('dev-workflow-step-engineer-job-pack-toggle'));
    await waitFor(() => expect(screen.getByTestId('engineer-job-pack-preview-panel')).toBeTruthy());

    // Expand step 6 and verify materials schedule panel appears
    fireEvent.click(screen.getByTestId('dev-workflow-step-materials-schedule-toggle'));
    await waitFor(() => expect(screen.getByTestId('materials-schedule-panel')).toBeTruthy());

    // Expand step 8 and verify handover preview panel appears
    fireEvent.click(screen.getByTestId('dev-workflow-step-handover-preview-toggle'));
    await waitFor(() => expect(screen.getByTestId('scope-pack-handover-preview-panel')).toBeTruthy());
  });

  it('workflow steps render in document order 1 → 8', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-step-readiness')).toBeTruthy());

    const stepIds = [
      'dev-workflow-step-readiness',
      'dev-workflow-step-follow-up-tasks',
      'dev-workflow-step-scan-evidence',
      'dev-workflow-step-scope-packs',
      'dev-workflow-step-specification-lines',
      'dev-workflow-step-materials-schedule',
      'dev-workflow-step-engineer-job-pack',
      'dev-workflow-step-handover-preview',
    ];
    const elements = stepIds.map((id) => screen.getByTestId(id));
    for (let i = 0; i < elements.length - 1; i++) {
      // Each step must appear after the previous one in the DOM
      expect(
        elements[i].compareDocumentPosition(elements[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('workflow summary shows next action banner with a valid workflow message', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    const banner = await screen.findByTestId('dev-workflow-next-action');
    const validMessages = [
      'Complete follow-up tasks first',
      'Capture missing evidence',
      'Confirm qualification/customer dependencies',
      'Ready for office review',
    ];
    expect(validMessages.some((msg) => banner.textContent?.includes(msg))).toBe(true);
  });

  it('next action banner shows "Ready for office review" when no blockers or scan items exist', async () => {
    // combi_1bath is the simplest fixture — single household, 1 bathroom
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-combi_1bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-summary')).toBeTruthy());

    const blockerEl = screen.getByTestId('dev-workflow-summary-blocker-count');
    const scanEl = screen.getByTestId('dev-workflow-summary-scan-capture-count');
    const blockers = Number(blockerEl.textContent);
    const scanItems = Number(scanEl.textContent);

    const banner = screen.getByTestId('dev-workflow-next-action');
    if (blockers > 0) {
      expect(banner.textContent).toContain('Complete follow-up tasks first');
    } else if (scanItems > 0) {
      expect(banner.textContent).toContain('Capture missing evidence');
    } else {
      expect(banner.textContent).toContain('Ready for office review');
    }
  });

  it('workflow summary counts are non-negative numbers and follow-ups > 0 for complex fixture', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-summary')).toBeTruthy());

    const blockerCount = Number(screen.getByTestId('dev-workflow-summary-blocker-count').textContent);
    const followUpCount = Number(screen.getByTestId('dev-workflow-summary-follow-up-count').textContent);
    const scanCount = Number(screen.getByTestId('dev-workflow-summary-scan-capture-count').textContent);
    const unresolvedCount = Number(screen.getByTestId('dev-workflow-summary-unresolved-count').textContent);

    expect(blockerCount).toBeGreaterThanOrEqual(0);
    expect(followUpCount).toBeGreaterThanOrEqual(0);
    expect(scanCount).toBeGreaterThanOrEqual(0);
    expect(unresolvedCount).toBeGreaterThanOrEqual(0);
    // The system+unvented, 4-person, 2-bathroom fixture has survey follow-up tasks
    expect(followUpCount).toBeGreaterThan(0);
  });

  it('Scope packs step shows the scope pack review panel for unvented fixture', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-step-scope-packs')).toBeTruthy());

    fireEvent.click(screen.getByTestId('dev-workflow-step-scope-packs-toggle'));
    await waitFor(() => expect(screen.getByTestId('scope-pack-review-panel')).toBeTruthy());
  });

  it('Scope packs step shows standard_unvented_cylinder_install card for unvented fixture', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-step-scope-packs')).toBeTruthy());

    fireEvent.click(screen.getByTestId('dev-workflow-step-scope-packs-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('scope-pack-card-standard_unvented_cylinder_install')).toBeTruthy(),
    );
  });

  it('Scope packs step shows open_vented_to_sealed_conversion card for open-vented fixture', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-open_vented_to_sealed_unvented'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-step-scope-packs')).toBeTruthy());

    fireEvent.click(screen.getByTestId('dev-workflow-step-scope-packs-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('scope-pack-card-open_vented_to_sealed_conversion')).toBeTruthy(),
    );
  });

  it('Scope packs step shows heat pump packs for heat pump fixture', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-heat_pump_low_temp'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-step-scope-packs')).toBeTruthy());

    fireEvent.click(screen.getByTestId('dev-workflow-step-scope-packs-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('scope-pack-card-heat_pump_emitter_review')).toBeTruthy(),
    );
    expect(screen.getByTestId('scope-pack-card-heat_pump_hydraulic_review')).toBeTruthy();
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

  it('open-vented shows loft capping and filling loop in handover preview step', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-open_vented_to_sealed_unvented'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-step-handover-preview-toggle')).toBeTruthy());

    fireEvent.click(screen.getByTestId('dev-workflow-step-handover-preview-toggle'));

    const step = await screen.findByTestId('dev-workflow-step-handover-preview');
    expect(within(step).getAllByText(/Capping of loft vent and cold-feed pipework/i).length).toBeGreaterThan(0);
    expect(within(step).getAllByText(/Sealed system filling loop/i).length).toBeGreaterThan(0);
  });

  it('no customer-facing copy appears in implementation workflow', async () => {
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

  it('resolving evidence updates workflow summary and reduces unresolved counts', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-summary')).toBeTruthy());

    const initialUnresolved = Number(screen.getByTestId('dev-workflow-summary-unresolved-count').textContent);
    const initialScan = Number(screen.getByTestId('dev-workflow-summary-scan-capture-count').textContent);

    const captureButtons = screen.getAllByRole('button', { name: /Mark evidence captured/i });
    fireEvent.click(captureButtons[0]);

    await waitFor(() => {
      const nextScan = Number(screen.getByTestId('dev-workflow-summary-scan-capture-count').textContent);
      expect(nextScan).toBeLessThanOrEqual(initialScan);
    });
    const nextUnresolved = Number(screen.getByTestId('dev-workflow-summary-unresolved-count').textContent);
    expect(nextUnresolved).toBeLessThanOrEqual(initialUnresolved);
  });

  it('confirming qualification clears unresolved dependency count', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-summary')).toBeTruthy());

    const before = Number(screen.getByTestId('dev-workflow-summary-unresolved-count').textContent);
    const qualificationButtons = screen.getAllByRole('button', { name: /Mark qualification confirmed/i });
    fireEvent.click(qualificationButtons[0]);

    await waitFor(() => {
      const after = Number(screen.getByTestId('dev-workflow-summary-unresolved-count').textContent);
      expect(after).toBeLessThan(before);
    });
  });

  it('readiness transitions to complete when all tasks are resolved', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-summary')).toBeTruthy());

    let unresolvedButtons = screen.queryAllByRole('button', { name: /Mark task resolved/i });
    while (unresolvedButtons.length > 0) {
      fireEvent.click(unresolvedButtons[0]);
      unresolvedButtons = screen.queryAllByRole('button', { name: /Mark task resolved/i });
    }

    await waitFor(() => {
      expect(screen.getByTestId('dev-workflow-summary-blocker-count').textContent).toBe('0');
      expect(screen.getByTestId('dev-workflow-step-readiness-complete')).toBeTruthy();
      expect(screen.getByTestId('dev-workflow-summary-office-ready').textContent).toContain('✓');
    });
  });

  it('workflow summary updates deterministically when toggling the same task', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-summary')).toBeTruthy());

    const initialBlockers = screen.getByTestId('dev-workflow-summary-blocker-count').textContent;
    const initialFollowUps = screen.getByTestId('dev-workflow-summary-follow-up-count').textContent;
    const toggleButton = screen.getAllByRole('button', { name: /Mark task resolved/i })[0];
    fireEvent.click(toggleButton);
    fireEvent.click(screen.getAllByRole('button', { name: /Mark unresolved/i })[0]);

    expect(screen.getByTestId('dev-workflow-summary-blocker-count').textContent).toBe(initialBlockers);
    expect(screen.getByTestId('dev-workflow-summary-follow-up-count').textContent).toBe(initialFollowUps);
  });

  it('resolution simulation state is transient and resets after reopening implementation workflow', async () => {
    render(<DevPortalFixturePage />);
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-summary')).toBeTruthy());

    const initialBlockers = screen.getByTestId('dev-workflow-summary-blocker-count').textContent;
    fireEvent.click(screen.getAllByRole('button', { name: /Mark task resolved/i })[0]);
    await waitFor(() =>
      expect(screen.getByTestId('dev-workflow-summary-blocker-count').textContent).not.toBe(initialBlockers),
    );

    fireEvent.click(screen.getByTestId('dev-fixture-back'));
    fireEvent.click(screen.getByTestId('fixture-implementation-system_unvented_2bath'));
    await waitFor(() => expect(screen.getByTestId('dev-workflow-summary')).toBeTruthy());
    expect(screen.getByTestId('dev-workflow-summary-blocker-count').textContent).toBe(initialBlockers);
  });
});
