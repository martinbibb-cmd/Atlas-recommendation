/**
 * portalUrl.ts
 *
 * Utility for generating customer portal URLs from report references.
 *
 * Phase 1 uses a simple `/portal/:reference` route.
 * Phase 2 (this file) adds signed-token support: `/portal/:reference?token=...`
 * The structure is preserved so a fully tokenised route (`/p/:signedToken`)
 * can replace this later without redesigning calling code.
 */

/**
 * Build the customer portal URL for a given report reference.
 *
 * @param reference - Report or visit reference ID.
 * @param origin    - URL origin; defaults to the current window origin.
 * @param token     - Optional signed portal token to append as `?token=...`.
 * @returns Fully qualified portal URL.
 */
export function buildPortalUrl(
  reference: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
  token?: string,
): string {
  const base = `${origin}/portal/${encodeURIComponent(reference)}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
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
