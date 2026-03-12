/**
 * WhatIfLab.test.tsx
 *
 * Tests verify:
 *   - Renders the "What if…?" heading
 *   - Renders all six scenario buttons
 *   - First scenario is selected by default (aria-pressed="true")
 *   - Selecting a scenario updates the explanation panel
 *   - Behaviour Console does not appear
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WhatIfLab from '../WhatIfLab';
import { WHAT_IF_SCENARIOS } from '../whatIfScenarios';

describe('WhatIfLab — heading and subtitle', () => {
  it('renders the "What if…?" heading', () => {
    render(<WhatIfLab />);
    expect(screen.getByRole('heading', { name: /what if/i })).toBeTruthy();
  });

  it('renders the subtitle text', () => {
    render(<WhatIfLab />);
    expect(screen.getByText(/see how system behaviour changes/i)).toBeTruthy();
  });
});

describe('WhatIfLab — scenario buttons', () => {
  it('renders all six scenario buttons', () => {
    render(<WhatIfLab />);
    WHAT_IF_SCENARIOS.forEach(scenario => {
      expect(screen.getByRole('button', { name: scenario.title })).toBeTruthy();
    });
  });

  it('marks the first scenario button as pressed by default', () => {
    render(<WhatIfLab />);
    const firstBtn = screen.getByRole('button', { name: WHAT_IF_SCENARIOS[0].title });
    expect(firstBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks other scenario buttons as not pressed by default', () => {
    render(<WhatIfLab />);
    WHAT_IF_SCENARIOS.slice(1).forEach(scenario => {
      const btn = screen.getByRole('button', { name: scenario.title });
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });
  });
});

describe('WhatIfLab — scenario selection updates explanation panel', () => {
  it('shows the first scenario whyItMatters by default', () => {
    render(<WhatIfLab />);
    expect(screen.getByText(WHAT_IF_SCENARIOS[0].whyItMatters[0])).toBeTruthy();
  });

  it('updates the panel when a different scenario is selected', () => {
    render(<WhatIfLab />);
    const secondScenario = WHAT_IF_SCENARIOS[1];
    fireEvent.click(screen.getByRole('button', { name: secondScenario.title }));
    expect(screen.getByText(secondScenario.whyItMatters[0])).toBeTruthy();
  });

  it('sets aria-pressed on the newly selected button', () => {
    render(<WhatIfLab />);
    const secondScenario = WHAT_IF_SCENARIOS[1];
    const btn = screen.getByRole('button', { name: secondScenario.title });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clears aria-pressed from the previously selected button', () => {
    render(<WhatIfLab />);
    const firstBtn  = screen.getByRole('button', { name: WHAT_IF_SCENARIOS[0].title });
    const secondBtn = screen.getByRole('button', { name: WHAT_IF_SCENARIOS[1].title });
    fireEvent.click(secondBtn);
    expect(firstBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('cycles through all scenarios without error', () => {
    render(<WhatIfLab />);
    WHAT_IF_SCENARIOS.forEach(scenario => {
      fireEvent.click(screen.getByRole('button', { name: scenario.title }));
      expect(screen.getByText(scenario.whyItMatters[0])).toBeTruthy();
    });
  });

  it('shows the shortVerdict for each selected scenario', () => {
    render(<WhatIfLab />);
    WHAT_IF_SCENARIOS.forEach(scenario => {
      fireEvent.click(screen.getByRole('button', { name: scenario.title }));
      expect(screen.getByText(scenario.shortVerdict)).toBeTruthy();
    });
  });
});

describe('WhatIfLab — no Behaviour Console', () => {
  it('does not render a Behaviour Console heading', () => {
    render(<WhatIfLab />);
    expect(screen.queryByText(/behaviour console/i)).toBeNull();
  });
});

describe('WhatIfLab — scenario data shape', () => {
  it('all scenarios have exactly the required fields', () => {
    WHAT_IF_SCENARIOS.forEach(scenario => {
      expect(typeof scenario.id).toBe('string');
      expect(typeof scenario.title).toBe('string');
      expect(typeof scenario.shortVerdict).toBe('string');
      expect(Array.isArray(scenario.whyItMatters)).toBe(true);
      expect(scenario.whyItMatters.length).toBeGreaterThan(0);
      expect(typeof scenario.visualType).toBe('string');
    });
  });

  it('has exactly six scenarios', () => {
    expect(WHAT_IF_SCENARIOS).toHaveLength(6);
  });

  it('scenario IDs match the expected set', () => {
    const ids = WHAT_IF_SCENARIOS.map(s => s.id);
    expect(ids).toContain('boiler_too_big');
    expect(ids).toContain('water_pressure_too_low');
    expect(ids).toContain('upgrade_radiators');
    expect(ids).toContain('add_better_controls');
    expect(ids).toContain('upgrade_primaries');
    expect(ids).toContain('add_stored_hot_water');
  });

  it('visualType values are valid', () => {
    const valid = new Set(['cycling', 'pressure', 'emitters', 'controls', 'primaries', 'storage']);
    WHAT_IF_SCENARIOS.forEach(scenario => {
      expect(valid.has(scenario.visualType)).toBe(true);
    });
  });
});
