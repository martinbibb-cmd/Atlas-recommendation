/**
 * LabPrintCustomer.test.tsx
 *
 * Validates that LabPrintCustomer:
 *   - Renders the document title "Customer Summary"
 *   - Shows the headline verdict (system name + note)
 *   - Renders the "Why it's recommended" section with suits copy
 *   - Renders the "Key considerations" section with struggles copy
 *   - Shows the confidence badge
 *   - Shows "Not yet confirmed" label (not "Missing") for the missing inputs
 *   - Renders the next step text
 *   - Renders the screen toolbar with back and print buttons
 *   - Calls onBack when the back button is clicked
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabPrintCustomer from '../LabPrintCustomer';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LabPrintCustomer — document structure', () => {
  it('renders the "Customer Summary" document title', () => {
    render(<LabPrintCustomer />);
    // The h1 heading — toolbar also shows the same text, so use role query
    expect(screen.getByRole('heading', { level: 1, name: 'Customer Summary' })).toBeTruthy();
  });

  it('renders the document header brand element', () => {
    render(<LabPrintCustomer />);
    expect(document.querySelector('.lp-doc-header__brand')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText(/System Summary — heating recommendation overview/)).toBeTruthy();
  });
});

describe('LabPrintCustomer — verdict section', () => {
  it('renders the "Best overall fit" label', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText('Best overall fit')).toBeTruthy();
  });

  it('renders the recommended system name', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText('ASHP with unvented cylinder')).toBeTruthy();
  });

  it('renders the verdict note', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText(/Meets heat and hot water demand/)).toBeTruthy();
  });
});

describe('LabPrintCustomer — explanation sections', () => {
  it('renders the "Why it\'s recommended" section heading', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText("Why it's recommended")).toBeTruthy();
  });

  it('renders the "Key considerations" section heading', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText('Key considerations')).toBeTruthy();
  });

  it('renders suits explanation text', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText(/Meets heat demand efficiently at low flow temperature/)).toBeTruthy();
  });

  it('renders struggles explanation text', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText(/Performance depends on emitter adequacy/)).toBeTruthy();
  });
});

describe('LabPrintCustomer — confidence section', () => {
  it('renders the confidence badge', () => {
    render(<LabPrintCustomer />);
    // Badge and meta both show "Confidence: Medium", so check at least one exists
    expect(screen.getAllByText('Confidence: Medium').length).toBeGreaterThan(0);
  });

  it('renders "Not yet confirmed" instead of "Missing" for customer-facing copy', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText('Not yet confirmed')).toBeTruthy();
    expect(screen.queryByText('Missing')).toBeNull();
  });

  it('renders the missing input items under "Not yet confirmed"', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText('Emitter output verification')).toBeTruthy();
    expect(screen.getByText('Flow temperature confirmation')).toBeTruthy();
    expect(screen.getByText('Cylinder siting / routing confirmation')).toBeTruthy();
  });
});

describe('LabPrintCustomer — next step', () => {
  it('renders the next step section heading', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText('Next step')).toBeTruthy();
  });

  it('renders the next step text', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText(/Complete a Full Survey to confirm compatibility/)).toBeTruthy();
  });
});

describe('LabPrintCustomer — toolbar', () => {
  it('renders the back button', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText('← Back to Lab')).toBeTruthy();
  });

  it('renders the print button', () => {
    render(<LabPrintCustomer />);
    expect(screen.getByText(/Print \/ Save PDF/)).toBeTruthy();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<LabPrintCustomer onBack={onBack} />);
    fireEvent.click(screen.getByText('← Back to Lab'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
