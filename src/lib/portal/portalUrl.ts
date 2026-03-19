/**
 * portalUrl.ts
 *
 * Utility for generating customer portal URLs from report references.
 *
 * Phase 1 uses a simple `/portal/:reference` route.
 * The code is structured so signed-token access can replace this later
 * (e.g. `/portal/:reference?token=...` or `/p/:signedToken`) without
 * redesigning calling code.
 */

/**
 * Build the customer portal URL for a given report reference.
 *
 * @param reference - Report or visit reference ID.
 * @param origin    - URL origin; defaults to the current window origin.
 * @returns Fully qualified portal URL.
 */
export function buildPortalUrl(
  reference: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  return `${origin}/portal/${encodeURIComponent(reference)}`;
}

/**
 * Extract the report reference from a `/portal/:reference` pathname.
 *
 * @returns The decoded reference string, or null if the pathname does not match.
 */
export function parsePortalPath(pathname: string): string | null {
  const match = pathname.match(/^\/portal\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}
