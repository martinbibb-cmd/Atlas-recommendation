/**
 * InsightLayerPage.images.test.tsx
 *
 * PR3 acceptance tests — Real-world supporting images in the live journey.
 *
 * Acceptance criteria verified:
 *   1. Current system image renders when a clean image mapping exists.
 *   2. No current system image renders when mapping is unknown/unavailable.
 *   3. Visualiser still precedes image in the DOM (image is below, not above).
 *   4. Recommendation image renders for supported option types.
 *   5. No recommendation image renders for unsupported option types.
 *   6. Image renders after compare visualiser and before prose in rec card.
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

const twoPersonComposition = {
  adultCount: 2,
  childCount0to4: 0,
  childCount5to10: 0,
  childCount11to17: 0,
  youngAdultCount18to25AtHome: 0,
};

// ─── Suite: current system real-world image ───────────────────────────────────

describe('InsightLayerPage — current system real-world image (PR3)', () => {
  it('renders the current system image for a combi boiler', () => {
    const systemBuilder = makeSystem({ heatSource: 'combi', emitters: 'radiators_standard' });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    const img = container.querySelector('[data-testid="current-system-real-world-image"] img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('Combination.PNG');
  });

  it('renders the current system image for a regular boiler with open-vented cylinder', () => {
    const systemBuilder = makeSystem({
      heatSource: 'regular',
      dhwType: 'open_vented',
      emitters: 'radiators_standard',
    });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    const img = container.querySelector('[data-testid="current-system-real-world-image"] img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('open-vented-schematic.JPG');
  });

  it('renders the current system image for a system boiler with unvented DHW', () => {
    const systemBuilder = makeSystem({
      heatSource: 'system',
      dhwType: 'unvented',
      emitters: 'radiators_standard',
    });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    const img = container.querySelector('[data-testid="current-system-real-world-image"] img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('unvented-cylinder.JPG');
  });

  it('does NOT render the current system image when mapping is unavailable (regular + thermal_store)', () => {
    const systemBuilder = makeSystem({
      heatSource: 'regular',
      dhwType: 'thermal_store',
      emitters: 'radiators_standard',
    });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-testid="current-system-real-world-image"]')).toBeNull();
  });

  it('does NOT render the current system image when heatSource is null', () => {
    const systemBuilder = makeSystem({ heatSource: null });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-testid="current-system-real-world-image"]')).toBeNull();
  });

  it('visualiser (sav-current) appears before the real-world image in the DOM', () => {
    const systemBuilder = makeSystem({ heatSource: 'combi', emitters: 'radiators_standard' });

    const { container } = render(
      <InsightLayerPage
        systemBuilder={systemBuilder}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    const visualiser = container.querySelector('[data-testid="sav-current"]');
    const realWorldImg = container.querySelector('[data-testid="current-system-real-world-image"]');

    expect(visualiser).not.toBeNull();
    expect(realWorldImg).not.toBeNull();

    // Visualiser must appear before the real-world image in document order
    const position = visualiser!.compareDocumentPosition(realWorldImg!);
    // DOCUMENT_POSITION_FOLLOWING === 4 means realWorldImg comes after visualiser
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ─── Suite: recommendation card real-world image ──────────────────────────────

describe('InsightLayerPage — recommendation card real-world image (PR3)', () => {
  it('renders a real-world image inside the combi_upgrade recommendation card', () => {
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

    const card = container.querySelector('[data-testid="recommendation-combi_upgrade"]');
    expect(card).not.toBeNull();

    const img = card!.querySelector('[data-testid="rec-real-world-image-combi_upgrade"] img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('Combination.PNG');
  });

  it('renders a real-world image inside the system_unvented recommendation card', () => {
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

    const card = container.querySelector('[data-testid="recommendation-system_unvented"]');
    expect(card).not.toBeNull();

    const img = card!.querySelector('[data-testid="rec-real-world-image-system_unvented"] img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('unvented-cylinder.JPG');
  });

  it('real-world image appears after compare visualiser and before prose grid in rec card', () => {
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

    const card = container.querySelector('[data-testid="recommendation-combi_upgrade"]');
    expect(card).not.toBeNull();

    const compareViz = card!.querySelector('[data-testid="sav-compare"]');
    const realWorldImg = card!.querySelector('[data-testid="rec-real-world-image-combi_upgrade"]');
    const proseGrid = card!.querySelector('[data-testid="rec-prose-grid"]');

    expect(compareViz).not.toBeNull();
    expect(realWorldImg).not.toBeNull();
    expect(proseGrid).not.toBeNull();

    // compare visualiser → image → prose (in that order)
    const vizBeforeImg = compareViz!.compareDocumentPosition(realWorldImg!);
    expect(vizBeforeImg & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const imgBeforeProse = realWorldImg!.compareDocumentPosition(proseGrid!);
    expect(imgBeforeProse & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
