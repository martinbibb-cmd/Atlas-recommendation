import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OpenVentedToSealedPortalSection } from '../sections/OpenVentedToSealedPortalSection';
import { UnventedSafetyPortalSection } from '../sections/UnventedSafetyPortalSection';
import { OpenVentedInsightSection } from '../sections/OpenVentedInsightSection';
import { LivingWithYourSystemPortalJourney } from '../sections/LivingWithYourSystemPortalJourney';

// ─── OpenVentedToSealedPortalSection (CON_A01) ────────────────────────────────

describe('OpenVentedToSealedPortalSection', () => {
  it('renders the section', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(screen.getByTestId('ovsp-section')).toBeInTheDocument();
  });

  it('renders the hero heading', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(
      screen.getByRole('heading', { name: /open-vented to sealed/i }),
    ).toBeInTheDocument();
  });

  it('renders all three comparison triptych cards', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(screen.getByTestId('ovsp-before-card')).toBeInTheDocument();
    expect(screen.getByTestId('ovsp-after-card')).toBeInTheDocument();
    expect(screen.getByTestId('ovsp-your-home-card')).toBeInTheDocument();
  });

  it('renders the "What you may notice" block', () => {
    render(<OpenVentedToSealedPortalSection />);
    const block = screen.getByTestId('ovsp-what-you-may-notice');
    expect(block).toBeInTheDocument();
    expect(within(block).getByText(/header tank removed/i)).toBeInTheDocument();
  });

  it('renders the "What stays familiar" block', () => {
    render(<OpenVentedToSealedPortalSection />);
    const block = screen.getByTestId('ovsp-what-stays-familiar');
    expect(block).toBeInTheDocument();
    expect(within(block).getByText(/comfort targets/i)).toBeInTheDocument();
  });

  it('renders the "What not to worry about" reassurance panel', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(screen.getByTestId('ovsp-reassurance')).toBeInTheDocument();
  });

  it('renders the diagram frame', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(screen.getByTestId('ovsp-diagram-frame')).toBeInTheDocument();
  });

  it('renders the misconception and reality', () => {
    render(<OpenVentedToSealedPortalSection />);
    const block = screen.getByTestId('ovsp-misconception');
    expect(block).toBeInTheDocument();
    expect(within(block).getByText(/conversion is only cosmetic/i)).toBeInTheDocument();
    expect(within(block).getByText(/changes pressure management/i)).toBeInTheDocument();
  });

  it('renders the QR deep-dive card', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(screen.getByTestId('ovsp-qr')).toBeInTheDocument();
  });

  it('does not render "content pending" placeholder text', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(screen.queryByText(/content pending/i)).toBeNull();
  });

  it('does not expose raw concept IDs to the customer', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(screen.queryByText(/CON_A01/)).toBeNull();
    expect(screen.queryByText(/sealed_system_conversion/)).toBeNull();
  });

  it('does not use forbidden terminology', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(screen.queryByText(/gravity system/i)).toBeNull();
    expect(screen.queryByText(/low pressure system/i)).toBeNull();
    expect(screen.queryByText(/high pressure system/i)).toBeNull();
    expect(screen.queryByText(/instantaneous hot water/i)).toBeNull();
  });

  it('does not collapse into plain text on mobile — triptych and notice panels are present', () => {
    render(<OpenVentedToSealedPortalSection />);
    expect(screen.getByTestId('portal-comparison-triptych')).toBeInTheDocument();
    expect(screen.getByTestId('portal-what-you-may-notice')).toBeInTheDocument();
  });
});

// ─── UnventedSafetyPortalSection (CON_C01) ────────────────────────────────────

describe('UnventedSafetyPortalSection', () => {
  it('renders the section', () => {
    render(<UnventedSafetyPortalSection />);
    expect(screen.getByTestId('uvsp-section')).toBeInTheDocument();
  });

  it('renders the hero heading', () => {
    render(<UnventedSafetyPortalSection />);
    expect(
      screen.getByRole('heading', { name: /safety devices are standard/i }),
    ).toBeInTheDocument();
  });

  it('renders the customer wording', () => {
    render(<UnventedSafetyPortalSection />);
    expect(screen.getByTestId('uvsp-customer-wording')).toBeInTheDocument();
    expect(screen.getByText(/visible relief and discharge hardware/i)).toBeInTheDocument();
  });

  it('renders the "What you may notice" block', () => {
    render(<UnventedSafetyPortalSection />);
    const block = screen.getByTestId('uvsp-what-you-may-notice');
    expect(block).toBeInTheDocument();
    expect(within(block).getByText(/tundish/i)).toBeInTheDocument();
  });

  it('renders the "What stays familiar" block', () => {
    render(<UnventedSafetyPortalSection />);
    const block = screen.getByTestId('uvsp-what-stays-familiar');
    expect(block).toBeInTheDocument();
    expect(within(block).getByText(/daily hot-water use/i)).toBeInTheDocument();
  });

  it('renders the reassurance panel', () => {
    render(<UnventedSafetyPortalSection />);
    expect(screen.getByTestId('uvsp-reassurance')).toBeInTheDocument();
  });

  it('renders the misconception and reality', () => {
    render(<UnventedSafetyPortalSection />);
    const block = screen.getByTestId('uvsp-misconception');
    expect(block).toBeInTheDocument();
    expect(within(block).getByText(/any discharge component means failure/i)).toBeInTheDocument();
    expect(within(block).getByText(/safety components are standard design features/i)).toBeInTheDocument();
  });

  it('renders the QR deep-dive card', () => {
    render(<UnventedSafetyPortalSection />);
    expect(screen.getByTestId('uvsp-qr')).toBeInTheDocument();
  });

  it('does not render "content pending" placeholder text', () => {
    render(<UnventedSafetyPortalSection />);
    expect(screen.queryByText(/content pending/i)).toBeNull();
  });

  it('does not expose raw concept IDs to the customer', () => {
    render(<UnventedSafetyPortalSection />);
    expect(screen.queryByText(/CON_C01/)).toBeNull();
    expect(screen.queryByText(/unvented_safety_reassurance/)).toBeNull();
  });

  it('does not use forbidden terminology', () => {
    render(<UnventedSafetyPortalSection />);
    expect(screen.queryByText(/gravity system/i)).toBeNull();
    expect(screen.queryByText(/low pressure system/i)).toBeNull();
    expect(screen.queryByText(/high pressure system/i)).toBeNull();
    expect(screen.queryByText(/instantaneous hot water/i)).toBeNull();
  });

  it('does not collapse into plain text on mobile — notice panel is present', () => {
    render(<UnventedSafetyPortalSection />);
    expect(screen.getByTestId('portal-what-you-may-notice')).toBeInTheDocument();
  });
});

