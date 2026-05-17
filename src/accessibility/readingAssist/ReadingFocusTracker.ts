import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { buildReadingLineAnchor, type ReadingLineAnchor } from './ReadingLineAnchor';
import { resolveActiveReadingRegion } from './ReadingRegionObserver';

export interface ReadingFocusState {
  activeRegion: HTMLElement | null;
  anchor: ReadingLineAnchor | null;
}

export function useReadingFocusTracker(surfaceRef: RefObject<HTMLElement | null>, enabled: boolean): ReadingFocusState {
  const [state, setState] = useState<ReadingFocusState>({ activeRegion: null, anchor: null });

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !enabled) {
      return;
    }

    let frame = 0;

    const update = (preferredTarget?: EventTarget | null) => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const nextRegion = resolveActiveReadingRegion(surface, preferredTarget);
        if (!nextRegion) {
          setState({ activeRegion: null, anchor: null });
          return;
        }
        setState({
          activeRegion: nextRegion,
          anchor: buildReadingLineAnchor(surface, nextRegion),
        });
      });
    };

    update();

    const handlePointerMove = (event: PointerEvent) => update(event.target);
    const handleFocusIn = (event: FocusEvent) => update(event.target);
    const handleScroll = () => update();
    const handleSelectionChange = () => {
      const anchorNode = document.getSelection()?.anchorNode;
      update(anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null);
    };

    surface.addEventListener('pointermove', handlePointerMove, { passive: true });
    surface.addEventListener('focusin', handleFocusIn);
    surface.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      surface.removeEventListener('pointermove', handlePointerMove);
      surface.removeEventListener('focusin', handleFocusIn);
      surface.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [enabled, surfaceRef]);

  return state;
}
