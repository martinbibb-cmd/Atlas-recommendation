/**
 * PresentationDeck.canonicalOrder.test.tsx
 *
 * Validates the canonical presentation sequence after the PR8d cleanup:
 *
 *   - The active deck does NOT contain any of the old legacy individual slides
 *     (house, home, energy, current_system, architecture).
 *   - The deck does contain the new slides in the correct order:
 *       1. quadrant_overview
 *       2. ageing
 *       3. options
 *       4. ranking
 *       5. option_* / compare_*
 *       6. simulator
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

  beforeEach(() => {
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

  it('third page is Options (available systems)', () => {
    expect(labels[2]).toBe('Options');
  });

  it('fourth page is Best fit (physics ranking)', () => {
    expect(labels[3]).toBe('Best fit');
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

  it('deck has at least 5 pages (overview + condition + options + ranking + proof)', () => {
    expect(labels.length).toBeGreaterThanOrEqual(5);
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
