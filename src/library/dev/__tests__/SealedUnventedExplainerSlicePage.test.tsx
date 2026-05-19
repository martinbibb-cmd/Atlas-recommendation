import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEV_ROUTE_REGISTRY } from '../../../dev/devRouteRegistry';
import { DEV_UI_REGISTRY } from '../../../dev/devUiRegistry';
import { SealedUnventedExplainerSlicePage } from '../SealedUnventedExplainerSlicePage';

describe('SealedUnventedExplainerSlicePage', () => {
  it('renders one customer card/page plus mobile and print previews', () => {
    render(<SealedUnventedExplainerSlicePage />);

    expect(screen.getByTestId('sealed-unvented-customer-card')).toBeInTheDocument();
    expect(screen.getByTestId('sealed-unvented-customer-page-preview')).toBeInTheDocument();
    expect(screen.getByTestId('sealed-unvented-mobile-preview')).toBeInTheDocument();
    expect(screen.getByTestId('sealed-unvented-print-preview')).toBeInTheDocument();
  });

  it('shows candidate visual status badges and marks the page as not yet canonical', () => {
    render(<SealedUnventedExplainerSlicePage />);

    const statusBadges = screen.getByTestId('sealed-unvented-reference-status-badges');
    expect(statusBadges.textContent).toContain('candidate');
    expect(statusBadges.textContent).toContain('under visual correction');
    expect(statusBadges.textContent).toContain('not yet canonical');
    expect(statusBadges.textContent).toContain('human review required');
    expect(statusBadges.textContent).toContain('screenshot review required');
    expect(screen.getByText(/Candidate Golden Reference \/ Sealed \+ Unvented Visual Workbench\./i)).toBeInTheDocument();
  });

  it('shows the Atlas Visual Review Board gate copy before customer-facing promotion', () => {
    render(<SealedUnventedExplainerSlicePage />);

    expect(screen.getByTestId('sealed-unvented-human-review-gate')).toBeInTheDocument();
    expect(screen.getByText(/Atlas Visual Review Board gate/i)).toBeInTheDocument();
    expect(screen.getByText(/Human screenshot review overrides all green badges/i)).toBeInTheDocument();
  });

  it('defaults to physical baseline with overlay off and keeps all required analogy modes available', () => {
    render(<SealedUnventedExplainerSlicePage />);

    expect(screen.getByText(/Overlay off: baseline physical system shown with no analogy layer\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Basic household/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Medical/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Traffic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Electrical/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Physics & engineering/i })).toBeInTheDocument();
  });

  it('shows overlay summary when a mode is selected', () => {
    render(<SealedUnventedExplainerSlicePage />);
    fireEvent.click(screen.getByRole('button', { name: /Traffic/i }));
    expect(screen.getByTestId('sealed-unvented-analogy-accessibility-summary')).toBeInTheDocument();
  });

  it('includes customer-safe acceptance copy and avoids forbidden/internal terms', () => {
    const { container } = render(<SealedUnventedExplainerSlicePage />);

    expect(screen.getByText(/The loft tanks are removed\./i)).toBeInTheDocument();
    expect(screen.getByText(/A sealed heating circuit is added/i)).toBeInTheDocument();
    expect(screen.getByText(/unvented cylinder provides stored hot water from mains-fed supply/i)).toBeInTheDocument();
    expect(screen.getByText(/stored hot water, not on-demand hot water/i)).toBeInTheDocument();
    expect(screen.getByText(/expansion vessel absorbs heating-water expansion/i)).toBeInTheDocument();
    expect(screen.getByText(/pressure gauge and filling loop are normal sealed-system features/i)).toBeInTheDocument();
    expect(screen.getByText(/tundish and discharge route are safety features, not faults/i)).toBeInTheDocument();

    expect(screen.queryByText(/gravity system|low pressure system|high pressure system|instantaneous hot water/i)).toBeNull();
    expect(screen.queryByText(/sealed_unvented_cylinder|sealed_unvented|CON_/i)).toBeNull();
    expect(container.innerHTML).not.toMatch(/gravity system|low pressure system|high pressure system|instantaneous hot water|sealed_unvented_cylinder|sealed_unvented|CON_/i);
  });

  it('lists acceptance criteria required before true golden reference status', () => {
    render(<SealedUnventedExplainerSlicePage />);

    expect(screen.getByTestId('sealed-unvented-golden-reference-acceptance')).toBeInTheDocument();
    expect(screen.getAllByText(/docs\/atlas-canonical-mechanical-primitive-spec\.md/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/boiler, cylinder, pressure gauge, filling loop, expansion vessel, and discharge route are recognisable without labels/i)).toBeInTheDocument();
    expect(screen.getByText(/system\/combi layouts do not show external pumps unless explicitly required/i)).toBeInTheDocument();
    expect(screen.getByText(/standard unvented cylinder has no thermocline/i)).toBeInTheDocument();
    expect(screen.getByText(/cylinder ports and coil path are physically plausible/i)).toBeInTheDocument();
    expect(screen.getByText(/primary heating, cold mains, hot draw-off, and discharge routes are visually distinct/i)).toBeInTheDocument();
    expect(screen.getByText(/not objects on a whiteboard/i)).toBeInTheDocument();
  });

  it('is registered as a dev-only route and UI surface', () => {
    const routeEntry = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === 'SealedUnventedExplainerSlicePage');
    const uiEntry = DEV_UI_REGISTRY.find((entry) => entry.codeName === 'SealedUnventedExplainerSlicePage');

    expect(routeEntry?.routePath).toBe('/dev/sealed-unvented-explainer-slice');
    expect(routeEntry?.access).toBe('dev_only');
    expect(uiEntry?.routePath).toBe('/dev/sealed-unvented-explainer-slice');
    expect(uiEntry?.access).toBe('dev_only');
  });
});
