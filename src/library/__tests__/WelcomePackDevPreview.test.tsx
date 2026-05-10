import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WelcomePackDevPreview } from '../dev/WelcomePackDevPreview';

describe('WelcomePackDevPreview', () => {
  it('renders development guard label and metadata sections', () => {
    render(<WelcomePackDevPreview />);

    expect(screen.getByText('Development preview — not customer content.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Plan metadata' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'selectedConceptIds' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'deferredConceptIds' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Omitted assets and reasons' })).toBeInTheDocument();
  });

  it('shows omitted and deferred reason text in preview metadata', () => {
    render(<WelcomePackDevPreview />);

    expect(screen.getAllByText(/No routing rule|No matched concern tags|Deferred to QR/i).length).toBeGreaterThan(0);
  });

  it('technical appendix toggle changes appendix visibility state', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    const toggle = screen.getByRole('checkbox', { name: /technical appendix/i });
    const visibility = screen.getByTestId('technical-appendix-visibility');
    expect(visibility.textContent).toBe('hidden');

    await user.click(toggle);
    expect(visibility.textContent).toBe('visible');

    await user.click(toggle);
    expect(visibility.textContent).toBe('hidden');
  });

  it('renders calm customer pack preview below diagnostics when the toggle is enabled', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    const toggle = screen.getByRole('checkbox', { name: /preview calm customer pack/i });
    await user.click(toggle);

    expect(screen.getByRole('heading', { level: 2, name: 'Calm customer pack preview' })).toBeInTheDocument();
    expect(screen.getByTestId('cwpr-blocking-panel')).toBeInTheDocument();
  });
});
