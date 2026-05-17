import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useReadingPreferences } from '../readingPreferences/ReadingPreferencesContext';
import { useReadingFocusTracker } from './ReadingFocusTracker';

export function ReadingAssistOverlay() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const { enabled, profile } = useReadingPreferences();
  const readingAssistEnabled = enabled && profile.readingRulerEnabled;
  const { activeRegion, anchor } = useReadingFocusTracker(surfaceRef, readingAssistEnabled);

  useEffect(() => {
    const surface = surfaceRef.current?.parentElement;
    if (!surface) return;
    surface.setAttribute('data-reading-assist-active', activeRegion ? 'true' : 'false');

    const regions = Array.from(surface.querySelectorAll<HTMLElement>('[data-reading-region]'));
    for (const region of regions) {
      region.setAttribute('data-reading-active', activeRegion && region === activeRegion ? 'true' : 'false');
    }

    return () => {
      surface.removeAttribute('data-reading-assist-active');
      for (const region of regions) {
        region.removeAttribute('data-reading-active');
      }
    };
  }, [activeRegion]);

  const style = useMemo(() => {
    if (!anchor) return undefined;
    return {
      '--atlas-reading-assist-top': `${anchor.top}px`,
      '--atlas-reading-assist-left': `${anchor.left}px`,
      '--atlas-reading-assist-width': `${anchor.width}px`,
      '--atlas-reading-assist-height': `${anchor.height}px`,
    } as CSSProperties;
  }, [anchor]);

  if (!readingAssistEnabled) {
    return <div ref={surfaceRef} className="atlas-reading-assist-anchor" aria-hidden="true" />;
  }

  return (
    <div ref={surfaceRef} className="atlas-reading-assist-anchor" aria-hidden="true">
      <div className="atlas-reading-assist-overlay" style={style} data-testid="reading-assist-overlay" />
    </div>
  );
}
