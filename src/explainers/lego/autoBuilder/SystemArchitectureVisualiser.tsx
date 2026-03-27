/**
 * SystemArchitectureVisualiser.tsx
 *
 * Schematic block visualiser that shows a heating system as a four-layer
 * module grid (heat source → controls → DHW storage → emitters).
 *
 * Three view modes:
 *
 *   current        — shows the customer's existing system
 *   recommendation — shows the recommended replacement / upgrade system
 *   compare        — side-by-side diff with kept/removed/added/future_ready overlays
 *
 * Design rules (from Atlas terminology guidelines):
 *   - Schematic, modular, professional — not toy-like
 *   - Calm colour palette; state overlays carry semantic meaning only
 *   - No Math.random() — entirely deterministic
 *   - All data from SystemConceptModel (derived from EngineOutputV1 or survey)
 *
 * Usage:
 *   // Current system from survey:
 *   const concept = systemBuilderToConceptModel(surveyState.systemBuilder);
 *   <SystemArchitectureVisualiser mode="current" currentSystem={concept} />
 *
 *   // Recommended system:
 *   const concept = optionToConceptModel('stored_unvented', true);
 *   <SystemArchitectureVisualiser mode="recommendation" recommendedSystem={concept} />
 *
 *   // Compare:
 *   <SystemArchitectureVisualiser
 *     mode="compare"
 *     currentSystem={current}
 *     recommendedSystem={recommended}
 *     futurePathways={[{ id: 'solar_connection' }]}
 *   />
 */

import React from 'react';
import type { SystemConceptModel } from '../model/types';
import {
  conceptToCurrentModules,
  conceptToRecommendedModules,
  diffConcepts,
  type FuturePathwayItem,
} from './diffSystemModules';
import type { SystemModule, ModuleState, ModuleVisualId, VisualiserMode } from './autoBuilderTypes';
import './SystemArchitectureVisualiser.css';

// ─── SVG palette ──────────────────────────────────────────────────────────────

const STROKE = '#475569';
const FILL_BODY = '#f1f5f9';
const FILL_ACCENT = '#cbd5e1';
const FILL_WATER = '#bfdbfe';
const FILL_FLAME = '#fde68a';
const FILL_GREEN = '#bbf7d0';
const FILL_SOLAR = '#fef9c3';
const SVG_SIZE = 56;

const svgProps = {
  width: SVG_SIZE,
  height: SVG_SIZE,
  viewBox: `0 0 ${SVG_SIZE} ${SVG_SIZE}`,
  style: { display: 'block' } as React.CSSProperties,
  'aria-hidden': true as const,
};

// ─── SVG primitives ───────────────────────────────────────────────────────────

