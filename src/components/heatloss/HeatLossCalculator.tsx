/**
 * HeatLossCalculator — canvas-based whole-house heat loss sketch tool.
 *
 * Ported from https://github.com/martinbibb-cmd/Quick-heat-loss
 *
 * Calculation method (simplified shell model):
 *   Fabric heat loss  = Σ (area × U-value) × ΔT
 *   Ventilation loss  = volume × ACH × 0.33 × ΔT
 *   Design ΔT = 20 °C (indoor 21 °C / outdoor 1 °C)
 *   ACH = 0.75 (typical UK existing dwelling)
 *
 * Layers:
 *   Drawings are organised into named layers — each with its own polygon,
 *   colour, kind (original / extension / upper_floor / reference), and
 *   visibility flag.  The heat-loss calculation runs on the active layer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import './heatloss.css';

// ── U-values (W/m²K) ─────────────────────────────────────────────────────────

const U_WALL: Record<string, number> = {
  solidBrick:        2.1,
  cavityUninsulated: 2.1,  // treated as high heat-loss band — same as solid masonry (per project physics rules)
  cavityPartialFill: 0.5,
  cavityFullFill:    0.28,
  timberFrame:       0.25,
  solidStone:        1.7,
};

const U_LOFT: Record<string, number> = {
  none:      2.3,
  mm100:     0.35,
  mm200:     0.18,
  mm270plus: 0.13,
};

const U_GLAZING: Record<string, number> = {
  single:       4.8,
  doubleOld:    2.8,
  doubleArated: 1.4,
  triple:       0.8,
};

const U_FLOOR: Record<string, number> = {
  solidUninsulated:     0.70,
  suspendedUninsulated: 0.80,
  insulated:            0.20,
};

const GLAZING_FRACTION: Record<string, number> = { low: 0.12, medium: 0.18, high: 0.25 };
const PARTY_WALL_FACTOR = 0.1;
const DELTA_T = 20;
const ACH = 0.75;
const SNAP = 0.5;
const CLOSE_PX = 14;

// ── Layer constants ───────────────────────────────────────────────────────────

type LayerKind = 'original' | 'extension' | 'upper_floor' | 'reference';

const LAYER_COLOURS: Record<LayerKind, string> = {
  original:    '#1a56db',
  extension:   '#059669',
  upper_floor: '#7c3aed',
  reference:   '#9ca3af',
};

const FLOOR_ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

let _layerCounter = 0;
function generateLayerId(): string {
  return 'layer-' + (++_layerCounter).toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }
interface Edge  { isPartyWall: boolean; }

interface Layer {
  id:      string;
  name:    string;
  kind:    LayerKind;
  visible: boolean;
  points:  Point[];
  closed:  boolean;
  edges:   Edge[];
}

interface HeatLossResult {
  floorArea:   number;
  perimeter:   number;
  netWallArea: number;
  glazingArea: number;
  roofArea:    number;
  volume:      number;
  wallHL:      number;
  glazingHL:   number;
  roofHL:      number;
  floorHL:     number;
  ventHL:      number;
  totalHL:     number;
}

/** View/interaction state — pan, zoom, hover, drag. No polygon data. */
interface ViewState {
  scale:         number;
  panX:          number;
  panY:          number;
  hoverPt:       Point | null;
  isPanning:     boolean;
  lastPointer:   Point | null;
  dragIndex:     number;
  lastPinchDist:   number | null;
  lastPinchCenter: Point | null;
}

