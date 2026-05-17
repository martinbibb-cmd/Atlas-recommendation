import { describe, expect, it } from 'vitest';
import type { DevUiRegistryItem } from '../devUiRegistry';
import { generateLibraryReferenceText } from '../devUiCopyExport';

function makeItem(overrides: Partial<DevUiRegistryItem>): DevUiRegistryItem {
  return {
    id: overrides.id ?? 'id',
    commonName: overrides.commonName ?? 'Common',
    codeName: overrides.codeName ?? 'CodeName',
    fileName: overrides.fileName ?? 'File.tsx',
    filePath: overrides.filePath ?? 'src/mock/File.tsx',
    category: overrides.category ?? 'utility',
    status: overrides.status ?? 'active',
    render: () => null,
    ...overrides,
  };
}

describe('generateLibraryReferenceText', () => {
  it('includes summary and entry metadata', () => {
    const text = generateLibraryReferenceText([
      makeItem({
        id: 'b',
        commonName: 'Bravo',
        codeName: 'BravoPage',
        category: 'utility',
        routePath: '/bravo',
        access: 'dev_only',
      }),
      makeItem({
        id: 'a',
        commonName: 'Alpha',
        codeName: 'AlphaPage',
        category: 'simulator',
        queryFlags: ['alpha=1'],
        access: 'production',
      }),
    ]);

    expect(text).toContain('Atlas UI Library Reference');
    expect(text).toContain('Total entries: 2');
    expect(text).toContain('Category summary:');
    expect(text).toContain('- simulator: 1');
    expect(text).toContain('- utility: 1');
    expect(text).toContain('Alpha (AlphaPage)');
    expect(text).toContain('route: /?alpha=1');
    expect(text).toContain('Bravo (BravoPage)');
    expect(text).toContain('route: /bravo');
  });

  it('returns a valid text payload for an empty list', () => {
    const text = generateLibraryReferenceText([]);
    expect(text).toContain('Atlas UI Library Reference');
    expect(text).toContain('Total entries: 0');
  });

  it('renders copyLabel and hierarchy metadata when present', () => {
    const text = generateLibraryReferenceText([
      makeItem({
        commonName: 'Base Name',
        copyLabel: 'Copy Label Name',
        codeName: 'HierarchyPage',
        parentCodeName: 'ParentPage',
        childElementIds: ['ChildA', 'ChildB'],
      }),
    ]);

    expect(text).toContain('Copy Label Name (HierarchyPage)');
    expect(text).toContain('parent: ParentPage');
    expect(text).toContain('contains: ChildA, ChildB');
  });
});
