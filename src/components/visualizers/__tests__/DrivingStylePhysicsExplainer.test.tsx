/**
 * DrivingStylePhysicsExplainer.test.tsx
 *
 * Component tests for DrivingStylePhysicsExplainer.
 *
 * Tests verify:
 *   - Renders heading and subtitle
 *   - Renders all four row labels
 *   - Renders row captions
 *   - Combi shows warningChip when peakConcurrentOutlets >= 2
 *   - Combi does NOT show warningChip when peakConcurrentOutlets is 1
 *   - Support text lines are rendered
 *   - systemFocus dims non-focused rows
 *   - Compact mode renders without error
 *   - No deprecated motion-state animation classes are present
 *   - No role="progressbar" is present in rendered output
 *   - animate prop controls presence of dspe--animated class
 *   - Fixed semantic energy bar widths (combi 85%, system 60%, mixergy 45%, heatpump 25%)
 *   - Play/Replay button appears, is keyboard accessible, and triggers animation
 *   - showPlayButton and autoPlay props
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
    expect(screen.getByRole('heading', { name: /same job\. different strategy\./i })).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/all systems complete the same job/i)).toBeTruthy();
  });
});

// ─── Row labels ───────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — row labels', () => {
  it('renders the combi row label', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/boy racer/i)).toBeTruthy();
  });

  it('renders the system row label', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/mondeo/i)).toBeTruthy();
  });

  it('renders the Mixergy row label', () => {
    render(<DrivingStylePhysicsExplainer />);
    // "Hyper-miler" is distinct from "Electric Hyper-miler" — use exact text
    const labels = screen.getAllByText(/hyper-miler/i);
    expect(labels.some(el => el.textContent === 'Hyper-miler')).toBe(true);
  });

  it('renders the heat pump row label', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText('Electric Hyper-miler')).toBeTruthy();
  });
});

// ─── Row captions ─────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — row captions', () => {
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
    expect(screen.getByText(/sets off first, runs smoothest/i)).toBeTruthy();
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

  it('renders heat pump earliest departure support text', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/heat pumps start earliest/i)).toBeTruthy();
  });
});

// ─── Warning chip — concurrent demand ────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — concurrent demand warning chip', () => {
  it('shows warning chip when peakConcurrentOutlets >= 2', () => {
    render(<DrivingStylePhysicsExplainer peakConcurrentOutlets={2} />);
    expect(screen.getByText(/second tap warning/i)).toBeTruthy();
  });

  it('does not show warning chip when peakConcurrentOutlets is 1', () => {
    render(<DrivingStylePhysicsExplainer peakConcurrentOutlets={1} />);
    expect(screen.queryByText(/second tap warning/i)).toBeNull();
  });

  it('does not show warning chip with default props', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.queryByText(/second tap warning/i)).toBeNull();
  });
});

// ─── No deprecated animation classes ─────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — no deprecated animation classes', () => {
  it('renders no elements with legacy motion-state classes', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const animationClassPattern = /dspe__(token|progress-fill|gauge-fill)--(reversing|warning|cruising|launching)/;
    expect(container.innerHTML).not.toMatch(animationClassPattern);
  });

  it('renders no role="progressbar" elements', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });
});

// ─── Compact mode ─────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — compact mode', () => {
  it('renders without error in compact mode', () => {
    expect(() => render(<DrivingStylePhysicsExplainer compact />)).not.toThrow();
  });

  it('still renders the title in compact mode', () => {
    render(<DrivingStylePhysicsExplainer compact />);
    expect(screen.getByRole('heading', { name: /same job\. different strategy\./i })).toBeTruthy();
  });

  it('still renders all four row labels in compact mode', () => {
    render(<DrivingStylePhysicsExplainer compact />);
    expect(screen.getByText(/boy racer/i)).toBeTruthy();
    expect(screen.getByText(/mondeo/i)).toBeTruthy();
    // "Hyper-miler" is distinct from "Electric Hyper-miler"
    const labels = screen.getAllByText(/hyper-miler/i);
    expect(labels.some(el => el.textContent === 'Hyper-miler')).toBe(true);
    expect(screen.getByText('Electric Hyper-miler')).toBeTruthy();
  });

  it('compact mode also has no animation classes', () => {
    const { container } = render(<DrivingStylePhysicsExplainer compact />);
    const animationClassPattern = /dspe__(token|progress-fill|gauge-fill)--(reversing|warning|cruising|launching)/;
    expect(container.innerHTML).not.toMatch(animationClassPattern);
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

  it('renders the focused row label when systemFocus is "system"', () => {
    render(<DrivingStylePhysicsExplainer systemFocus="system" />);
    expect(screen.getByText(/mondeo/i)).toBeTruthy();
  });

  it('applies dimmed class to non-focused rows when systemFocus is set', () => {
    const { container } = render(<DrivingStylePhysicsExplainer systemFocus="combi" />);
    const dimmedRows = container.querySelectorAll('.dspe__row--dimmed');
    expect(dimmedRows.length).toBe(3);
  });
});

// ─── animate prop ─────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — animate prop', () => {
  it('does NOT add dspe--animated class by default (static initial render)', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    expect(container.querySelector('.dspe--animated')).toBeNull();
  });

  it('does NOT add dspe--animated class when animate={true} on initial render (no autoPlay)', () => {
    const { container } = render(<DrivingStylePhysicsExplainer animate={true} />);
    expect(container.querySelector('.dspe--animated')).toBeNull();
  });

  it('omits dspe--animated class when animate={false}', () => {
    const { container } = render(<DrivingStylePhysicsExplainer animate={false} />);
    expect(container.querySelector('.dspe--animated')).toBeNull();
  });

  it('renders all four row labels when animate={false}', () => {
    render(<DrivingStylePhysicsExplainer animate={false} />);
    expect(screen.getByText(/boy racer/i)).toBeTruthy();
    expect(screen.getByText(/mondeo/i)).toBeTruthy();
    const labels = screen.getAllByText(/hyper-miler/i);
    expect(labels.some(el => el.textContent === 'Hyper-miler')).toBe(true);
    expect(screen.getByText('Electric Hyper-miler')).toBeTruthy();
  });

  it('renders vehicle tokens with drivetrain-specific classes', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    expect(container.querySelector('.dspe__vehicle-token--combi')).toBeTruthy();
    expect(container.querySelector('.dspe__vehicle-token--system')).toBeTruthy();
    expect(container.querySelector('.dspe__vehicle-token--mixergy')).toBeTruthy();
    expect(container.querySelector('.dspe__vehicle-token--heatpump')).toBeTruthy();
  });

  it('adds dspe__vehicle-token--has-warning to combi token when warningChip present', () => {
    const { container } = render(<DrivingStylePhysicsExplainer peakConcurrentOutlets={2} />);
    const combiToken = container.querySelector('.dspe__vehicle-token--combi');
    expect(combiToken?.classList.contains('dspe__vehicle-token--has-warning')).toBe(true);
  });

  it('does not add dspe__vehicle-token--has-warning to combi token without warningChip', () => {
    const { container } = render(<DrivingStylePhysicsExplainer peakConcurrentOutlets={1} />);
    const combiToken = container.querySelector('.dspe__vehicle-token--combi');
    expect(combiToken?.classList.contains('dspe__vehicle-token--has-warning')).toBe(false);
  });

  it('compact mode still renders without error when animate=true', () => {
    expect(() => render(<DrivingStylePhysicsExplainer compact animate={true} />)).not.toThrow();
  });
});

// ─── Play / Replay button ─────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — play/replay button', () => {
  it('renders a play button by default', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByRole('button', { name: /play heating system explainer/i })).toBeTruthy();
  });

  it('play button label is "▶\u00a0Play explainer" before first play', () => {
    render(<DrivingStylePhysicsExplainer />);
    const btn = screen.getByRole('button', { name: /play heating system explainer/i });
    expect(btn.textContent).toContain('Play explainer');
  });

  it('adds dspe--animated class after clicking Play', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const btn = screen.getByRole('button', { name: /play heating system explainer/i });
    act(() => { fireEvent.click(btn); });
    expect(container.querySelector('.dspe--animated')).toBeTruthy();
  });

  it('button label changes to "↻\u00a0Replay" after first click', () => {
    render(<DrivingStylePhysicsExplainer />);
    const btn = screen.getByRole('button', { name: /play heating system explainer/i });
    act(() => { fireEvent.click(btn); });
    const replayBtn = screen.getByRole('button', { name: /replay heating system explainer/i });
    expect(replayBtn.textContent).toContain('Replay');
  });

  it('does not render play button when showPlayButton={false}', () => {
    render(<DrivingStylePhysicsExplainer showPlayButton={false} />);
    expect(screen.queryByRole('button', { name: /play heating system explainer/i })).toBeNull();
  });

  it('does not render play button when animate={false}', () => {
    render(<DrivingStylePhysicsExplainer animate={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render play button in compact mode', () => {
    render(<DrivingStylePhysicsExplainer compact />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('play button has correct aria-label before first play', () => {
    render(<DrivingStylePhysicsExplainer />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe('Play heating system explainer');
  });

  it('play button aria-label changes to Replay after first play', () => {
    render(<DrivingStylePhysicsExplainer />);
    const btn = screen.getByRole('button');
    act(() => { fireEvent.click(btn); });
    const replayBtn = screen.getByRole('button');
    expect(replayBtn.getAttribute('aria-label')).toBe('Replay heating system explainer');
  });
});

// ─── autoPlay prop ────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — autoPlay prop', () => {
  it('adds dspe--animated class on mount when autoPlay={true}', () => {
    const { container } = render(<DrivingStylePhysicsExplainer autoPlay={true} />);
    expect(container.querySelector('.dspe--animated')).toBeTruthy();
  });

  it('button label is "↻\u00a0Replay" on mount when autoPlay={true} (already played)', () => {
    render(<DrivingStylePhysicsExplainer autoPlay={true} />);
    const btn = screen.getByRole('button', { name: /replay heating system explainer/i });
    expect(btn.textContent).toContain('Replay');
  });

  it('does not add dspe--animated class on mount when autoPlay={false} (default)', () => {
    const { container } = render(<DrivingStylePhysicsExplainer autoPlay={false} />);
    expect(container.querySelector('.dspe--animated')).toBeNull();
  });

  it('autoPlay has no effect when animate={false}', () => {
    const { container } = render(<DrivingStylePhysicsExplainer autoPlay={true} animate={false} />);
    expect(container.querySelector('.dspe--animated')).toBeNull();
  });
});

// ─── Fixed semantic energy bar widths ─────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — energy bar widths', () => {
  it('combi energy bar is 85%', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const fill = container.querySelector('[data-system="combi"] .dspe__energy-fill');
    expect(fill?.getAttribute('style')).toContain('width: 85%');
  });

  it('system energy bar is 60%', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const fill = container.querySelector('[data-system="system"] .dspe__energy-fill');
    expect(fill?.getAttribute('style')).toContain('width: 60%');
  });

  it('mixergy energy bar is 45%', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const fill = container.querySelector('[data-system="mixergy"] .dspe__energy-fill');
    expect(fill?.getAttribute('style')).toContain('width: 45%');
  });

  it('heatpump energy bar is 25%', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const fill = container.querySelector('[data-system="heatpump"] .dspe__energy-fill');
    expect(fill?.getAttribute('style')).toContain('width: 25%');
  });
});

// ─── Fuel labels ──────────────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — fuel labels', () => {
  it('shows "Gas used" label on combi row', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const label = container.querySelector('[data-system="combi"] .dspe__energy-label');
    expect(label?.textContent).toBe('Gas used');
  });

  it('shows "Gas used" label on system row', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const label = container.querySelector('[data-system="system"] .dspe__energy-label');
    expect(label?.textContent).toBe('Gas used');
  });

  it('shows "Gas used" label on mixergy row', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const label = container.querySelector('[data-system="mixergy"] .dspe__energy-label');
    expect(label?.textContent).toBe('Gas used');
  });

  it('shows "Electric used" label on heatpump row', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const label = container.querySelector('[data-system="heatpump"] .dspe__energy-label');
    expect(label?.textContent).toBe('Electric used');
  });

  it('every row has an energy label element', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const labels = container.querySelectorAll('.dspe__energy-label');
    expect(labels).toHaveLength(4);
  });
});

// ─── Vehicle orientation ──────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — vehicle orientation', () => {
  it('all vehicle tokens contain a .dspe__vehicle-glyph inner wrapper', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const glyphs = container.querySelectorAll('.dspe__vehicle-glyph');
    expect(glyphs).toHaveLength(4);
  });

  it('each .dspe__vehicle-token contains exactly one .dspe__vehicle-glyph', () => {
    const { container } = render(<DrivingStylePhysicsExplainer />);
    const tokens = container.querySelectorAll('.dspe__vehicle-token');
    tokens.forEach(token => {
      expect(token.querySelectorAll('.dspe__vehicle-glyph')).toHaveLength(1);
    });
  });
});

// ─── Heat pump cost caveat ────────────────────────────────────────────────────

describe('DrivingStylePhysicsExplainer — heat pump cost caveat', () => {
  it('renders the energy-vs-running-cost note', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/energy used is not the same as running cost/i)).toBeTruthy();
  });

  it('cost note mentions electricity costs more per kWh', () => {
    render(<DrivingStylePhysicsExplainer />);
    expect(screen.getByText(/electricity usually costs more per kwh than gas/i)).toBeTruthy();
  });

  it('cost note is present when animate={false}', () => {
    render(<DrivingStylePhysicsExplainer animate={false} />);
    expect(screen.getByText(/energy used is not the same as running cost/i)).toBeTruthy();
  });
});
