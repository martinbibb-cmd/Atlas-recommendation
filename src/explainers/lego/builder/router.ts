/**
 * Simple orthogonal pipe router.
 *
 * Produces a 2-segment elbow polyline between two canvas points.
 *   • If the horizontal span is larger: horizontal first then vertical.
 *   • If the vertical span is larger: vertical first then horizontal.
 *
 * Returns an SVG `points` string suitable for use in a <polyline>.
 */
export function routePipe(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  if (dx >= dy) {
    // Horizontal then vertical: bend at (midX, from.y) → (midX, to.y)
    const midX = (from.x + to.x) / 2;
    return `${from.x},${from.y} ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
  } else {
    // Vertical then horizontal: bend at (from.x, midY) → (to.x, midY)
    const midY = (from.y + to.y) / 2;
    return `${from.x},${from.y} ${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`;
  }
}
