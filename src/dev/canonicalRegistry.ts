type RegistryItem = {
  codeName: string;
  status?: string;
  access?: string;
};

export function buildCanonicalRegistry(items: RegistryItem[]): RegistryItem[] {
  return items.filter((item) =>
    item.access === 'production'
    || (item.status === 'canonical' && item.access !== 'legacy_dev_only'),
  );
}

