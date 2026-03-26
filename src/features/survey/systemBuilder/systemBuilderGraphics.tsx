/**
 * systemBuilderGraphics.tsx
 *
 * Lightweight SVG schematic graphics for each heat-source and DHW-type card.
 * Uses simple geometric shapes only — no photorealistic icons.
 *
 * Colour palette is intentionally monochrome so the active/inactive card
 * border carries the selection state, not the graphic fill.
 */

import type { CSSProperties } from 'react';
import type { HeatSource, DhwType, EmitterType } from './systemBuilderTypes';

const STROKE = '#475569';
const FILL_BODY = '#f1f5f9';
const FILL_ACCENT = '#cbd5e1';
const FILL_WATER = '#bfdbfe';
const FILL_FLAME = '#fde68a';
const SVG_SIZE = 72;

const svgProps = {
  width: SVG_SIZE,
  height: SVG_SIZE,
  viewBox: `0 0 ${SVG_SIZE} ${SVG_SIZE}`,
  style: { display: 'block' } as CSSProperties,
  'aria-hidden': true as const,
};

// ─── Shared primitives ────────────────────────────────────────────────────────

function Boiler({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <rect x={x} y={y} width={w} height={h} rx={3}
      fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />
  );
}

function FlameSymbol({ cx, cy }: { cx: number; cy: number }) {
  return (
    <ellipse cx={cx} cy={cy} rx={4} ry={5}
      fill={FILL_FLAME} stroke={STROKE} strokeWidth={1} />
  );
}

function HeatExchanger({ x, y }: { x: number; y: number }) {
  // Coil-style symbol: three parallel arcs
  return (
    <g>
      <path d={`M${x} ${y} Q${x + 5} ${y - 5} ${x + 10} ${y}`} fill="none" stroke={STROKE} strokeWidth={1.5} />
      <path d={`M${x} ${y + 4} Q${x + 5} ${y - 1} ${x + 10} ${y + 4}`} fill="none" stroke={STROKE} strokeWidth={1.5} />
      <path d={`M${x} ${y + 8} Q${x + 5} ${y + 3} ${x + 10} ${y + 8}`} fill="none" stroke={STROKE} strokeWidth={1.5} />
    </g>
  );
}

function Pump({ cx, cy }: { cx: number; cy: number }) {
  return (
    <circle cx={cx} cy={cy} r={5}
      fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
  );
}

function ExpansionVessel({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={5} ry={7} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx} y1={cy - 7} x2={cx} y2={cy - 11} stroke={STROKE} strokeWidth={1.5} />
    </>
  );
}

function Cylinder({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={4}
        fill={FILL_WATER} stroke={STROKE} strokeWidth={1.5} />
      <ellipse cx={x + w / 2} cy={y} rx={w / 2} ry={3}
        fill={FILL_WATER} stroke={STROKE} strokeWidth={1} />
      <ellipse cx={x + w / 2} cy={y + h} rx={w / 2} ry={3}
        fill={FILL_WATER} stroke={STROKE} strokeWidth={1} />
    </>
  );
}

