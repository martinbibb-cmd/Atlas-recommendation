type RegistryItem = {
  codeName: string;
  status?: string;
  access?: string;
  domain?: string;
};

export function buildLegacyRegistry(items: RegistryItem[]): RegistryItem[] {
  return items.filter((item) =>
    item.access === 'legacy_dev_only'
    || item.status === 'deprecated'
    || item.status === 'remove'
    || item.domain?.startsWith('legacy/') === true,
  );
}

