import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PhoneFirstQaHarness from '../PhoneFirstQaHarness';

vi.mock('../../components/portal/CustomerPortalPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-phone-qa-portal">Portal preview</div>,
  CUSTOMER_PORTAL_PHONE_MEDIA_QUERY: '(max-width: 768px)',
}));

vi.mock('../../features/houseSimulator/HouseSimulatorPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-phone-qa-simulator">Simulator preview</div>,
}));

describe('PhoneFirstQaHarness', () => {
  it('renders phone QA cards for portal, simulator, reading preferences, and deep link', () => {
    render(<PhoneFirstQaHarness />);

    expect(screen.getByText('Phone customer QA')).toBeInTheDocument();
    expect(screen.getByTestId('phone-qa-surface-portal')).toBeInTheDocument();
    expect(screen.getByTestId('phone-qa-surface-simulator')).toBeInTheDocument();
    expect(screen.getByTestId('phone-qa-surface-reading-preferences')).toBeInTheDocument();
    expect(screen.getByTestId('phone-qa-surface-deep-link')).toBeInTheDocument();
  });

  it('supports dev-menu style back navigation', () => {
    const onBack = vi.fn();
    render(<PhoneFirstQaHarness onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
