import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BuildingFabricStep } from '../BuildingFabricStep';
import { INITIAL_HEAT_LOSS_STATE } from '../HeatLossStep';

describe('BuildingFabricStep', () => {
  it('captures a numeric storey count instead of forcing a two-storey default', () => {
    const onChange = vi.fn();
    render(
      <BuildingFabricStep
        state={INITIAL_HEAT_LOSS_STATE}
        onChange={onChange}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/storey count/i), { target: { value: '3' } });

    expect(onChange).toHaveBeenCalled();
    const nextState = onChange.mock.calls.at(-1)?.[0];
    expect(nextState.shellModel?.settings.storeys).toBe(3);
  });
});
