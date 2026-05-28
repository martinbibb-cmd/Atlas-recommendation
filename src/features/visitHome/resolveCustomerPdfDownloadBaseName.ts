import type { VisitMeta } from '../../lib/visits/visitApi';
import { toSafeDownloadBaseName } from './resolveCanonicalVisitIdentity';

export function resolveCustomerPdfDownloadBaseName(
  visitMeta: Pick<VisitMeta, 'visit_reference' | 'address_line_1' | 'customer_name'> | null | undefined,
  visitReference: string | undefined,
  exportVisitId: string,
): string {
  const preferredName =
    visitMeta?.visit_reference
    ?? visitMeta?.customer_name
    ?? visitReference
    ?? `visit-${exportVisitId}`;
  return toSafeDownloadBaseName(preferredName);
}
