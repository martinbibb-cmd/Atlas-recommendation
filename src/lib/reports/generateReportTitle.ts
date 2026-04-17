/**
 * generateReportTitle.ts
 *
 * Derives a clear, concise title for a persisted Atlas report from the
 * available survey / engine data.
 *
 * Priority order:
 *   1. address_line_1 + postcode  (e.g. "12 High Street, SW1A 1AA")
 *   2. customer_name + postcode   (e.g. "John Smith · SW1A 1AA")
 *   3. postcode + recommended system (e.g. "SW1A 1AA — System boiler")
 *   4. recommended system only    (e.g. "System boiler assessment")
 *   5. Formatted date fallback     (e.g. "Assessment 17 Apr 2025")
 */

export interface ReportTitleInputs {
  postcode?: string | null;
  customerName?: string | null;
  addressLine1?: string | null;
  recommendedSystem?: string | null;
}

/**
 * Produces a clear, human-readable report title from the supplied inputs.
 * All inputs are optional — the function always returns a non-empty string.
 */
export function generateReportTitle(inputs: ReportTitleInputs = {}): string {
  const { postcode, customerName, addressLine1, recommendedSystem } = inputs;

  const parts: string[] = [];

  // Address / customer identity
  if (addressLine1 && postcode) {
    parts.push(`${addressLine1}, ${postcode}`);
  } else if (customerName && postcode) {
    parts.push(`${customerName} · ${postcode}`);
  } else if (addressLine1) {
    parts.push(addressLine1);
  } else if (postcode) {
    parts.push(postcode);
  } else if (customerName) {
    parts.push(customerName);
  }

  // Recommended system
  if (recommendedSystem) {
    if (parts.length > 0) {
      parts.push(`— ${recommendedSystem}`);
    } else {
      parts.push(`${recommendedSystem} assessment`);
    }
  }

  if (parts.length > 0) {
    return parts.join(' ');
  }

  // Date fallback
  return `Assessment ${new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}
