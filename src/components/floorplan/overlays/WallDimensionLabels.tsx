/**
 * WallDimensionLabels — SVG overlay that renders dimension labels along each
 * wall on the active floor.
 *
 * Labels are shown in engineer view mode.  Clicking a label opens the
 * inline length editor via `onEditLength`.
 *
 * The label is offset perpendicular to the wall so it does not overlap the
 * wall line itself.  External walls get a slightly larger offset to clear the
 * thick stroke.
 */

import type { Wall } from '../propertyPlan.types';
import { GRID, MIN_LABELED_WALL_LENGTH_PX } from '../../../features/floorplan/constants';
const LABEL_OFFSET_INTERNAL = 10; // px perpendicular offset
const LABEL_OFFSET_EXTERNAL = 14;

interface Props {
  walls: Wall[];
  selectedWallId?: string | null;
  /** Called when the user taps a dimension label to edit the wall length. */
  onEditLength: (wallId: string, currentLengthM: number) => void;
}

export default function WallDimensionLabels({ walls, selectedWallId, onEditLength }: Props) {
  return (
    <>
      {walls.map((wall) => {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const len = Math.hypot(dx, dy);
        if (len < MIN_LABELED_WALL_LENGTH_PX) return null; // too short to label

        const ux = dx / len;
        const uy = dy / len;
        // Perpendicular (outward to the left of the wall direction)
        const perpX = -uy;
        const perpY =  ux;

        const offset = wall.kind === 'external' ? LABEL_OFFSET_EXTERNAL : LABEL_OFFSET_INTERNAL;
        const cx = (wall.x1 + wall.x2) / 2 + perpX * offset;
        const cy = (wall.y1 + wall.y2) / 2 + perpY * offset;
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        const lenM = (len / GRID).toFixed(2);

        const isSelected = wall.id === selectedWallId;

        return (
          <g
            key={wall.id}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onEditLength(wall.id, len / GRID);
            }}
          >
            {/* Pill background for readability */}
            <rect
              x={cx - 22}
              y={cy - 7}
              width={44}
              height={13}
              rx={4}
              fill={isSelected ? '#dbeafe' : 'rgba(255,255,255,0.88)'}
              stroke={isSelected ? '#2563eb' : '#cbd5e1'}
              strokeWidth={0.8}
              transform={`rotate(${angleDeg}, ${cx}, ${cy})`}
              style={{ pointerEvents: 'none' }}
            />
            <text
              x={cx}
              y={cy + 4}
              fontSize={9}
              textAnchor="middle"
              fill={isSelected ? '#1d4ed8' : '#475569'}
              fontWeight={isSelected ? 'bold' : 'normal'}
              transform={`rotate(${angleDeg}, ${cx}, ${cy})`}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {lenM} m
            </text>
          </g>
        );
      })}
    </>
  );
}
