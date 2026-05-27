/** Minimal layout helper: returns a position near `hint` that avoids overlapping existing nodes. */

const GRID = 200
const MIN_DIST = 140

export function nextPosition(
  existing: Array<{ x: number; y: number }>,
  hint?: { x: number; y: number },
): { x: number; y: number } {
  const base = hint ?? { x: 200, y: 300 }

  const candidates = [
    base,
    { x: base.x + GRID, y: base.y },
    { x: base.x, y: base.y + GRID },
    { x: base.x - GRID, y: base.y },
    { x: base.x, y: base.y - GRID },
    { x: base.x + GRID * 2, y: base.y },
    { x: base.x + GRID, y: base.y + GRID },
    { x: base.x - GRID, y: base.y + GRID },
    { x: base.x + GRID * 2, y: base.y + GRID },
  ]

  for (const candidate of candidates) {
    const tooClose = existing.some(p => {
      const dx = p.x - candidate.x
      const dy = p.y - candidate.y
      return Math.sqrt(dx * dx + dy * dy) < MIN_DIST
    })
    if (!tooClose) return candidate
  }

  return { x: base.x + GRID * 3, y: base.y }
}
