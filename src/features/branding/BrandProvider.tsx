/**
 * src/features/branding/BrandProvider.tsx
 *
 * Resolves the active BrandProfileV1 and exposes it via React context.
 * Also writes the theme tokens as CSS custom properties onto the wrapper div
 * so that descendant components can consume `var(--atlas-brand-*)` without
 * importing any JS.
 */

import { createContext, useContext, useRef, useEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import type { BrandProfileV1 } from './brandProfile';
import { resolveBrandProfile } from './resolveBrandProfile';
import './brandTheme.css';

// ─── Context ──────────────────────────────────────────────────────────────────

const BrandContext = createContext<BrandProfileV1 | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface BrandProviderProps {
  brandId?: string;
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
 */
export function BrandProvider({ brandId, children }: BrandProviderProps) {
  const profile = resolveBrandProfile(brandId);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const { theme } = profile;

    el.style.setProperty('--atlas-brand-primary', theme.primaryColor);
    el.style.setProperty('--atlas-brand-secondary', theme.secondaryColor ?? '');
    el.style.setProperty('--atlas-brand-accent', theme.accentColor ?? '');
    el.style.setProperty('--atlas-brand-background', theme.backgroundColor ?? '');
    el.style.setProperty('--atlas-brand-surface', theme.surfaceColor ?? '');
    el.style.setProperty('--atlas-brand-text', theme.textColor ?? '');
  }, [profile]);

  // Inline style ensures the variables are present on first render (before the
  // effect fires) to avoid a flash of unstyled content.
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
        ref={wrapperRef}
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
