/**
 * LabPrintComparison.test.tsx
 *
 * Validates that LabPrintComparison:
 *   - Renders the document title "Comparison Sheet"
 *   - Renders the ATLAS brand
 *   - Shows the comparison table with all three system columns
 *   - Renders all normalized heading rows
 *   - Shows the trade-off summary section
 *   - Renders "Strongest fit", "Main trade-off", and "What would need to change"
 *     blocks for each candidate
 *   - Renders the toolbar with back and print buttons
 *   - Calls onBack when the back button is clicked
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabPrintComparison from '../LabPrintComparison';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LabPrintComparison — document structure', () => {
  it('renders the "Comparison Sheet" document title', () => {
    render(<LabPrintComparison />);
    // The h1 heading — toolbar also shows the same text, so use role query
    expect(screen.getByRole('heading', { level: 1, name: 'Comparison Sheet' })).toBeTruthy();
  });

  it('renders the ATLAS brand', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText('ATLAS')).toBeTruthy();
  });

  it('renders the comparison subtitle', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText(/side-by-side system comparison/)).toBeTruthy();
  });
});

describe('LabPrintComparison — comparison table', () => {
  it('renders the table section heading', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText('Side-by-side comparison')).toBeTruthy();
  });

  it('renders the current system column header', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText('Gas Combi (Current)')).toBeTruthy();
  });

  it('renders the Gas System + Cylinder column header', () => {
    render(<LabPrintComparison />);
    // column header in thead
    expect(screen.getAllByText('Gas System + Cylinder').length).toBeGreaterThan(0);
  });

  it('renders the ASHP column header', () => {
    render(<LabPrintComparison />);
    // column header in thead
    expect(screen.getAllByText('ASHP').length).toBeGreaterThan(0);
  });

  it('renders all 8 normalized row headings in the table', () => {
    render(<LabPrintComparison />);
    const headings = [
      'Heat performance',
      'Hot water performance',
      'Reliability',
      'Longevity',
      'Disruption',
      'Control',
      'Eco / operating behaviour',
      'Future compatibility',
    ];
    for (const h of headings) {
      expect(screen.getAllByText(h).length).toBeGreaterThan(0);
    }
  });

  it('renders current system row content', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText(/No change — existing system remains in place/)).toBeTruthy();
  });

  it('renders ASHP disruption row content', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText(/Significant: outdoor unit, cylinder/)).toBeTruthy();
  });
});

describe('LabPrintComparison — trade-off summary', () => {
  it('renders the "Trade-off summary" section heading', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText('Trade-off summary')).toBeTruthy();
  });

  it('renders "Strongest fit" labels for each candidate', () => {
    render(<LabPrintComparison />);
    const labels = screen.getAllByText('Strongest fit');
    expect(labels.length).toBe(2);
  });

  it('renders "Main trade-off" labels for each candidate', () => {
    render(<LabPrintComparison />);
    const labels = screen.getAllByText('Main trade-off');
    expect(labels.length).toBe(2);
  });

  it('renders "What would need to change" labels for each candidate', () => {
    render(<LabPrintComparison />);
    const labels = screen.getAllByText('What would need to change');
    expect(labels.length).toBe(2);
  });

  it('renders suits text for Gas System + Cylinder in the trade-off block', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText(/Strong on-demand hot water resilience/)).toBeTruthy();
  });

  it('renders suits text for ASHP in the trade-off block', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText(/Meets heat demand efficiently at low flow temperature/)).toBeTruthy();
  });
});

describe('LabPrintComparison — toolbar', () => {
  it('renders the back button', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText('← Back to Lab')).toBeTruthy();
  });

  it('renders the print button', () => {
    render(<LabPrintComparison />);
    expect(screen.getByText(/Print \/ Save PDF/)).toBeTruthy();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<LabPrintComparison onBack={onBack} />);
    fireEvent.click(screen.getByText('← Back to Lab'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
