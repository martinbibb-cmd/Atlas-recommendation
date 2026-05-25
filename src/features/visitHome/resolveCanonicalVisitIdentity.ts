function firstText(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (value != null && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export function formatVisitReference(visitId: string): string {
  const normalized = visitId.trim().toUpperCase();
  if (normalized.length >= 8) return normalized.slice(-8);
  return normalized.padStart(8, '0');
}

export function resolveCanonicalVisitIdentityReference(input: {
  canonicalVisitReference?: string | null;
  customerOrProjectLabel?: string | null;
  customerName?: string | null;
  addressLine1?: string | null;
  visitId: string;
}): string {
  return (
    firstText(
      input.canonicalVisitReference ?? undefined,
      input.customerOrProjectLabel ?? undefined,
      input.customerName ?? undefined,
      input.addressLine1 ?? undefined,
    )
    ?? formatVisitReference(input.visitId)
  );
}

export function toSafeDownloadBaseName(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe.length > 0 ? safe : 'atlas-visit';
}

