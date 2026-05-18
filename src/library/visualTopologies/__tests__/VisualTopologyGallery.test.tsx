import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VisualTopologyGallery } from '../VisualTopologyGallery';
import { VISUAL_TOPOLOGY_REGISTRY } from '../visualTopologyRegistry';
import { VISUAL_PRIMITIVE_REGISTRY } from '../../visualPrimitives/visualPrimitiveRegistry';
import { DEV_ROUTE_REGISTRY } from '../../../dev/devRouteRegistry';
import { DEV_UI_REGISTRY } from '../../../dev/devUiRegistry';

describe('visual topology registry', () => {
  it('contains all required canonical topology entries', () => {
    expect(VISUAL_TOPOLOGY_REGISTRY.map((entry) => entry.id)).toEqual([
      'open_vented_vented_cylinder',
      'sealed_unvented_cylinder',
      'combi_direct_hot_water',
      'mixergy_stratified_cylinder',
      'thermal_store_layout',
      'powerflush_service_layout',
      'abv_protected_heating_loop',
      'magnetic_filter_on_return',
      'system_pressure_layout',
    ]);
  });

  it('only references registered visual primitives', () => {
    const primitiveIds = new Set(VISUAL_PRIMITIVE_REGISTRY.map((entry) => entry.id));

    const missing = VISUAL_TOPOLOGY_REGISTRY.flatMap((topology) =>
      topology.primitivesUsed
        .filter((primitiveId) => !primitiveIds.has(primitiveId))
        .map((primitiveId) => `${topology.id}:${primitiveId}`),
    );

    expect(missing).toEqual([]);
  });
});

describe('VisualTopologyGallery', () => {
  it('renders no-label primary fixture first and all topology cards', () => {
    render(<VisualTopologyGallery />);

    expect(screen.getByTestId('vt-gallery-human-review')).toBeTruthy();
    expect(screen.getByText(/Can I follow flow and return without reading text\?/i)).toBeTruthy();
    expect(screen.getByTestId('vt-gallery-primary-no-label')).toBeTruthy();
    expect(screen.getByText(/Primary fixture — no-label view first/i)).toBeTruthy();
    expect(screen.getByTestId('vt-gallery-physical-realism-callouts').textContent).toContain('bottom-based radiator connections');

    for (const topology of VISUAL_TOPOLOGY_REGISTRY) {
      expect(screen.getAllByTestId(`vt-gallery-card-${topology.id}`)).toHaveLength(2);
    }
  });

  it('shows a clean missing primitive warning state when all references resolve', () => {
    render(<VisualTopologyGallery />);
    expect(screen.getByTestId('vt-gallery-missing-primitive-warning').textContent).toContain('All topology primitive references resolve');
  });

  it('supports installer review mode with per-topology hydraulic QA summaries', () => {
    render(<VisualTopologyGallery />);
    fireEvent.click(screen.getByRole('button', { name: /installer review mode/i }));

    expect(screen.getByTestId('vt-gallery-installer-review-mode')).toBeTruthy();
    for (const topology of VISUAL_TOPOLOGY_REGISTRY) {
      expect(screen.getByTestId(`vt-gallery-installer-review-${topology.id}`)).toBeTruthy();
    }
  });

  it('shows template compliance panel entries for every topology', () => {
    render(<VisualTopologyGallery />);
    expect(screen.getByTestId('vt-gallery-template-compliance-panel')).toBeTruthy();
    for (const topology of VISUAL_TOPOLOGY_REGISTRY) {
      expect(screen.getByTestId(`vt-template-compliance-${topology.id}`)).toBeTruthy();
    }
  });

  it('is registered as a dev-only route and UI surface', () => {
    const routeEntry = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === 'VisualTopologyGallery');
    const uiEntry = DEV_UI_REGISTRY.find((entry) => entry.codeName === 'VisualTopologyGallery');

    expect(routeEntry?.routePath).toBe('/dev/visual-topology-gallery');
    expect(routeEntry?.access).toBe('dev_only');

    expect(uiEntry?.routePath).toBe('/dev/visual-topology-gallery');
    expect(uiEntry?.access).toBe('dev_only');
  });
});
