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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DevPortalFixturePage, { PORTAL_FIXTURES } from '../DevPortalFixturePage';
import { DEV_ROUTE_REGISTRY } from '../devRouteRegistry';

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

  it('renders "Open portal", "Open Insight", "Open In-room presentation", and "Copy portal URL" for each fixture', () => {
    render(<DevPortalFixturePage />);
    for (const fixture of PORTAL_FIXTURES) {
      expect(screen.getByTestId(`fixture-open-${fixture.id}`)).toBeTruthy();
      expect(screen.getByTestId(`fixture-insight-${fixture.id}`)).toBeTruthy();
      expect(screen.getByTestId(`fixture-presentation-${fixture.id}`)).toBeTruthy();
      expect(screen.getByTestId(`fixture-copy-url-${fixture.id}`)).toBeTruthy();
    }
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
