import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CustomerPortalPreviewPage from '../CustomerPortalPreviewPage';
import { DEV_ROUTE_REGISTRY } from '../devRouteRegistry';
import { DEV_UI_REGISTRY } from '../devUiRegistry';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('scrollTo', vi.fn());
});

describe('CustomerPortalPreviewPage', () => {
  it('renders canonical portal shell in production-like mode with fixture input', async () => {
    render(<CustomerPortalPreviewPage />);
    await waitFor(() => expect(screen.getByTestId('portal-page')).toBeTruthy());
    expect(screen.getByText(/selectedPortalMode:\s*portal/i)).toBeTruthy();
    expect(screen.getByText(/activeRendererComponent:\s*PortalPage/i)).toBeTruthy();
    expect(screen.queryByTestId('presentation-deck')).toBeNull();
    expect(screen.queryByTestId('insight-pack-deck')).toBeNull();
    expect(screen.queryByTestId('dev-portal-fixture-launcher')).toBeNull();
  });

  it('includes explicit route labels for production portal, preview, and fixture diagnostics', () => {
    render(<CustomerPortalPreviewPage />);
    expect(screen.getByTestId('customer-portal-preview-route-labels')).toHaveTextContent('/portal/:reference');
    expect(screen.getByTestId('customer-portal-preview-route-labels')).toHaveTextContent('/dev/customer-portal-preview');
    expect(screen.getByTestId('customer-portal-preview-route-labels')).toHaveTextContent('/dev/portal-fixtures');
  });

  it('registers preview route metadata and fixture diagnostics notes correctly', () => {
    const previewRoute = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === 'CustomerPortalPreviewPage');
    expect(previewRoute?.routePath).toBe('/dev/customer-portal-preview');
    expect(previewRoute?.access).toBe('dev_only');

    const fixtureUi = DEV_UI_REGISTRY.find((item) => item.codeName === 'DevPortalFixturePage');
    expect(fixtureUi?.notes).toMatch(/Not production portal/i);

    const previewUi = DEV_UI_REGISTRY.find((item) => item.codeName === 'CustomerPortalPreviewPage');
    expect(previewUi?.fullRouteExample).toBe('/dev/customer-portal-preview');
  });
});