interface Settings {
  storeys:        number;
  ceilingHeight:  number;
  dwellingType:   'detached' | 'semi' | 'endTerrace' | 'midTerrace';
  wallType:       string;
  loftInsulation: string;
  glazingType:    string;
  glazingAmount:  string;
  floorType:      string;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function polygonArea(pts: Point[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function polygonPerimeter(pts: Point[]): number {
  let p = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
  }
  return p;
}

function round(v: number, dp: number): number {
  const m = Math.pow(10, dp);
  return Math.round(v * m) / m;
}

function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ── Heat loss calculation ─────────────────────────────────────────────────────

function calculateHeatLoss(layer: Layer, settings: Settings): HeatLossResult | null {
  // Reference layers are for visual context only — not included in calculation.
  if (!layer.closed || layer.points.length < 3 || layer.kind === 'reference') return null;

  const pts           = layer.points;
  const floorArea     = polygonArea(pts);
  const perimeter     = polygonPerimeter(pts);
  const totalHeight   = settings.storeys * settings.ceilingHeight;
  const volume        = floorArea * totalHeight;

  let exposedPerimeter = 0;
  let partyPerimeter   = 0;
  layer.edges.forEach((edge, i) => {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (edge.isPartyWall) partyPerimeter += len;
    else exposedPerimeter += len;
  });

  const grossWallArea = exposedPerimeter * totalHeight;
  const glazingFrac   = GLAZING_FRACTION[settings.glazingAmount] ?? 0.18;
  const glazingArea   = grossWallArea * glazingFrac;
  const netWallArea   = grossWallArea - glazingArea;
  const roofArea      = floorArea;

  const uWall    = U_WALL[settings.wallType]    ?? 2.1;
  const uLoft    = U_LOFT[settings.loftInsulation] ?? 0.13;
  const uGlazing = U_GLAZING[settings.glazingType] ?? 1.4;
  const uFloor   = U_FLOOR[settings.floorType]  ?? 0.8;

  const partyWallArea = partyPerimeter * totalHeight;
  const wallHL    = (netWallArea * uWall + partyWallArea * uWall * PARTY_WALL_FACTOR) * DELTA_T;
  const glazingHL = glazingArea * uGlazing * DELTA_T;
  const roofHL    = roofArea    * uLoft    * DELTA_T;
  const floorHL   = floorArea   * uFloor   * DELTA_T;
  const ventHL    = volume * ACH * 0.33 * DELTA_T;
  const totalHL   = wallHL + glazingHL + roofHL + floorHL + ventHL;

  return {
    floorArea:   round(floorArea,   1),
    perimeter:   round(perimeter,   1),
    netWallArea: round(netWallArea, 1),
    glazingArea: round(glazingArea, 1),
    roofArea:    round(roofArea,    1),
    volume:      round(volume,      0),
    wallHL:      round(wallHL    / 1000, 2),
    glazingHL:   round(glazingHL / 1000, 2),
    roofHL:      round(roofHL    / 1000, 2),
    floorHL:     round(floorHL   / 1000, 2),
    ventHL:      round(ventHL    / 1000, 2),
    totalHL:     round(totalHL   / 1000, 1),
  };
}

// ── Party wall auto-assignment ────────────────────────────────────────────────

function applyDefaultExposure(pts: Point[], edges: Edge[], dwellingType: string): void {
  edges.forEach(e => { e.isPartyWall = false; });
  if (dwellingType === 'detached') return;

  const sorted = edges
    .map((_, i) => {
      const j = (i + 1) % pts.length;
      return { i, length: Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) };
    })
    .sort((a, b) => b.length - a.length);

  if (dwellingType === 'semi' || dwellingType === 'endTerrace') {
    edges[sorted[0].i].isPartyWall = true;
  } else if (dwellingType === 'midTerrace') {
    edges[sorted[0].i].isPartyWall = true;
    if (sorted.length > 1) edges[sorted[1].i].isPartyWall = true;
  }
}

// ── Canvas rendering helpers ──────────────────────────────────────────────────

function w2c(mx: number, my: number, scale: number, panX: number, panY: number) {
  return { x: (mx - panX) * scale, y: (my - panY) * scale };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderCanvas(
  canvas: HTMLCanvasElement,
  vs: ViewState,
  layers: Layer[],
  activeLayerId: string,
): void {
  const ctxOrNull  = canvas.getContext('2d');
  if (!ctxOrNull) return;
  const ctx: CanvasRenderingContext2D = ctxOrNull;
  const dpr  = window.devicePixelRatio || 1;
  const cssW = canvas.offsetWidth;
  const cssH = canvas.offsetHeight;

  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const { scale, panX, panY, hoverPt } = vs;
  ctx.clearRect(0, 0, cssW, cssH);

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, cssW, cssH);

  // ── Grid ──────────────────────────────────────────────────────────────────
  const minX = panX, minY = panY;
  const maxX = minX + cssW / scale, maxY = minY + cssH / scale;

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  for (let x = Math.floor(minX); x <= maxX; x++) {
    const px = (x - panX) * scale;
    ctx.moveTo(px, 0); ctx.lineTo(px, cssH);
  }
  for (let y = Math.floor(minY); y <= maxY; y++) {
    const py = (y - panY) * scale;
    ctx.moveTo(0, py); ctx.lineTo(cssW, py);
  }
  ctx.stroke();

  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  const x0 = Math.floor(minX / 5) * 5, y0 = Math.floor(minY / 5) * 5;
  for (let x = x0; x <= maxX; x += 5) {
    const px = (x - panX) * scale;
    ctx.moveTo(px, 0); ctx.lineTo(px, cssH);
  }
  for (let y = y0; y <= maxY; y += 5) {
    const py = (y - panY) * scale;
    ctx.moveTo(0, py); ctx.lineTo(cssW, py);
  }
  ctx.stroke();

  ctx.fillStyle    = '#9ca3af';
  ctx.font         = '10px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'center';
  for (let x = x0; x <= maxX; x += 5) {
    if (x === 0) continue;
    const px = (x - panX) * scale;
    if (px > 30 && px < cssW - 10) ctx.fillText(x + ' m', px, 4);
  }
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  for (let y = y0; y <= maxY; y += 5) {
    if (y === 0) continue;
    const py = (y - panY) * scale;
    if (py > 14 && py < cssH - 10) ctx.fillText(y + ' m', 28, py);
  }

  // ── Draw all layers ───────────────────────────────────────────────────────
  // Render inactive visible layers behind active layer, then active on top.
  const activeLayer = layers.find(l => l.id === activeLayerId) ?? null;

  function drawLayerPolygon(layer: Layer, isActive: boolean) {
    const pts = layer.points;
    if (pts.length < 2) return;

    const colour      = LAYER_COLOURS[layer.kind] ?? '#1a56db';
    const isRef       = layer.kind === 'reference';
    const strokeAlpha = isActive ? 1 : 0.3;
    const fillAlpha   = isActive ? (isRef ? 0.04 : 0.10) : 0.04;

    if (layer.closed) {
      // Fill
      ctx.beginPath();
      const s = w2c(pts[0].x, pts[0].y, scale, panX, panY);
      ctx.moveTo(s.x, s.y);
      for (let i = 1; i < pts.length; i++) {
        const p = w2c(pts[i].x, pts[i].y, scale, panX, panY);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colour, fillAlpha);
      ctx.fill();

      // Edges
      for (let i = 0; i < pts.length; i++) {
        const a = w2c(pts[i].x, pts[i].y, scale, panX, panY);
        const b = w2c(pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y, scale, panX, panY);
        const isParty = layer.edges[i]?.isPartyWall ?? false;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (isRef) {
          ctx.strokeStyle = hexToRgba(colour, strokeAlpha * 0.7);
          ctx.setLineDash([8, 5]);
        } else if (isParty) {
          ctx.strokeStyle = `rgba(136,136,136,${strokeAlpha})`;
          ctx.setLineDash([6, 4]);
        } else {
          ctx.strokeStyle = hexToRgba(colour, strokeAlpha);
          ctx.setLineDash([]);
        }
        ctx.lineWidth = isActive ? 2.5 : 1.5;
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Edge length labels on active closed layer
      if (isActive) {
        ctx.font        = '11px system-ui, sans-serif';
        ctx.textBaseline = 'alphabetic';
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len < 0.4) continue;
          const ca = w2c(a.x, a.y, scale, panX, panY);
          const cb = w2c(b.x, b.y, scale, panX, panY);
          const mx = (ca.x + cb.x) / 2, my = (ca.y + cb.y) / 2;
          let angle = Math.atan2(cb.y - ca.y, cb.x - ca.x);
          if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(angle);
          const text = len.toFixed(1) + ' m';
          const tw   = ctx.measureText(text).width;
          ctx.fillStyle = 'rgba(255,255,255,0.82)';
          ctx.fillRect(-tw / 2 - 3, -14, tw + 6, 14);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#475569';
          ctx.fillText(text, 0, -2);
          ctx.restore();
        }
      }
    } else if (isActive) {
      // Open polygon preview
      ctx.beginPath();
      const s0 = w2c(pts[0].x, pts[0].y, scale, panX, panY);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = w2c(pts[i].x, pts[i].y, scale, panX, panY);
        ctx.lineTo(p.x, p.y);
      }
      if (hoverPt) {
        const hp = w2c(hoverPt.x, hoverPt.y, scale, panX, panY);
        ctx.lineTo(hp.x, hp.y);
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth   = 2;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Vertices (only for active layer)
    if (isActive) {
      pts.forEach((pt, i) => {
        const cp = w2c(pt.x, pt.y, scale, panX, panY);
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2);
        ctx.fillStyle   = i === 0 && !layer.closed ? '#10b981' : colour;
        ctx.strokeStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  }

  // Inactive layers first
  layers.forEach(layer => {
    if (!layer.visible || layer.id === activeLayerId) return;
    drawLayerPolygon(layer, false);
  });
  // Active layer on top
  if (activeLayer?.visible) {
    drawLayerPolygon(activeLayer, true);
  }

  // ── Cursor snap dot ───────────────────────────────────────────────────────
  if (activeLayer && !activeLayer.closed && hoverPt) {
    const cp = w2c(hoverPt.x, hoverPt.y, scale, panX, panY);
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(26, 86, 219, 0.35)';
    ctx.fill();

    const label = `${hoverPt.x.toFixed(1)}, ${hoverPt.y.toFixed(1)} m`;
    ctx.font        = '11px system-ui, sans-serif';
    ctx.textAlign   = 'left';
    ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(label).width;
    let lx = cp.x + 12, ly = cp.y - 8;
    if (lx + tw > cssW - 6) lx = cp.x - tw - 12;
    if (ly < 14) ly = cp.y + 18;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(lx - 2, ly - 11, tw + 4, 14);
    ctx.fillStyle = '#1e293b';
    ctx.fillText(label, lx, ly);
  }

  // ── Scale bar ─────────────────────────────────────────────────────────────
  const barM  = 5;
  const barPx = barM * scale;
  if (barPx >= 30 && barPx <= cssW * 0.4) {
    const bx = cssW - barPx - 18;
    const by = cssH - 16;
    ctx.strokeStyle = '#374151';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by);
    ctx.moveTo(bx, by - 5); ctx.lineTo(bx, by + 5);
    ctx.moveTo(bx + barPx, by - 5); ctx.lineTo(bx + barPx, by + 5);
    ctx.stroke();
    ctx.fillStyle    = '#374151';
    ctx.font         = '11px system-ui, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('5 m', bx + barPx / 2, by - 8);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  /** When provided, a "Use this value" button appears in the results panel.
   *  Receives the calculated totalHL in kW. */
  onComplete?: (totalHL: number) => void;
}

function makeLayer(name: string, kind: LayerKind): Layer {
  return { id: generateLayerId(), name, kind, visible: true, points: [], closed: false, edges: [] };
}

export default function HeatLossCalculator({ onBack, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // View/interaction state (pan, zoom, hover, drag) — no polygon data.
  const vsRef = useRef<ViewState>({
    scale:           40,
    panX:            -2,
    panY:            -2,
    hoverPt:         null,
    isPanning:       false,
    lastPointer:     null,
    dragIndex:       -1,
    lastPinchDist:   null,
    lastPinchCenter: null,
  });

  // Compute initial layer data once — lazy useState ensures the layer
  // (and its id) are created only on mount, and re-used by both the
  // mutable ref and the rendered state without accessing .current during render.
  const [initialLayerData] = useState<{ layers: Layer[]; activeId: string }>(() => {
    const layer = makeLayer('Original footprint', 'original');
    return { layers: [layer], activeId: layer.id };
  });

  // Mutable ref for all layers — used by canvas event handlers without
  // triggering re-renders.  Initialised from `initialLayerData.layers`.
  const layersRef = useRef<Layer[]>(initialLayerData.layers);
  // Mutable ref for the active layer ID.
  const activeLayerIdRef = useRef<string>(initialLayerData.activeId);

  const [settings, setSettings] = useState<Settings>({
    storeys:        2,
    ceilingHeight:  2.4,
    dwellingType:   'semi',
    wallType:       'cavityUninsulated',
    loftInsulation: 'mm270plus',
    glazingType:    'doubleArated',
    glazingAmount:  'medium',
    floorType:      'suspendedUninsulated',
  });

  // Layer panel UI state (mirrors layersRef for rendering).
  const [layers, setLayers] = useState<Layer[]>(initialLayerData.layers);
  const [activeLayerId, setActiveLayerId] = useState<string>(initialLayerData.activeId);

  // Reactive hint + result derived from drawing state
  const [hint, setHint]     = useState<string>('Click to place first corner point');
  const [result, setResult] = useState<HeatLossResult | null>(null);
  const [closed, setClosed] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  /** Returns the currently active layer. */
  const getActiveLayer = useCallback((): Layer | null => {
    return layersRef.current.find(l => l.id === activeLayerIdRef.current) ?? null;
  }, []);

  /** Sync layer array to React state so the layer panel re-renders. */
  const syncLayers = useCallback(() => {
    setLayers([...layersRef.current]);
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCanvas(canvas, vsRef.current, layersRef.current, activeLayerIdRef.current);
  }, []);

  const refreshResults = useCallback(() => {
    const layer = getActiveLayer();
    const res = layer ? calculateHeatLoss(layer, settingsRef.current) : null;
    setResult(res);

    const active = layer;
    const closed_ = active?.closed ?? false;
    const pts     = active?.points ?? [];
    setClosed(closed_);
    setPointCount(pts.length);

    if (!active) {
      setHint('Select or create a layer to start drawing');
    } else if (closed_) {
      setHint('Click or tap walls to mark as party walls · Drag corners to adjust');
    } else if (pts.length === 0) {
      setHint('Click to place first corner point');
    } else if (pts.length < 3) {
      setHint(`${pts.length} point${pts.length > 1 ? 's' : ''} — keep clicking to add corners`);
    } else {
      setHint('Click the green point to close, or press Close Shape');
    }
  }, [getActiveLayer]);

  // Recompute results whenever settings change
  useEffect(() => {
    refreshResults();
    repaint();
  }, [settings, refreshResults, repaint]);

  // ── Canvas resize ──────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => repaint());
    observer.observe(canvas.parentElement ?? canvas);
    repaint();
    return () => observer.disconnect();
  }, [repaint]);

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  const client2world = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const { scale, panX, panY } = vsRef.current;
    return {
      x: (clientX - rect.left)  / scale + panX,
      y: (clientY - rect.top)   / scale + panY,
    };
  }, []);

