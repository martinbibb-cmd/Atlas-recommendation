import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CustomerPortalPage, { CUSTOMER_PORTAL_PHONE_MEDIA_QUERY } from '../CustomerPortalPage';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import { PHONE_QA_VIEWPORTS } from '../../../dev/phoneQa/phoneQaConfig';

const PHONE_QA_FIXTURE: EngineInputV2_3 = {
  postcode: 'M1 1AA',
  dynamicMainsPressure: 2.4,
  mainsDynamicFlowLpm: 16,
  primaryPipeDiameter: 22,
  heatLossWatts: 8200,
  radiatorCount: 10,
  bathroomCount: 2,
  occupancyCount: 3,
  peakConcurrentOutlets: 2,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'steady_home',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: false,
  currentHeatSourceType: 'system',
  dhwStorageType: 'unvented',
  currentSystem: { boiler: { type: 'system', ageYears: 11 } },
};

function stubPhoneMatchMedia() {
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
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('scrollTo', vi.fn());
});

describe('CustomerPortalPage phone QA', () => {
  it.each(PHONE_QA_VIEWPORTS)('opens directly in presentation mode for %s smoke viewport', async (_viewport) => {
    stubPhoneMatchMedia();

    render(
      <CustomerPortalPage
        reference="phone-qa-portal"
        devFixtureInput={PHONE_QA_FIXTURE}
        showDevTraceLabelsOverride={false}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('presentation-deck')).toBeInTheDocument());
    expect(screen.queryByTestId('portal-welcome')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Deck navigation' })).toBeInTheDocument();
  });

  it('keeps safe-area padding and mobile overflow guards in customer portal CSS', () => {
    const portalCss = readFileSync(new URL('../CustomerPortalPage.css', import.meta.url), 'utf8');

    expect(portalCss).toContain('var(--customer-safe-top)');
    expect(portalCss).toContain('var(--customer-safe-right)');
    expect(portalCss).toContain('var(--customer-safe-bottom)');
    expect(portalCss).toContain('var(--customer-safe-left)');
    expect(portalCss).toMatch(/overflow-x:\s*clip/);
  });

  it('keeps the comparison modal as a full-screen sheet on phone widths', () => {
    const deckCss = readFileSync(new URL('../../presentation/PresentationDeck.css', import.meta.url), 'utf8');

    expect(deckCss).toContain('@media (max-width: 768px)');
    expect(deckCss).toContain('width: 100vw;');
    expect(deckCss).toContain('max-width: 100vw;');
    expect(deckCss).toContain('max-height: 100dvh;');
    expect(deckCss).toContain('padding-bottom: var(--customer-safe-bottom);');
  });
});
