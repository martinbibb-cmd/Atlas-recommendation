import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('InsightLayerPage — pre-engine surfaces', () => {
  it('renders the current system visual when heat source is present', () => {
    const { container } = render(
      <InsightLayerPage
        systemBuilder={makeSystem({ heatSource: 'combi' })}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    expect(screen.getByText('🏠 Your current system')).toBeTruthy();
    expect(container.querySelector('[data-testid="sav-current"]')).not.toBeNull();
  });

  it('shows neutral analysis status and no recommendation cards before engine run', () => {
    const { container } = render(
      <InsightLayerPage
        systemBuilder={makeSystem({ heatSource: 'regular', dhwType: 'open_vented' })}
        home={makeHome()}
        input={makeInput()}
        priorities={INITIAL_PRIORITIES_STATE}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    expect(screen.getByTestId('analysis-status-panel')).toBeTruthy();
    expect(container.querySelector('[data-testid^="recommendation-"]')).toBeNull();
  });
});
