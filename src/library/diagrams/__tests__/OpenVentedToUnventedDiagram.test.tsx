/**
 * OpenVentedToUnventedDiagram.test.tsx
 *
 * Validates the CWS (cold-water storage) tank capacity labelling rules:
 * - No guessed generic litre ranges appear by default
 * - Surveyed capacity shown only when explicitly provided
 * - Twin-tank label appears when twinCwsTanks is true
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpenVentedToUnventedDiagram } from '../OpenVentedToUnventedDiagram';

// ─── Default rendering (no survey data) ──────────────────────────────────────

describe('OpenVentedToUnventedDiagram — default (no survey data)', () => {
  it('renders without throwing', () => {
    expect(() => render(<OpenVentedToUnventedDiagram />)).not.toThrow();
  });

  it('does not render the guessed "100–150 L" capacity label', () => {
    const { container } = render(<OpenVentedToUnventedDiagram />);
    expect(container.textContent).not.toContain('100–150 L');
    expect(container.textContent).not.toContain('100-150 L');
  });

  it('does not render any guessed litre ranges for the CWS loft tank', () => {
    const { container } = render(<OpenVentedToUnventedDiagram />);
    // Must not invent a size range that was not measured during the survey
    expect(container.textContent).not.toContain('100–150 L');
    expect(container.textContent).not.toContain('110–140 L');
  });

  it('renders the CWS tank label without capacity', () => {
    render(<OpenVentedToUnventedDiagram />);
    expect(screen.getByText('Cold water storage tank (loft)')).toBeInTheDocument();
  });

  it('renders the vented hot water cylinder label', () => {
    render(<OpenVentedToUnventedDiagram />);
    expect(screen.getByText('Vented hot water cylinder')).toBeInTheDocument();
  });

  it('renders the unvented cylinder label without guessed capacity', () => {
    render(<OpenVentedToUnventedDiagram />);
    expect(screen.getByText('Unvented cylinder')).toBeInTheDocument();
    const { container } = render(<OpenVentedToUnventedDiagram />);
    expect(container.textContent).not.toContain('150–250 L');
  });
});

// ─── Surveyed CWS capacity ────────────────────────────────────────────────────

describe('OpenVentedToUnventedDiagram — surveyed CWS capacity', () => {
  it('shows surveyed capacity when cwsVolumeLSurveyed is provided', () => {
    render(<OpenVentedToUnventedDiagram cwsVolumeLSurveyed={120} />);
    expect(screen.getByText('120 L (surveyed)')).toBeInTheDocument();
  });

  it('does not show capacity label when cwsVolumeLSurveyed is absent', () => {
    const { container } = render(<OpenVentedToUnventedDiagram />);
    expect(container.textContent).not.toMatch(/\d+ L \(surveyed\)/);
  });

  it('shows correct label for different surveyed values', () => {
    render(<OpenVentedToUnventedDiagram cwsVolumeLSurveyed={90} />);
    expect(screen.getByText('90 L (surveyed)')).toBeInTheDocument();
  });
});

// ─── Twin CWS tanks ───────────────────────────────────────────────────────────

describe('OpenVentedToUnventedDiagram — twin CWS tanks', () => {
  it('shows "Two linked loft tanks" when twinCwsTanks is true', () => {
    render(<OpenVentedToUnventedDiagram twinCwsTanks />);
    expect(screen.getByText('Two linked loft tanks')).toBeInTheDocument();
  });

  it('does not show "Cold water storage tank (loft)" when twinCwsTanks is true', () => {
    render(<OpenVentedToUnventedDiagram twinCwsTanks />);
    expect(screen.queryByText('Cold water storage tank (loft)')).toBeNull();
  });

  it('twin tanks with surveyed capacity shows both labels', () => {
    render(<OpenVentedToUnventedDiagram twinCwsTanks cwsVolumeLSurveyed={200} />);
    expect(screen.getByText('Two linked loft tanks')).toBeInTheDocument();
    expect(screen.getByText('200 L (surveyed)')).toBeInTheDocument();
  });
});

// ─── Print-safe mode ──────────────────────────────────────────────────────────

describe('OpenVentedToUnventedDiagram — print-safe mode', () => {
  it('marks wrapper as print-safe when printSafe is true', () => {
    const { container } = render(<OpenVentedToUnventedDiagram printSafe />);
    const wrapper = container.querySelector('[data-print-safe="true"]');
    expect(wrapper).not.toBeNull();
  });

  it('does not set data-print-safe when printSafe is false', () => {
    const { container } = render(<OpenVentedToUnventedDiagram printSafe={false} />);
    const wrapper = container.querySelector('[data-print-safe="true"]');
    expect(wrapper).toBeNull();
  });
});
