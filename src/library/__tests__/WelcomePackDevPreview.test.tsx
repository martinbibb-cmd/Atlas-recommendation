import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WelcomePackDevPreview } from '../dev/WelcomePackDevPreview';

describe('WelcomePackDevPreview', () => {
  it('uses visual storyboard as the default mode', () => {
    render(<WelcomePackDevPreview />);

    expect(screen.getByRole('radio', { name: /visual storyboard/i })).toBeChecked();
    expect(screen.getByTestId('visual-storyboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Plan metadata' })).not.toBeInTheDocument();
  });

  it('hides diagnostics by default and does not leak QA or audit text into visual mode', () => {
    render(<WelcomePackDevPreview />);

    expect(screen.queryByText('selectedConceptIds')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Content QA' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Asset QA' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Asset accessibility audit' })).not.toBeInTheDocument();
  });

  it('renders sequenced cards in ascending sequence order', () => {
    render(<WelcomePackDevPreview />);

    const sequencedCardsContainer = screen.getByTestId('storyboard-sequenced-cards');
    const renderedCards = sequencedCardsContainer.querySelectorAll('[data-sequence-order]');
    const renderedOrders = Array.from(renderedCards).map((card) => Number(card.getAttribute('data-sequence-order')));

    expect(renderedOrders.length).toBeGreaterThan(0);
    expect(renderedOrders).toEqual(renderedOrders.slice().sort((a, b) => a - b));
  });

  it('shows print sheet cards and QR deep dive cards in storyboard mode', () => {
    render(<WelcomePackDevPreview />);

    expect(screen.getByTestId('storyboard-print-cards').children.length).toBeGreaterThan(0);
    expect(screen.getByTestId('storyboard-qr-cards').children.length).toBeGreaterThan(0);
  });

  it('keeps the calm customer pack blocked when output is not production-safe', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    await user.click(screen.getByRole('radio', { name: /calm customer pack/i }));

    expect(screen.getByRole('heading', { level: 2, name: 'Calm customer pack preview' })).toBeInTheDocument();
    expect(screen.getByTestId('cwpr-blocking-panel')).toBeInTheDocument();
  });
});