function SvgBoilerBox({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={2} fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />;
}

function SvgFlame({ cx, cy }: { cx: number; cy: number }) {
  return <ellipse cx={cx} cy={cy} rx={3} ry={4} fill={FILL_FLAME} stroke={STROKE} strokeWidth={1} />;
}

function SvgPump({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r={4} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />;
}

function SvgExpansion({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={4} ry={5} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx} y1={cy - 5} x2={cx} y2={cy - 8} stroke={STROKE} strokeWidth={1.5} />
    </>
  );
}

function SvgCylinder({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={FILL_WATER} stroke={STROKE} strokeWidth={1.5} />
      <ellipse cx={x + w / 2} cy={y} rx={w / 2} ry={2.5} fill={FILL_WATER} stroke={STROKE} strokeWidth={1} />
      <ellipse cx={x + w / 2} cy={y + h} rx={w / 2} ry={2.5} fill={FILL_WATER} stroke={STROKE} strokeWidth={1} />
    </>
  );
}

function SvgPlateHex({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={10} height={16} rx={1.5} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={x + 3} y1={y + 2} x2={x + 3} y2={y + 14} stroke={STROKE} strokeWidth={1} />
      <line x1={x + 5.5} y1={y + 2} x2={x + 5.5} y2={y + 14} stroke={STROKE} strokeWidth={1} />
      <line x1={x + 8} y1={y + 2} x2={x + 8} y2={y + 14} stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

function SvgLoftTank({ x, y }: { x: number; y: number }) {
  return <rect x={x} y={y} width={14} height={7} rx={1.5} fill={FILL_WATER} stroke={STROKE} strokeWidth={1.5} />;
}

function SvgHeatPumpUnit({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />
      {/* Fan blades */}
      <circle cx={x + w / 2} cy={y + h / 2} r={h * 0.3} fill="none" stroke={STROKE} strokeWidth={1} />
      <line x1={x + w / 2} y1={y + h * 0.2} x2={x + w / 2} y2={y + h * 0.8} stroke={STROKE} strokeWidth={1} />
      <line x1={x + w * 0.2} y1={y + h / 2} x2={x + w * 0.8} y2={y + h / 2} stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

function SvgThreePortValve({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 9} y1={cy} x2={cx - 16} y2={cy} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx + 9} y1={cy} x2={cx + 16} y2={cy} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx} y1={cy + 9} x2={cx} y2={cy + 16} stroke={STROKE} strokeWidth={1.5} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="7" fill={STROKE}>Y</text>
    </g>
  );
}

function SvgTwoZoneValves({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx - 9} cy={cy} r={7} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <circle cx={cx + 9} cy={cy} r={7} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 9} y1={cy - 7} x2={cx - 9} y2={cy - 13} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx + 9} y1={cy - 7} x2={cx + 9} y2={cy - 13} stroke={STROKE} strokeWidth={1.5} />
      <text x={cx - 9} y={cy + 3} textAnchor="middle" fontSize="6" fill={STROKE}>S</text>
      <text x={cx + 9} y={cy + 3} textAnchor="middle" fontSize="6" fill={STROKE}>S</text>
    </g>
  );
}

function SvgBufferDiverter({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <rect x={cx - 8} y={cy - 14} width={16} height={28} rx={2} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 8} y1={cy} x2={cx - 14} y2={cy} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx + 8} y1={cy} x2={cx + 14} y2={cy} stroke={STROKE} strokeWidth={1.5} />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize="6" fill={STROKE}>LLH</text>
    </g>
  );
}

