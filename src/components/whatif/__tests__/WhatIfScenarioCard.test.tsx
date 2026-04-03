/**
 * WhatIfScenarioCard.test.tsx
 *
 * Tests verify:
 *   - Renders the scenario title
 *   - Renders the myth block
 *   - Renders the shortVerdict badge
 *   - Renders the physicsReason
 *   - Renders the recommendation
 *   - Renders the VisualComponent
 *   - Renders before/after labels when provided
 *   - Does not render label bar when no labels are provided
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
  id: 'bigger_boiler',
  title: 'Bigger boiler = better heating',
  myth: 'A larger output means better heating, quicker warm-up, and more reliability.',
  shortVerdict: 'Oversized boilers short-cycle, waste fuel, and reduce comfort.',
  physicsReason:
    'When rated output far exceeds the true heat loss, the boiler reaches set-point almost instantly and short-cycles.',
  recommendation:
    'Atlas calculates actual heat loss to select output that matches load — not room count.',
  visualType: 'cycling',
};

const CONTROLS_SCENARIO: WhatIfScenario = {
  id: 'high_flow_temp',
  title: 'Raise the flow temperature',
  myth: 'Simply raising the boiler flow temperature will fix cold rooms.',
  shortVerdict: 'High flow temperatures lock out condensing mode and raise fuel costs.',
  physicsReason:
    'Gas boilers recover ~10 % efficiency when return water falls below ~55 °C. High flow temperatures prevent this.',
  recommendation: 'Fix emitter sizing or hydraulic balance — not the thermostat dial.',
  beforeLabel: '80 °C flow (non-condensing)',
  afterLabel: '55 °C flow (condensing ✓)',
  visualType: 'controls',
};

function StubVisual() {
  return <div data-testid="stub-visual">visual</div>;
}

describe('WhatIfScenarioCard — title and verdict', () => {
  it('renders the scenario title', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText('Bigger boiler = better heating')).toBeTruthy();
  });

  it('renders the shortVerdict', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText(CYCLING_SCENARIO.shortVerdict)).toBeTruthy();
  });
});

describe('WhatIfScenarioCard — myth block', () => {
  it('renders the myth text', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText(CYCLING_SCENARIO.myth)).toBeTruthy();
  });

  it('renders the "Myth" section label', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText('Myth')).toBeTruthy();
  });
});

describe('WhatIfScenarioCard — physics reason', () => {
  it('renders the physicsReason', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText(CYCLING_SCENARIO.physicsReason)).toBeTruthy();
  });

  it('renders the "Why this happens" section label', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText('Why this happens')).toBeTruthy();
  });
});

describe('WhatIfScenarioCard — recommendation', () => {
  it('renders the recommendation', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText(CYCLING_SCENARIO.recommendation)).toBeTruthy();
  });

  it('renders the "We recommend" section label', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.getByText('We recommend')).toBeTruthy();
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
    expect(screen.getByText(/80 °C flow/)).toBeTruthy();
    expect(screen.getByText(/55 °C flow/)).toBeTruthy();
  });

  it('does not render label bar when no labels are provided', () => {
    render(<WhatIfScenarioCard scenario={CYCLING_SCENARIO} VisualComponent={StubVisual} />);
    expect(screen.queryByText(/Before:/)).toBeNull();
    expect(screen.queryByText(/After:/)).toBeNull();
  });
});