function PlateHex({ x, y }: { x: number; y: number }) {
  // Compact plate heat exchanger
  return (
    <g>
      <rect x={x} y={y} width={14} height={20} rx={2}
        fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={x + 4} y1={y + 3} x2={x + 4} y2={y + 17} stroke={STROKE} strokeWidth={1} />
      <line x1={x + 7} y1={y + 3} x2={x + 7} y2={y + 17} stroke={STROKE} strokeWidth={1} />
      <line x1={x + 10} y1={y + 3} x2={x + 10} y2={y + 17} stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

function LoftCistern({ x, y }: { x: number; y: number }) {
  return (
    <rect x={x} y={y} width={18} height={9} rx={2}
      fill={FILL_WATER} stroke={STROKE} strokeWidth={1.5} />
  );
}

function DischargeArrow({ x, y }: { x: number; y: number }) {
  return (
    <path d={`M${x} ${y} L${x + 6} ${y + 8} L${x - 6} ${y + 8} Z`}
      fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1} />
  );
}

// ─── Heat Source graphics ─────────────────────────────────────────────────────

export function HeatSourceGraphic({ type }: { type: HeatSource }) {
  switch (type) {
    case 'regular':
      return (
        <svg {...svgProps}>
          <Boiler x={8} y={12} w={28} h={36} />
          <FlameSymbol cx={22} cy={36} />
          <HeatExchanger x={40} y={22} />
        </svg>
      );
    case 'system':
      return (
        <svg {...svgProps}>
          <Boiler x={8} y={12} w={28} h={36} />
          <FlameSymbol cx={22} cy={36} />
          <HeatExchanger x={40} y={18} />
          <Pump cx={52} cy={44} />
          <ExpansionVessel cx={18} cy={10} />
        </svg>
      );
    case 'combi':
      return (
        <svg {...svgProps}>
          <Boiler x={8} y={12} w={28} h={36} />
          <FlameSymbol cx={22} cy={36} />
          <HeatExchanger x={40} y={14} />
          <Pump cx={52} cy={38} />
          <ExpansionVessel cx={18} cy={10} />
          <PlateHex x={40} y={40} />
        </svg>
      );
    case 'storage_combi':
      return (
        <svg {...svgProps}>
          <Boiler x={4} y={10} w={24} h={34} />
          <FlameSymbol cx={16} cy={34} />
          <HeatExchanger x={32} y={10} />
          <Pump cx={44} cy={24} />
          <ExpansionVessel cx={16} cy={8} />
          <PlateHex x={32} y={32} />
          <Cylinder x={52} y={10} w={12} h={32} />
        </svg>
      );
  }
}

// ─── DHW Type graphics ────────────────────────────────────────────────────────

export function DhwTypeGraphic({ type }: { type: DhwType }) {
  switch (type) {
    case 'open_vented':
      return (
        <svg {...svgProps}>
          {/* House outline */}
          <path d="M8 36 L36 12 L64 36 L64 64 L8 64 Z"
            fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />
          {/* Loft cistern */}
          <LoftCistern x={27} y={18} />
          {/* Cylinder on ground floor */}
          <Cylinder x={28} y={42} w={16} h={18} />
        </svg>
      );
    case 'unvented':
      return (
        <svg {...svgProps}>
          <Cylinder x={20} y={10} w={20} h={42} />
          {/* Discharge route */}
          <DischargeArrow x={36} y={52} />
        </svg>
      );
    case 'thermal_store':
      return (
        <svg {...svgProps}>
          {/* Taller cylinder with top store detail */}
          <Cylinder x={16} y={8} w={28} h={50} />
          {/* Top-mounted coil indicator */}
          <rect x={20} y={12} width={20} height={10} rx={2}
            fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1} />
          {/* Side pump indicators */}
          <Pump cx={10} cy={30} />
          <Pump cx={62} cy={30} />
          {/* Flow lines */}
          <line x1={16} y1={30} x2={14} y2={30} stroke={STROKE} strokeWidth={1.5} />
          <line x1={44} y1={30} x2={62} y2={30} stroke={STROKE} strokeWidth={1.5} />
        </svg>
      );
    case 'plate_hex':
      return (
        <svg {...svgProps}>
          <PlateHex x={28} y={20} />
          {/* Flow lines */}
          <line x1={8} y1={26} x2={28} y2={26} stroke={STROKE} strokeWidth={1.5} />
          <line x1={42} y1={26} x2={62} y2={26} stroke={STROKE} strokeWidth={1.5} />
          <line x1={8} y1={34} x2={28} y2={34} stroke={STROKE} strokeWidth={1.5} strokeDasharray="3 2" />
          <line x1={42} y1={34} x2={62} y2={34} stroke={STROKE} strokeWidth={1.5} strokeDasharray="3 2" />
        </svg>
      );
    case 'small_store':
      return (
        <svg {...svgProps}>
          <Cylinder x={22} y={16} w={18} h={28} />
          <FlameSymbol cx={31} cy={50} />
        </svg>
      );
  }
}

// ─── Emitter graphics ─────────────────────────────────────────────────────────

export function EmitterGraphic({ type }: { type: EmitterType }) {
  switch (type) {
    case 'radiators_standard':
      return (
        <svg {...svgProps}>
          {/* Radiator body */}
          <rect x={12} y={20} width={48} height={30} rx={2}
            fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />
          {/* Fins */}
          {[20, 28, 36, 44, 52].map(x => (
            <line key={x} x1={x} y1={20} x2={x} y2={50} stroke={STROKE} strokeWidth={1} />
          ))}
          {/* Pipes */}
          <line x1={16} y1={50} x2={16} y2={58} stroke={STROKE} strokeWidth={2} />
          <line x1={56} y1={50} x2={56} y2={58} stroke={STROKE} strokeWidth={2} />
        </svg>
      );
    case 'radiators_designer':
      return (
        <svg {...svgProps}>
          {/* Column radiator */}
          {[18, 26, 34, 42, 50].map(x => (
            <rect key={x} x={x} y={16} width={5} height={40} rx={2}
              fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />
          ))}
          {/* Header */}
          <rect x={16} y={14} width={42} height={5} rx={1}
            fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1} />
          <rect x={16} y={54} width={42} height={5} rx={1}
            fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1} />
        </svg>
      );
    case 'underfloor':
      return (
        <svg {...svgProps}>
          {/* Floor representation */}
          <rect x={8} y={44} width={56} height={8} rx={1}
            fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
          {/* UFH pipes beneath floor */}
          {[12, 20, 28, 36, 44, 52].map(x => (
            <line key={x} x1={x} y1={44} x2={x} y2={56} stroke={STROKE} strokeWidth={1.5} />
          ))}
          {/* Manifold */}
          <rect x={28} y={24} width={16} height={18} rx={2}
            fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />
          <line x1={36} y1={24} x2={36} y2={14} stroke={STROKE} strokeWidth={2} />
        </svg>
      );
    case 'mixed':
      return (
        <svg {...svgProps}>
          {/* Half radiator */}
          <rect x={6} y={20} width={26} height={24} rx={2}
            fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />
          {[12, 18, 24].map(x => (
            <line key={x} x1={x} y1={20} x2={x} y2={44} stroke={STROKE} strokeWidth={1} />
          ))}
          {/* + sign */}
          <text x={35} y={36} fontSize={14} fill={STROKE} fontWeight="bold">+</text>
          {/* Underfloor floor strip */}
          <rect x={44} y={38} width={22} height={6} rx={1}
            fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
          {[48, 54, 60].map(x => (
            <line key={x} x1={x} y1={38} x2={x} y2={48} stroke={STROKE} strokeWidth={1.5} />
          ))}
        </svg>
      );
  }
}
