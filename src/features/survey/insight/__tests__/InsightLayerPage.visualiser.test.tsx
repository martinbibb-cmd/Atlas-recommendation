/**
 * InsightLayerPage.visualiser.test.tsx
 *
 * PR2 acceptance tests — Surface the system visually in the live journey.
 *
 * Acceptance criteria verified:
 *   1. "Your current system" block (sav-current) renders when heatSource is set.
 *   2. "Your current system" block is absent when heatSource is null.
 *   3. A compare visualiser (sav-compare) renders above the prose inside each
 *      recommendation card that has a mapped OptionId.
 *   4. Recommendation cards whose IDs are not mappable do not render a compare block.
 *
 * These tests prove that the SystemArchitectureVisualiser is no longer hidden
 * in presentation-only surfaces — it is part of the live survey journey.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { InsightLayerPage } from '../InsightLayerPage';
import type { SystemBuilderState } from '../../systemBuilder/systemBuilderTypes';
import { INITIAL_SYSTEM_BUILDER_STATE } from '../../systemBuilder/systemBuilderTypes';
import type { HomeState } from '../../usage/usageTypes';
import { INITIAL_HOME_STATE } from '../../usage/usageTypes';
import type { FullSurveyModelV1 } from '../../../../ui/fullSurvey/FullSurveyModelV1';
import { INITIAL_PRIORITIES_STATE } from '../../priorities/prioritiesTypes';

// jsdom does not implement window.scrollTo — stub it.
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

// ─── Factories ────────────────────────────────────────────────────────────────

function makeSystem(overrides: Partial<SystemBuilderState> = {}): SystemBuilderState {
  return { ...INITIAL_SYSTEM_BUILDER_STATE, ...overrides };
}

function makeHome(overrides: Partial<HomeState> = {}): HomeState {
  return { ...INITIAL_HOME_STATE, ...overrides };
}

function makeInput(overrides: Partial<FullSurveyModelV1> = {}): FullSurveyModelV1 {
  return {
    heatLossWatts: 8000,
    hasMagneticFilter: false,
    ...overrides,
  } as unknown as FullSurveyModelV1;
}

// ─── Suite: current-system visualiser ────────────────────────────────────────

describe('InsightLayerPage — current system visualiser (PR2)', () => {
  it('renders the "Your current system" block and sav-current when heatSource is set', () => {
    const systemBuilder = makeSystem({ heatSource: 'combi', emitters: 'radiators_standard' });

    const { container, getByText } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    // Section heading
    expect(getByText('🏠 Your current system')).toBeTruthy();

    // SystemArchitectureVisualiser renders in current mode
    expect(container.querySelector('[data-testid="sav-current"]')).not.toBeNull();
  });

  it('does NOT render the "Your current system" block when heatSource is null', () => {
    const systemBuilder = makeSystem({ heatSource: null });

    const { container, queryByText } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    expect(queryByText('🏠 Your current system')).toBeNull();
    expect(container.querySelector('[data-testid="sav-current"]')).toBeNull();
  });
});

// ─── Suite: compare visualiser in recommendation cards ───────────────────────

describe('InsightLayerPage — compare visualiser inside recommendation cards (PR2)', () => {
  /**
   * A regular boiler with a vented cylinder on a two-person household is
   * a classic setup that produces a combi_upgrade recommendation — the
   * simplest scenario to trigger a recommendation card with a mapped OptionId.
   */
  const twoPersonComposition = {
    adultCount: 2,
    childCount0to4: 0,
    childCount5to10: 0,
    childCount11to17: 0,
    youngAdultCount18to25AtHome: 0,
  };

  it('renders sav-compare inside the combi_upgrade recommendation card', () => {
    const systemBuilder = makeSystem({
      heatSource: 'regular',
      dhwType: 'open_vented',
      emitters: 'radiators_standard',
    });
    const home = makeHome({ composition: twoPersonComposition, bathroomCount: 1 });
    const input = makeInput({ dynamicMainsPressure: 2.5, bathroomCount: 1, peakConcurrentOutlets: 1 });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={home}
        input={input}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    const combiCard = container.querySelector('[data-testid="recommendation-combi_upgrade"]');
    expect(combiCard).not.toBeNull();

    // The compare visualiser should be present inside the recommendation card
    const compareViz = combiCard!.querySelector('[data-testid="sav-compare"]');
    expect(compareViz).not.toBeNull();
  });

  it('renders sav-compare inside the system_unvented recommendation card', () => {
    const systemBuilder = makeSystem({
      heatSource: 'regular',
      dhwType: 'open_vented',
      emitters: 'radiators_standard',
    });
    const fivePersonComposition = {
      adultCount: 3,
      childCount0to4: 0,
      childCount5to10: 1,
      childCount11to17: 1,
      youngAdultCount18to25AtHome: 0,
    };
    const home = makeHome({ composition: fivePersonComposition, bathroomCount: 2 });
    const input = makeInput({ dynamicMainsPressure: 2.5, bathroomCount: 2 });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={home}
        input={input}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    const sysCard = container.querySelector('[data-testid="recommendation-system_unvented"]');
    expect(sysCard).not.toBeNull();

    const compareViz = sysCard!.querySelector('[data-testid="sav-compare"]');
    expect(compareViz).not.toBeNull();
  });

  it('compare visualiser sits before (above) the prose grid inside the recommendation card', () => {
    const systemBuilder = makeSystem({
      heatSource: 'regular',
      dhwType: 'open_vented',
      emitters: 'radiators_standard',
    });
    const home = makeHome({ composition: twoPersonComposition, bathroomCount: 1 });
    const input = makeInput({ dynamicMainsPressure: 2.5, bathroomCount: 1, peakConcurrentOutlets: 1 });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={home}
        input={input}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    const combiCard = container.querySelector('[data-testid="recommendation-combi_upgrade"]');
    expect(combiCard).not.toBeNull();

    const compareViz = combiCard!.querySelector('[data-testid="sav-compare"]');
    const proseGrid = combiCard!.querySelector('[data-testid="rec-prose-grid"]');

    expect(compareViz).not.toBeNull();
    expect(proseGrid).not.toBeNull();

    // Compare block must appear before the prose grid in document order
    const position = compareViz!.compareDocumentPosition(proseGrid!);
    // DOCUMENT_POSITION_FOLLOWING === 4 means proseGrid comes after compareViz
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ─── Suite: recIdToOptionId coverage ─────────────────────────────────────────
// Tested indirectly: recommendation IDs that have no OptionId mapping must
// NOT produce a compare visualiser block.

describe('InsightLayerPage — recIdToOptionId fallback (PR2)', () => {
  it('does not render sav-compare for a recommendation card with an unknown id', () => {
    // heat_pump requires HP-compatible emitters, so use radiators to avoid that rec.
    // The three known IDs are combi_upgrade, system_unvented, heat_pump — all others
    // are quick wins (service, flush, controls) which are not rendered as rec cards.
    // We validate this negative by checking that every sav-compare is inside a known rec card.
    const systemBuilder = makeSystem({
      heatSource: 'regular',
      dhwType: 'open_vented',
      emitters: 'radiators_standard',
    });
    const twoPersonComposition = {
      adultCount: 2,
      childCount0to4: 0,
      childCount5to10: 0,
      childCount11to17: 0,
      youngAdultCount18to25AtHome: 0,
    };
    const home = makeHome({ composition: twoPersonComposition, bathroomCount: 1 });
    const input = makeInput({ dynamicMainsPressure: 2.5, bathroomCount: 1, peakConcurrentOutlets: 1 });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={home}
        input={input}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    const knownRecIds = ['combi_upgrade', 'system_unvented', 'heat_pump'];

    // Every sav-compare element must be inside a known recommendation card
    const compareEls = Array.from(container.querySelectorAll('[data-testid="sav-compare"]'));
    for (const el of compareEls) {
      const parentCard = el.closest('[data-testid^="recommendation-"]');
      expect(parentCard).not.toBeNull();
      const testId = parentCard!.getAttribute('data-testid')!;
      const recId = testId.replace('recommendation-', '');
      expect(knownRecIds).toContain(recId);
    }
  });
});
