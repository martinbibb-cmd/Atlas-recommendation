import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEV_ROUTE_REGISTRY } from '../../../dev/devRouteRegistry';
import { DEV_UI_REGISTRY } from '../../../dev/devUiRegistry';
import { VisualEducationLibraryQaHubPage } from '../VisualEducationLibraryQaHubPage';

describe('VisualEducationLibraryQaHubPage', () => {
  it('renders direct links to the visual galleries, including the customer explainer slice', () => {
    render(<VisualEducationLibraryQaHubPage />);

    expect(screen.getByTestId('visual-education-library-qa-hub')).toBeTruthy();
    expect(screen.getByText(/Visual Primitive Gallery/i)).toBeTruthy();
    expect(screen.getByText(/Visual Topology Gallery/i)).toBeTruthy();
    expect(screen.getByText(/Analogy Overlay Gallery/i)).toBeTruthy();
    expect(screen.getByText(/Sealed \+ Unvented Visual Workbench/i)).toBeTruthy();
    expect(screen.getByText(/docs\/atlas-canonical-mechanical-primitive-spec\.md/i)).toBeTruthy();
    expect(screen.getByText(/Legacy Diagram Fixture/i)).toBeTruthy();
  });

  it('is registered as a dev-only route and UI surface', () => {
    const routeEntry = DEV_ROUTE_REGISTRY.find(
      (entry) => entry.codeName === 'VisualEducationLibraryQaHubPage',
    );
    const uiEntry = DEV_UI_REGISTRY.find(
      (entry) => entry.codeName === 'VisualEducationLibraryQaHubPage',
    );

    expect(routeEntry?.routePath).toBe('/dev/visual-education-library');
    expect(routeEntry?.queryFlags).toEqual(['visual-education-library=1']);
    expect(routeEntry?.access).toBe('dev_only');

    expect(uiEntry?.routePath).toBe('/dev/visual-education-library');
    expect(uiEntry?.access).toBe('dev_only');
  });
});
