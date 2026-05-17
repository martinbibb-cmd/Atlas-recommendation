export interface ReadingLineAnchor {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function buildReadingLineAnchor(surface: HTMLElement, region: HTMLElement): ReadingLineAnchor {
  const surfaceRect = surface.getBoundingClientRect();
  const regionRect = region.getBoundingClientRect();
  const top = regionRect.top - surfaceRect.top + surface.scrollTop;
  const left = regionRect.left - surfaceRect.left + surface.scrollLeft;

  return {
    top,
    left,
    width: regionRect.width,
    height: regionRect.height,
  };
}
