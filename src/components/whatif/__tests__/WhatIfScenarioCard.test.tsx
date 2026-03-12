/**
 * WhatIfScenarioCard.test.tsx
 *
 * Tests verify:
 *   - Renders the scenario title
 *   - Renders the shortVerdict badge
 *   - Renders all whyItMatters bullets
 *   - Renders the VisualComponent
 *   - Renders before/after labels when provided
 *   - Renders without labels when not provided
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WhatIfScenarioCard from '../WhatIfScenarioCard';
import type { WhatIfScenario } from '../../explainers/whatIfScenarios';

// Mock matchMedia (not available in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

const CYCLING_SCENARIO: WhatIfScenario = {
  id: 'boiler_too_big',
  title: 'Boiler too big',
  shortVerdict: 'Too much output for the heating load causes cycling.',
  whyItMatters: [
    'The boiler reaches temperature too quickly.',
    'It switches off and restarts more often.',
  ],
  visualType: 'cycling',
};

const CONTROLS_SCENARIO: WhatIfScenario = {
  id: 'add_better_controls',
  title: 'Improve boiler control',
  shortVerdict: 'Better boiler control helps the heat source run lower and steadier.',
  whyItMatters: [
    'Lower flow temperatures improve condensing potential.',
    'Better control reduces stop-start cycling.',
  ],
  beforeLabel: 'Fixed higher flow',
  afterLabel: 'Lower, steadier flow',
  visualType: 'controls',
};

function StubVisual() {
  return <div data-testid="stub-visual">visual</div>;
}

describe('WhatIfScenarioCard — title and verdict', () => {
  it('renders the scenario title', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText('Boiler too big')).toBeTruthy();
  });

  it('renders the shortVerdict', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText(CYCLING_SCENARIO.shortVerdict)).toBeTruthy();
  });
});

describe('WhatIfScenarioCard — bullets', () => {
  it('renders all whyItMatters bullets', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    CYCLING_SCENARIO.whyItMatters.forEach(point => {
      expect(screen.getByText(point)).toBeTruthy();
    });
  });
});

describe('WhatIfScenarioCard — visual component', () => {
  it('renders the provided VisualComponent', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByTestId('stub-visual')).toBeTruthy();
  });
});

describe('WhatIfScenarioCard — before/after labels', () => {
  it('renders beforeLabel and afterLabel when provided', () => {
    render(<WhatIfScenarioCard scenario={CONTROLS_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText(/Fixed higher flow/)).toBeTruthy();
    expect(screen.getByText(/Lower, steadier flow/)).toBeTruthy();
  });

  it('does not render label bar when no labels are provided', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.queryByText(/Before:/)).toBeNull();
    expect(screen.queryByText(/After:/)).toBeNull();
  });
});
