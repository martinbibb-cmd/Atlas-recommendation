import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PressureVsStoragePortalSection } from '../sections/PressureVsStoragePortalSection';
import { DailyUsePortalSection } from '../sections/DailyUsePortalSection';

describe('PressureVsStoragePortalSection', () => {
  it('renders the correct section title', () => {
    render(<PressureVsStoragePortalSection />);
    expect(
      screen.getByRole('heading', { name: /why stored hot water suits this home/i }),
    ).toBeInTheDocument();
  });

  it('renders the pressure vs storage diagram', () => {
    render(<PressureVsStoragePortalSection />);
    expect(screen.getByTestId('pvsp-diagram-panel')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/pressure vs storage diagram/i),
    ).toBeInTheDocument();
  });

  it('renders all 3 comparison cards', () => {
    render(<PressureVsStoragePortalSection />);
    expect(screen.getByRole('article', { name: /combination boiler/i })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: /unvented cylinder/i })).toBeInTheDocument();
    expect(screen.getByTestId('pvsp-your-home-card')).toBeInTheDocument();
  });

  it('shows the correct "Your home" title for 2 bathrooms', () => {
    render(<PressureVsStoragePortalSection bathroomCount={2} />);
    const card = screen.getByTestId('pvsp-your-home-card');
    expect(within(card).getByRole('heading')).toHaveTextContent('2 bathrooms');
  });

  it('shows the correct "Your home" title for 3 bathrooms', () => {
    render(<PressureVsStoragePortalSection bathroomCount={3} />);
    const card = screen.getByTestId('pvsp-your-home-card');
    expect(within(card).getByRole('heading')).toHaveTextContent('3 bathrooms');
  });

  it('renders the "What you may notice" block', () => {
    render(<PressureVsStoragePortalSection />);
    const block = screen.getByTestId('pvsp-what-you-may-notice');
    expect(block).toBeInTheDocument();
    expect(within(block).getByText(/recovery wait/i)).toBeInTheDocument();
  });

  it('renders the "What not to worry about" block', () => {
    render(<PressureVsStoragePortalSection />);
    const block = screen.getByTestId('pvsp-what-not-to-worry');
    expect(block).toBeInTheDocument();
    expect(within(block).getByText(/recovery after heavy use is normal/i)).toBeInTheDocument();
  });

  it('renders the misconception and reality', () => {
    render(<PressureVsStoragePortalSection />);
    const block = screen.getByTestId('pvsp-misconception');
    expect(block).toBeInTheDocument();
    expect(within(block).getByText(/higher pressure means more stored hot water/i)).toBeInTheDocument();
    expect(within(block).getByText(/pressure affects delivery force/i)).toBeInTheDocument();
  });

  it('renders the QR deep-dive placeholder', () => {
    render(<PressureVsStoragePortalSection />);
    expect(screen.getByTestId('pvsp-qr-placeholder')).toBeInTheDocument();
  });

  it('does not render "content pending" placeholder text', () => {
    render(<PressureVsStoragePortalSection />);
    expect(screen.queryByText(/content pending/i)).toBeNull();
  });

  it('does not render debug or QA text', () => {
    render(<PressureVsStoragePortalSection />);
    expect(screen.queryByText(/debug/i)).toBeNull();
    expect(screen.queryByText(/\bqa\b/i)).toBeNull();
  });

  it('does not expose raw concept IDs to the customer', () => {
    render(<PressureVsStoragePortalSection />);
    expect(screen.queryByText(/pressure_vs_storage/)).toBeNull();
    expect(screen.queryByText(/CON_C02/)).toBeNull();
  });

  it('does not use forbidden terminology', () => {
    render(<PressureVsStoragePortalSection />);
    expect(screen.queryByText(/instantaneous hot water/i)).toBeNull();
    expect(screen.queryByText(/high pressure system/i)).toBeNull();
    expect(screen.queryByText(/gravity system/i)).toBeNull();
    expect(screen.queryByText(/low pressure system/i)).toBeNull();
  });
});

describe('DailyUsePortalSection — CON_C02 routing', () => {
  it('renders PressureVsStoragePortalSection for stored hot water with 2+ bathrooms', () => {
    render(
      <DailyUsePortalSection appliesStoredHotWater bathroomCount={2} />,
    );
    expect(
      screen.getByRole('heading', { name: /why stored hot water suits this home/i }),
    ).toBeInTheDocument();
  });

  it('renders PressureVsStoragePortalSection for stored hot water with 3 bathrooms', () => {
    render(
      <DailyUsePortalSection appliesStoredHotWater bathroomCount={3} />,
    );
    expect(screen.getByTestId('pvsp-section')).toBeInTheDocument();
  });

  it('does not render CON_C02 section for non-stored scenarios', () => {
    const { container } = render(
      <DailyUsePortalSection appliesStoredHotWater={false} bathroomCount={2} />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('pvsp-section')).toBeNull();
  });

  it('does not render CON_C02 section for stored hot water with only 1 bathroom', () => {
    const { container } = render(
      <DailyUsePortalSection appliesStoredHotWater bathroomCount={1} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('recommendation identity is unchanged for non-stored scenarios — section returns null', () => {
    const { container } = render(
      <DailyUsePortalSection appliesStoredHotWater={false} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