describe('LivingWithYourSystemPortalJourney', () => {
  it('renders timeline cards in morning-to-recovery order', () => {
    render(<LivingWithYourSystemPortalJourney bathroomCount={2} />);
    expect(screen.getByTestId('lwspj-timeline-morning')).toBeInTheDocument();
    expect(screen.getByTestId('lwspj-timeline-evening')).toBeInTheDocument();
    expect(screen.getByTestId('lwspj-timeline-peak-use')).toBeInTheDocument();
    expect(screen.getByTestId('lwspj-timeline-recovery')).toBeInTheDocument();
  });

  it('renders everyday-use visuals and mobile-safe card structure', () => {
    render(<LivingWithYourSystemPortalJourney bathroomCount={3} />);
    expect(screen.getByTestId('lwspj-showers-visual')).toBeInTheDocument();
    expect(screen.getByTestId('lwspj-bath-visual')).toBeInTheDocument();
    expect(screen.getByTestId('lwspj-reserve-visual')).toBeInTheDocument();
    expect(screen.getByTestId('lwspj-pressure-visual')).toBeInTheDocument();
    expect(screen.getByTestId('lwspj-subsections')).toBeInTheDocument();
  });

  it('uses calm copy without emotional overload or technical jargon leakage', () => {
    render(<LivingWithYourSystemPortalJourney bathroomCount={2} />);
    expect(screen.queryByText(/panic|urgent|emergency|catastrophic/i)).toBeNull();
    expect(screen.queryByText(/L\/min|bar\b|plate heat exchanger|delta-?t/i)).toBeNull();
  });

  it('includes print-safe outputs for sheet and compact handout', () => {
    const { container } = render(<LivingWithYourSystemPortalJourney bathroomCount={2} />);
    const printSafeNodes = container.querySelectorAll('[data-print-safe="true"]');
    expect(printSafeNodes.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('lwspj-print-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('lwspj-print-handout')).toBeInTheDocument();
  });

  it('includes reduced-motion-safe CSS rules', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/library/portal/sections/livingWithYourSystemPortalJourney.css'),
      'utf8',
    );
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.lwspj-section');
  });
});

// ─── OpenVentedInsightSection (composite) ────────────────────────────────────

describe('OpenVentedInsightSection', () => {
  it('renders the composite wrapper', () => {
    render(<OpenVentedInsightSection />);
    expect(screen.getByTestId('open-vented-insight-section')).toBeInTheDocument();
  });

  it('renders CON_C02 — pressure vs storage section', () => {
    render(<OpenVentedInsightSection />);
    expect(screen.getByTestId('pvsp-section')).toBeInTheDocument();
  });

  it('renders CON_A01 — open-vented to sealed section', () => {
    render(<OpenVentedInsightSection />);
    expect(screen.getByTestId('ovsp-section')).toBeInTheDocument();
  });

  it('renders CON_C01 — unvented safety section', () => {
    render(<OpenVentedInsightSection />);
    expect(screen.getByTestId('uvsp-section')).toBeInTheDocument();
  });

  it('renders living-with-your-system journey section', () => {
    render(<OpenVentedInsightSection />);
    expect(screen.getByTestId('lwspj-section')).toBeInTheDocument();
  });

  it('passes bathroomCount to PressureVsStoragePortalSection', () => {
    render(<OpenVentedInsightSection bathroomCount={3} />);
    const card = screen.getByTestId('pvsp-your-home-card');
    expect(card).toBeInTheDocument();
    // heading should mention 3 bathrooms
    const heading = within(card).getByRole('heading');
    expect(heading).toHaveTextContent('3 bathrooms');
  });

  it('all three sections are visible in the same view — no "content pending"', () => {
    render(<OpenVentedInsightSection />);
    expect(screen.queryByText(/content pending/i)).toBeNull();
  });

  it('does not expose raw concept IDs', () => {
    render(<OpenVentedInsightSection />);
    expect(screen.queryByText(/CON_A01/)).toBeNull();
    expect(screen.queryByText(/CON_C01/)).toBeNull();
    expect(screen.queryByText(/CON_C02/)).toBeNull();
    expect(screen.queryByText(/open_vented_to_sealed/)).toBeNull();
  });
});
