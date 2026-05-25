import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HeatLossStep } from '../HeatLossStep';
import { INITIAL_HEAT_LOSS_STATE } from '../heatLossTypes';
import type { HeatLossState } from '../heatLossTypes';

vi.mock('../../../../components/heatloss/HeatLossCalculator', () => ({
  default: () => <div data-testid="mock-heat-loss-calculator" />,
}));

describe('HeatLossStep perimeter persistence controls', () => {
  it('renders save trigger and commits perimeter metrics with visual confirmation', () => {
    const onChange = vi.fn();
    const state: HeatLossState = {
      ...INITIAL_HEAT_LOSS_STATE,
      shellModel: {
        activeLayerId: 'ground',
        layers: [
          {
            id: 'ground',
            name: 'Ground floor',
            kind: 'original',
            visible: true,
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 5 },
              { x: 0, y: 5 },
            ],
            closed: true,
            edges: [],
            storeys: 2,
            ceilingHeight: 2.4,
          },
        ],
        settings: {
          storeys: 2,
          ceilingHeight: 2.4,
          dwellingType: 'semi',
          wallType: 'cavityUninsulated',
          loftInsulation: 'mm270plus',
          glazingType: 'doubleArated',
          glazingAmount: 'medium',
          floorType: 'suspendedUninsulated',
          thermalMass: 'medium',
        },
      },
    };

    render(
      <HeatLossStep
        state={state}
        onChange={onChange}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('save-perimeter-data-button'));

    expect(onChange).toHaveBeenCalled();
    const nextState = onChange.mock.calls.at(-1)?.[0];
    expect(nextState.perimeterM).toBe(30);
    expect(nextState.groundFloorAreaM2).toBe(50);
    expect(screen.getByTestId('perimeter-save-status').textContent).toContain('saved locally');
  });
});
