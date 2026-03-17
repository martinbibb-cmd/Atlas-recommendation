// src/components/compass/__tests__/HomeEnergyCompass.test.tsx
//
// Tests for the HomeEnergyCompass component.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeEnergyCompass from '../HomeEnergyCompass';
import type { CompassState } from '../../../lib/compass/buildCompassState';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STATE_CURRENT_ONLY: CompassState = {
  current: { x: 0, y: -0.7, label: 'You are here', type: 'current' },
  recommended: undefined,
  opportunities: [],
};

const STATE_WITH_RECOMMENDED: CompassState = {
  current: { x: 0, y: -0.7, label: 'You are here', type: 'current' },
  recommended: { x: 0.65, y: 0.65, label: 'Air Source Heat Pump', type: 'recommended' },
  opportunities: [],
};

const STATE_WITH_OPPORTUNITIES: CompassState = {
  current: { x: 0, y: -0.7, label: 'You are here', type: 'current' },
  recommended: { x: 0.65, y: 0.65, label: 'Air Source Heat Pump', type: 'recommended' },
  opportunities: [
    { x: 0.30, y: 0.75, label: '☀️ Solar PV', type: 'opportunity' },
    { x: 1.00, y: 0.65, label: '⚡ EV charging', type: 'opportunity' },
  ],
};

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('HomeEnergyCompass — rendering', () => {
  it('renders without crashing', () => {
    expect(() => render(<HomeEnergyCompass compassState={STATE_CURRENT_ONLY} />)).not.toThrow();
  });

  it('renders the accessible SVG role and label', () => {
    render(<HomeEnergyCompass compassState={STATE_CURRENT_ONLY} />);
    expect(screen.getByRole('img', { name: /home energy compass/i })).toBeTruthy();
  });

  it('renders cardinal direction labels', () => {
    render(<HomeEnergyCompass compassState={STATE_CURRENT_ONLY} />);
    const svg = screen.getByRole('img', { name: /home energy compass/i });
    // Cardinal letters are text elements within the SVG — check SVG content.
    expect(svg.textContent).toContain('N');
    expect(svg.textContent).toContain('S');
    expect(svg.textContent).toContain('E');
    expect(svg.textContent).toContain('W');
  });

  it('renders axis descriptions', () => {
    render(<HomeEnergyCompass compassState={STATE_CURRENT_ONLY} />);
    const svg = screen.getByRole('img', { name: /home energy compass/i });
    expect(svg.textContent).toContain('Efficiency');
    expect(svg.textContent).toContain('Low capital');
    expect(svg.textContent).toContain('Electrification');
    expect(svg.textContent).toContain('Independence');
  });
});

// ─── Current position ─────────────────────────────────────────────────────────

describe('HomeEnergyCompass — current position', () => {
  it('shows "You are here" label', () => {
    render(<HomeEnergyCompass compassState={STATE_CURRENT_ONLY} />);
    // Appears in both SVG marker and legend
    const matches = screen.getAllByText(/you are here/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders legend entry for current position', () => {
    render(<HomeEnergyCompass compassState={STATE_CURRENT_ONLY} />);
    const legend = screen.getByLabelText('Compass legend');
    expect(legend.textContent).toContain('You are here');
  });
});

// ─── Recommended position ─────────────────────────────────────────────────────

describe('HomeEnergyCompass — recommended position', () => {
  it('renders "Recommended" marker when recommended is present', () => {
    render(<HomeEnergyCompass compassState={STATE_WITH_RECOMMENDED} />);
    const matches = screen.getAllByText(/recommended/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders the recommended system label in the legend', () => {
    render(<HomeEnergyCompass compassState={STATE_WITH_RECOMMENDED} />);
    const legend = screen.getByLabelText('Compass legend');
    expect(legend.textContent).toContain('Air Source Heat Pump');
  });

  it('does not render a recommended marker when recommended is absent', () => {
    render(<HomeEnergyCompass compassState={STATE_CURRENT_ONLY} />);
    const legend = screen.getByLabelText('Compass legend');
    expect(legend.textContent).not.toContain('Air Source Heat Pump');
  });
});

// ─── Opportunity vectors ──────────────────────────────────────────────────────

describe('HomeEnergyCompass — opportunity vectors', () => {
  it('renders opportunity labels in the legend', () => {
    render(<HomeEnergyCompass compassState={STATE_WITH_OPPORTUNITIES} />);
    const legend = screen.getByLabelText('Compass legend');
    expect(legend.textContent).toContain('Solar PV');
    expect(legend.textContent).toContain('EV charging');
  });

  it('renders no opportunity entries when list is empty', () => {
    render(<HomeEnergyCompass compassState={STATE_WITH_RECOMMENDED} />);
    const legend = screen.getByLabelText('Compass legend');
    expect(legend.textContent).not.toContain('Solar PV');
    expect(legend.textContent).not.toContain('EV charging');
  });
});
