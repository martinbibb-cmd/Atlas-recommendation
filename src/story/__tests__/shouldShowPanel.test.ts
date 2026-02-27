import { describe, it, expect } from 'vitest';
import { shouldShowPanel } from '../rendering/shouldShowPanel';
import type { OutputPanel } from '../scenarioRegistry';
import { combiSwitchScenario, oldBoilerRealityScenario } from '../scenarioRegistry';

describe('shouldShowPanel', () => {
  it('returns true for any panel when outputFocus is undefined (backward compat)', () => {
    const panels: OutputPanel[] = [
      'band_ladder',
      'recovery_steps',
      'demand_graph',
      'efficiency_graph',
      'hydraulics',
      'inputs_summary',
      'behaviour_bullets',
    ];
    for (const panel of panels) {
      expect(shouldShowPanel(undefined, panel)).toBe(true);
    }
  });

  it('returns true for panels included in outputFocus', () => {
    const focus: OutputPanel[] = ['band_ladder', 'recovery_steps'];
    expect(shouldShowPanel(focus, 'band_ladder')).toBe(true);
    expect(shouldShowPanel(focus, 'recovery_steps')).toBe(true);
  });

  it('returns false for panels not in outputFocus', () => {
    const focus: OutputPanel[] = ['band_ladder', 'recovery_steps'];
    expect(shouldShowPanel(focus, 'demand_graph')).toBe(false);
    expect(shouldShowPanel(focus, 'efficiency_graph')).toBe(false);
    expect(shouldShowPanel(focus, 'inputs_summary')).toBe(false);
  });

  it('returns false for all panels when outputFocus is an empty array', () => {
    const focus: OutputPanel[] = [];
    expect(shouldShowPanel(focus, 'band_ladder')).toBe(false);
    expect(shouldShowPanel(focus, 'demand_graph')).toBe(false);
    expect(shouldShowPanel(focus, 'inputs_summary')).toBe(false);
  });
});

describe('shouldShowPanel — old_boiler_reality scenario focus', () => {
  const focus = oldBoilerRealityScenario.outputFocus;

  it('shows band_ladder', () => {
    expect(shouldShowPanel(focus, 'band_ladder')).toBe(true);
  });

  it('shows recovery_steps', () => {
    expect(shouldShowPanel(focus, 'recovery_steps')).toBe(true);
  });

  it('shows inputs_summary', () => {
    expect(shouldShowPanel(focus, 'inputs_summary')).toBe(true);
  });

  it('hides demand_graph', () => {
    expect(shouldShowPanel(focus, 'demand_graph')).toBe(false);
  });

  it('hides efficiency_graph', () => {
    expect(shouldShowPanel(focus, 'efficiency_graph')).toBe(false);
  });
});

describe('shouldShowPanel — combi_switch scenario focus', () => {
  const focus = combiSwitchScenario.outputFocus;

  it('shows demand_graph', () => {
    expect(shouldShowPanel(focus, 'demand_graph')).toBe(true);
  });

  it('shows efficiency_graph', () => {
    expect(shouldShowPanel(focus, 'efficiency_graph')).toBe(true);
  });

  it('shows inputs_summary', () => {
    expect(shouldShowPanel(focus, 'inputs_summary')).toBe(true);
  });

  it('hides band_ladder', () => {
    expect(shouldShowPanel(focus, 'band_ladder')).toBe(false);
  });

  it('hides recovery_steps', () => {
    expect(shouldShowPanel(focus, 'recovery_steps')).toBe(false);
  });
});
