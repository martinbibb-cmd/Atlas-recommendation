/**
 * PresentationDeck.canonicalOrder.test.tsx
 *
 * Validates the canonical presentation sequence after the PR8d cleanup:
 *
 *   - The active deck does NOT contain any of the old legacy individual slides
 *     (house, home, energy, current_system, architecture).
 *   - The deck does contain the new slides in the correct order:
 *       1. quadrant_overview
 *       2. condition (ageing)
 *       3. quick wins (low-hanging fruit, conditional)
 *       4. go further (performance upgrades, conditional)
 *       5. options
 *       6. ranking
 *       7. option_* / compare_*
 *       8. simulator
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PresentationDeck from '../PresentationDeck';
import { runEngine } from '../../../engine/Engine';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixture ──────────────────────────────────────────────────────────────────

/** Minimal valid input that produces a recommendation with at least one option. */
const FIXTURE: EngineInputV2_3 = {
  postcode:                   'SW1A 1AA',
  dynamicMainsPressure:       2.5,
  mainsDynamicFlowLpm:        18,
  mainsDynamicFlowLpmKnown:   true,
  buildingMass:               'medium',
  primaryPipeDiameter:        22,
  heatLossWatts:              8000,
  radiatorCount:              10,
  hasLoftConversion:          false,
  returnWaterTemp:            45,
  occupancySignature:         'professional',
  highOccupancy:              false,
  preferCombi:                true,
  bathroomCount:              1,
  occupancyCount:             2,
  currentHeatSourceType:      'combi',
  dhwStorageType:             'none',
  demandTimingOverrides:      { bathFrequencyPerWeek: 0, simultaneousUseSeverity: 'low' },
  // Age is required to produce the System Condition (ageing) slide.
  // Without it hasRealEvidence = false and the slide is suppressed.
  currentBoilerAgeYears:      8,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the ordered list of progress-dot aria-labels from the rendered deck.
 * Each dot has aria-label="Go to page: <label>" so we extract the label part.
 */
function getPageLabels(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Deck navigation' });
  const buttons = Array.from(nav.querySelectorAll('button[aria-label^="Go to page:"]'));
  return buttons.map(b => {
    const raw = b.getAttribute('aria-label') ?? '';
    return raw.replace('Go to page: ', '').trim();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PresentationDeck — canonical page order', () => {
  let labels: string[];

  beforeAll(() => {
    const result = runEngine(FIXTURE);
    render(
      <PresentationDeck
        result={result}
        input={FIXTURE}
        recommendationResult={result.recommendationResult}
      />,
    );
    labels = getPageLabels();
  });

  // ── New pages must be present ──────────────────────────────────────────────

  it('first page is the quadrant Overview', () => {
    expect(labels[0]).toBe('Overview');
  });

  it('second page is system Condition (ageing)', () => {
    expect(labels[1]).toBe('Condition');
  });

  it('third page is Quick wins (low-hanging fruit)', () => {
    expect(labels[2]).toBe('Quick wins');
  });

  it('fourth page is Go further (performance upgrades)', () => {
    expect(labels[3]).toBe('Go further');
  });

  it('fifth page is Options (available systems)', () => {
    expect(labels[4]).toBe('Options');
  });

  it('sixth page is Best fit (physics ranking)', () => {
    expect(labels[5]).toBe('Best fit');
  });

  it('last page is the Proof (simulator handoff)', () => {
    expect(labels[labels.length - 1]).toBe('Proof');
  });

  // ── Legacy pages must NOT be present ──────────────────────────────────────

  it('does NOT include a standalone House page', () => {
    expect(labels).not.toContain('House');
  });

  it('does NOT include a standalone Home page', () => {
    expect(labels).not.toContain('Home');
  });

  it('does NOT include a standalone Energy page', () => {
    expect(labels).not.toContain('Energy');
  });

  it('does NOT include a standalone System page', () => {
    expect(labels).not.toContain('System');
  });

  it('does NOT include a standalone Blueprint (current architecture) page', () => {
    expect(labels).not.toContain('Blueprint');
  });

  // ── Overall sequence structure ─────────────────────────────────────────────

  it('deck has at least 7 pages (overview + condition + quick-wins + go-further + options + ranking + proof)', () => {
    expect(labels.length).toBeGreaterThanOrEqual(7);
  });

  it('pages after Best fit are Option or Changes slides before Proof', () => {
    const rankingIdx = labels.indexOf('Best fit');
    const proofIdx   = labels.indexOf('Proof');
    expect(rankingIdx).toBeGreaterThanOrEqual(0);
    expect(proofIdx).toBeGreaterThan(rankingIdx);
    const between = labels.slice(rankingIdx + 1, proofIdx);
    for (const label of between) {
      expect(label).toMatch(/^(Option \d+|Changes \d+)$/);
    }
  });
});

// ─── Branding ─────────────────────────────────────────────────────────────────

import { BrandProvider } from '../../../features/branding';
import type { BrandProfileV1 } from '../../../features/branding/brandProfile';

describe('PresentationDeck — branding', () => {
  const result = runEngine(FIXTURE);

  function renderWithBrand(brandId?: string) {
    render(
      <BrandProvider brandId={brandId}>
        <PresentationDeck
          result={result}
          input={FIXTURE}
          recommendationResult={result.recommendationResult}
        />
      </BrandProvider>,
    );
  }

  function renderWithProfile(profile: BrandProfileV1) {
    render(
      <BrandProvider profile={profile}>
        <PresentationDeck
          result={result}
          input={FIXTURE}
          recommendationResult={result.recommendationResult}
        />
      </BrandProvider>,
    );
  }

  it('renders brand band when inside a BrandProvider', () => {
    renderWithBrand();
    expect(screen.getByTestId('deck-brand-band')).toBeTruthy();
  });

  it('shows atlas-default company name "Atlas" when no brandId supplied', () => {
    renderWithBrand();
    expect(screen.getByTestId('deck-brand-company').textContent).toBe('Atlas');
  });

  it('shows installer-demo company name when brandId="installer-demo"', () => {
    renderWithBrand('installer-demo');
    expect(screen.getByTestId('deck-brand-company').textContent).toBe('Demo Heating Co');
  });

  it('does NOT render brand band when rendered outside a BrandProvider', () => {
    render(
      <PresentationDeck
        result={result}
        input={FIXTURE}
        recommendationResult={result.recommendationResult}
      />,
    );
    expect(screen.queryByTestId('deck-brand-band')).toBeNull();
  });

  it('renders logo when logoUrl is set on the active brand', () => {
    renderWithProfile({
      version: '1.0',
      brandId: 'logo-deck',
      companyName: 'Deck Logo Co',
      logoUrl: 'https://example.com/deck-logo.png',
      theme: { primaryColor: '#abc' },
      contact: {},
      outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: false, tone: 'friendly' },
    });
    const logo = screen.queryByTestId('brand-logo') as HTMLImageElement | null;
    expect(logo).toBeTruthy();
    expect(logo?.src).toContain('example.com/deck-logo.png');
  });

  it('page labels (recommendation order) are unchanged regardless of brand', () => {
    // Render with no brand
    const { unmount } = render(
      <PresentationDeck
        result={result}
        input={FIXTURE}
        recommendationResult={result.recommendationResult}
      />,
    );
    const nav1 = screen.getByRole('navigation', { name: 'Deck navigation' });
    const labels1 = Array.from(nav1.querySelectorAll('button[aria-label^="Go to page:"]'))
      .map(b => b.getAttribute('aria-label'));
    unmount();

    // Render with installer-demo brand
    renderWithBrand('installer-demo');
    const nav2 = screen.getByRole('navigation', { name: 'Deck navigation' });
    const labels2 = Array.from(nav2.querySelectorAll('button[aria-label^="Go to page:"]'))
      .map(b => b.getAttribute('aria-label'));

    expect(labels1).toEqual(labels2);
  });
});