function SvgRadiators({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {[0, 6, 12, 18, 24].map(i => (
        <g key={i}>
          <rect x={x + i} y={y} width={4} height={18} rx={1} fill={FILL_BODY} stroke={STROKE} strokeWidth={1} />
        </g>
      ))}
      <line x1={x} y1={y + 4} x2={x + 28} y2={y + 4} stroke={STROKE} strokeWidth={1} />
      <line x1={x} y1={y + 14} x2={x + 28} y2={y + 14} stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

function SvgUFH({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y + 10} width={32} height={3} rx={1} fill={FILL_BODY} stroke={STROKE} strokeWidth={1} />
      <path d={`M${x + 4} ${y + 10} Q${x + 4} ${y} ${x + 10} ${y} Q${x + 16} ${y} ${x + 16} ${y + 10}`} fill="none" stroke={STROKE} strokeWidth={1.5} />
      <path d={`M${x + 16} ${y + 10} Q${x + 16} ${y} ${x + 22} ${y} Q${x + 28} ${y} ${x + 28} ${y + 10}`} fill="none" stroke={STROKE} strokeWidth={1.5} />
    </g>
  );
}

function SvgSolarPanel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={FILL_SOLAR} stroke={STROKE} strokeWidth={1.5} strokeDasharray="3 2" />
      <line x1={x + w * 0.33} y1={y} x2={x + w * 0.33} y2={y + h} stroke={STROKE} strokeWidth={1} />
      <line x1={x + w * 0.66} y1={y} x2={x + w * 0.66} y2={y + h} stroke={STROKE} strokeWidth={1} />
      <line x1={x} y1={y + h * 0.33} x2={x + w} y2={y + h * 0.33} stroke={STROKE} strokeWidth={1} />
      <line x1={x} y1={y + h * 0.66} x2={x + w} y2={y + h * 0.66} stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

function SvgHeatPumpReady({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={14} fill={FILL_GREEN} stroke={STROKE} strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="8" fill={STROKE}>HP</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6" fill={STROKE}>ready</text>
    </g>
  );
}

// ─── Module graphic ────────────────────────────────────────────────────────────

function ModuleGraphic({ visualId }: { visualId: ModuleVisualId }) {
  switch (visualId) {
    case 'regular_boiler':
      return (
        <svg {...svgProps}>
          <SvgBoilerBox x={6} y={8} w={22} h={30} />
          <SvgFlame cx={17} cy={28} />
          {/* F&E tank */}
          <SvgLoftTank x={32} y={8} />
        </svg>
      );

    case 'system_boiler':
      return (
        <svg {...svgProps}>
          <SvgBoilerBox x={6} y={8} w={22} h={30} />
          <SvgFlame cx={17} cy={28} />
          <SvgPump cx={38} cy={34} />
          <SvgExpansion cx={40} cy={16} />
        </svg>
      );

    case 'combi_boiler':
      return (
        <svg {...svgProps}>
          <SvgBoilerBox x={4} y={6} w={24} h={32} />
          <SvgFlame cx={16} cy={28} />
          <SvgPump cx={36} cy={32} />
          <SvgExpansion cx={38} cy={16} />
          <SvgPlateHex x={36} y={38} />
        </svg>
      );

    case 'heat_pump':
      return (
        <svg {...svgProps}>
          <SvgHeatPumpUnit x={6} y={10} w={36} h={34} />
        </svg>
      );

    case 'y_plan':
      return (
        <svg {...svgProps}>
          <SvgThreePortValve cx={28} cy={28} />
        </svg>
      );

    case 's_plan':
      return (
        <svg {...svgProps}>
          <SvgTwoZoneValves cx={28} cy={28} />
        </svg>
      );

    case 's_plan_multi_zone':
      return (
        <svg {...svgProps}>
          <SvgTwoZoneValves cx={28} cy={28} />
          <circle cx={28} cy={48} r={5} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
          <text x={28} y={51} textAnchor="middle" fontSize="5" fill={STROKE}>+Z</text>
        </svg>
      );

    case 'hp_diverter':
      return (
        <svg {...svgProps}>
          <SvgBufferDiverter cx={28} cy={28} />
        </svg>
      );

    case 'controls_integral':
      return (
        <svg {...svgProps}>
          {/* Simple chip / PCB icon */}
          <rect x={14} y={18} width={28} height={20} rx={2} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
          {[20, 26, 32, 38].map(x => (
            <g key={x}>
              <line x1={x} y1={18} x2={x} y2={12} stroke={STROKE} strokeWidth={1} />
              <line x1={x} y1={38} x2={x} y2={44} stroke={STROKE} strokeWidth={1} />
            </g>
          ))}
        </svg>
      );

    case 'vented_cylinder':
      return (
        <svg {...svgProps}>
          <SvgLoftTank x={18} y={6} />
          <SvgCylinder x={16} y={18} w={24} h={30} />
        </svg>
      );

    case 'unvented_cylinder':
      return (
        <svg {...svgProps}>
          <SvgCylinder x={16} y={6} w={24} h={38} />
          {/* Safety discharge */}
          <path d={`M34 44 L40 52 L28 52 Z`} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1} />
        </svg>
      );

    case 'mixergy_cylinder':
      return (
        <svg {...svgProps}>
          <SvgCylinder x={16} y={6} w={24} h={38} />
          {/* Stratification indicator — gradient bands */}
          <rect x={17} y={7} width={22} height={10} rx={1} fill="#bfdbfe" opacity={0.9} />
          <rect x={17} y={17} width={22} height={10} rx={0} fill="#93c5fd" opacity={0.7} />
          <rect x={17} y={27} width={22} height={8} rx={0} fill="#60a5fa" opacity={0.5} />
          {/* Safety discharge */}
          <path d={`M34 44 L40 52 L28 52 Z`} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1} />
        </svg>
      );

    case 'combi_on_demand':
      return (
        <svg {...svgProps}>
          <SvgPlateHex x={21} y={12} />
          {/* Flow arrows */}
          <line x1={28} y1={12} x2={28} y2={6} stroke={STROKE} strokeWidth={1.5} />
          <path d={`M25 8 L28 4 L31 8`} fill="none" stroke={STROKE} strokeWidth={1} />
          <line x1={28} y1={28} x2={28} y2={42} stroke={STROKE} strokeWidth={1.5} />
          <path d={`M25 40 L28 44 L31 40`} fill="none" stroke={STROKE} strokeWidth={1} />
        </svg>
      );

    case 'radiators':
      return (
        <svg {...svgProps}>
          <SvgRadiators x={12} y={16} />
        </svg>
      );

    case 'ufh':
      return (
        <svg {...svgProps}>
          <SvgUFH x={12} y={18} />
        </svg>
      );

    case 'mixed_emitters':
      return (
        <svg {...svgProps}>
          {/* Half radiator + UFH manifold */}
          <SvgRadiators x={4} y={14} />
          <line x1={28} y1={14} x2={28} y2={42} stroke={STROKE} strokeWidth={1} strokeDasharray="2 1" />
          <SvgUFH x={30} y={22} />
        </svg>
      );

    case 'solar_connection':
      return (
        <svg {...svgProps}>
          <SvgSolarPanel x={8} y={8} w={40} h={28} />
          <line x1={28} y1={36} x2={28} y2={48} stroke={STROKE} strokeWidth={1.5} strokeDasharray="3 2" />
        </svg>
      );

    case 'heat_pump_ready':
      return (
        <svg {...svgProps}>
          <SvgHeatPumpReady cx={28} cy={28} />
        </svg>
      );

    default:
      return <svg {...svgProps} />;
  }
}

