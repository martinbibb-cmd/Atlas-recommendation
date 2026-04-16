/**
 * projectEvidenceToScene.ts
 *
 * Projects SpatialEvidenceMarkerV1 entities into billboard / marker scene nodes.
 *
 * Evidence markers are purely informational — they never affect canonical model
 * state and are tagged as 'shared' across all branches.
 */

import type { SpatialEvidenceMarkerV1 } from '../../state/spatialTwin.types';
import type { SpatialTwinSceneNode } from '../sceneGraph.types';
import type { SceneMode } from '../sceneGraph.types';
import { makeNode } from '../sceneGraph.builders';

const DEFAULT_EVIDENCE_Z = 0;

function evidenceIcon(kind: SpatialEvidenceMarkerV1['kind']): string {
  switch (kind) {
    case 'photo':
      return 'photo';
    case 'transcript':
      return 'mic';
    case 'note':
      return 'note';
    case 'object_pin':
      return 'pin';
    default:
      return 'marker';
  }
}

export function projectEvidenceToScene(
  evidenceMarkers: SpatialEvidenceMarkerV1[],
  _mode: SceneMode,
): SpatialTwinSceneNode[] {
  return evidenceMarkers.map((ev) => {
    const pos = ev.position ?? { x: 0, y: 0 };
    return makeNode({
      entityId: ev.evidenceId,
      entityKind: 'evidence',
      branch: 'shared',
      tone: 'neutral',
      label: ev.label,
      selectable: true,
      geometry: {
        type: 'billboard',
        position: { x: pos.x, y: pos.y, z: DEFAULT_EVIDENCE_Z },
        icon: evidenceIcon(ev.kind),
      },
    });
  });
}
