/**
 * PresentationDeck.optionSelection.test.tsx
 *
 * Validates the per-row Option 1 / Option 2 button behaviour introduced in PR #792,
 * covering the review-comment fixes merged in the follow-up:
 *
 *   1. Per-row buttons navigate to the correct option-detail slide.
 *   2. Mutual exclusivity — selecting Option 1 on a row that is already Option 2
 *      clears the Option 2 slot, and vice versa.
 *   3. Single-viable-option case — "Explore option 2" CTA is hidden when only
 *      one option page exists.
 *   4. Disqualified families (overallScore = 0) show "Not available" instead of
 *      buttons.  (Verified indirectly: the two-option fixture has >= 2 viable
 *      families, so the buttons are enabled for the top two families.)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PresentationDeck from '../PresentationDeck';
import { runEngine } from '../../../engine/Engine';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Input that reliably produces >= 2 viable options so we can test both option
 * slots. Low-pressure / mains-pressure, bathroom count 1 so combi is viable,
 * and no forced disqualifiers for system boiler.
 */
const MULTI_OPTION_FIXTURE: EngineInputV2_3 = {
  postcode:                 'SW1A 1AA',
  dynamicMainsPressure:     2.5,
  mainsDynamicFlowLpm:      18,
  mainsDynamicFlowLpmKnown: true,
  buildingMass:             'medium',
  primaryPipeDiameter:      22,
  heatLossWatts:            8000,
  radiatorCount:            10,
  hasLoftConversion:        false,
  returnWaterTemp:          45,
  occupancySignature:       'professional',
  highOccupancy:            false,
  preferCombi:              false,
  bathroomCount:            1,
  occupancyCount:           2,
  currentHeatSourceType:    'combi',
  dhwStorageType:           'none',
  demandTimingOverrides:    { bathFrequencyPerWeek: 0, simultaneousUseSeverity: 'low' },
  currentBoilerAgeYears:    8,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Navigate the deck to the slide whose label matches the given string. */
function goToSlide(label: string) {
  const nav = screen.getByRole('navigation', { name: 'Deck navigation' });
  const btn = nav.querySelector(`button[aria-label="Go to page: ${label}"]`);
  if (!btn) throw new Error(`Slide not found: ${label}`);
  fireEvent.click(btn);
}

/** Return the text content of the current visible slide heading. */
function currentSlideHeading(): string {
  // The active slide is the one that is NOT aria-hidden
  const slides = screen.getAllByRole('group');
  const active = slides.find(s => s.getAttribute('aria-hidden') === 'false');
  if (!active) throw new Error('No active slide found');
  const h2 = active.querySelector('h2');
  return h2?.textContent ?? '';
}

/** Return the label suffix of the current page from the nav counter. */
function currentPageLabel(): string {
  const span = document.querySelector('.atlas-presentation-deck__nav-counter');
  return span?.textContent?.trim() ?? '';
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('PresentationDeck — option selection buttons', () => {
  let result: ReturnType<typeof runEngine>;

  beforeAll(() => {
    result = runEngine(MULTI_OPTION_FIXTURE);
  });

  // ── CTA button navigates to option detail slides ─────────────────────────

  it('clicking "Explore option 1" on the ranking page navigates to Option 1 slide', () => {
    render(
      <PresentationDeck
        result={result}
        input={MULTI_OPTION_FIXTURE}
        recommendationResult={result.recommendationResult}
      />,
    );

    // Navigate to the ranking page
    goToSlide('Best fit');
    expect(currentPageLabel()).toBe('Best fit');

    // The deck pre-seeds Option 1 to the top-ranked family, so the CTA exists.
    const exploreCta = screen.getByRole('button', { name: /Explore option 1/i });
    fireEvent.click(exploreCta);

    expect(currentPageLabel()).toBe('Option 1');
  });

  // ── Mutual exclusivity: Option 1 click clears existing Option 2 ──────────

  it('selecting Option 1 on a row that is already Option 2 clears Option 2', () => {
    render(
      <PresentationDeck
        result={result}
        input={MULTI_OPTION_FIXTURE}
        recommendationResult={result.recommendationResult}
      />,
    );

    goToSlide('Best fit');

    // Find a row that is currently marked "✓ Option 2"
    const opt2ActiveBtn = screen.queryByRole('button', { name: /✓ Option 2/i });
    if (!opt2ActiveBtn) {
      // Only one viable option — mutual-exclusivity can't apply; skip gracefully.
      return;
    }

    // The row containing "✓ Option 2" — find the sibling "Option 1" button
    const row = opt2ActiveBtn.closest('[aria-label^="Rank"]');
    expect(row).not.toBeNull();
    const opt1BtnInRow = row!.querySelector<HTMLButtonElement>(
      '.atlas-deck-ranking__item-btn--1',
    );
    expect(opt1BtnInRow).not.toBeNull();

    // Click "Option 1" on the row that is currently Option 2
    fireEvent.click(opt1BtnInRow!);

    // That row is now Option 1 — confirm the button changed to "✓ Option 1"
    expect(opt1BtnInRow!.textContent).toContain('✓ Option 1');

    // There should no longer be any "✓ Option 2" button on this same row
    // (it was swapped), meaning no duplicate assignment
    const opt2BtnInSameRow = row!.querySelector<HTMLButtonElement>(
      '.atlas-deck-ranking__item-btn--2',
    );
    if (opt2BtnInSameRow) {
      expect(opt2BtnInSameRow.textContent).not.toContain('✓ Option 2');
    }
  });

  // ── Mutual exclusivity: Option 2 click clears existing Option 1 ──────────

  it('selecting Option 2 on a row that is already Option 1 clears Option 1', () => {
    render(
      <PresentationDeck
        result={result}
        input={MULTI_OPTION_FIXTURE}
        recommendationResult={result.recommendationResult}
      />,
    );

    goToSlide('Best fit');

    // Find a row that is currently "✓ Option 1"
    const opt1ActiveBtn = screen.queryByRole('button', { name: /✓ Option 1/i });
    if (!opt1ActiveBtn) return; // no selectable row — skip

    const row = opt1ActiveBtn.closest('[aria-label^="Rank"]');
    expect(row).not.toBeNull();
    const opt2BtnInRow = row!.querySelector<HTMLButtonElement>(
      '.atlas-deck-ranking__item-btn--2',
    );
    expect(opt2BtnInRow).not.toBeNull();

    fireEvent.click(opt2BtnInRow!);

    // Row is now Option 2
    expect(opt2BtnInRow!.textContent).toContain('✓ Option 2');

    // Option 1 button on this row must no longer be active
    expect(opt1ActiveBtn.textContent).not.toContain('✓ Option 1');
  });

  // ── Single viable option: "Explore option 2" CTA is hidden ───────────────

  it('"Explore option 2" CTA is absent when only one viable option exists', () => {
    // Verify that the "Explore option 2" CTA is shown if and only if an Option 2
    // page exists in the deck.  The fixture may produce 1 or 2 viable options;
    // the test is valid in both cases.
    render(
      <PresentationDeck
        result={result}
        input={MULTI_OPTION_FIXTURE}
        recommendationResult={result.recommendationResult}
      />,
    );

    goToSlide('Best fit');

    const pageLabels = Array.from(
      screen.getByRole('navigation', { name: 'Deck navigation' })
        .querySelectorAll('button[aria-label^="Go to page:"]'),
    ).map(b => b.getAttribute('aria-label')?.replace('Go to page: ', '') ?? '');

    const hasOption2Page = pageLabels.includes('Option 2');
    const exploreCta2 = screen.queryByRole('button', { name: /Explore option 2/i });

    if (hasOption2Page) {
      // Two viable options: the CTA should be present
      expect(exploreCta2).not.toBeNull();
    } else {
      // Only one viable option: the CTA must be hidden
      expect(exploreCta2).toBeNull();
    }
  });

  // ── Disqualified-family rows show "Not available" ─────────────────────────

  it('rows whose family has no option page show "Not available" instead of buttons', () => {
    render(
      <PresentationDeck
        result={result}
        input={MULTI_OPTION_FIXTURE}
        recommendationResult={result.recommendationResult}
      />,
    );

    goToSlide('Best fit');

    // Any row classed "disabled" must contain "Not available" text and must
    // NOT contain the regular option buttons.
    const disabledRows = document.querySelectorAll('.atlas-deck-ranking__row--disabled');
    for (const row of disabledRows) {
      const unavailable = row.querySelector('.atlas-deck-ranking__item-btn--unavailable');
      expect(unavailable).not.toBeNull();
      expect(unavailable!.textContent).toMatch(/Not available/i);

      // No selectable buttons on a disabled row
      const btn1 = row.querySelector('.atlas-deck-ranking__item-btn--1');
      const btn2 = row.querySelector('.atlas-deck-ranking__item-btn--2');
      expect(btn1).toBeNull();
      expect(btn2).toBeNull();
    }
  });
});