// ─── Module block ─────────────────────────────────────────────────────────────

function ModuleBlock({ module }: { module: SystemModule }) {
  const stateClass = `sav-module--${module.state}`;
  const stateLabel: Record<ModuleState, string | null> = {
    current:     null,
    recommended: null,
    kept:        null,
    removed:     'Removed',
    added:       'Added',
    future_ready:'Future-ready',
  };
  const badge = stateLabel[module.state];
  const ariaLabel = `${module.label}${badge ? ` (${badge})` : ''}`;

  return (
    <div className={`sav-module ${stateClass}`} role="figure" aria-label={ariaLabel}>
      <div className="sav-module__graphic" aria-hidden="true">
        <ModuleGraphic visualId={module.visualId} />
      </div>
      <div className="sav-module__text">
        <span className="sav-module__label">{module.label}</span>
        {module.sublabel && (
          <span className="sav-module__sublabel">{module.sublabel}</span>
        )}
      </div>
      {badge && (
        <span className="sav-module__badge" aria-hidden="true">{badge}</span>
      )}
    </div>
  );
}

// ─── Layer row ────────────────────────────────────────────────────────────────

function LayerRow({
  heading,
  modules,
}: {
  heading: string;
  modules: SystemModule[];
}) {
  if (modules.length === 0) return null;
  return (
    <div className="sav-layer">
      <p className="sav-layer__heading" aria-hidden="true">{heading}</p>
      <div className="sav-layer__blocks">
        {modules.map(m => <ModuleBlock key={m.id} module={m} />)}
      </div>
    </div>
  );
}

// ─── Role heading map ─────────────────────────────────────────────────────────

const ROLE_HEADINGS: Record<string, string> = {
  heat_source:  'Heat source',
  controls:     'Controls',
  dhw_storage:  'Hot water',
  emitters:     'Emitters',
};

// ─── Group modules by role ────────────────────────────────────────────────────

function groupModulesByRole(modules: SystemModule[]): Record<string, SystemModule[]> {
  const groups: Record<string, SystemModule[]> = {
    heat_source: [],
    controls:    [],
    dhw_storage: [],
    emitters:    [],
  };
  for (const m of modules) {
    if (groups[m.role]) groups[m.role].push(m);
    else groups[m.role] = [m];
  }
  return groups;
}

