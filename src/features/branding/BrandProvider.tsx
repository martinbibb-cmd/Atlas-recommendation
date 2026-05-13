/**
 * src/features/branding/BrandProvider.tsx
 *
 * Resolves the active BrandProfileV1 and exposes it via React context.
 * Also writes the theme tokens as CSS custom properties onto the wrapper div
 * so that descendant components can consume `var(--atlas-brand-*)` without
 * importing any JS.
 *
 * Resolution order:
 *   1. `profile` prop — raw profile, bypasses all other resolution (tests/Storybook)
 *   2. `brandId` prop — resolved via resolveBrandProfile()
 *   3. WorkspaceBrandSessionContext — authoritative workspace session brand
 *   4. atlas-default — built-in fallback
 */

import { createContext, useContext } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import type { BrandProfileV1 } from './brandProfile';
import { resolveBrandProfile } from './resolveBrandProfile';
import { WorkspaceBrandSessionContext } from '../../auth/brand/WorkspaceBrandSessionProvider';
import './brandTheme.css';

// ─── Context ──────────────────────────────────────────────────────────────────

const BrandContext = createContext<BrandProfileV1 | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface BrandProviderProps {
  /** Resolved from this brandId string when provided (and profile is absent). */
  brandId?: string;
  /**
   * Supply a raw BrandProfileV1 directly, bypassing the brandId resolver.
   * Useful in tests and Storybook to render a specific profile without
   * registering it in BRAND_PROFILES.
   */
  profile?: BrandProfileV1;
  children: ReactNode;
}

/**
 * BrandProvider
 *
 * Wraps a subtree with the resolved brand profile.  Applies CSS variables to
 * the wrapper element so that styled descendants can consume them without JS.
 *
 * Usage:
 *   <BrandProvider brandId="installer-demo">
 *     <App />
 *   </BrandProvider>
 *
 *   // Or in tests, pass a profile directly:
 *   <BrandProvider profile={myProfile}>
 *     <App />
 *   </BrandProvider>
 *
 *   // When no brandId or profile are supplied, falls back to the workspace brand
 *   // session resolved by WorkspaceBrandSessionProvider (if present in the tree).
 */
export function BrandProvider({ brandId, profile: profileProp, children }: BrandProviderProps) {
  const workspaceBrandSession = useContext(WorkspaceBrandSessionContext);

  // Resolution order: explicit profile > explicit brandId > workspace session > atlas-default.
  const sessionProfile = workspaceBrandSession.activeBrand;
  const profile =
    profileProp ??
    (brandId !== undefined ? resolveBrandProfile(brandId) : null) ??
    sessionProfile;

  const inlineVars: CSSProperties = {
    ['--atlas-brand-primary' as string]: profile.theme.primaryColor,
    ['--atlas-brand-secondary' as string]: profile.theme.secondaryColor ?? '',
    ['--atlas-brand-accent' as string]: profile.theme.accentColor ?? '',
    ['--atlas-brand-background' as string]: profile.theme.backgroundColor ?? '',
    ['--atlas-brand-surface' as string]: profile.theme.surfaceColor ?? '',
    ['--atlas-brand-text' as string]: profile.theme.textColor ?? '',
  };

  return (
    <BrandContext.Provider value={profile}>
      <div
        className="brand-theme-root"
        style={inlineVars}
        data-brand-id={profile.brandId}
      >
        {children}
      </div>
    </BrandContext.Provider>
  );
}

// ─── Internal context export (for useBrandProfile) ───────────────────────────

export { BrandContext };
