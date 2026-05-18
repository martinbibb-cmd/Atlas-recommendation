import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiagramFixturePage } from '../DiagramFixturePage';
import { SUPPORTED_DIAGRAM_RENDERER_IDS } from '../../diagrams/DiagramRenderer';
import { DEV_UI_REGISTRY } from '../../../dev/devUiRegistry';
import { DEV_ROUTE_REGISTRY } from '../../../dev/devRouteRegistry';

describe('DiagramFixturePage', () => {
  it('renders fixture cards for every supported diagram renderer id', () => {
    render(<DiagramFixturePage />);
    for (const diagramId of SUPPORTED_DIAGRAM_RENDERER_IDS) {
      expect(screen.getByTestId(`diagram-fixture-card-${diagramId}`)).toBeTruthy();
      expect(screen.getByTestId(`diagram-fixture-mobile-${diagramId}`)).toBeTruthy();
      expect(screen.getByTestId(`diagram-fixture-print-${diagramId}`)).toBeTruthy();
    }
  });

  it('is registered as a dev-only route and ui inventory surface', () => {
    const uiEntry = DEV_UI_REGISTRY.find((item) => item.codeName === 'DiagramFixturePage');
    const routeEntry = DEV_ROUTE_REGISTRY.find((item) => item.codeName === 'DiagramFixturePage');

    expect(uiEntry?.routePath).toBe('/dev/diagram-fixture');
    expect(uiEntry?.access).toBe('dev_only');
    expect(routeEntry?.routePath).toBe('/dev/diagram-fixture');
    expect(routeEntry?.access).toBe('dev_only');
  });
});
