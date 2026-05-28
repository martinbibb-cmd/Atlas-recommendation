import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DevMenuPage from '../DevMenuPage';

vi.mock('../../../features/userProfiles/useActiveUser', () => ({
  useActiveUser: () => ({ activeUser: null }),
}));

describe('DevMenuPage inventory curation', () => {
  it('shows the visual language authority panel with the canonical hub and all library surfaces', () => {
    render(<DevMenuPage onBack={() => {}} />);

    expect(screen.getByTestId('devmenu-visual-education-library')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Atlas Visual Language Authority' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open canonical hub' })).toHaveAttribute('href', '/dev/visual-education-library');
    expect(screen.getAllByRole('link', { name: 'Open candidate reference' })[0]).toHaveAttribute('href', '/dev/sealed-unvented-explainer-slice');
    expect(screen.getByText(/docs\/atlas-canonical-mechanical-primitive-spec\.md/i)).toBeInTheDocument();

    expect(screen.getByTestId('devmenu-visual-education-library-sealed-unvented-explainer-slice').textContent)
      .toContain('/dev/sealed-unvented-explainer-slice');
    expect(screen.getByTestId('devmenu-visual-education-library-visual-primitive-gallery').textContent)
      .toContain('/dev/visual-primitive-gallery');
    expect(screen.getByTestId('devmenu-visual-education-library-visual-topology-gallery').textContent)
      .toContain('/dev/visual-topology-gallery');
    expect(screen.getByTestId('devmenu-visual-education-library-analogy-overlay-gallery').textContent)
      .toContain('/dev/analogy-overlay-gallery');

    expect(screen.getAllByRole('link', { name: /Open (surface|candidate reference)/i })).toHaveLength(5);
  });

  it('hides dev and legacy inventory items by default and reveals them only when toggled', async () => {
    const user = userEvent.setup();
    render(<DevMenuPage onBack={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Customer-facing tools' })).toBeTruthy();
    expect(screen.getByText('Customer Portal')).toBeTruthy();
    expect(screen.getByText('Supporting PDF')).toBeTruthy();
    expect(screen.getByText('House Simulator')).toBeTruthy();
    expect(screen.getByText('Real Simulator')).toBeTruthy();
    expect(screen.getAllByText('Presentation Deck').length).toBeGreaterThan(0);
    expect(screen.queryByText('Portal Fixtures')).toBeNull();
    expect(screen.queryByText('Lifestyle Interactive')).toBeNull();
    expect(screen.queryByText('Customer Portal Preview (Prod-like)')).toBeNull();
    expect(screen.queryByText('Legacy Prototype Composer (Archived)')).toBeNull();
    expect(screen.queryByLabelText('Preview Visual Primitive Gallery')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Show dev & QA tools/i }));
    await waitFor(() => {
      expect(screen.getByText('Portal Fixtures')).toBeTruthy();
    }, { timeout: 15000 });

    await user.click(screen.getByRole('button', { name: /Show legacy tools/i }));
    await waitFor(() => {
      expect(screen.getByText('Lifestyle Interactive')).toBeTruthy();
    }, { timeout: 15000 });
  }, 20000);
});
