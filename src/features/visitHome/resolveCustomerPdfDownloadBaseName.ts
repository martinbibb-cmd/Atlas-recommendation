import type { VisitMeta } from '../../lib/visits/visitApi';
import { resolveCanonicalVisitIdentityReference, toSafeDownloadBaseName } from './resolveCanonicalVisitIdentity';

export function resolveCustomerPdfDownloadBaseName(
  visitMeta: Pick<VisitMeta, 'visit_reference' | 'address_line_1' | 'customer_name'> | null | undefined,
  visitReference: string | undefined,
  exportVisitId: string,
): string {
  const preferredName = resolveCanonicalVisitIdentityReference({
    canonicalVisitReference: visitReference,
    customerOrProjectLabel: visitMeta?.visit_reference,
    customerName: visitMeta?.customer_name,
    addressLine1: visitMeta?.address_line_1,
    visitId: exportVisitId,
  });
  return toSafeDownloadBaseName(preferredName);
}
