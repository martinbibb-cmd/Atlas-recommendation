import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DevMenuPage from '../DevMenuPage';

vi.mock('../../../features/userProfiles/useActiveUser', () => ({
  useActiveUser: () => ({ activeUser: null }),
}));

describe('DevMenuPage visual education library links', () => {
  it('shows a visible Visual Education Library group with all three gallery links', () => {
    render(<DevMenuPage onBack={() => {}} />);

    expect(screen.getByTestId('devmenu-visual-education-library')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open QA hub' })).toHaveAttribute('href', '/dev/visual-education-library');
    expect(screen.getByRole('link', { name: 'Open QA hub via query flag' })).toHaveAttribute('href', '/?visual-education-library=1');

    const primitiveCard = screen.getByTestId('devmenu-visual-education-library-visual-primitive-gallery');
    const topologyCard = screen.getByTestId('devmenu-visual-education-library-visual-topology-gallery');
    const overlayCard = screen.getByTestId('devmenu-visual-education-library-analogy-overlay-gallery');

    expect(primitiveCard.textContent).toContain('/dev/visual-primitive-gallery');
    expect(primitiveCard.textContent).toContain('?visual-primitive-gallery=1');

    expect(topologyCard.textContent).toContain('/dev/visual-topology-gallery');
    expect(topologyCard.textContent).toContain('?visual-topology-gallery=1');

    expect(overlayCard.textContent).toContain('/dev/analogy-overlay-gallery');
    expect(overlayCard.textContent).toContain('?analogy-overlay-gallery=1');

    expect(screen.getAllByRole('link', { name: /Open route/i })).toHaveLength(3);
    expect(screen.getAllByRole('link', { name: /Open query flag/i })).toHaveLength(3);
  });
});
