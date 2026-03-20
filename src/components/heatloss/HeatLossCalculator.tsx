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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }
interface Edge  { isPartyWall: boolean; }

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

interface DrawState {
  points:    Point[];
  closed:    boolean;
  hoverPt:   Point | null;
  scale:     number;
  panX:      number;
  panY:      number;
  edges:     Edge[];
  isPanning: boolean;
  lastPointer: Point | null;
  dragIndex:   number;
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

function calculateHeatLoss(ds: DrawState, settings: Settings): HeatLossResult | null {
  if (!ds.closed || ds.points.length < 3) return null;

  const pts           = ds.points;
  const floorArea     = polygonArea(pts);
  const perimeter     = polygonPerimeter(pts);
  const totalHeight   = settings.storeys * settings.ceilingHeight;
  const volume        = floorArea * totalHeight;

  let exposedPerimeter = 0;
  let partyPerimeter   = 0;
  ds.edges.forEach((edge, i) => {
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

  const uWall    = U_WALL[settings.wallType]    ?? 1.5;
  const uLoft    = U_LOFT[settings.loftInsulation] ?? 0.18;
  const uGlazing = U_GLAZING[settings.glazingType] ?? 1.4;
  const uFloor   = U_FLOOR[settings.floorType]  ?? 0.70;

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

function renderCanvas(
  canvas: HTMLCanvasElement,
  ds: DrawState,
): void {
  const ctx  = canvas.getContext('2d');
  if (!ctx) return;
  const dpr  = window.devicePixelRatio || 1;
  const cssW = canvas.offsetWidth;
  const cssH = canvas.offsetHeight;

  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const { scale, panX, panY, points: pts, closed, hoverPt, edges } = ds;
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

  // ── Polygon ───────────────────────────────────────────────────────────────
  if (pts.length >= 2) {
    if (closed) {
      // Fill
      ctx.beginPath();
      const s = w2c(pts[0].x, pts[0].y, scale, panX, panY);
      ctx.moveTo(s.x, s.y);
      for (let i = 1; i < pts.length; i++) {
        const p = w2c(pts[i].x, pts[i].y, scale, panX, panY);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(26, 86, 219, 0.10)';
      ctx.fill();

      // Edges
      for (let i = 0; i < pts.length; i++) {
        const a = w2c(pts[i].x, pts[i].y, scale, panX, panY);
        const b = w2c(pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y, scale, panX, panY);
        const isParty = edges[i]?.isPartyWall ?? false;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = isParty ? '#888888' : '#1a56db';
        ctx.setLineDash(isParty ? [6, 4] : []);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else {
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
      ctx.strokeStyle = '#1a56db';
      ctx.lineWidth   = 2;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Vertices ──────────────────────────────────────────────────────────────
  pts.forEach((pt, i) => {
    const cp = w2c(pt.x, pt.y, scale, panX, panY);
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2);
    ctx.fillStyle   = i === 0 && !closed ? '#10b981' : '#1a56db';
    ctx.strokeStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // ── Cursor snap dot ───────────────────────────────────────────────────────
  if (!closed && hoverPt) {
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

  // ── Edge length labels ────────────────────────────────────────────────────
  if (closed && pts.length >= 2) {
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

export default function HeatLossCalculator({ onBack, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drawing state kept in a ref so event handlers always see latest values
  const dsRef = useRef<DrawState>({
    points:          [],
    closed:          false,
    hoverPt:         null,
    scale:           40,
    panX:            -2,
    panY:            -2,
    edges:           [],
    isPanning:       false,
    lastPointer:     null,
    dragIndex:       -1,
    lastPinchDist:   null,
    lastPinchCenter: null,
  });

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

  // Reactive hint + result derived from drawing state
  const [hint, setHint]     = useState<string>('Click to place first corner point');
  const [result, setResult] = useState<HeatLossResult | null>(null);
  const [closed, setClosed] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCanvas(canvas, dsRef.current);
  }, []);

  const refreshResults = useCallback(() => {
    const res = calculateHeatLoss(dsRef.current, settingsRef.current);
    setResult(res);
    setClosed(dsRef.current.closed);
    setPointCount(dsRef.current.points.length);
    const ds = dsRef.current;
    if (ds.closed) {
      setHint('Click or tap walls to mark as party walls · Drag corners to adjust');
    } else if (ds.points.length === 0) {
      setHint('Click to place first corner point');
    } else if (ds.points.length < 3) {
      setHint(`${ds.points.length} point${ds.points.length > 1 ? 's' : ''} — keep clicking to add corners`);
    } else {
      setHint('Click the green point to close, or press Close Shape');
    }
  }, []);

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
    const { scale, panX, panY } = dsRef.current;
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
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const { scale, panX, panY, points } = dsRef.current;
    const cp = {
      x: (points[idx].x - panX) * scale,
      y: (points[idx].y - panY) * scale,
    };
    return Math.hypot(clientX - rect.left - cp.x, clientY - rect.top - cp.y);
  }, []);

  const getEdgeAtClient = useCallback((clientX: number, clientY: number): number => {
    const ds = dsRef.current;
    if (!ds.closed) return -1;
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const cx = clientX - rect.left, cy = clientY - rect.top;
    const { scale, panX, panY, points: pts } = ds;
    let best = -1, bestDist = 12;
    for (let i = 0; i < pts.length; i++) {
      const a = { x: (pts[i].x - panX) * scale, y: (pts[i].y - panY) * scale };
      const b = { x: (pts[(i + 1) % pts.length].x - panX) * scale, y: (pts[(i + 1) % pts.length].y - panY) * scale };
      const d = pointToSegmentDist(cx, cy, a.x, a.y, b.x, b.y);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }, []);

  // ── Polygon operations ─────────────────────────────────────────────────────

  const closePolygon = useCallback(() => {
    const ds = dsRef.current;
    if (ds.points.length < 3) return;
    ds.edges  = ds.points.map(() => ({ isPartyWall: false }));
    applyDefaultExposure(ds.points, ds.edges, settingsRef.current.dwellingType);
    ds.closed  = true;
    ds.hoverPt = null;
    refreshResults();
    repaint();
  }, [refreshResults, repaint]);

  const undoLastPoint = useCallback(() => {
    const ds = dsRef.current;
    if (ds.closed) {
      ds.closed = false;
      ds.edges  = [];
      refreshResults();
    } else if (ds.points.length > 0) {
      ds.points.pop();
    }
    refreshResults();
    repaint();
  }, [refreshResults, repaint]);

  const clearAll = useCallback(() => {
    const ds = dsRef.current;
    ds.points    = [];
    ds.closed    = false;
    ds.hoverPt   = null;
    ds.dragIndex = -1;
    ds.edges     = [];
    refreshResults();
    repaint();
  }, [refreshResults, repaint]);

  const fitToView = useCallback(() => {
    const ds     = dsRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.offsetWidth;
    const cssH = canvas.offsetHeight;
    if (ds.points.length === 0) {
      ds.scale = 40; ds.panX = -2; ds.panY = -2;
      repaint(); return;
    }
    const xs = ds.points.map(p => p.x), ys = ds.points.map(p => p.y);
    const minX = Math.min(...xs) - 2, maxX = Math.max(...xs) + 2;
    const minY = Math.min(...ys) - 2, maxY = Math.max(...ys) + 2;
    const scX  = cssW / (maxX - minX), scY = cssH / (maxY - minY);
    ds.scale   = Math.min(scX, scY, 100);
    ds.panX    = minX; ds.panY = minY;
    repaint();
  }, [repaint]);

  // ── Pointer events ─────────────────────────────────────────────────────────

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const cx     = clientX - rect.left, cy = clientY - rect.top;
    const ds     = dsRef.current;
    const wx     = cx / ds.scale + ds.panX;
    const wy     = cy / ds.scale + ds.panY;
    ds.scale     = Math.min(200, Math.max(6, ds.scale * factor));
    ds.panX      = wx - cx / ds.scale;
    ds.panY      = wy - cy / ds.scale;
    repaint();
  }, [repaint]);

  const clientPos = (e: MouseEvent | TouchEvent): Point =>
    'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

  const onPointerDown = useCallback((e: MouseEvent | TouchEvent) => {
    const pos = clientPos(e);
    const ds  = dsRef.current;

    // Pan: middle-mouse or Alt+drag
    if ('button' in e && (e.button === 1 || (e.button === 0 && e.altKey))) {
      ds.isPanning   = true;
      ds.lastPointer = pos;
      e.preventDefault();
      return;
    }

    if (ds.closed) {
      // Drag existing vertex?
      for (let i = 0; i < ds.points.length; i++) {
        if (pixelDistToPoint(pos.x, pos.y, i) < 14) {
          ds.dragIndex = i;
          return;
        }
      }
      // Toggle party wall
      const edgeIdx = getEdgeAtClient(pos.x, pos.y);
      if (edgeIdx >= 0) {
        ds.edges[edgeIdx].isPartyWall = !ds.edges[edgeIdx].isPartyWall;
        refreshResults();
        repaint();
      }
      return;
    }

    const wp      = client2world(pos.x, pos.y);
    const snapped = snapPt(wp.x, wp.y);

    // Auto-close
    if (ds.points.length >= 3 && pixelDistToPoint(pos.x, pos.y, 0) < CLOSE_PX) {
      closePolygon();
      return;
    }

    ds.points.push(snapped);
    refreshResults();
    repaint();
  }, [client2world, pixelDistToPoint, getEdgeAtClient, closePolygon, refreshResults, repaint]);

  const onPointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    const pos = clientPos(e);
    const ds  = dsRef.current;

    if (ds.isPanning && ds.lastPointer) {
      const dx = (pos.x - ds.lastPointer.x) / ds.scale;
      const dy = (pos.y - ds.lastPointer.y) / ds.scale;
      ds.panX -= dx; ds.panY -= dy;
      ds.lastPointer = pos;
      repaint();
      return;
    }

    if (ds.dragIndex >= 0) {
      const wp = client2world(pos.x, pos.y);
      ds.points[ds.dragIndex] = snapPt(wp.x, wp.y);
      refreshResults();
      repaint();
      return;
    }

    if (!ds.closed) {
      const wp = client2world(pos.x, pos.y);
      ds.hoverPt = snapPt(wp.x, wp.y);
      repaint();
    }
  }, [client2world, refreshResults, repaint]);

  const onPointerUp = useCallback(() => {
    const ds = dsRef.current;
    ds.isPanning = false;
    if (ds.dragIndex >= 0) {
      ds.dragIndex = -1;
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
      dsRef.current.hoverPt = null;
      if (!dsRef.current.closed) repaint();
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
      const ds = dsRef.current;
      if (e.touches.length === 1) {
        onPointerDown(e);
      } else if (e.touches.length === 2) {
        ds.isPanning      = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        ds.lastPinchDist   = Math.hypot(dx, dy);
        ds.lastPinchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const ds = dsRef.current;
      if (e.touches.length === 2) {
        const dx   = e.touches[0].clientX - e.touches[1].clientX;
        const dy   = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const center = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        if (ds.lastPinchDist && ds.lastPinchCenter) {
          const canvas2 = canvasRef.current!;
          const rect    = canvas2.getBoundingClientRect();
          const lc      = ds.lastPinchCenter;
          const wx      = (lc.x - rect.left) / ds.scale + ds.panX;
          const wy      = (lc.y - rect.top)  / ds.scale + ds.panY;
          ds.scale = Math.min(200, Math.max(6, ds.scale * (dist / ds.lastPinchDist)));
          ds.panX  = wx - (center.x - rect.left) / ds.scale;
          ds.panY  = wy - (center.y - rect.top)  / ds.scale;
        }
        ds.lastPinchDist   = dist;
        ds.lastPinchCenter = center;
        repaint();
        return;
      }
      onPointerMove(e);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const ds = dsRef.current;
      onPointerUp();
      ds.lastPinchDist   = null;
      ds.lastPinchCenter = null;
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
    const ds = dsRef.current;
    if (ds.closed && ds.edges.length > 0) {
      applyDefaultExposure(ds.points, ds.edges, settings.dwellingType);
      refreshResults();
      repaint();
    }
  }, [settings.dwellingType, refreshResults, repaint]);

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
              title="Clear canvas"
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
                <option value="low">Low (~12 % of wall area)</option>
                <option value="medium">Medium (~18 %)</option>
                <option value="high">High (~25 %)</option>
              </select>
            </div>

            <div className="hlc__field">
              <label>Ground floor type</label>
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
                Sketch the ground-floor perimeter and close the shape to see the heat loss estimate.
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

                <table className="hlc__breakdown-table">
                  <thead>
                    <tr>
                      <th>Element</th>
                      <th>kW</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Walls</td><td>{result.wallHL}</td></tr>
                    <tr><td>Glazing</td><td>{result.glazingHL}</td></tr>
                    <tr><td>Roof / loft</td><td>{result.roofHL}</td></tr>
                    <tr><td>Floor</td><td>{result.floorHL}</td></tr>
                    <tr><td>Ventilation</td><td>{result.ventHL}</td></tr>
                    <tr><td>Total</td><td>{result.totalHL}</td></tr>
                  </tbody>
                </table>

                <p className="hlc__accuracy-note">
                  ±25–40 % first-pass estimate using ΔT&nbsp;=&nbsp;20&nbsp;°C, ACH&nbsp;=&nbsp;0.75.
                  Not for formal MCS calculations.
                </p>

                {onComplete && (
                  <button
                    className="hlc__use-value-btn"
                    onClick={() => onComplete(result.totalHL)}
                  >
                    Use {result.totalHL} kW →
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
