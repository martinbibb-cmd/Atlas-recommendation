import { ANALOGY_OVERLAYS } from './overlays/analogyOverlays';
import type {
  AnalogyMode,
  AnalogyOverlayEntry,
  AnalogyTargetConcept,
} from './types';

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