  const snapPt = (wx: number, wy: number): Point => ({
    x: Math.round(wx / SNAP) * SNAP,
    y: Math.round(wy / SNAP) * SNAP,
  });

  const pixelDistToPoint = useCallback((clientX: number, clientY: number, idx: number): number => {
    const layer = getActiveLayer();
    if (!layer) return Infinity;
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const { scale, panX, panY } = vsRef.current;
    const cp = {
      x: (layer.points[idx].x - panX) * scale,
      y: (layer.points[idx].y - panY) * scale,
    };
    return Math.hypot(clientX - rect.left - cp.x, clientY - rect.top - cp.y);
  }, [getActiveLayer]);

  const getEdgeAtClient = useCallback((clientX: number, clientY: number): number => {
    const layer = getActiveLayer();
    if (!layer?.closed) return -1;
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const cx = clientX - rect.left, cy = clientY - rect.top;
    const { scale, panX, panY } = vsRef.current;
    const pts = layer.points;
    let best = -1, bestDist = 12;
    for (let i = 0; i < pts.length; i++) {
      const a = { x: (pts[i].x - panX) * scale, y: (pts[i].y - panY) * scale };
      const b = { x: (pts[(i + 1) % pts.length].x - panX) * scale, y: (pts[(i + 1) % pts.length].y - panY) * scale };
      const d = pointToSegmentDist(cx, cy, a.x, a.y, b.x, b.y);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }, [getActiveLayer]);

  // ── Polygon operations ─────────────────────────────────────────────────────

  const closePolygon = useCallback(() => {
    const layer = getActiveLayer();
    if (!layer || layer.points.length < 3) return;
    layer.edges  = layer.points.map(() => ({ isPartyWall: false }));
    applyDefaultExposure(layer.points, layer.edges, settingsRef.current.dwellingType);
    layer.closed  = true;
    vsRef.current.hoverPt = null;
    refreshResults();
    syncLayers();
    repaint();
  }, [getActiveLayer, refreshResults, syncLayers, repaint]);

  const undoLastPoint = useCallback(() => {
    const layer = getActiveLayer();
    if (!layer) return;
    if (layer.closed) {
      layer.closed = false;
      layer.edges  = [];
      refreshResults();
    } else if (layer.points.length > 0) {
      layer.points.pop();
    }
    refreshResults();
    syncLayers();
    repaint();
  }, [getActiveLayer, refreshResults, syncLayers, repaint]);

  const clearAll = useCallback(() => {
    const layer = getActiveLayer();
    if (layer) {
      layer.points    = [];
      layer.closed    = false;
      layer.edges     = [];
    }
    vsRef.current.hoverPt   = null;
    vsRef.current.dragIndex = -1;
    refreshResults();
    syncLayers();
    repaint();
  }, [getActiveLayer, refreshResults, syncLayers, repaint]);

  const fitToView = useCallback(() => {
    const vs     = vsRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.offsetWidth;
    const cssH = canvas.offsetHeight;
    const allPts = layersRef.current
      .filter(l => l.visible)
      .flatMap(l => l.points);
    if (allPts.length === 0) {
      vs.scale = 40; vs.panX = -2; vs.panY = -2;
      repaint(); return;
    }
    const xs = allPts.map(p => p.x), ys = allPts.map(p => p.y);
    const minX = Math.min(...xs) - 2, maxX = Math.max(...xs) + 2;
    const minY = Math.min(...ys) - 2, maxY = Math.max(...ys) + 2;
    const scX  = cssW / (maxX - minX), scY = cssH / (maxY - minY);
    vs.scale   = Math.min(scX, scY, 100);
    vs.panX    = minX; vs.panY = minY;
    repaint();
  }, [repaint]);

  // ── Layer management ───────────────────────────────────────────────────────

  const selectLayer = useCallback((id: string) => {
    activeLayerIdRef.current = id;
    vsRef.current.hoverPt   = null;
    vsRef.current.dragIndex = -1;
    setActiveLayerId(id);
    refreshResults();
    repaint();
  }, [refreshResults, repaint]);

  const addLayer = useCallback((kind: LayerKind = 'extension') => {
    const existingOfKind = layersRef.current.filter(l => l.kind === kind).length;
    let name: string;
    if (kind === 'extension') {
      name = `Extension ${existingOfKind + 1}`;
    } else if (kind === 'upper_floor') {
      const ordinal = FLOOR_ORDINALS[existingOfKind] ?? `Floor ${existingOfKind + 1}`;
      name = `${ordinal} floor`;
    } else if (kind === 'reference') {
      name = existingOfKind === 0 ? 'Reference outline' : `Reference ${existingOfKind + 1}`;
    } else {
      name = 'Original footprint';
    }
    const newLayer = makeLayer(name, kind);
    layersRef.current = [...layersRef.current, newLayer];
    selectLayer(newLayer.id);
  }, [selectLayer]);

  const removeLayer = useCallback((id: string) => {
    if (layersRef.current.length <= 1) return;
    const idx = layersRef.current.findIndex(l => l.id === id);
    if (idx < 0) return;
    layersRef.current = layersRef.current.filter(l => l.id !== id);
    if (activeLayerIdRef.current === id) {
      selectLayer(layersRef.current[Math.max(0, idx - 1)].id);
    } else {
      syncLayers();
      refreshResults();
      repaint();
    }
  }, [selectLayer, syncLayers, refreshResults, repaint]);

  const toggleLayerVisibility = useCallback((id: string) => {
    const layer = layersRef.current.find(l => l.id === id);
    if (layer) layer.visible = !layer.visible;
    syncLayers();
    repaint();
  }, [syncLayers, repaint]);

  const renameLayer = useCallback((id: string, name: string) => {
    const layer = layersRef.current.find(l => l.id === id);
    if (layer) layer.name = name.trim() || layer.name;
    syncLayers();
  }, [syncLayers]);

  // ── Pointer events ─────────────────────────────────────────────────────────

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const cx     = clientX - rect.left, cy = clientY - rect.top;
    const vs     = vsRef.current;
    const wx     = cx / vs.scale + vs.panX;
    const wy     = cy / vs.scale + vs.panY;
    vs.scale     = Math.min(200, Math.max(6, vs.scale * factor));
    vs.panX      = wx - cx / vs.scale;
    vs.panY      = wy - cy / vs.scale;
    repaint();
  }, [repaint]);

  const clientPos = (e: MouseEvent | TouchEvent): Point =>
    'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

  const onPointerDown = useCallback((e: MouseEvent | TouchEvent) => {
    const pos   = clientPos(e);
    const vs    = vsRef.current;
    const layer = getActiveLayer();

    // Pan: middle-mouse or Alt+drag
    if ('button' in e && (e.button === 1 || (e.button === 0 && e.altKey))) {
      vs.isPanning   = true;
      vs.lastPointer = pos;
      e.preventDefault();
      return;
    }

    if (!layer) return;

    if (layer.closed) {
      // Drag existing vertex?
      for (let i = 0; i < layer.points.length; i++) {
        if (pixelDistToPoint(pos.x, pos.y, i) < 14) {
          vs.dragIndex = i;
          return;
        }
      }
      // Toggle party wall
      const edgeIdx = getEdgeAtClient(pos.x, pos.y);
      if (edgeIdx >= 0) {
        layer.edges[edgeIdx].isPartyWall = !layer.edges[edgeIdx].isPartyWall;
        refreshResults();
        repaint();
      }
      return;
    }

    const wp      = client2world(pos.x, pos.y);
    const snapped = snapPt(wp.x, wp.y);

    // Auto-close
    if (layer.points.length >= 3 && pixelDistToPoint(pos.x, pos.y, 0) < CLOSE_PX) {
      closePolygon();
      return;
    }

    layer.points.push(snapped);
    refreshResults();
    repaint();
  }, [getActiveLayer, client2world, pixelDistToPoint, getEdgeAtClient, closePolygon, refreshResults, repaint]);

  const onPointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    const pos   = clientPos(e);
    const vs    = vsRef.current;
    const layer = getActiveLayer();

    if (vs.isPanning && vs.lastPointer) {
      const dx = (pos.x - vs.lastPointer.x) / vs.scale;
      const dy = (pos.y - vs.lastPointer.y) / vs.scale;
      vs.panX -= dx; vs.panY -= dy;
      vs.lastPointer = pos;
      repaint();
      return;
    }

    if (vs.dragIndex >= 0 && layer) {
      const wp = client2world(pos.x, pos.y);
      layer.points[vs.dragIndex] = snapPt(wp.x, wp.y);
      refreshResults();
      repaint();
      return;
    }

    if (layer && !layer.closed) {
      const wp = client2world(pos.x, pos.y);
      vs.hoverPt = snapPt(wp.x, wp.y);
      repaint();
    }
  }, [getActiveLayer, client2world, refreshResults, repaint]);

  const onPointerUp = useCallback(() => {
    const vs = vsRef.current;
    vs.isPanning = false;
    if (vs.dragIndex >= 0) {
      vs.dragIndex = -1;
      refreshResults();
      repaint();
    }
  }, [refreshResults, repaint]);

  // ── Register canvas event listeners ───────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown  = (e: MouseEvent) => onPointerDown(e);
    const handleMouseMove  = (e: MouseEvent) => onPointerMove(e);
    const handleMouseUp    = () => onPointerUp();
    const handleMouseLeave = () => {
      vsRef.current.hoverPt = null;
      const layer = layersRef.current.find(l => l.id === activeLayerIdRef.current);
      if (!layer?.closed) repaint();
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      undoLastPoint();
    };

    // Touch
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const vs = vsRef.current;
      if (e.touches.length === 1) {
        onPointerDown(e);
      } else if (e.touches.length === 2) {
        vs.isPanning      = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        vs.lastPinchDist   = Math.hypot(dx, dy);
        vs.lastPinchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const vs = vsRef.current;
      if (e.touches.length === 2) {
        const dx   = e.touches[0].clientX - e.touches[1].clientX;
        const dy   = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const center = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        if (vs.lastPinchDist && vs.lastPinchCenter) {
          const canvas2 = canvasRef.current!;
          const rect    = canvas2.getBoundingClientRect();
          const lc      = vs.lastPinchCenter;
          const wx      = (lc.x - rect.left) / vs.scale + vs.panX;
          const wy      = (lc.y - rect.top)  / vs.scale + vs.panY;
          vs.scale = Math.min(200, Math.max(6, vs.scale * (dist / vs.lastPinchDist)));
          vs.panX  = wx - (center.x - rect.left) / vs.scale;
          vs.panY  = wy - (center.y - rect.top)  / vs.scale;
        }
        vs.lastPinchDist   = dist;
        vs.lastPinchCenter = center;
        repaint();
        return;
      }
      onPointerMove(e);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const vs = vsRef.current;
      onPointerUp();
      vs.lastPinchDist   = null;
      vs.lastPinchCenter = null;
    };

    canvas.addEventListener('mousedown',    handleMouseDown);
    canvas.addEventListener('mousemove',    handleMouseMove);
    canvas.addEventListener('mouseup',      handleMouseUp);
    canvas.addEventListener('mouseleave',   handleMouseLeave);
    canvas.addEventListener('wheel',        handleWheel,        { passive: false });
    canvas.addEventListener('contextmenu',  handleContextMenu);
    canvas.addEventListener('touchstart',   handleTouchStart,   { passive: false });
    canvas.addEventListener('touchmove',    handleTouchMove,    { passive: false });
    canvas.addEventListener('touchend',     handleTouchEnd,     { passive: false });

    return () => {
      canvas.removeEventListener('mousedown',   handleMouseDown);
      canvas.removeEventListener('mousemove',   handleMouseMove);
      canvas.removeEventListener('mouseup',     handleMouseUp);
      canvas.removeEventListener('mouseleave',  handleMouseLeave);
      canvas.removeEventListener('wheel',       handleWheel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('touchstart',  handleTouchStart);
      canvas.removeEventListener('touchmove',   handleTouchMove);
      canvas.removeEventListener('touchend',    handleTouchEnd);
    };
  }, [onPointerDown, onPointerMove, onPointerUp, zoomAt, undoLastPoint, repaint]);

  // ── Sync dwellingType change to existing party walls ───────────────────────

  useEffect(() => {
    const layer = getActiveLayer();
    if (layer?.closed && layer.edges.length > 0) {
      applyDefaultExposure(layer.points, layer.edges, settings.dwellingType);
      refreshResults();
      repaint();
    }
  }, [settings.dwellingType, getActiveLayer, refreshResults, repaint]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="hlc">
      {/* Header */}
      <div className="hlc__header">
        <div className="hlc__header-title">
          <h2>🔥 Heat Loss Calculator</h2>
          <p>Sketch the ground-floor perimeter · set building assumptions · get an instant heat loss estimate</p>
        </div>
        <button className="hlc__back-btn" onClick={onBack}>← Back</button>
      </div>

      <div className="hlc__body">
        {/* Canvas panel */}
        <div className="hlc__canvas-panel">
          <div className="hlc__toolbar">
            <button
              className="hlc__tool-btn"
              onClick={undoLastPoint}
              disabled={pointCount === 0 && !closed}
              title="Undo last point (or right-click on canvas)"
            >
              ↩ Undo
            </button>
            <button
              className="hlc__tool-btn"
              onClick={closePolygon}
              disabled={pointCount < 3 || closed}
              title="Close the shape"
            >
              ✓ Close Shape
            </button>
            <button
              className="hlc__tool-btn"
              onClick={clearAll}
              title="Clear active layer"
            >
              🗑 Clear
            </button>
            <button
              className="hlc__tool-btn"
              onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) {
                  const rect = canvas.getBoundingClientRect();
                  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
                }
              }}
              title="Zoom in"
            >
              ＋
            </button>
            <button
              className="hlc__tool-btn"
              onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) {
                  const rect = canvas.getBoundingClientRect();
                  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.2);
                }
              }}
              title="Zoom out"
            >
              −
            </button>
            <button
              className="hlc__tool-btn"
              onClick={fitToView}
              title="Fit to view"
            >
              ⊡ Fit
            </button>
          </div>

          <div className="hlc__canvas-wrapper">
            <canvas
              ref={canvasRef}
              className="hlc__canvas"
              style={{ width: '100%', height: '100%' }}
            />
            <div className="hlc__hint">{hint}</div>
          </div>
        </div>

        {/* Settings + results panel */}
        <div className="hlc__side-panel">
          {/* Layer management */}
          <div className="hlc__section">
            <div className="hlc__section-header">
              <h3>Layers</h3>
              <div className="hlc__layer-add-btns">
                <button
                  className="hlc__layer-add-btn"
                  onClick={() => addLayer('extension')}
                  title="Add extension layer"
                >
                  + Extension
                </button>
                <button
                  className="hlc__layer-add-btn"
                  onClick={() => addLayer('upper_floor')}
                  title="Add upper floor layer"
                >
                  + Upper floor
                </button>
                <button
                  className="hlc__layer-add-btn hlc__layer-add-btn--ref"
                  onClick={() => addLayer('reference')}
                  title="Add reference outline (not included in calculation)"
                >
                  + Reference
                </button>
              </div>
            </div>

            <div className="hlc__layer-list" role="list" aria-label="Drawing layers">
              {layers.map(layer => {
                const isActive = layer.id === activeLayerId;
                const colour   = LAYER_COLOURS[layer.kind] ?? '#1a56db';
                return (
                  <div
                    key={layer.id}
                    className={`hlc__layer-item${isActive ? ' hlc__layer-item--active' : ''}`}
                    role="listitem"
                    onClick={() => selectLayer(layer.id)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <button
                      className="hlc__layer-vis-btn"
                      title={layer.visible ? 'Hide layer' : 'Show layer'}
                      aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                      onClick={e => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                    >
                      {layer.visible ? '●' : '○'}
                    </button>
                    <span
                      className="hlc__layer-colour-dot"
                      style={{ background: colour }}
                      aria-hidden="true"
                    />
                    <span
                      className="hlc__layer-name"
                      title={layer.name}
                    >
                      {layer.name}
                    </span>
                    <span className={`hlc__layer-badge hlc__layer-badge--${layer.kind}`}>
                      {layer.kind.replace('_', ' ')}
                    </span>
                    {layers.length > 1 && (
                      <button
                        className="hlc__layer-del-btn"
                        title="Remove layer"
                        aria-label={`Remove layer ${layer.name}`}
                        onClick={e => { e.stopPropagation(); removeLayer(layer.id); }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rename active layer */}
            {(() => {
              const activeLayer = layers.find(l => l.id === activeLayerId);
              if (!activeLayer) return null;
              return (
                <div className="hlc__layer-rename">
                  <input
                    className="hlc__layer-rename-input"
                    type="text"
                    value={activeLayer.name}
                    onChange={e => renameLayer(activeLayerId, e.target.value)}
                    placeholder="Layer name"
                    aria-label="Active layer name"
                  />
                </div>
              );
            })()}
          </div>

          {/* Building settings */}
          <div className="hlc__section">
            <h3>Building</h3>

            <div className="hlc__field">
              <label>Dwelling type</label>
              <select
                value={settings.dwellingType}
                onChange={e => setSettings(s => ({ ...s, dwellingType: e.target.value as Settings['dwellingType'] }))}
              >
                <option value="detached">Detached</option>
                <option value="semi">Semi-detached</option>
                <option value="endTerrace">End-terrace</option>
                <option value="midTerrace">Mid-terrace</option>
              </select>
            </div>

            <div className="hlc__field">
              <label>Storeys</label>
              <input
                type="number"
                min={1} max={5} step={1}
                value={settings.storeys}
                onChange={e => setSettings(s => ({ ...s, storeys: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
            </div>

            <div className="hlc__field">
              <label>Ceiling height (m)</label>
              <input
                type="number"
                min={2} max={4} step={0.1}
                value={settings.ceilingHeight}
                onChange={e => setSettings(s => ({ ...s, ceilingHeight: parseFloat(e.target.value) || 2.4 }))}
              />
            </div>
          </div>

          {/* Fabric settings */}
          <div className="hlc__section">
            <h3>Fabric</h3>

            <div className="hlc__field">
              <label>Wall construction</label>
              <select
                value={settings.wallType}
                onChange={e => setSettings(s => ({ ...s, wallType: e.target.value }))}
              >
                <option value="solidBrick">Solid brick (U 2.1)</option>
                <option value="cavityUninsulated">Cavity uninsulated (U 2.1 — high heat-loss band)</option>
                <option value="cavityPartialFill">Cavity partial fill (U 0.5)</option>
                <option value="cavityFullFill">Cavity full fill (U 0.28)</option>
                <option value="timberFrame">Timber frame (U 0.25)</option>
                <option value="solidStone">Solid stone (U 1.7)</option>
              </select>
            </div>

            <div className="hlc__field">
              <label>Loft insulation</label>
              <select
                value={settings.loftInsulation}
                onChange={e => setSettings(s => ({ ...s, loftInsulation: e.target.value }))}
              >
                <option value="none">None (U 2.3)</option>
                <option value="mm100">100 mm (U 0.35)</option>
                <option value="mm200">200 mm (U 0.18)</option>
                <option value="mm270plus">270 mm+ (U 0.13)</option>
              </select>
            </div>

            <div className="hlc__field">
              <label>Glazing type</label>
              <select
                value={settings.glazingType}
                onChange={e => setSettings(s => ({ ...s, glazingType: e.target.value }))}
              >
                <option value="single">Single glazed (U 4.8)</option>
                <option value="doubleOld">Double old (U 2.8)</option>
                <option value="doubleArated">Double A-rated (U 1.4)</option>
                <option value="triple">Triple glazed (U 0.8)</option>
              </select>
            </div>

            <div className="hlc__field">
              <label>Glazing amount</label>
              <select
                value={settings.glazingAmount}
                onChange={e => setSettings(s => ({ ...s, glazingAmount: e.target.value }))}
              >
                <option value="low">Low (12 % of wall)</option>
                <option value="medium">Medium (18 %)</option>
                <option value="high">High (25 %)</option>
              </select>
            </div>

            <div className="hlc__field">
              <label>Floor type</label>
              <select
                value={settings.floorType}
                onChange={e => setSettings(s => ({ ...s, floorType: e.target.value }))}
              >
                <option value="solidUninsulated">Solid uninsulated (U 0.70)</option>
                <option value="suspendedUninsulated">Suspended uninsulated (U 0.80)</option>
                <option value="insulated">Insulated (U 0.20)</option>
              </select>
            </div>
          </div>

          {/* Results */}
          <div className="hlc__section">
            <h3>Results</h3>

            {result == null ? (
              <p className="hlc__result-placeholder">
                {layers.find(l => l.id === activeLayerId)?.kind === 'reference'
                  ? 'Reference layers are not included in the heat loss calculation.'
                  : 'Sketch the ground-floor perimeter and close the shape to see the heat loss estimate.'}
              </p>
            ) : (
              <>
                <div className="hlc__result-headline">
                  <span className="hlc__result-kw">{result.totalHL}</span>
                  <span className="hlc__result-unit">kW design heat loss</span>
                </div>

                <div className="hlc__geometry-grid">
                  <div className="hlc__geo-item">
                    <label>Floor area</label>
                    <span>{result.floorArea} m²</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Perimeter</label>
                    <span>{result.perimeter} m</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Net wall area</label>
                    <span>{result.netWallArea} m²</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Glazing area</label>
                    <span>{result.glazingArea} m²</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Roof area</label>
                    <span>{result.roofArea} m²</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Volume</label>
                    <span>{result.volume} m³</span>
                  </div>
                </div>

                <div className="hlc__breakdown">
                  <div className="hlc__breakdown-row">
                    <span>Walls</span>
                    <span>{result.wallHL} kW</span>
                  </div>
                  <div className="hlc__breakdown-row">
                    <span>Glazing</span>
                    <span>{result.glazingHL} kW</span>
                  </div>
                  <div className="hlc__breakdown-row">
                    <span>Roof</span>
                    <span>{result.roofHL} kW</span>
                  </div>
                  <div className="hlc__breakdown-row">
                    <span>Floor</span>
                    <span>{result.floorHL} kW</span>
                  </div>
                  <div className="hlc__breakdown-row">
                    <span>Ventilation</span>
                    <span>{result.ventHL} kW</span>
                  </div>
                </div>

                {onComplete && (
                  <button
                    className="hlc__use-btn"
                    onClick={() => onComplete(result.totalHL)}
                  >
                    ✓ Use {result.totalHL} kW
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

