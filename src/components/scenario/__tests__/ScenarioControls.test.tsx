/**
 * ScenarioControls.test.tsx
 *
 * Tests verify:
 *   - "Clear all" button appears when any scenario is active
 *   - "Clear all" button is absent when no scenario is active
 *   - clicking "Clear all" resets all scenarios to default state
 *   - Scenario basis line shows "Base survey" when nothing active
 *   - Scenario basis line reflects active draw-off events
 *   - Scenario basis line reflects heating demand
 *   - Scenario basis line reflects reduced boiler output
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScenarioControls from '../ScenarioControls';
import type { ScenarioState } from '../../../scenario/scenarioEngineAdapter';
import { DEFAULT_SCENARIO_STATE } from '../../../scenario/scenarioEngineAdapter';

const noOp = () => {};

describe('ScenarioControls — Clear all', () => {
  it('does not show Clear all when no scenario is active', () => {
    render(<ScenarioControls scenario={DEFAULT_SCENARIO_STATE} onChange={noOp} />);
    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull();
  });

  it('shows Clear all when extraShowers > 0', () => {
    const scenario: ScenarioState = { ...DEFAULT_SCENARIO_STATE, extraShowers: 1 };
    render(<ScenarioControls scenario={scenario} onChange={noOp} />);
    expect(screen.getByRole('button', { name: /clear all/i })).toBeTruthy();
  });

  it('shows Clear all when heatingDemand is active', () => {
    const scenario: ScenarioState = { ...DEFAULT_SCENARIO_STATE, heatingDemand: true };
    render(<ScenarioControls scenario={scenario} onChange={noOp} />);
    expect(screen.getByRole('button', { name: /clear all/i })).toBeTruthy();
  });

  it('calls onChange with DEFAULT_SCENARIO_STATE when Clear all is clicked', () => {
    const scenario: ScenarioState = {
      ...DEFAULT_SCENARIO_STATE,
      extraShowers: 2,
      heatingDemand: true,
      kitchenTap: true,
    };
    const onChange = vi.fn();
    render(<ScenarioControls scenario={scenario} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SCENARIO_STATE);
  });
});

describe('ScenarioControls — Scenario basis', () => {
  it('shows "Base survey" when nothing is active', () => {
    render(<ScenarioControls scenario={DEFAULT_SCENARIO_STATE} onChange={noOp} />);
    expect(screen.getByText('Base survey')).toBeTruthy();
  });

  it('shows singular draw-off event label for one event', () => {
    const scenario: ScenarioState = { ...DEFAULT_SCENARIO_STATE, extraShowers: 1 };
    render(<ScenarioControls scenario={scenario} onChange={noOp} />);
    expect(screen.getByText(/base survey \+ 1 added draw-off event$/i)).toBeTruthy();
  });

  it('shows plural draw-off events for multiple events', () => {
    const scenario: ScenarioState = {
      ...DEFAULT_SCENARIO_STATE,
      extraShowers: 1,
      bathRunning: true,
      kitchenTap: true,
    };
    render(<ScenarioControls scenario={scenario} onChange={noOp} />);
    expect(screen.getByText(/base survey \+ 3 added draw-off events$/i)).toBeTruthy();
  });

  it('includes heating demand in basis', () => {
    const scenario: ScenarioState = { ...DEFAULT_SCENARIO_STATE, heatingDemand: true };
    render(<ScenarioControls scenario={scenario} onChange={noOp} />);
    expect(screen.getByText(/base survey \+ heating demand/i)).toBeTruthy();
  });

  it('includes reduced boiler output with kW value in basis', () => {
    const scenario: ScenarioState = { ...DEFAULT_SCENARIO_STATE, boilerOutputOverrideKw: 18 };
    render(<ScenarioControls scenario={scenario} onChange={noOp} />);
    expect(screen.getByText(/reduced boiler output \(18 kW\)/i)).toBeTruthy();
  });

  it('combines draw-off events and heating demand in basis', () => {
    const scenario: ScenarioState = {
      ...DEFAULT_SCENARIO_STATE,
      extraShowers: 1,
      heatingDemand: true,
    };
    render(<ScenarioControls scenario={scenario} onChange={noOp} />);
    expect(
      screen.getByText(/base survey \+ 1 added draw-off event \+ heating demand/i),
    ).toBeTruthy();
  });
});
