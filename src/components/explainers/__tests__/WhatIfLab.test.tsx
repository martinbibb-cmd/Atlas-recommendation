/**
 * WhatIfLab.test.tsx
 *
 * Tests verify:
 *   - Renders the "What if…?" heading
 *   - Renders the myth-busting subtitle
 *   - Renders all seven scenario buttons
 *   - First scenario is selected by default (aria-pressed="true")
 *   - Selecting a scenario updates the card panel
 *   - The card renders the myth, verdict, physics reason, and recommendation
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

  it('renders the myth-busting subtitle', () => {
    render(<WhatIfLab />);
    expect(screen.getByText(/busts a common assumption/i)).toBeTruthy();
  });
});

describe('WhatIfLab — scenario buttons', () => {
  it('renders all seven scenario buttons', () => {
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

describe('WhatIfLab — scenario selection updates card panel', () => {
  it('shows the first scenario myth by default', () => {
    render(<WhatIfLab />);
    expect(screen.getByText(WHAT_IF_SCENARIOS[0].myth)).toBeTruthy();
  });

  it('updates the panel when a different scenario is selected', () => {
    render(<WhatIfLab />);
    const secondScenario = WHAT_IF_SCENARIOS[1];
    fireEvent.click(screen.getByRole('button', { name: secondScenario.title }));
    expect(screen.getByText(secondScenario.myth)).toBeTruthy();
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
      expect(screen.getByText(scenario.myth)).toBeTruthy();
    });
  });

  it('shows the shortVerdict for each selected scenario', () => {
    render(<WhatIfLab />);
    WHAT_IF_SCENARIOS.forEach(scenario => {
      fireEvent.click(screen.getByRole('button', { name: scenario.title }));
      expect(screen.getByText(scenario.shortVerdict)).toBeTruthy();
    });
  });

  it('shows the physicsReason for each selected scenario', () => {
    render(<WhatIfLab />);
    WHAT_IF_SCENARIOS.forEach(scenario => {
      fireEvent.click(screen.getByRole('button', { name: scenario.title }));
      expect(screen.getByText(scenario.physicsReason)).toBeTruthy();
    });
  });

  it('shows the recommendation for each selected scenario', () => {
    render(<WhatIfLab />);
    WHAT_IF_SCENARIOS.forEach(scenario => {
      fireEvent.click(screen.getByRole('button', { name: scenario.title }));
      expect(screen.getByText(scenario.recommendation)).toBeTruthy();
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
      expect(typeof scenario.myth).toBe('string');
      expect(typeof scenario.shortVerdict).toBe('string');
      expect(typeof scenario.physicsReason).toBe('string');
      expect(typeof scenario.recommendation).toBe('string');
      expect(typeof scenario.visualType).toBe('string');
    });
  });

  it('has exactly seven scenarios', () => {
    expect(WHAT_IF_SCENARIOS).toHaveLength(7);
  });

  it('scenario IDs match the expected set', () => {
    const ids = WHAT_IF_SCENARIOS.map(s => s.id);
    expect(ids).toContain('bigger_boiler');
    expect(ids).toContain('bigger_primaries');
    expect(ids).toContain('high_flow_temp');
    expect(ids).toContain('22mm_bottleneck');
    expect(ids).toContain('stored_always_efficient');
    expect(ids).toContain('hp_cylinder_55c');
    expect(ids).toContain('oversizing_cylinder');
  });

  it('visualType values are valid', () => {
    const valid = new Set([
      'cycling', 'pressure', 'emitters', 'controls',
      'primaries', 'storage', 'hp_cylinder', 'oversizing', 'velocity',
    ]);
    WHAT_IF_SCENARIOS.forEach(scenario => {
      expect(valid.has(scenario.visualType)).toBe(true);
    });
  });

  it('all scenario text fields are non-empty', () => {
    WHAT_IF_SCENARIOS.forEach(scenario => {
      expect(scenario.myth.length).toBeGreaterThan(0);
      expect(scenario.shortVerdict.length).toBeGreaterThan(0);
      expect(scenario.physicsReason.length).toBeGreaterThan(0);
      expect(scenario.recommendation.length).toBeGreaterThan(0);
    });
  });
});

describe('WhatIfLab — myth-busting content contracts', () => {
  it('bigger_boiler myth references boiler size/output', () => {
    const s = WHAT_IF_SCENARIOS.find(s => s.id === 'bigger_boiler')!;
    const allText = [s.myth, s.shortVerdict, s.physicsReason].join(' ').toLowerCase();
    expect(allText).toMatch(/output|boiler/);
    expect(allText).toMatch(/cycl/);
  });

  it('high_flow_temp scenario uses controls visual and references condensing', () => {
    const s = WHAT_IF_SCENARIOS.find(s => s.id === 'high_flow_temp')!;
    expect(s.visualType).toBe('controls');
    const allText = [s.physicsReason, s.shortVerdict].join(' ').toLowerCase();
    expect(allText).toMatch(/condens/);
  });

  it('22mm_bottleneck beforeLabel uses 22 mm', () => {
    const s = WHAT_IF_SCENARIOS.find(s => s.id === '22mm_bottleneck')!;
    expect(s.beforeLabel).toMatch(/22\s*mm/);
  });

  it('22mm_bottleneck afterLabel uses 28 mm', () => {
    const s = WHAT_IF_SCENARIOS.find(s => s.id === '22mm_bottleneck')!;
    expect(s.afterLabel).toMatch(/28\s*mm/);
  });

  it('hp_cylinder_55c scenario references Legionella and 60 °C', () => {
    const s = WHAT_IF_SCENARIOS.find(s => s.id === 'hp_cylinder_55c')!;
    const allText = [s.myth, s.shortVerdict, s.physicsReason].join(' ').toLowerCase();
    expect(allText).toMatch(/legionella/i);
    expect(allText).toMatch(/60/);
  });

  it('hp_cylinder_55c applies to ashp', () => {
    const s = WHAT_IF_SCENARIOS.find(s => s.id === 'hp_cylinder_55c')!;
    expect(s.appliesTo).toContain('ashp');
  });

  it('oversizing_cylinder references standing loss or recovery', () => {
    const s = WHAT_IF_SCENARIOS.find(s => s.id === 'oversizing_cylinder')!;
    const allText = [s.shortVerdict, s.physicsReason].join(' ').toLowerCase();
    expect(allText).toMatch(/standing loss|recovery/);
  });

  it('bigger_primaries references velocity or sludge', () => {
    const s = WHAT_IF_SCENARIOS.find(s => s.id === 'bigger_primaries')!;
    const allText = [s.shortVerdict, s.physicsReason].join(' ').toLowerCase();
    expect(allText).toMatch(/velocity|sludge/);
  });

  it('stored_always_efficient references standing loss', () => {
    const s = WHAT_IF_SCENARIOS.find(s => s.id === 'stored_always_efficient')!;
    const allText = [s.shortVerdict, s.physicsReason].join(' ').toLowerCase();
    expect(allText).toMatch(/standing loss/);
  });

  it('no scenario uses prohibited term "instantaneous"', () => {
    WHAT_IF_SCENARIOS.forEach(scenario => {
      const allText = [
        scenario.myth, scenario.shortVerdict, scenario.physicsReason, scenario.recommendation,
      ].join(' ').toLowerCase();
      expect(allText).not.toMatch(/instantaneous/);
    });
  });

  it('no scenario uses prohibited term "gravity system"', () => {
    WHAT_IF_SCENARIOS.forEach(scenario => {
      const allText = [
        scenario.myth, scenario.shortVerdict, scenario.physicsReason, scenario.recommendation,
      ].join(' ').toLowerCase();
      expect(allText).not.toMatch(/gravity system/);
    });
  });

  it('no scenario uses prohibited term "high performance"', () => {
    WHAT_IF_SCENARIOS.forEach(scenario => {
      const allText = [
        scenario.myth, scenario.shortVerdict, scenario.physicsReason, scenario.recommendation,
      ].join(' ').toLowerCase();
      expect(allText).not.toMatch(/high performance/);
    });
  });
});
