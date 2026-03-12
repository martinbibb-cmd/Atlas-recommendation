/**
 * ReportCompletenessBanner.test.tsx
 *
 * Validates that ReportCompletenessBanner:
 *   - Renders nothing when missingOptional is empty
 *   - Renders "Partial report" heading when items are present
 *   - Lists each missing optional item
 *   - Uses correct ARIA role
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportCompletenessBanner from '../ReportCompletenessBanner';

describe('ReportCompletenessBanner', () => {
  it('renders nothing when missingOptional is empty', () => {
    const { container } = render(<ReportCompletenessBanner missingOptional={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the "Partial report" title when items are present', () => {
    render(<ReportCompletenessBanner missingOptional={['24-hour behaviour timeline']} />);
    expect(screen.getByText('Partial report')).toBeTruthy();
  });

  it('renders the explanatory body text', () => {
    render(<ReportCompletenessBanner missingOptional={['24-hour behaviour timeline']} />);
    expect(screen.getByText(/Some inputs were not captured/)).toBeTruthy();
  });

  it('renders each missing optional item as a list item', () => {
    const missing = [
      '24-hour behaviour timeline',
      'Physical limiters / constraints',
      'Domain influence breakdown',
    ];
    render(<ReportCompletenessBanner missingOptional={missing} />);
    for (const item of missing) {
      expect(screen.getByText(item)).toBeTruthy();
    }
  });

  it('has role="status" for accessibility', () => {
    render(<ReportCompletenessBanner missingOptional={['Something missing']} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('has the correct aria-label', () => {
    render(<ReportCompletenessBanner missingOptional={['Something missing']} />);
    expect(screen.getByLabelText('Partial report notice')).toBeTruthy();
  });
});
