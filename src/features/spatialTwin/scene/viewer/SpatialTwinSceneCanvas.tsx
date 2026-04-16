/**
 * SpatialTwinSceneCanvas.tsx
 *
 * 3D dollhouse canvas — isometric projection via react-konva.
 *
 * Rendering strategy:
 *  - All geometry is projected from SpatialTwinSceneGraph nodes; the canvas
 *    owns zero engineering state.
 *  - Isometric projection: screenX = cx + (x − y) × s × cos30°
 *                          screenY = cy + (x + y) × s × sin30° − z × s
 *  - Rooms are drawn as extruded floor-plates (top face + two visible side faces).
 *  - Objects (heat sources, stores, emitters) are drawn as simple labelled boxes.
 *  - Pipe runs are drawn as elevated polylines.
 *  - Evidence is drawn as labelled marker pins.
 *
 * Hit-testing: Konva onClick on each shape emits the sceneNodeId, which the
 * parent resolves to a canonical entityId via selectSpatialTwinEntityFromSceneNode().
 */

import { Stage, Layer, Line, Rect, Text, Circle, Group } from 'react-konva';
import type { SpatialTwinSceneGraph, SpatialTwinSceneNode, Vec3 } from '../sceneGraph.types';
import { getMaterial } from '../sceneMaterials';

// ─── Isometric projection constants ──────────────────────────────────────────

const COS30 = Math.cos(Math.PI / 6); // ≈ 0.866
const SIN30 = Math.sin(Math.PI / 6); // ≈ 0.5

// ─── Projection helpers ───────────────────────────────────────────────────────

function toIso(
  v: Vec3,
  scale: number,
  cx: number,
  cy: number,
): { sx: number; sy: number } {
  return {
    sx: cx + (v.x - v.y) * scale * COS30,
    sy: cy + (v.x + v.y) * scale * SIN30 - v.z * scale,
  };
}

function isoFlat(
  points2d: Array<{ x: number; y: number }>,
  z: number,
  scale: number,
  cx: number,
  cy: number,
): number[] {
  return points2d.flatMap((p) => {
    const { sx, sy } = toIso({ x: p.x, y: p.y, z }, scale, cx, cy);
    return [sx, sy];
  });
}

// ─── Room renderer ────────────────────────────────────────────────────────────

interface RoomShapeProps {
  node: SpatialTwinSceneNode;
  scale: number;
  cx: number;
  cy: number;
  selected: boolean;
  onSelect: (sceneNodeId: string) => void;
}

function RoomShape({ node, scale, cx, cy, selected, onSelect }: RoomShapeProps) {
  if (node.geometry.type !== 'extrudedPolygon') return null;
  const { points, height } = node.geometry;
  const mat = getMaterial(node.appearance.tone);

  const topFlat = isoFlat(points, height, scale, cx, cy);
  const bottomFlat = isoFlat(points, 0, scale, cx, cy);

  // Front face: last two points (index 2,3 → 0-indexed right/bottom)
  // We approximate by drawing two side quads for the first two edges visible
  // in an isometric view facing upper-left.
  const facePts = (iBase: number, jBase: number): number[] => {
    const p0 = points[iBase];
    const p1 = points[jBase];
    if (p0 == null || p1 == null) return [];
    const t0 = toIso({ x: p0.x, y: p0.y, z: height }, scale, cx, cy);
    const t1 = toIso({ x: p1.x, y: p1.y, z: height }, scale, cx, cy);
    const b0 = toIso({ x: p0.x, y: p0.y, z: 0 }, scale, cx, cy);
    const b1 = toIso({ x: p1.x, y: p1.y, z: 0 }, scale, cx, cy);
    return [t0.sx, t0.sy, t1.sx, t1.sy, b1.sx, b1.sy, b0.sx, b0.sy];
  };

  const fill = selected ? '#0ea5e9' : mat.fill;
  const stroke = selected ? '#0369a1' : mat.stroke;

  return (
    <Group onClick={() => { onSelect(node.sceneNodeId); }}>
      {/* Side face 0→1 (front-right) */}
      <Line
        points={facePts(1, 2)}
        closed
        fill={fill}
        opacity={mat.fillOpacity * 0.75}
        stroke={stroke}
        strokeWidth={0.5}
        listening={false}
      />
      {/* Side face 3→0 (front-left) */}
      <Line
        points={facePts(2, 3)}
        closed
        fill={fill}
        opacity={mat.fillOpacity * 0.6}
        stroke={stroke}
        strokeWidth={0.5}
        listening={false}
      />
      {/* Top face */}
      <Line
        points={topFlat}
        closed
        fill={fill}
        opacity={mat.fillOpacity}
        stroke={stroke}
        strokeWidth={selected ? 1.5 : 0.8}
        dash={node.appearance.dashed ? [4, 3] : undefined}
      />
      {/* Bottom edge hint */}
      <Line
        points={bottomFlat}
        closed
        fill='transparent'
        stroke={stroke}
        strokeWidth={0.3}
        opacity={0.3}
        listening={false}
      />
    </Group>
  );
}

