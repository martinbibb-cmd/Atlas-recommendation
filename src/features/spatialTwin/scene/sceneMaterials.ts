/**
 * sceneMaterials.ts
 *
 * Colour palette for scene node tones.
 *
 * The renderer reads these values; they are not physics data.
 */

import type { SceneNodeTone } from './sceneGraph.types';

export interface SceneMaterial {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeOpacity: number;
}

const MATERIALS: Record<SceneNodeTone, SceneMaterial> = {
  neutral: {
    fill: '#cbd5e1',
    fillOpacity: 0.55,
    stroke: '#94a3b8',
    strokeOpacity: 1,
  },
  current: {
    fill: '#bae6fd',
    fillOpacity: 0.65,
    stroke: '#0ea5e9',
    strokeOpacity: 1,
  },
  proposed: {
    fill: '#bbf7d0',
    fillOpacity: 0.65,
    stroke: '#22c55e',
    strokeOpacity: 1,
  },
  removed: {
    fill: '#fecaca',
    fillOpacity: 0.35,
    stroke: '#f87171',
    strokeOpacity: 0.6,
  },
  warning: {
    fill: '#fde68a',
    fillOpacity: 0.7,
    stroke: '#f59e0b',
    strokeOpacity: 1,
  },
  ghost: {
    fill: '#e2e8f0',
    fillOpacity: 0.2,
    stroke: '#94a3b8',
    strokeOpacity: 0.3,
  },
};

export function getMaterial(tone: SceneNodeTone): SceneMaterial {
  return MATERIALS[tone];
}

/** Slightly darker shade for vertical faces in the isometric projection. */
export function getDarkerFill(fill: string): string {
  return fill;
}
