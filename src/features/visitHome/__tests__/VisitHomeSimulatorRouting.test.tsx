import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

vi.mock('../../../engine/Engine', () => ({
  runEngine: vi.fn(() => ({
    engineOutput: { recommendation: { primary: 'combi' } },
  })),
}));

vi.mock('../../../components/simulator/UnifiedSimulatorView', () => ({
  default: () => <div data-testid="unified-simulator-view">UnifiedSimulatorView</div>,
}));

import { VisitHomeUnifiedSimulatorRoute } from '../VisitHomeUnifiedSimulatorRoute';

const ENGINE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  heatLossWatts: 8000,
  bathroomCount: 1,
  occupancyCount: 3,
  dynamicMainsPressure: 2.0,
  mainsDynamicFlowLpm: 14,
};

describe('Visit Home unified simulator route', () => {
  it('renders UnifiedSimulatorView wrapper when recommendation data is available', () => {
    render(
      <VisitHomeUnifiedSimulatorRoute
        engineInput={ENGINE_INPUT}
        onBack={vi.fn()}
        backLabel="visit-home"
      />,
    );

    expect(screen.getByTestId('unified-simulator-view')).toBeInTheDocument();
  });

  it('back button routes control to parent handler for visit-home return path', () => {
    const onBack = vi.fn();
    render(
      <VisitHomeUnifiedSimulatorRoute
        engineInput={ENGINE_INPUT}
        onBack={onBack}
        backLabel="visit-home"
      />,
    );

    fireEvent.click(screen.getByTestId('visit-home-unified-simulator-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
