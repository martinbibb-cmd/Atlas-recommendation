import type { VisitMeta } from '../../lib/visits/visitApi';

function toSafeDownloadBaseName(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe.length > 0 ? safe : 'atlas-visit';
}

export function resolveCustomerPdfDownloadBaseName(
  visitMeta: Pick<VisitMeta, 'visit_reference' | 'address_line_1' | 'customer_name'> | null | undefined,
  visitReference: string | undefined,
  exportVisitId: string,
): string {
  const preferredName =
    visitMeta?.visit_reference
    ?? visitMeta?.address_line_1
    ?? visitMeta?.customer_name
    ?? visitReference
    ?? exportVisitId;
  return toSafeDownloadBaseName(preferredName);
}
