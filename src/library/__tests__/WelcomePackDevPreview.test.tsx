import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WelcomePackDevPreview } from '../dev/WelcomePackDevPreview';

describe('WelcomePackDevPreview', () => {
  it('renders Visual Preview heading by default', () => {
    render(<WelcomePackDevPreview />);

    expect(screen.getByTestId('visual-preview-heading')).toHaveTextContent('Visual Preview — customer-facing pack shape');
    expect(screen.queryByRole('heading', { level: 2, name: 'Plan metadata' })).not.toBeInTheDocument();
  });

  it('has a visual preview tab button', () => {
    render(<WelcomePackDevPreview />);
    expect(screen.getByRole('tab', { name: /visual preview/i })).toBeInTheDocument();
  });

  it('does not select diagnostics by default', () => {
    render(<WelcomePackDevPreview />);
    expect(screen.getByRole('tab', { name: /diagnostics/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('open_vented_to_sealed_unvented renders diagrams and journey cards', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    await user.selectOptions(screen.getByRole('combobox', { name: /fixture selector/i }), 'open_vented_to_sealed_unvented');

    expect(screen.getByTestId('storyboard-diagram-badge')).toHaveTextContent(/\d+\s+diagrams matched/i);
    expect(screen.getByRole('heading', { level: 2, name: /home now/i })).toBeInTheDocument();
  });

  it('changing tabs shows the correct panel', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    await user.click(screen.getByRole('tab', { name: /diagnostics/i }));
    expect(screen.getByRole('heading', { level: 2, name: 'Plan metadata' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /calm pack/i }));
    expect(screen.getByRole('heading', { level: 2, name: 'Calm customer pack preview' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /visual preview/i }));
    expect(screen.getByTestId('visual-preview-heading')).toBeInTheDocument();
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
    expect(screen.getByTestId('storyboard-diagram-badge')).toHaveTextContent(/^\d+\s+diagrams matched$/i);
    expect(screen.getByTestId('storyboard-qr-cards').children.length).toBeGreaterThan(0);
  });

  it('toggling disruption concern shows disruption badge in storyboard mode', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    await user.click(screen.getByRole('checkbox', { name: /worried about disruption/i }));

    const badges = screen.getByTestId('storyboard-active-pattern-badges');
    expect(badges.textContent?.toLowerCase()).toContain('worried about disruption');
  });

  it('toggling safety concern shows a safety atlas response card', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    await user.click(screen.getByRole('checkbox', { name: /worried about safety/i }));

    const responseCards = screen.getByTestId('storyboard-atlas-response-cards');
    expect(responseCards.textContent?.toLowerCase()).toContain('worried about safety');
  });

  it('concern toggles update sequencing metadata in diagnostics mode', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    await user.click(screen.getByRole('checkbox', { name: /worried about disruption/i }));
    await user.click(screen.getByRole('tab', { name: /diagnostics/i }));

    const patterns = screen.getByTestId('diagnostics-active-anxiety-patterns');
    expect(patterns.textContent).toContain('worried_about_disruption');
  });

  it('storyboard cards render sequencing labels', () => {
    render(<WelcomePackDevPreview />);
    const sequencedCardsContainer = screen.getByTestId('storyboard-sequenced-cards');
    expect(sequencedCardsContainer.querySelector('.atlas-storyboard-card-label')).not.toBeNull();
  });

  it('calm customer pack does not expose anxiety or profiling wording', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    await user.click(screen.getByRole('checkbox', { name: /worried about disruption/i }));
    await user.click(screen.getByRole('tab', { name: /calm pack/i }));

    const previewText = screen.getByRole('region', { name: /calm customer pack preview/i }).textContent?.toLowerCase() ?? '';
    expect(previewText).not.toContain('anxiety');
    expect(previewText).not.toContain('profiling');
  });
});
