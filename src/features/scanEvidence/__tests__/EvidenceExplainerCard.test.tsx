/**
 * EvidenceExplainerCard.test.tsx
 *
 * Render tests for the EvidenceExplainerCard component.
 *
 * Design rules enforced:
 *   - Customer mode shows only confirmed refs; unresolved are hidden.
 *   - Engineer mode shows all refs, unresolved flagged.
 *   - Engineer notes are hidden in customer mode.
 *   - "Why this matters" heading always present when any section is visible.
 *   - Ghost-appliance variant for `general` section.
 *   - Renders nothing when all refs are unresolved in customer mode.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceExplainerCard } from '../EvidenceExplainerCard';
import type { EvidenceProofLinkV1 } from '../EvidenceProofLinkV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLink(
  section: EvidenceProofLinkV1['section'],
  resolved: boolean,
  cardKey: 'key-objects' | 'measurements' | 'ghost-appliances' | 'what-scanned' | 'open-review' = 'key-objects',
): EvidenceProofLinkV1 {
  return {
    section,
    captureRefs: [
      {
        capturePointId: `cp-${section}-${cardKey}`,
        storyboardCardKey: cardKey,
        label: `${section} capture`,
        isResolved: resolved,
      },
    ],
    reviewStatus: resolved ? 'confirmed' : 'unresolved',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EvidenceExplainerCard', () => {
  it('renders nothing when no links provided', () => {
    const { container } = render(<EvidenceExplainerCard links={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing in customer mode when all refs are unresolved', () => {
    const { container } = render(
      <EvidenceExplainerCard
        links={[makeLink('boiler', false)]}
        customerFacing
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the "Why this matters" heading when any section has visible refs', () => {
    render(
      <EvidenceExplainerCard
        links={[makeLink('boiler', true)]}
        customerFacing
      />,
    );
    expect(screen.getByText(/why this matters/i)).toBeInTheDocument();
  });

  it('shows customer text for the boiler section', () => {
    render(
      <EvidenceExplainerCard
        links={[makeLink('boiler', true)]}
        customerFacing
      />,
    );
    expect(screen.getByTestId('evidence-explainer-customer-text-boiler'))
      .toHaveTextContent(/boiler location/i);
  });

  it('hides engineer notes in customer mode', () => {
    render(
      <EvidenceExplainerCard
        links={[makeLink('boiler', true)]}
        customerFacing
      />,
    );
    expect(screen.queryByTestId('evidence-explainer-engineer-notes-boiler')).toBeNull();
  });

  it('shows engineer notes in engineer mode', () => {
    render(
      <EvidenceExplainerCard
        links={[makeLink('boiler', true)]}
        customerFacing={false}
      />,
    );
    expect(screen.getByTestId('evidence-explainer-engineer-notes-boiler'))
      .toBeInTheDocument();
  });

  it('renders multiple sections in canonical order', () => {
    render(
      <EvidenceExplainerCard
        links={[
          makeLink('cylinder', true),
          makeLink('boiler', true),
          makeLink('flue', true),
        ]}
        customerFacing={false}
      />,
    );
    const sections = screen
      .getAllByTestId(/evidence-explainer-section-/)
      .map((el) => el.getAttribute('data-testid'));

    const boilerIdx = sections.findIndex((s) => s?.includes('boiler'));
    const cylinderIdx = sections.findIndex((s) => s?.includes('cylinder'));
    const flueIdx = sections.findIndex((s) => s?.includes('flue'));

    expect(boilerIdx).toBeLessThan(cylinderIdx);
    expect(cylinderIdx).toBeLessThan(flueIdx);
  });

  it('uses ghost-appliance explainer text for general section with ghost-appliance refs', () => {
    render(
      <EvidenceExplainerCard
        links={[makeLink('general', true, 'ghost-appliances')]}
        customerFacing
      />,
    );
    expect(screen.getByTestId('evidence-explainer-customer-text-general'))
      .toHaveTextContent(/overlaid the proposed appliance/i);
  });

  it('uses default general explainer text when no ghost-appliance refs', () => {
    render(
      <EvidenceExplainerCard
        links={[makeLink('general', true, 'measurements')]}
        customerFacing
      />,
    );
    expect(screen.getByTestId('evidence-explainer-customer-text-general'))
      .toHaveTextContent(/overall recommendation/i);
  });

  it('shows unresolved refs in engineer mode but hides them in customer mode', () => {
    const { rerender } = render(
      <EvidenceExplainerCard
        links={[makeLink('flue', false)]}
        customerFacing={false}
      />,
    );
    // Engineer mode — section should be visible
    expect(screen.getByTestId('evidence-explainer-section-flue')).toBeInTheDocument();

    // Customer mode — unresolved, section should be hidden
    rerender(
      <EvidenceExplainerCard
        links={[makeLink('flue', false)]}
        customerFacing
      />,
    );
    expect(screen.queryByTestId('evidence-explainer-section-flue')).toBeNull();
  });

  it('shows section when mixed resolved/unresolved refs in customer mode', () => {
    const mixedLinks: EvidenceProofLinkV1[] = [
      {
        section: 'cylinder',
        captureRefs: [
          { capturePointId: 'cp-1', storyboardCardKey: 'key-objects', label: 'resolved', isResolved: true },
          { capturePointId: 'cp-2', storyboardCardKey: 'measurements', label: 'unresolved', isResolved: false },
        ],
        reviewStatus: 'needs_review',
      },
    ];
    render(<EvidenceExplainerCard links={mixedLinks} customerFacing />);
    expect(screen.getByTestId('evidence-explainer-section-cylinder')).toBeInTheDocument();
  });

  it('calls onOpenCapturePoint when a capture ref pill is clicked', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <EvidenceExplainerCard
        links={[makeLink('boiler', true, 'key-objects')]}
        customerFacing={false}
        onOpenCapturePoint={onOpen}
      />,
    );
    const pill = screen.getByRole('link', { name: /boiler capture/i });
    await user.click(pill);
    expect(onOpen).toHaveBeenCalledWith('cp-boiler-key-objects', 'key-objects');
  });

  it('renders the section heading label', () => {
    render(
      <EvidenceExplainerCard
        links={[makeLink('boiler', true)]}
        customerFacing={false}
      />,
    );
    expect(screen.getByText(/heat source/i)).toBeInTheDocument();
  });
});
