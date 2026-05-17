import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_READING_PREFERENCES_V1,
  DEFAULT_READING_OVERLAY_ALPHA,
  type ReadingColorOverlayV1,
  type ReadingPreferencesV1,
} from './ReadingPreferencesV1';
import {
  ReadingPreferencesContext,
  type ReadingPreferencesContextValue,
} from './ReadingPreferencesContext';
import './readingPreferences.css';

const READING_PROFILE_KEY = 'atlas.readingPreferences.v1';
const READING_ENABLED_KEY = 'atlas.readingPreferences.enabled.v1';

const OVERLAY_RGB_BY_MODE: Record<Exclude<ReadingColorOverlayV1, 'none'>, string> = {
  warm: '255 241 214',
  cool: '224 240 255',
  rose: '255 232 240',
};

function parseStoredProfile(raw: string | null): ReadingPreferencesV1 {
  if (!raw) return DEFAULT_READING_PREFERENCES_V1;
  try {
    const parsed = JSON.parse(raw) as Partial<ReadingPreferencesV1>;
    return { ...DEFAULT_READING_PREFERENCES_V1, ...parsed };
  } catch {
    return DEFAULT_READING_PREFERENCES_V1;
  }
}

function parseStoredEnabled(raw: string | null): boolean {
  return raw === 'true';
}

export function ReadingPreferencesProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return parseStoredEnabled(window.localStorage.getItem(READING_ENABLED_KEY));
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [profile, setProfile] = useState<ReadingPreferencesV1>(() => {
    if (typeof window === 'undefined') return DEFAULT_READING_PREFERENCES_V1;
    return parseStoredProfile(window.localStorage.getItem(READING_PROFILE_KEY));
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(READING_ENABLED_KEY, enabled ? 'true' : 'false');
  }, [enabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(READING_PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const overlayRgb =
      profile.colorOverlay === 'none'
        ? '0 0 0'
        : OVERLAY_RGB_BY_MODE[profile.colorOverlay];
    const overlayAlpha = profile.colorOverlay === 'none' ? 0 : DEFAULT_READING_OVERLAY_ALPHA;

    root.setAttribute('data-atlas-reading-enabled', enabled ? 'true' : 'false');
    root.setAttribute('data-atlas-reading-contrast', profile.contrastMode);
    root.setAttribute('data-atlas-reading-word-highlighting', profile.wordHighlighting ? 'true' : 'false');
    root.setAttribute('data-atlas-reading-reduced-motion', profile.reducedMotion ? 'true' : 'false');
    root.setAttribute('data-atlas-reading-ruler-enabled', (enabled && profile.readingRulerEnabled) ? 'true' : 'false');
    root.style.setProperty('--atlas-reading-font-scale', String(profile.fontScale));
    root.style.setProperty('--atlas-reading-line-height', String(profile.lineHeight));
    root.style.setProperty('--atlas-reading-letter-spacing', `${profile.letterSpacing}em`);
    root.style.setProperty('--atlas-reading-paragraph-spacing', `${profile.paragraphSpacing}em`);
    root.style.setProperty('--atlas-reading-ruler-opacity', String(profile.rulerOpacity));
    root.style.setProperty('--atlas-reading-ruler-line-count', String(profile.rulerLineCount));
    root.style.setProperty('--atlas-reading-overlay-rgb', overlayRgb);
    root.style.setProperty('--atlas-reading-overlay-alpha', String(overlayAlpha));
  }, [enabled, profile]);

  // Scoped reading ruler: follow pointer within .atlas-reading-surface only.
  // The ruler is rendered as a CSS ::after pseudo-element on each reading surface,
  // positioned via --atlas-ruler-y which tracks the pointer relative to that surface.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!enabled || !profile.readingRulerEnabled) return;

    let rafId: number | null = null;

    const handlePointerMove = (event: PointerEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const target = (event.target as Element | null)?.closest?.('.atlas-reading-surface') as HTMLElement | null;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const y = event.clientY - rect.top + target.scrollTop;
        target.style.setProperty('--atlas-ruler-y', `${y}px`);
      });
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [enabled, profile.readingRulerEnabled]);

  const value = useMemo<ReadingPreferencesContextValue>(
    () => ({
      enabled,
      panelOpen,
      profile,
      setPanelOpen,
      setEnabled,
      updateProfile: (patch: Partial<ReadingPreferencesV1>) => setProfile((current) => ({ ...current, ...patch })),
      resetProfile: () => setProfile(DEFAULT_READING_PREFERENCES_V1),
    }),
    [enabled, panelOpen, profile],
  );

  return (
    <ReadingPreferencesContext.Provider value={value}>
      {children}
    </ReadingPreferencesContext.Provider>
  );
}
