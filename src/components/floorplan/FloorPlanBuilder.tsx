import { useMemo, useRef, useState } from 'react';
import { ALL_PALETTE_ITEMS } from '../../explainers/lego/builder/palette';
import { getPortDefs } from '../../explainers/lego/builder/portDefs';
import { smartAdd } from '../../explainers/lego/builder/smartAttach';
import { isTopologyAllowed, portAbs } from '../../explainers/lego/builder/snapConnect';
import type { BuildEdge, BuildGraph, BuildNode, PartKind, PortRef } from '../../explainers/lego/builder/types';
import type { SystemConceptModel } from '../../explainers/lego/model/types';
import './floorplan.css';

type StageMode = 'plan' | 'system';

type Floor = {
  id: string;
  name: string;
};

type Room = {
  id: string;
  floorId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Wall = {
  id: string;
  floorId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type SystemNode = BuildNode & { floorId: string };

type DragState =
  | { mode: 'room-move'; id: string; dx: number; dy: number }
  | { mode: 'room-resize'; id: string; startX: number; startY: number; baseW: number; baseH: number }
  | { mode: 'node-move'; id: string; dx: number; dy: number };

const GRID = 24;
const CANVAS_W = 980;
const CANVAS_H = 560;
const SNAP = 12;

export interface FloorPlanOutput {
  floors: Floor[];
  rooms: Room[];
  walls: Wall[];
  nodes: SystemNode[];
  edges: BuildEdge[];
  systemConcept: SystemConceptModel;
}

interface Props {
  surveyResults?: { systemType?: 'combi' | 'system' | 'regular' | 'heat_pump' };
  onChange?: (output: FloorPlanOutput) => void;
}

const ROOM_TOOLS = [
  { id: 'add-room', label: 'Add room', icon: '⬛' },
  { id: 'draw-wall', label: 'Draw wall', icon: '📏' },
  { id: 'clone-floor', label: 'Clone perimeter', icon: '🧱' },
  { id: 'add-floor', label: 'Add floor', icon: '🏢' },
] as const;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2, 8)}`;
}

function snapRoom(candidate: Room, siblings: Room[]) {
  let next = { ...candidate };
  siblings.forEach((other) => {
    const yOverlap = next.y < other.y + other.height && next.y + next.height > other.y;
    const xOverlap = next.x < other.x + other.width && next.x + next.width > other.x;
    const rightToLeft = Math.abs(next.x + next.width - other.x);
    const leftToRight = Math.abs(next.x - (other.x + other.width));
    const bottomToTop = Math.abs(next.y + next.height - other.y);
    const topToBottom = Math.abs(next.y - (other.y + other.height));

    if (yOverlap && rightToLeft <= SNAP) next.x = other.x - next.width;
    if (yOverlap && leftToRight <= SNAP) next.x = other.x + other.width;
    if (xOverlap && bottomToTop <= SNAP) next.y = other.y - next.height;
    if (xOverlap && topToBottom <= SNAP) next.y = other.y + other.height;
  });
  return next;
}

function toMeters(px: number) {
  return (px / GRID).toFixed(1);
}

function toConceptModel(nodes: SystemNode[], surveySystemType?: 'combi' | 'system' | 'regular' | 'heat_pump'): SystemConceptModel {
  const hasCombi = surveySystemType === 'combi' || nodes.some((n) => n.kind === 'heat_source_combi');
  const hasCylinder = nodes.some((n) => n.kind.includes('cylinder') || n.kind === 'dhw_mixergy');
  const hasRads = nodes.some((n) => n.kind === 'radiator_loop');
  return {
    heatSource: hasCombi ? 'system_boiler' : surveySystemType === 'heat_pump' ? 'heat_pump' : surveySystemType === 'regular' ? 'regular_boiler' : 'system_boiler',
    hotWaterService: hasCylinder ? 'unvented_cylinder' : 'combi_plate_hex',
    controls: nodes.some((n) => n.kind === 'zone_valve') ? 's_plan' : 'none',
    emitters: hasRads ? ['radiators'] : ['ufh'],
  };
}

export default function FloorPlanBuilder({ surveyResults, onChange }: Props = {}) {
  const [mode, setMode] = useState<StageMode>('plan');
  const [floors, setFloors] = useState<Floor[]>([{ id: 'floor_0', name: 'Ground' }]);
  const [activeFloorId, setActiveFloorId] = useState('floor_0');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [nodes, setNodes] = useState<SystemNode[]>([]);
  const [edges, setEdges] = useState<BuildEdge[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [isWallMode, setIsWallMode] = useState(false);
  const [pendingPort, setPendingPort] = useState<PortRef | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const visibleRooms = useMemo(() => rooms.filter((r) => r.floorId === activeFloorId), [rooms, activeFloorId]);
  const visibleWalls = useMemo(() => walls.filter((w) => w.floorId === activeFloorId), [walls, activeFloorId]);
  const visibleNodes = useMemo(() => nodes.filter((n) => n.floorId === activeFloorId), [nodes, activeFloorId]);

  function emit(next = { floors, rooms, walls, nodes, edges }) {
    onChange?.({ ...next, systemConcept: toConceptModel(next.nodes, surveyResults?.systemType) });
  }

  function floorGraph(floorId: string): BuildGraph {
    return {
      nodes: nodes.filter((n) => n.floorId === floorId),
      edges: edges.filter((e) => {
        const from = nodes.find((n) => n.id === e.from.nodeId);
        const to = nodes.find((n) => n.id === e.to.nodeId);
        return from?.floorId === floorId && to?.floorId === floorId;
      }),
    };
  }

  function addRoom() {
    const room: Room = {
      id: uid('room'),
      floorId: activeFloorId,
      name: `Room ${visibleRooms.length + 1}`,
      x: 80 + visibleRooms.length * 20,
      y: 80 + visibleRooms.length * 16,
      width: 180,
      height: 120,
    };
    const next = [...rooms, room];
    setRooms(next);
    setSelectedRoomId(room.id);
    emit({ floors, rooms: next, walls, nodes, edges });
  }

  function addFloor(clonePerimeter: boolean) {
    const id = uid('floor');
    const nextFloors = [...floors, { id, name: `Floor ${floors.length}` }];
    let nextRooms = rooms;
    let nextWalls = walls;

    if (clonePerimeter) {
      const floorRooms = rooms.filter((r) => r.floorId === activeFloorId);
      const floorWalls = walls.filter((w) => w.floorId === activeFloorId);
      nextRooms = [
        ...rooms,
        ...floorRooms.map((r) => ({ ...r, id: uid('room'), floorId: id })),
      ];
      nextWalls = [
        ...walls,
        ...floorWalls.map((w) => ({ ...w, id: uid('wall'), floorId: id })),
      ];
      setRooms(nextRooms);
      setWalls(nextWalls);
    }

    setFloors(nextFloors);
    setActiveFloorId(id);
    emit({ floors: nextFloors, rooms: nextRooms, walls: nextWalls, nodes, edges });
  }

  function addSystemNode(kind: PartKind) {
    const local = floorGraph(activeFloorId);
    const { nextGraph, placedNodeId } = smartAdd(local, kind);
    const mergedNodes = [
      ...nodes.filter((n) => n.floorId !== activeFloorId),
      ...nextGraph.nodes.map((n) => ({ ...n, floorId: activeFloorId })),
    ];
    const otherEdges = edges.filter((e) => {
      const from = nodes.find((n) => n.id === e.from.nodeId);
      const to = nodes.find((n) => n.id === e.to.nodeId);
      return !(from?.floorId === activeFloorId && to?.floorId === activeFloorId);
    });
    const nextEdges = [...otherEdges, ...nextGraph.edges];
    setNodes(mergedNodes);
    setEdges(nextEdges);
    setSelectedNodeId(placedNodeId);
    emit({ floors, rooms, walls, nodes: mergedNodes, edges: nextEdges });
  }

  function pointerPos(e: React.PointerEvent<HTMLDivElement>) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(CANVAS_W, e.clientX - rect.left)),
      y: Math.max(0, Math.min(CANVAS_H, e.clientY - rect.top)),
    };
  }

  function handleBoardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const pos = pointerPos(e);
    const state = dragRef.current;

    if (state.mode === 'room-move') {
      setRooms((current) => {
        const draft = current.map((room) => {
          if (room.id !== state.id) return room;
          return { ...room, x: pos.x - state.dx, y: pos.y - state.dy };
        });
        const moving = draft.find((r) => r.id === state.id);
        if (!moving) return current;
        const snapped = snapRoom(moving, draft.filter((r) => r.floorId === activeFloorId && r.id !== state.id));
        return draft.map((r) => (r.id === state.id ? snapped : r));
      });
    }

    if (state.mode === 'room-resize') {
      setRooms((current) =>
        current.map((room) => {
          if (room.id !== state.id) return room;
          return {
            ...room,
            width: Math.max(80, state.baseW + (pos.x - state.startX)),
            height: Math.max(60, state.baseH + (pos.y - state.startY)),
          };
        }),
      );
    }

    if (state.mode === 'node-move') {
      setNodes((current) =>
        current.map((node) => (node.id === state.id ? { ...node, x: pos.x - state.dx, y: pos.y - state.dy } : node)),
      );
    }
  }

  function handleBoardPointerUp() {
    dragRef.current = null;
    emit();
  }

  function startWallOrClear(e: React.PointerEvent<HTMLDivElement>) {
    if (!isWallMode || mode !== 'plan') return;
    const pos = pointerPos(e);
    if (!wallStart) {
      setWallStart(pos);
      return;
    }
    const next = [...walls, { id: uid('wall'), floorId: activeFloorId, x1: wallStart.x, y1: wallStart.y, x2: pos.x, y2: pos.y }];
    setWalls(next);
    setWallStart(null);
    emit({ floors, rooms, walls: next, nodes, edges });
  }

  function connectPorts(target: PortRef) {
    if (!pendingPort) {
      setPendingPort(target);
      return;
    }
    if (pendingPort.nodeId === target.nodeId && pendingPort.portId === target.portId) {
      setPendingPort(null);
      return;
    }
    const graph = floorGraph(activeFloorId);
    if (!isTopologyAllowed(graph, pendingPort, target)) {
      setPendingPort(null);
      return;
    }
    const edge: BuildEdge = { id: uid('edge'), from: pendingPort, to: target };
    const next = [...edges, edge];
    setEdges(next);
    setPendingPort(null);
    emit({ floors, rooms, walls, nodes, edges: next });
  }

  return (
    <div className="floor-builder">
      <header className="floor-builder__header">
        <h2>Property Builder</h2>
        <p>Stage 1: draw rooms and walls. Stage 2: place full Lego system nodes and connect ports.</p>
      </header>

      <div className="floor-builder__controls">
        <div className="floor-builder__mode">
          <button className={mode === 'plan' ? 'active' : ''} onClick={() => setMode('plan')}>Floor plan</button>
          <button className={mode === 'system' ? 'active' : ''} onClick={() => setMode('system')}>System builder</button>
        </div>
        <div className="floor-builder__floors">
          {floors.map((floor) => (
            <button key={floor.id} className={activeFloorId === floor.id ? 'active' : ''} onClick={() => setActiveFloorId(floor.id)}>
              {floor.name}
            </button>
          ))}
        </div>
      </div>

      <div className="floor-builder__layout">
        <aside className="floor-builder__tray" aria-label="Builder tray">
          <h3>Tray</h3>
          {ROOM_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                if (tool.id === 'add-room') addRoom();
                if (tool.id === 'draw-wall') setIsWallMode((v) => !v);
                if (tool.id === 'clone-floor') addFloor(true);
                if (tool.id === 'add-floor') addFloor(false);
              }}
              className={tool.id === 'draw-wall' && isWallMode ? 'active' : ''}
            >
              <span>{tool.icon}</span>
              {tool.label}
            </button>
          ))}

          <h4>System nodes</h4>
          <div className="floor-builder__node-list">
            {ALL_PALETTE_ITEMS.map((item) => (
              <button key={item.kind} onClick={() => addSystemNode(item.kind)}>
                <span>{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <div
          className="floor-builder__board"
          ref={boardRef}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onPointerCancel={handleBoardPointerUp}
          onPointerDown={startWallOrClear}
        >
          <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
            <defs>
              <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e2e8f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {visibleWalls.map((w) => (
              <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#0f172a" strokeWidth={4} />
            ))}
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from.nodeId && n.floorId === activeFloorId);
              const toNode = nodes.find((n) => n.id === edge.to.nodeId && n.floorId === activeFloorId);
              if (!fromNode || !toNode) return null;
              const from = portAbs(fromNode, edge.from.portId);
              const to = portAbs(toNode, edge.to.portId);
              return <polyline key={edge.id} points={`${from.x},${from.y} ${(from.x + to.x) / 2},${from.y} ${(from.x + to.x) / 2},${to.y} ${to.x},${to.y}`} fill="none" stroke="#64748b" strokeWidth={4} />;
            })}
          </svg>

          {visibleRooms.map((room) => (
            <div
              key={room.id}
              className={`floor-builder__room ${selectedRoomId === room.id ? 'selected' : ''}`}
              style={{ left: room.x, top: room.y, width: room.width, height: room.height }}
              onPointerDown={(e) => {
                if (mode !== 'plan') return;
                e.stopPropagation();
                setSelectedRoomId(room.id);
                const pos = pointerPos(e);
                dragRef.current = { mode: 'room-move', id: room.id, dx: pos.x - room.x, dy: pos.y - room.y };
              }}
            >
              <div className="label">{room.name}</div>
              <div className="measure">{toMeters(room.width)}m × {toMeters(room.height)}m</div>
              <div
                className="resize"
                onPointerDown={(e) => {
                  if (mode !== 'plan') return;
                  e.stopPropagation();
                  const pos = pointerPos(e as unknown as React.PointerEvent<HTMLDivElement>);
                  dragRef.current = {
                    mode: 'room-resize',
                    id: room.id,
                    startX: pos.x,
                    startY: pos.y,
                    baseW: room.width,
                    baseH: room.height,
                  };
                }}
              />
            </div>
          ))}

          {visibleNodes.map((node) => {
            const selected = selectedNodeId === node.id;
            return (
              <div
                key={node.id}
                className={`floor-builder__node ${selected ? 'selected' : ''}`}
                style={{ left: node.x - 68, top: node.y - 30 }}
                onPointerDown={(e) => {
                  if (mode !== 'system') return;
                  e.stopPropagation();
                  const pos = pointerPos(e);
                  dragRef.current = { mode: 'node-move', id: node.id, dx: pos.x - node.x, dy: pos.y - node.y };
                  setSelectedNodeId(node.id);
                }}
              >
                <div>{node.kind.replaceAll('_', ' ')}</div>
                {getPortDefs(node.kind).map((port) => (
                  <button
                    key={port.id}
                    className={`port ${pendingPort?.nodeId === node.id && pendingPort.portId === port.id ? 'pending' : ''}`}
                    style={{ left: port.dx + 68 - 5, top: port.dy + 30 - 5 }}
                    onClick={(e) => {
                      if (mode !== 'system') return;
                      e.stopPropagation();
                      connectPorts({ nodeId: node.id, portId: port.id });
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
