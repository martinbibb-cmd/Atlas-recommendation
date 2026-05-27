type RegistryItem = {
  codeName: string;
  status?: string;
  access?: string;
};

export function buildExperimentalRegistry(items: RegistryItem[]): RegistryItem[] {
  return items.filter((item) =>
    item.status === 'experimental' || item.status === 'review',
  );
}

