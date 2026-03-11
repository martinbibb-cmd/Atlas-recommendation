/**
 * LabPrintTechnical.test.tsx
 *
 * Validates that LabPrintTechnical:
 *   - Renders the document title "Technical Specification"
 *   - Renders the ATLAS brand
 *   - Shows the current system section
 *   - Shows candidate system names and their comparison rows
 *   - Shows the confidence drivers section with measured/inferred groups
 *   - Shows the technical constraints section
 *   - Shows the items requiring confirmation (missing inputs)
 *   - Renders the toolbar back and print buttons
 *   - Calls onBack when the back button is clicked
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabPrintTechnical from '../LabPrintTechnical';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LabPrintTechnical — document structure', () => {
  it('renders the "Technical Specification" document title', () => {
    render(<LabPrintTechnical />);
    // The h1 heading — toolbar also shows the same text, so use role query
    expect(screen.getByRole('heading', { level: 1, name: 'Technical Specification' })).toBeTruthy();
  });

  it('renders the ATLAS brand', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('ATLAS')).toBeTruthy();
  });

  it('renders the engineer subtitle', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText(/engineer \/ internal reference/)).toBeTruthy();
  });
});

describe('LabPrintTechnical — current system', () => {
  it('renders the "Current system" section heading', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Current system')).toBeTruthy();
  });

  it('renders the current system type value', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Gas Combi')).toBeTruthy();
  });
});

describe('LabPrintTechnical — candidate systems', () => {
  it('renders the "Candidate systems" section heading', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Candidate systems')).toBeTruthy();
  });

  it('renders Gas System + Cylinder candidate heading', () => {
    render(<LabPrintTechnical />);
    // Appears in candidate list h3 AND in constraints section div
    expect(screen.getAllByText('Gas System + Cylinder').length).toBeGreaterThan(0);
  });

  it('renders ASHP candidate heading', () => {
    render(<LabPrintTechnical />);
    // Appears in candidate list h3 AND in constraints section div
    expect(screen.getAllByText('ASHP').length).toBeGreaterThan(0);
  });

  it('renders normalized comparison row labels', () => {
    render(<LabPrintTechnical />);
    expect(screen.getAllByText('Heat performance').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hot water performance').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reliability').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Longevity').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Disruption').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Control').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Eco / operating behaviour').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Future compatibility').length).toBeGreaterThan(0);
  });
});

describe('LabPrintTechnical — confidence drivers', () => {
  it('renders the "Confidence drivers" section heading', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Confidence drivers')).toBeTruthy();
  });

  it('renders the confidence badge', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Overall: Medium')).toBeTruthy();
  });

  it('renders the "Measured" group label', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Measured')).toBeTruthy();
  });

  it('renders measured items', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Current system type')).toBeTruthy();
    expect(screen.getByText('Occupancy count')).toBeTruthy();
  });

  it('renders the "Inferred / assumed" group label', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Inferred / assumed')).toBeTruthy();
  });

  it('renders inferred items', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('DHW demand (from occupancy pattern)')).toBeTruthy();
  });
});

describe('LabPrintTechnical — constraints', () => {
  it('renders the "Technical constraints and required changes" section', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Technical constraints and required changes')).toBeTruthy();
  });

  it('renders changes copy for each candidate', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText(/Confirm cylinder siting, primary routing/)).toBeTruthy();
    expect(screen.getByText(/Confirm emitter output, flow temperatures/)).toBeTruthy();
  });
});

describe('LabPrintTechnical — items requiring confirmation', () => {
  it('renders the "Items requiring confirmation" section heading', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Items requiring confirmation')).toBeTruthy();
  });

  it('renders missing items in the confirmation list', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('Emitter output verification')).toBeTruthy();
    expect(screen.getByText('Flow temperature confirmation')).toBeTruthy();
    expect(screen.getByText('Cylinder siting / routing confirmation')).toBeTruthy();
  });
});

describe('LabPrintTechnical — toolbar', () => {
  it('renders the back button', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText('← Back to Lab')).toBeTruthy();
  });

  it('renders the print button', () => {
    render(<LabPrintTechnical />);
    expect(screen.getByText(/Print \/ Save PDF/)).toBeTruthy();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<LabPrintTechnical onBack={onBack} />);
    fireEvent.click(screen.getByText('← Back to Lab'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