// ─── Box renderer ─────────────────────────────────────────────────────────────

interface BoxShapeProps {
  node: SpatialTwinSceneNode;
  scale: number;
  cx: number;
  cy: number;
  selected: boolean;
  onSelect: (sceneNodeId: string) => void;
}

function BoxShape({ node, scale, cx, cy, selected, onSelect }: BoxShapeProps) {
  if (node.geometry.type !== 'box') return null;
  const { width, depth, height, position } = node.geometry;
  const mat = getMaterial(node.appearance.tone);
  const fill = selected ? '#0ea5e9' : mat.fill;
  const stroke = selected ? '#0369a1' : mat.stroke;

  const px = position.x;
  const py = position.y;
  const pz = position.z;

  // 8 corners
  const c: Array<{ x: number; y: number; z: number }> = [
    { x: px, y: py, z: pz },
    { x: px + width, y: py, z: pz },
    { x: px + width, y: py + depth, z: pz },
    { x: px, y: py + depth, z: pz },
    { x: px, y: py, z: pz + height },
    { x: px + width, y: py, z: pz + height },
    { x: px + width, y: py + depth, z: pz + height },
    { x: px, y: py + depth, z: pz + height },
  ];

  const sc = c.map((v) => toIso(v, scale, cx, cy));

  const face = (indices: number[]): number[] =>
    indices.flatMap((i) => [sc[i]!.sx, sc[i]!.sy]);

  return (
    <Group onClick={() => { onSelect(node.sceneNodeId); }}>
      {/* Right face */}
      <Line points={face([1, 2, 6, 5])} closed fill={fill} opacity={mat.fillOpacity * 0.6} stroke={stroke} strokeWidth={0.5} listening={false} />
      {/* Left face */}
      <Line points={face([0, 3, 7, 4])} closed fill={fill} opacity={mat.fillOpacity * 0.5} stroke={stroke} strokeWidth={0.5} listening={false} />
      {/* Top face */}
      <Line points={face([4, 5, 6, 7])} closed fill={fill} opacity={mat.fillOpacity} stroke={stroke} strokeWidth={selected ? 1.5 : 0.8} />
    </Group>
  );
}

// ─── Polyline3D renderer ──────────────────────────────────────────────────────

interface PolylineShapeProps {
  node: SpatialTwinSceneNode;
  scale: number;
  cx: number;
  cy: number;
  selected: boolean;
  onSelect: (sceneNodeId: string) => void;
}

function PolylineShape({ node, scale, cx, cy, selected, onSelect }: PolylineShapeProps) {
  if (node.geometry.type !== 'polyline3d') return null;
  const mat = getMaterial(node.appearance.tone);
  const pts = node.geometry.points.flatMap((p) => {
    const { sx, sy } = toIso(p, scale, cx, cy);
    return [sx, sy];
  });

  return (
    <Line
      points={pts}
      stroke={selected ? '#0ea5e9' : mat.stroke}
      strokeWidth={selected ? 2 : 1.5}
      dash={node.appearance.dashed ? [5, 4] : undefined}
      opacity={mat.strokeOpacity}
      onClick={() => { onSelect(node.sceneNodeId); }}
    />
  );
}

// ─── Billboard / marker renderer ─────────────────────────────────────────────

interface BillboardShapeProps {
  node: SpatialTwinSceneNode;
  scale: number;
  cx: number;
  cy: number;
  selected: boolean;
  onSelect: (sceneNodeId: string) => void;
}

function BillboardShape({ node, scale, cx, cy, selected, onSelect }: BillboardShapeProps) {
  if (node.geometry.type !== 'billboard' && node.geometry.type !== 'marker') return null;
  const pos = node.geometry.position;
  const { sx, sy } = toIso(pos, scale, cx, cy);
  const mat = getMaterial(node.appearance.tone);

  return (
    <Group onClick={() => { onSelect(node.sceneNodeId); }}>
      <Circle
        x={sx}
        y={sy}
        radius={5}
        fill={selected ? '#0ea5e9' : mat.fill}
        stroke={selected ? '#0369a1' : mat.stroke}
        strokeWidth={1}
      />
      {node.label != null && (
        <Text
          x={sx + 7}
          y={sy - 5}
          text={node.label}
          fontSize={9}
          fill='#374151'
          listening={false}
        />
      )}
    </Group>
  );
}

