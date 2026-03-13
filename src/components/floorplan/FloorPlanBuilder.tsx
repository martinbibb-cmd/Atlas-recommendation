import { useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import { routePipeAligned } from '../../explainers/lego/builder/router';
import type { StructuralZone } from '../../explainers/lego/builder/schematicBlocks';
import type { SystemConceptModel } from '../../explainers/lego/model/types';
import './floorplan.css';

type TemplateId = 'terrace' | 'semi';
type FloorId = 0 | 1;

type Room = {
  id: string;
  label: string;
  floorId: FloorId;
  x: number;
  y: number;
  width: number;
  height: number;
  zone?: StructuralZone;
};

type PlacedComponent = {
  id: string;
  kind: string;
  icon: string;
  label: string;
  floorId: FloorId;
  x: number;
  y: number;
  riserId?: string;
};

type Pipe = {
  id: string;
  floorId: FloorId;
  fromId: string;
  toId: string;
};

type PaletteItem = {
  kind: string;
  icon: string;
  label: string;
  requiredZone?: StructuralZone;
};

const PALETTE_ITEMS: PaletteItem[] = [
  { kind: 'boiler', icon: '🔥', label: 'Boiler', requiredZone: 'plant_room' },
  { kind: 'cylinder', icon: '🛢️', label: 'Cylinder', requiredZone: 'airing_cupboard' },
  { kind: 'radiator', icon: '♨️', label: 'Radiator' },
  { kind: 'pump', icon: '⚙️', label: 'Pump' },
  { kind: 'riser', icon: '↕️', label: 'Riser' },
];

const TEMPLATES: Record<TemplateId, { label: string; rooms: Room[] }> = {
  terrace: {
    label: 'Terrace',
    rooms: [
      { id: 'g-kitchen', label: 'Kitchen', floorId: 0, x: 20, y: 220, width: 140, height: 110, zone: 'plant_room' },
      { id: 'g-lounge', label: 'Lounge', floorId: 0, x: 170, y: 220, width: 150, height: 110 },
      { id: 'f-bed', label: 'Bedroom', floorId: 1, x: 20, y: 30, width: 140, height: 120 },
      { id: 'f-bath', label: 'Bathroom', floorId: 1, x: 170, y: 30, width: 150, height: 120, zone: 'airing_cupboard' },
    ],
  },
  semi: {
    label: 'Semi',
    rooms: [
      { id: 'g-kitchen', label: 'Kitchen', floorId: 0, x: 20, y: 220, width: 140, height: 110, zone: 'plant_room' },
      { id: 'g-hall', label: 'Hall', floorId: 0, x: 170, y: 220, width: 150, height: 110 },
      { id: 'f-bed', label: 'Bedroom', floorId: 1, x: 20, y: 30, width: 140, height: 120 },
      { id: 'f-airing', label: 'Airing', floorId: 1, x: 170, y: 30, width: 150, height: 120, zone: 'airing_cupboard' },
    ],
  },
};

type DrawState = { x: number; y: number; floorId: FloorId };

export interface FloorPlanOutput {
  template: TemplateId;
  rooms: Room[];
  components: PlacedComponent[];
  pipes: Pipe[];
  systemConcept: SystemConceptModel;
}

interface Props {
  surveyResults?: { systemType?: 'combi' | 'system' | 'regular' | 'heat_pump' };
  onChange?: (output: FloorPlanOutput) => void;
}

function toConceptModel(components: PlacedComponent[]): SystemConceptModel {
  const hasBoiler = components.some((c) => c.kind === 'boiler');
  const hasCylinder = components.some((c) => c.kind === 'cylinder');
  const hasRad = components.some((c) => c.kind === 'radiator');
  return {
    heatSource: hasBoiler ? 'system_boiler' : 'heat_pump',
    hotWaterService: hasCylinder ? 'unvented_cylinder' : 'combi_plate_hex',
    controls: hasCylinder ? 's_plan' : 'none',
    emitters: hasRad ? ['radiators'] : ['ufh'],
  };
}

function inferDomain(fromKind: string, toKind: string): 'primary' | 'heating' {
  if (fromKind === 'boiler' && toKind === 'radiator') return 'primary';
  return 'heating';
}

export default function FloorPlanBuilder({ surveyResults, onChange }: Props = {}) {
  const [template, setTemplate] = useState<TemplateId>('terrace');
  const [floorId, setFloorId] = useState<FloorId>(0);
  const [rooms, setRooms] = useState<Room[]>(TEMPLATES.terrace.rooms);
  const [components, setComponents] = useState<PlacedComponent[]>([]);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [pendingPipeFrom, setPendingPipeFrom] = useState<string | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const idRef = useRef(0);

  const visibleRooms = useMemo(() => rooms.filter((r) => r.floorId === floorId), [rooms, floorId]);
  const visibleComponents = useMemo(() => components.filter((c) => c.floorId === floorId), [components, floorId]);

  function emit(nextComponents = components, nextRooms = rooms, nextPipes = pipes) {
    onChange?.({
      template,
      rooms: nextRooms,
      components: nextComponents,
      pipes: nextPipes,
      systemConcept: toConceptModel(nextComponents),
    });
  }

  function setTemplateAndReset(next: TemplateId) {
    setTemplate(next);
    setRooms(TEMPLATES[next].rooms);
    setComponents([]);
    setPipes([]);
    setFloorId(0);
  }

  function addComponent(item: PaletteItem) {
    const allowedBySurvey = surveyResults?.systemType !== 'system' || item.kind !== 'heat_pump';
    if (!allowedBySurvey) return;

    const roomForZone = item.requiredZone
      ? rooms.find((r) => r.floorId === floorId && r.zone === item.requiredZone)
      : undefined;

    const x = roomForZone ? roomForZone.x + roomForZone.width / 2 : 80 + (visibleComponents.length % 4) * 60;
    const y = roomForZone ? roomForZone.y + roomForZone.height / 2 : 80;
    const id = `cmp-${idRef.current++}`;

    if (item.kind === 'riser') {
      const riserId = `riser-${id}`;
      const twinFloor: FloorId = floorId === 0 ? 1 : 0;
      const next: PlacedComponent[] = [
        ...components,
        { id, kind: item.kind, icon: item.icon, label: item.label, floorId, x, y, riserId },
        { id: `cmp-${idRef.current++}`, kind: item.kind, icon: item.icon, label: item.label, floorId: twinFloor, x, y, riserId },
      ];
      setComponents(next);
      emit(next);
      return;
    }

    const next = [...components, { id, kind: item.kind, icon: item.icon, label: item.label, floorId, x, y }];
    setComponents(next);
    emit(next);
  }

  function onStageMouseDown() {
    if (!drawMode) return;
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    setDrawState({ x: pos.x, y: pos.y, floorId });
  }

  function onStageMouseUp() {
    if (!drawState) return;
    const pos = stageRef.current?.getPointerPosition();
    if (!pos || drawState.floorId !== floorId) {
      setDrawState(null);
      return;
    }
    const width = Math.abs(pos.x - drawState.x);
    const height = Math.abs(pos.y - drawState.y);
    if (width < 20 || height < 20) {
      setDrawState(null);
      return;
    }
    const room: Room = {
      id: `room-${idRef.current++}`,
      label: `Room ${rooms.length + 1}`,
      floorId,
      x: Math.min(pos.x, drawState.x),
      y: Math.min(pos.y, drawState.y),
      width,
      height,
    };
    const next = [...rooms, room];
    setRooms(next);
    setDrawState(null);
    emit(components, next, pipes);
  }

  function connectPipe(targetId: string) {
    if (!pendingPipeFrom || pendingPipeFrom === targetId) {
      setPendingPipeFrom(targetId);
      return;
    }
    const from = components.find((c) => c.id === pendingPipeFrom);
    const to = components.find((c) => c.id === targetId);
    if (!from || !to || from.floorId !== to.floorId) {
      setPendingPipeFrom(null);
      return;
    }

    const nextPipe: Pipe = { id: `pipe-${idRef.current++}`, floorId: from.floorId, fromId: from.id, toId: to.id };
    const next = [...pipes, nextPipe];

    if (from.kind === 'riser' || to.kind === 'riser') {
      const riser = from.kind === 'riser' ? from : to;
      const twin = components.find((c) => c.riserId && c.riserId === riser.riserId && c.id !== riser.id);
      const other = from.kind === 'riser' ? to : from;
      if (twin) {
        next.push({
          id: `pipe-${idRef.current++}`,
          floorId: twin.floorId,
          fromId: twin.id,
          toId: other.id,
        });
      }
    }

    setPipes(next);
    setPendingPipeFrom(null);
    emit(components, rooms, next);
  }

  return (
    <div className="floor-plan">
      <h2 className="floor-plan__title">Floor Plan Builder</h2>
      <div className="floor-plan__templates">
        {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
          <button key={id} className="floor-plan__template-btn" onClick={() => setTemplateAndReset(id)}>{TEMPLATES[id].label}</button>
        ))}
        <button className="floor-plan__template-btn" onClick={() => setDrawMode((v) => !v)}>{drawMode ? 'Stop Draw Room' : 'Draw Room'}</button>
      </div>

      <div className="floor-plan__floor-switcher">
        <button className="floor-plan__floor-btn" onClick={() => setFloorId(0)}>Ground</button>
        <button className="floor-plan__floor-btn" onClick={() => setFloorId(1)}>First</button>
      </div>

      <div className="floor-plan__body">
        <div className="floor-plan__palette">
          {PALETTE_ITEMS.filter((item) => (surveyResults?.systemType === 'combi' ? item.kind !== 'cylinder' : true)).map((item) => (
            <button key={item.kind} className="floor-plan__palette-item" onClick={() => addComponent(item)}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>

        <Stage ref={stageRef} width={340} height={360} onMouseDown={onStageMouseDown} onMouseUp={onStageMouseUp} style={{ border: '1px solid #cbd5e0', borderRadius: 8 }}>
          <Layer>
            {visibleRooms.map((room) => (
              <Group key={room.id}>
                <Rect x={room.x} y={room.y} width={room.width} height={room.height} stroke="#4a5568" strokeWidth={2} fillEnabled={false} />
                <Text x={room.x + 5} y={room.y + 5} text={room.label} fontSize={11} />
              </Group>
            ))}

            {pipes.filter((p) => p.floorId === floorId).map((pipe) => {
              const from = components.find((c) => c.id === pipe.fromId);
              const to = components.find((c) => c.id === pipe.toId);
              if (!from || !to) return null;
              const roomScope = rooms.filter((r) => r.floorId === floorId).map((r) => ({
                x: r.x,
                y: r.y,
                w: r.width,
                h: r.height,
                label: r.label,
              }));
              const points = routePipeAligned({ x: from.x, y: from.y }, { x: to.x, y: to.y }, roomScope)
                .split(' ')
                .flatMap((pair) => pair.split(',').map(Number));
              const domain = inferDomain(from.kind, to.kind);
              return <Line key={pipe.id} points={points} stroke={domain === 'primary' ? '#2563eb' : '#16a34a'} strokeWidth={3} />;
            })}

            {visibleComponents.map((comp) => (
              <Group
                key={comp.id}
                x={comp.x - 14}
                y={comp.y - 12}
                draggable
                onClick={() => connectPipe(comp.id)}
                onDragEnd={(e) => {
                  const next = components.map((c) => (c.id === comp.id ? { ...c, x: e.target.x() + 14, y: e.target.y() + 12 } : c));
                  setComponents(next);
                  emit(next);
                }}
              >
                <Rect width={28} height={24} fill={pendingPipeFrom === comp.id ? '#c7d2fe' : '#e2e8f0'} stroke="#334155" cornerRadius={4} />
                <Text text={comp.icon} x={6} y={4} fontSize={14} />
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
