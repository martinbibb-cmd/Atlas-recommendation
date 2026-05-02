/**
 * src/features/tenants/workspaceSlug.ts
 *
 * Workspace slug validation and normalisation for Atlas tenants.
 *
 * Rules
 * ─────
 * - Lowercase letters, numbers, and hyphens only.
 * - No leading or trailing hyphen.
 * - Length: 3–40 characters.
 * - Reserved slugs are rejected.
 *
 * Design rules
 * ────────────
 * - All functions are pure: no side-effects, no I/O.
 */

// ─── Reserved slugs ───────────────────────────────────────────────────────────

const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'portal',
  'receive-scan',
  'www',
  'atlas-mind',
]);

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Normalises a user-supplied string into a candidate workspace slug:
 *   - Trims whitespace.
 *   - Lowercases.
 *   - Replaces runs of spaces/underscores/hyphens with a single hyphen.
 *   - Strips any character that is not a letter, digit, or hyphen.
 *   - Strips leading and trailing hyphens.
 *
 * The result may still fail isValidWorkspaceSlug() (e.g. too short / reserved).
 */
export function normaliseWorkspaceSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Returns true when the slug meets all workspace slug rules.
 */
export function isValidWorkspaceSlug(slug: string): boolean {
  if (typeof slug !== 'string') return false;
  if (slug.length < 3 || slug.length > 40) return false;
  // Must start with a letter/digit; if longer than 1 char, must also end with
  // a letter/digit (no leading/trailing hyphens).  Interior may contain hyphens.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return false;
  }
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}

/**
 * Throws a descriptive Error when the slug is invalid.
 *
 * @throws Error with a human-readable message describing the violation.
 */
export function assertValidWorkspaceSlug(slug: string): void {
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new Error('Workspace slug must be a non-empty string.');
  }
  if (slug.length < 3) {
    throw new Error('Workspace slug must be at least 3 characters long.');
  }
  if (slug.length > 40) {
    throw new Error('Workspace slug must be no more than 40 characters long.');
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    throw new Error(
      'Workspace slug may only contain lowercase letters, numbers, and hyphens, ' +
        'and must not start or end with a hyphen.',
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`"${slug}" is a reserved workspace slug and cannot be used.`);
  }
}
