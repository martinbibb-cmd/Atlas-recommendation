import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEV_ROUTE_REGISTRY } from '../../../dev/devRouteRegistry';
import { DEV_UI_REGISTRY } from '../../../dev/devUiRegistry';
import { VISUAL_TOPOLOGY_REGISTRY } from '../../visualTopologies/visualTopologyRegistry';
import { AnalogyOverlayGallery } from '../AnalogyOverlayGallery';
import {
  ANALOGY_OVERLAY_REGISTRY,
  REQUIRED_ANALOGY_MODES,
} from '../analogyOverlayRegistry';
import { getTopologyOverlayAnchors } from '../topologyAnchors';

describe('analogy overlay registry', () => {
  it('anchors every overlay to a real topology and valid topology anchor points', () => {
    const topologyIds = new Set(VISUAL_TOPOLOGY_REGISTRY.map((entry) => entry.id));

    for (const overlay of ANALOGY_OVERLAY_REGISTRY) {
      expect(topologyIds.has(overlay.topologyId)).toBe(true);
      const anchorIds = new Set(getTopologyOverlayAnchors(overlay.topologyId).map((anchor) => anchor.id));
      for (const element of overlay.overlayElements) {
        if (element.type === 'callout') {
          expect(anchorIds.has(element.anchorId)).toBe(true);
        } else {
          expect(anchorIds.has(element.fromAnchorId)).toBe(true);
          expect(anchorIds.has(element.toAnchorId)).toBe(true);
        }
      }
    }
  });

  it('retains required anchor IDs for ABV and Mixergy overlays after geometry updates', () => {
    const abvAnchors = new Set(getTopologyOverlayAnchors('abv_protected_heating_loop').map((anchor) => anchor.id));
    const mixergyAnchors = new Set(getTopologyOverlayAnchors('mixergy_stratified_cylinder').map((anchor) => anchor.id));

    expect(abvAnchors.has('abv')).toBe(true);
    expect(abvAnchors.has('flow_header')).toBe(true);
    expect(abvAnchors.has('return_header')).toBe(true);

    expect(mixergyAnchors.has('cylinder_top')).toBe(true);
    expect(mixergyAnchors.has('thermocline')).toBe(true);
    expect(mixergyAnchors.has('hot_draw_off')).toBe(true);
  });

  it('provides every required analogy mode for each target concept', () => {
    const concepts = Array.from(new Set(ANALOGY_OVERLAY_REGISTRY.map((entry) => entry.targetConcept)));
    for (const concept of concepts) {
      const modes = new Set(
        ANALOGY_OVERLAY_REGISTRY
          .filter((entry) => entry.targetConcept === concept)
          .map((entry) => entry.analogyMode),
      );
      expect(Array.from(modes).sort()).toEqual([...REQUIRED_ANALOGY_MODES].sort());
    }
  });
});

describe('AnalogyOverlayGallery', () => {
  it('renders no-overlay baseline and allows mode switching', () => {
    render(<AnalogyOverlayGallery />);

    expect(screen.getByText(/No overlay active\. This baseline confirms the physical topology remains unchanged\./i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Traffic/i }));
    expect(screen.getByText(/Like a bypass road, this valve opens when routes close so circulation does not dead-end\./i)).toBeTruthy();
    expect(screen.getByTestId('analogy-accessibility-summary')).toBeTruthy();
  });

  it('is registered as a dev-only route and UI surface', () => {
    const routeEntry = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === 'AnalogyOverlayGallery');
    const uiEntry = DEV_UI_REGISTRY.find((entry) => entry.codeName === 'AnalogyOverlayGallery');

    expect(routeEntry?.routePath).toBe('/dev/analogy-overlay-gallery');
    expect(routeEntry?.access).toBe('dev_only');
    expect(uiEntry?.routePath).toBe('/dev/analogy-overlay-gallery');
    expect(uiEntry?.access).toBe('dev_only');
  });

  it('shows physical-realism QA callouts', () => {
    render(<AnalogyOverlayGallery />);
    expect(screen.getByTestId('analogy-overlay-qa-callouts').textContent).toContain('preserve topology-anchor IDs');
  });
});