// ─── Label renderer ───────────────────────────────────────────────────────────

interface LabelProps {
  node: SpatialTwinSceneNode;
  scale: number;
  cx: number;
  cy: number;
}

function NodeLabel({ node, scale, cx, cy }: LabelProps) {
  if (node.label == null) return null;

  let labelPos: { x: number; y: number; z: number } | null = null;

  if (node.geometry.type === 'extrudedPolygon') {
    const pts = node.geometry.points;
    const sumX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const sumY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    labelPos = { x: sumX, y: sumY, z: node.geometry.height + 4 };
  } else if (node.geometry.type === 'box') {
    const { position, width, depth, height } = node.geometry;
    labelPos = { x: position.x + width / 2, y: position.y + depth / 2, z: position.z + height + 2 };
  }

  if (labelPos == null) return null;
  const { sx, sy } = toIso(labelPos, scale, cx, cy);

  return (
    <Text
      x={sx - 24}
      y={sy - 6}
      width={48}
      text={node.label}
      fontSize={9}
      fill='#374151'
      align='center'
      listening={false}
    />
  );
}

// ─── Main canvas component ────────────────────────────────────────────────────

interface SpatialTwinSceneCanvasProps {
  graph: SpatialTwinSceneGraph;
  selectedEntityId: string | null;
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  showLabels: boolean;
  onSelectSceneNode: (sceneNodeId: string) => void;
}

export function SpatialTwinSceneCanvas({
  graph,
  selectedEntityId,
  width,
  height,
  scale,
  offsetX,
  offsetY,
  showLabels,
  onSelectSceneNode,
}: SpatialTwinSceneCanvasProps) {
  const cx = width / 2 + offsetX;
  const cy = height / 3 + offsetY;

  const visibleNodes = graph.nodes.filter((n) => n.appearance.visible);

  return (
    <Stage width={width} height={height}>
      <Layer>
        {/* Background */}
        <Rect x={0} y={0} width={width} height={height} fill='#f8fafc' listening={false} />

        {/* Rooms (bottom layer) */}
        {visibleNodes
          .filter((n) => n.entityKind === 'room')
          .map((node) => (
            <RoomShape
              key={node.sceneNodeId}
              node={node}
              scale={scale}
              cx={cx}
              cy={cy}
              selected={node.entityId === selectedEntityId}
              onSelect={onSelectSceneNode}
            />
          ))}

        {/* Pipe runs (above floors) */}
        {visibleNodes
          .filter((n) => n.entityKind === 'pipeRun')
          .map((node) => (
            <PolylineShape
              key={node.sceneNodeId}
              node={node}
              scale={scale}
              cx={cx}
              cy={cy}
              selected={node.entityId === selectedEntityId}
              onSelect={onSelectSceneNode}
            />
          ))}

        {/* Objects (heat sources, stores, emitters) */}
        {visibleNodes
          .filter((n) => n.entityKind === 'heatSource' || n.entityKind === 'store' || n.entityKind === 'emitter')
          .map((node) => (
            <BoxShape
              key={node.sceneNodeId}
              node={node}
              scale={scale}
              cx={cx}
              cy={cy}
              selected={node.entityId === selectedEntityId}
              onSelect={onSelectSceneNode}
            />
          ))}

        {/* Evidence markers (top layer) */}
        {visibleNodes
          .filter((n) => n.entityKind === 'evidence')
          .map((node) => (
            <BillboardShape
              key={node.sceneNodeId}
              node={node}
              scale={scale}
              cx={cx}
              cy={cy}
              selected={node.entityId === selectedEntityId}
              onSelect={onSelectSceneNode}
            />
          ))}

        {/* Labels */}
        {showLabels &&
          visibleNodes
            .filter((n) => n.entityKind === 'room' || n.entityKind === 'heatSource' || n.entityKind === 'store')
            .map((node) => (
              <NodeLabel
                key={`label-${node.sceneNodeId}`}
                node={node}
                scale={scale}
                cx={cx}
                cy={cy}
              />
            ))}
      </Layer>
    </Stage>
  );
}