// ─── Single system panel ──────────────────────────────────────────────────────

function SystemPanel({
  title,
  modules,
  className,
}: {
  title: string;
  modules: SystemModule[];
  className?: string;
}) {
  // Separate future-ready items from architecture layers
  const futureModules   = modules.filter(m => m.state === 'future_ready');
  const standardModules = modules.filter(m => m.state !== 'future_ready');

  const byRoleStd = groupModulesByRole(standardModules);

  return (
    <div className={`sav-panel ${className ?? ''}`}>
      <p className="sav-panel__title">{title}</p>
      <div className="sav-panel__layers">
        {(['heat_source', 'controls', 'dhw_storage', 'emitters'] as const).map(role => (
          <LayerRow
            key={role}
            heading={ROLE_HEADINGS[role]}
            modules={byRoleStd[role] ?? []}
          />
        ))}
        {futureModules.length > 0 && (
          <LayerRow heading="Future pathway" modules={futureModules} />
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SystemArchitectureVisualiserProps {
  /**
   * Display mode.
   *
   *  current        — render the customer's existing system only
   *  recommendation — render the recommended system only
   *  compare        — side-by-side diff with state overlays
   */
  mode: VisualiserMode;
  /**
   * The customer's current system concept model (required for 'current'
   * and 'compare' modes).
   */
  currentSystem?: SystemConceptModel;
  /**
   * The recommended system concept model (required for 'recommendation'
   * and 'compare' modes).
   */
  recommendedSystem?: SystemConceptModel;
  /**
   * Future-ready pathway items shown at the bottom of the recommended panel
   * (compare mode only) or recommendation panel (recommendation mode only).
   * Each item is tagged 'future_ready' and rendered with a dashed blue overlay.
   */
  futurePathways?: FuturePathwayItem[];
  /**
   * Optional heading to display above the visualiser.
   * Defaults to a mode-appropriate string if not provided.
   */
  title?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * SystemArchitectureVisualiser
 *
 * Renders a heating system as a schematic four-layer block diagram.
 * Supports three display modes (current / recommendation / compare).
 */
export default function SystemArchitectureVisualiser({
  mode,
  currentSystem,
  recommendedSystem,
  futurePathways = [],
  title,
}: SystemArchitectureVisualiserProps) {

  if (mode === 'current') {
    if (!currentSystem) return null;
    const modules = conceptToCurrentModules(currentSystem);
    return (
      <div className="sav sav--current" data-testid="sav-current">
        {title && <p className="sav__heading">{title}</p>}
        <SystemPanel title="Current system" modules={modules} />
      </div>
    );
  }

  if (mode === 'recommendation') {
    if (!recommendedSystem) return null;
    const modules = conceptToRecommendedModules(recommendedSystem, futurePathways);
    return (
      <div className="sav sav--recommendation" data-testid="sav-recommendation">
        {title && <p className="sav__heading">{title}</p>}
        <SystemPanel title="Recommended system" modules={modules} />
      </div>
    );
  }

  // compare mode
  if (!currentSystem || !recommendedSystem) return null;
  const diff = diffConcepts(currentSystem, recommendedSystem, futurePathways);

  return (
    <div className="sav sav--compare" data-testid="sav-compare">
      {title && <p className="sav__heading">{title}</p>}
      <div className="sav__compare-grid">
        <SystemPanel
          title="Your current system"
          modules={diff.current}
          className="sav-panel--current"
        />
        <div className="sav__compare-arrow" aria-hidden="true">→</div>
        <SystemPanel
          title="Recommended system"
          modules={diff.recommended}
          className="sav-panel--recommended"
        />
      </div>
      <div className="sav__legend" aria-label="Diff legend">
        <span className="sav-legend-item sav-legend-item--kept">No change</span>
        <span className="sav-legend-item sav-legend-item--removed">Removed</span>
        <span className="sav-legend-item sav-legend-item--added">Added</span>
        {futurePathways.length > 0 && (
          <span className="sav-legend-item sav-legend-item--future_ready">Future-ready</span>
        )}
      </div>
    </div>
  );
}
