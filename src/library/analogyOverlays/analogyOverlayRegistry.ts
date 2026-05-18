import { ANALOGY_OVERLAYS } from './overlays/analogyOverlays';
import type {
  AnalogyMode,
  AnalogyOverlayEntry,
  AnalogyTargetConcept,
} from './types';

/**
 * ─── OverlayLayerContract ────────────────────────────────────────────────────
 *
 * All analogy overlay components MUST comply with the following rules to
 * ensure they do not obscure or replace the physical topology diagram:
 *
 * 1. **Opacity ≤ 0.85** — overlay fill/background must never be fully opaque;
 *    the physical topology beneath must remain perceptible.
 *
 * 2. **Never obscure pipe stubs or equipment labels** — overlay bounding boxes
 *    must avoid the equipment node zones defined in TOPOLOGY_LAYOUT_GRID.md.
 *    If an overlay must cover an equipment zone it must use `pointer-events: none`
 *    and `opacity ≤ 0.5`.
 *
 * 3. **Lower z-index than the equipment node layer** — overlays must render at
 *    a z-index below the `position: absolute` equipment `<div>` nodes.
 *    The equipment nodes sit at z-index 1 (implicit stacking).  Overlay SVGs
 *    that live inside `PipeLayer` (z-index 0, `position: absolute, inset: 0`)
 *    satisfy this automatically.  Any overlay that renders outside `PipeLayer`
 *    must explicitly set `z-index: 0` or lower.
 *
 * 4. **TopologyShell must always be rendered** — overlays are composited ON TOP
 *    of `TopologyShell`, never instead of it.  Any variant that currently
 *    replaces `TopologyShell` must be refactored to use a transparent layer
 *    over the existing topology.
 *
 * 5. **No motion in overlays** — overlay components must not introduce CSS
 *    animations.  All motion belongs to `primitiveMotion.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const REQUIRED_ANALOGY_MODES: readonly AnalogyMode[] = [
  'basic_household',
  'traffic',
  'medical',
  'electrical',
  'physics_engineering',
] as const;

export const ANALOGY_OVERLAY_REGISTRY: AnalogyOverlayEntry[] = ANALOGY_OVERLAYS;

export function listAnalogyTargetConcepts(): AnalogyTargetConcept[] {
  return Array.from(new Set(ANALOGY_OVERLAY_REGISTRY.map((entry) => entry.targetConcept)));
}

export function findAnalogyOverlay(
  targetConcept: AnalogyTargetConcept,
  analogyMode: AnalogyMode,
): AnalogyOverlayEntry | undefined {
  return ANALOGY_OVERLAY_REGISTRY.find(
    (entry) =>
      entry.targetConcept === targetConcept
      && entry.analogyMode === analogyMode,
  );
}
