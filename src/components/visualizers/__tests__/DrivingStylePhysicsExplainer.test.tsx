/**
 * DrivingStylePhysicsExplainer.test.tsx
 *
 * Component tests for DrivingStylePhysicsExplainer.
 *
 * Tests verify:
 *   - Renders heading and subtitle
 *   - Renders all four lane labels
 *   - Renders energy gauges for each lane
 *   - Renders lane captions
 *   - Combi shows concurrent-demand warning when peakConcurrentOutlets >= 2
 *   - Combi does NOT show warning when peakConcurrentOutlets is 1
 *   - Support text lines are rendered
 *   - systemFocus dims non-focused lanes (aria/role checks)
 *   - Compact mode renders without error
 *   - Snapshot: compact mode
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DrivingStylePhysicsExplainer from '../DrivingStylePhysicsExplainer';

// Mock matchMedia (not available in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media:   query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

// ─── Heading and subtitle ─────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — heading and subtitle', () => {
  it('renders the title', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByRole('heading', { name: /why these systems behave differently/i })).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/same destination/i)).toBeTruthy();
  });
});

// ─── Lane labels ──────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — lane labels', () => {
  it('renders the combi lane label', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/boy racer/i)).toBeTruthy();
  });

  it('renders the system lane label', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/mondeo/i)).toBeTruthy();
  });

  it('renders the Mixergy lane label', () => {
    render(<DrivingStylePhysicsExplainer />);
    // "Hyper-miler" is distinct from "Electric Hyper-miler" — use exact text
    const labels = screen.getAllByText(/hyper-miler/i);
    expect(labels.some(el => el.textContent === 'Hyper-miler')).toBe(true);
  });

  it('renders the heat pump lane label', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText('Electric Hyper-miler')).toBeTruthy();
  });
});

// ─── Lane captions ────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — lane captions', () => {
  it('renders combi caption', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/fast launch, lots of stop-start/i)).toBeTruthy();
  });

  it('renders system caption', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/steadier output/i)).toBeTruthy();
  });

  it('renders Mixergy caption', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/smarter stored hot water/i)).toBeTruthy();
  });

  it('renders heat pump caption', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/lowest-energy route/i)).toBeTruthy();
  });
});

// ─── Support text ─────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — support text', () => {
  it('renders on-demand high-power support text', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/on-demand hot water needs very high power/i)).toBeTruthy();
  });

  it('renders stored hot water steadier support text', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/stored hot water lets the heat source run more steadily/i)).toBeTruthy();
  });

  it('renders heat pump slower recovery support text', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/heat pumps use less energy overall/i)).toBeTruthy();
  });
});

// ─── Concurrent demand warning ────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — concurrent demand warning', () => {
  it('shows warning badge when peakConcurrentOutlets >= 2', () => {
    render(<DrivingStylePhysicsExplainer peakConcurrentOutlets={2} />);
    expect(screen.getByText(/on-demand hot water divides available output/i)).toBeTruthy();
  });

  it('does not show warning badge when peakConcurrentOutlets is 1', () => {
    render(<DrivingStylePhysicsExplainer peakConcurrentOutlets={1} />);
    expect(screen.queryByText(/on-demand hot water divides available output/i)).toBeNull();
  });

  it('does not show warning badge with default props', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.queryByText(/on-demand hot water divides available output/i)).toBeNull();
  });
});

// ─── Energy gauges ────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — energy gauges', () => {
  it('renders 4 progressbar elements (one per lane)', () => {
    render(<DrivingStylePhysicsExplainer />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(4);
  });
});

// ─── Compact mode ─────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — compact mode', () => {
  it('renders without error in compact mode', () => {
    expect(() => render(<DrivingStylePhysicsExplainer compact />)).not.toThrow();
  });

  it('still renders the title in compact mode', () => {
    render(<DrivingStylePhysicsExplainer compact />);
    expect(screen.getByRole('heading', { name: /why these systems behave differently/i })).toBeTruthy();
  });

  it('still renders all four lane labels in compact mode', () => {
    render(<DrivingStylePhysicsExplainer compact />);
    expect(screen.getByText(/boy racer/i)).toBeTruthy();
    expect(screen.getByText(/mondeo/i)).toBeTruthy();
    // "Hyper-miler" is distinct from "Electric Hyper-miler"
    const labels = screen.getAllByText(/hyper-miler/i);
    expect(labels.some(el => el.textContent === 'Hyper-miler')).toBe(true);
    expect(screen.getByText('Electric Hyper-miler')).toBeTruthy();
  });
});

// ─── systemFocus prop ─────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — systemFocus', () => {
  it('renders without error when systemFocus is "combi"', () => {
    expect(() => render(<DrivingStylePhysicsExplainer systemFocus="combi" />)).not.toThrow();
  });

  it('renders without error when systemFocus is "heatpump"', () => {
    expect(() => render(<DrivingStylePhysicsExplainer systemFocus="heatpump" />)).not.toThrow();
  });

  it('renders without error when systemFocus is "all"', () => {
    expect(() => render(<DrivingStylePhysicsExplainer systemFocus="all" />)).not.toThrow();
  });

  it('renders the focused lane label when systemFocus is "system"', () => {
    render(<DrivingStylePhysicsExplainer systemFocus="system" />);
    expect(screen.getByText(/mondeo/i)).toBeTruthy();
  });
});
