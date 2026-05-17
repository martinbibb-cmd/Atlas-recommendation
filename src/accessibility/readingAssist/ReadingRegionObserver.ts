const READING_REGION_SELECTOR = '[data-reading-region]';

export function getReadingRegions(surface: HTMLElement): HTMLElement[] {
  return Array.from(surface.querySelectorAll<HTMLElement>(READING_REGION_SELECTOR));
}

export function resolveActiveReadingRegion(
  surface: HTMLElement,
  preferredTarget?: EventTarget | null,
): HTMLElement | null {
  const preferredRegion = preferredTarget instanceof Element
    ? preferredTarget.closest<HTMLElement>(READING_REGION_SELECTOR)
    : null;
  if (preferredRegion && surface.contains(preferredRegion)) {
    return preferredRegion;
  }

  const regions = getReadingRegions(surface);
  if (regions.length === 0) return null;

  const viewportCenter = window.innerHeight / 2;
  let bestRegion = regions[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const region of regions) {
    const rect = region.getBoundingClientRect();
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);
    const isVisible = visibleBottom > visibleTop;
    const anchor = isVisible ? (visibleTop + visibleBottom) / 2 : (rect.top + rect.bottom) / 2;
    const distance = Math.abs(anchor - viewportCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRegion = region;
    }
  }

  return bestRegion;
}
