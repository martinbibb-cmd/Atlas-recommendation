import { describe, expect, it } from 'vitest';
import type { DevRouteMeta } from '../../devRouteRegistry';
import type { DevUiRegistryItem } from '../../devUiRegistry';
import { buildComponentDiscoveryReport } from '../componentScanner';

function makeUiItem(codeName: string): DevUiRegistryItem {
  return {
    id: codeName,
    codeName,
    commonName: codeName,
    fileName: `${codeName}.tsx`,
    filePath: `src/mock/${codeName}.tsx`,
    category: 'utility',
    status: 'active',
    render: () => null,
  };
}

describe('componentScanner', () => {
  it('classifies page candidates into production, dev_only, and unrouted buckets', () => {
    const routeRegistry: DevRouteMeta[] = [
      {
        codeName: 'WorkspaceHomePage',
        routePath: '/workspace',
        routeKind: 'path',
        access: 'production',
      },
      {
        codeName: 'DevMenuPage',
        routePath: '/dev/devmenu',
        routeKind: 'path',
        access: 'dev_only',
      },
    ];

    const report = buildComponentDiscoveryReport({
      candidateFilePaths: [
        'src/features/workspace/WorkspaceHomePage.tsx',
        'src/components/dev/DevMenuPage.tsx',
        'src/components/dev/UnmappedPage.tsx',
      ],
      routeRegistry,
      uiRegistry: [makeUiItem('WorkspaceHomePage')],
    });

    const workspace = report.routeAuditRows.find(row => row.codeName === 'WorkspaceHomePage');
    const devMenu = report.routeAuditRows.find(row => row.codeName === 'DevMenuPage');
    const unmapped = report.routeAuditRows.find(row => row.codeName === 'UnmappedPage');

    expect(workspace?.status).toBe('production');
    expect(workspace?.inUiInventory).toBe(true);

    expect(devMenu?.status).toBe('dev_only');
    expect(unmapped?.status).toBe('unrouted');

    expect(report.counts).toEqual({
      production: 1,
      devOnly: 1,
      unrouted: 1,
    });
  });

  it('includes non-page visual/dev files in unrouted component discovery', () => {
    const report = buildComponentDiscoveryReport({
      candidateFilePaths: [
        'src/components/visualizers/LifestyleInteractiveCompare.tsx',
        'src/components/presentation/VisualBlockDebugDeck.tsx',
        'src/components/physics-visuals/preview/PhysicsVisualGallery.tsx',
      ],
      routeRegistry: [
        {
          codeName: 'PhysicsVisualGallery',
          queryFlags: ['gallery=1'],
          routeKind: 'query_flag',
          access: 'dev_only',
        },
      ],
      uiRegistry: [makeUiItem('LifestyleInteractiveCompare')],
    });

    expect(report.unroutedComponents.map(row => row.codeName)).toEqual([
      'LifestyleInteractiveCompare',
      'VisualBlockDebugDeck',
    ]);

    const compare = report.unroutedComponents.find(row => row.codeName === 'LifestyleInteractiveCompare');
    expect(compare?.inUiInventory).toBe(true);
  });
});
