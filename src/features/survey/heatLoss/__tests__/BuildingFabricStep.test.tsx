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

    const input = screen.getByLabelText(/storey count/i);
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalled();
    const nextState = onChange.mock.calls.at(-1)?.[0];
    expect(nextState.shellModel?.settings.storeys).toBe(3);
  });

  it('allows temporary sign-only edits and safely restores the prior value on blur', () => {
    const onChange = vi.fn();
    render(
      <BuildingFabricStep
        state={INITIAL_HEAT_LOSS_STATE}
        onChange={onChange}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/storey count/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(input.value).toBe('2');
    expect(onChange).not.toHaveBeenCalled();
  });
});
