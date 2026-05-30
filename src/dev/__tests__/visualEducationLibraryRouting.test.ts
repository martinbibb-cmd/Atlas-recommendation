import { describe, expect, it } from 'vitest';
import { DEV_ROUTE_REGISTRY } from '../devRouteRegistry';
import { DEV_UI_REGISTRY } from '../devUiRegistry';
import { INITIAL_FILTER_STATE, applyFilters } from '../devUiFilters';
import {
  VISUAL_EDUCATION_LIBRARY_QA_HUB,
  VISUAL_EDUCATION_LIBRARY_SURFACES,
  isVisualEducationLibraryQaHubRoute,
  resolveActiveVisualEducationLibrarySurface,
} from '../visualEducationLibrary';

describe('visual education library routing smoke coverage', () => {
  it('registers all visual education library routes in the dev route registry', () => {
    for (const surface of VISUAL_EDUCATION_LIBRARY_SURFACES) {
      const route = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === surface.codeName);
      expect(route, `${surface.codeName} must exist in DEV_ROUTE_REGISTRY`).toBeDefined();
      expect(route).toMatchObject({
        routePath: surface.routePath,
        queryFlags: [surface.queryFlag],
        routeKind: 'path',
        access: 'dev_only',
      });
    }

    const hubRoute = DEV_ROUTE_REGISTRY.find(
      (entry) => entry.codeName === VISUAL_EDUCATION_LIBRARY_QA_HUB.codeName,
    );
    expect(hubRoute).toMatchObject({
      routePath: VISUAL_EDUCATION_LIBRARY_QA_HUB.routePath,
      queryFlags: [VISUAL_EDUCATION_LIBRARY_QA_HUB.queryFlag],
      routeKind: 'path',
      access: 'dev_only',
    });
  });

  it('exposes all visual education library routes as visible dev UI registry items', () => {
    const visibleItems = applyFilters(DEV_UI_REGISTRY, INITIAL_FILTER_STATE);

    for (const surface of VISUAL_EDUCATION_LIBRARY_SURFACES) {
      const item = DEV_UI_REGISTRY.find((entry) => entry.codeName === surface.codeName);
      expect(item, `${surface.codeName} must exist in DEV_UI_REGISTRY`).toBeDefined();
      expect(item).toMatchObject({
        commonName: surface.commonName,
        routePath: surface.routePath,
        queryFlags: [surface.queryFlag],
        routeKind: 'path',
        access: 'dev_only',
        status: surface.isCandidateReference ? 'candidate' : 'canonical',
      });
      expect(item?.notes).toContain('Visual Education Library');
      expect(visibleItems.some((entry) => entry.codeName === surface.codeName)).toBe(true);
    }

    const hubItem = DEV_UI_REGISTRY.find(
      (entry) => entry.codeName === VISUAL_EDUCATION_LIBRARY_QA_HUB.codeName,
    );
    expect(hubItem).toMatchObject({
      routePath: VISUAL_EDUCATION_LIBRARY_QA_HUB.routePath,
      queryFlags: [VISUAL_EDUCATION_LIBRARY_QA_HUB.queryFlag],
      routeKind: 'path',
      access: 'dev_only',
      status: 'canonical',
      childElementIds: [
        'visual-primitive-gallery',
        'visual-topology-gallery',
        'analogy-overlay-gallery',
        'sealed-unvented-explainer-slice',
        'diagram-fixture-page',
      ],
    });
  });

  it('matches App route and query-flag detection for each visual gallery surface', () => {
    for (const surface of VISUAL_EDUCATION_LIBRARY_SURFACES) {
      expect(
        resolveActiveVisualEducationLibrarySurface({ pathname: surface.routePath, search: '' })?.codeName,
      ).toBe(surface.codeName);
      expect(
        resolveActiveVisualEducationLibrarySurface({ pathname: '/', search: `?${surface.queryFlag}` })?.codeName,
      ).toBe(surface.codeName);
    }

    expect(
      isVisualEducationLibraryQaHubRoute({
        pathname: VISUAL_EDUCATION_LIBRARY_QA_HUB.routePath,
        search: '',
      }),
    ).toBe(true);
    expect(
      isVisualEducationLibraryQaHubRoute({
        pathname: '/',
        search: `?${VISUAL_EDUCATION_LIBRARY_QA_HUB.queryFlag}`,
      }),
    ).toBe(true);
  });
});
