/**
 * sceneLegend.ts
 *
 * Legend items for the 3D dollhouse view.
 * Content varies by scene mode; no physics data here.
 */

import type { SceneMode } from './sceneGraph.types';

export interface SceneLegendItem {
  color: string;
  label: string;
}

/** Return legend items appropriate for the given scene mode. */
export function buildSceneLegendItems(mode: SceneMode): SceneLegendItem[] {
  const base: SceneLegendItem[] = [
    { color: '#cbd5e1', label: 'Room shell' },
    { color: '#bae6fd', label: 'Heat emitter' },
    { color: '#fde68a', label: 'Heat source / store' },
    { color: '#94a3b8', label: 'Pipe run (confirmed)' },
  ];

  if (mode === 'proposed') {
    return [
      ...base,
      { color: '#bbf7d0', label: 'Proposed addition' },
      { color: '#fecaca', label: 'To be removed' },
    ];
  }

  if (mode === 'compare') {
    return [
      { color: '#cbd5e1', label: 'Unchanged' },
      { color: '#bbf7d0', label: 'Proposed addition' },
      { color: '#fecaca', label: 'Removed (ghosted)' },
      { color: '#bae6fd', label: 'Current state' },
    ];
  }

  return base;
}
