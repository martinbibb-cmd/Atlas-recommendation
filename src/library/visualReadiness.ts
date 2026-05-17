export type VisualStatus = 'production_ready' | 'draft' | 'placeholder' | 'dev_only';

export interface VisualReadinessMetadata {
  visualStatus: VisualStatus;
  customerReady: boolean;
  replacementNeededReason?: string;
}

export function applyDefaultVisualReadiness<T extends object>(
  entry: T,
  defaults: VisualReadinessMetadata = {
    visualStatus: 'production_ready',
    customerReady: true,
  },
): T & VisualReadinessMetadata {
  return {
    ...defaults,
    ...entry,
  };
}

export function isCustomerReadyProductionVisual(
  entry?: Partial<VisualReadinessMetadata> | null,
): entry is VisualReadinessMetadata & { customerReady: true; visualStatus: 'production_ready' } {
  return Boolean(
    entry
    && entry.customerReady
    && entry.visualStatus === 'production_ready',
  );
}

export type VisualReadinessFilter = 'all' | VisualStatus | 'needs_redesign';

export function matchesVisualReadinessFilter(
  entry: Partial<VisualReadinessMetadata>,
  filter: VisualReadinessFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'needs_redesign') {
    return Boolean(entry.replacementNeededReason);
  }
  return entry.visualStatus === filter;
}
