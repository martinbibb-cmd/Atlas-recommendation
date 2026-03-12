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
import WhatIfLab, { SCENARIOS } from '../WhatIfLab';

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
    SCENARIOS.forEach(scenario => {
      expect(screen.getByRole('button', { name: scenario.title })).toBeTruthy();
    });
  });

  it('marks the first scenario button as pressed by default', () => {
    render(<WhatIfLab />);
    const firstBtn = screen.getByRole('button', { name: SCENARIOS[0].title });
    expect(firstBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks other scenario buttons as not pressed by default', () => {
    render(<WhatIfLab />);
    SCENARIOS.slice(1).forEach(scenario => {
      const btn = screen.getByRole('button', { name: scenario.title });
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });
  });
});

describe('WhatIfLab — scenario selection updates explanation panel', () => {
  it('shows the first scenario explanation by default', () => {
    render(<WhatIfLab />);
    // First scenario bullet should be visible
    expect(screen.getByText(SCENARIOS[0].bullets[0])).toBeTruthy();
  });

  it('updates the panel when a different scenario is selected', () => {
    render(<WhatIfLab />);
    const secondScenario = SCENARIOS[1];
    fireEvent.click(screen.getByRole('button', { name: secondScenario.title }));
    // The second scenario's bullet should now be visible
    expect(screen.getByText(secondScenario.bullets[0])).toBeTruthy();
  });

  it('sets aria-pressed on the newly selected button', () => {
    render(<WhatIfLab />);
    const secondScenario = SCENARIOS[1];
    const btn = screen.getByRole('button', { name: secondScenario.title });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clears aria-pressed from the previously selected button', () => {
    render(<WhatIfLab />);
    const firstBtn  = screen.getByRole('button', { name: SCENARIOS[0].title });
    const secondBtn = screen.getByRole('button', { name: SCENARIOS[1].title });
    fireEvent.click(secondBtn);
    expect(firstBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('cycles through all scenarios without error', () => {
    render(<WhatIfLab />);
    SCENARIOS.forEach(scenario => {
      fireEvent.click(screen.getByRole('button', { name: scenario.title }));
      expect(screen.getByText(scenario.bullets[0])).toBeTruthy();
    });
  });
});

describe('WhatIfLab — no Behaviour Console', () => {
  it('does not render a Behaviour Console heading', () => {
    render(<WhatIfLab />);
    expect(screen.queryByText(/behaviour console/i)).toBeNull();
  });
});
