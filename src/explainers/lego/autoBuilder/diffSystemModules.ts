/**
 * diffSystemModules.ts
 *
 * Converts one or two SystemConceptModels into SystemModuleSets with
 * appropriate state tags (kept / removed / added / future_ready).
 *
 * Used by the SystemArchitectureVisualiser to power all three view modes:
 *   current        — single set, all modules tagged 'current'
 *   recommendation — single set, all modules tagged 'recommended'
 *   compare        — two sets with diff tags
 *
 * The diff operates at the module level: each role in the four-layer
 * architecture (heat_source / controls / dhw_storage / emitters) is
 * compared independently.  If the module identity changes between current
 * and recommended, the current module is tagged 'removed' and the
 * recommended module is tagged 'added'.  If they match, both are 'kept'.
 *
 * Future-ready modules are passed in explicitly as an optional list.
 */

import type { SystemConceptModel, HeatSourceKind, HotWaterServiceKind, ControlTopologyKind, EmitterKind } from '../model/types';
import type { SystemModule, SystemModuleSet, SystemDiff, ModuleState, ModuleVisualId, ModuleRole } from './autoBuilderTypes';

// ─── Label helpers ────────────────────────────────────────────────────────────

function heatSourceLabel(kind: HeatSourceKind): { label: string; sublabel: string } {
  switch (kind) {
    case 'regular_boiler': return { label: 'Regular Boiler',      sublabel: 'Open-vented circuit' };
    case 'system_boiler':  return { label: 'System Boiler',       sublabel: 'Sealed circuit' };
    case 'heat_pump':      return { label: 'Heat Pump',           sublabel: 'Low-temperature primary' };
    default:               return { label: 'Heat Source',         sublabel: '' };
  }
}

function heatSourceVisualId(kind: HeatSourceKind, hotWaterService: HotWaterServiceKind): ModuleVisualId {
  if (hotWaterService === 'storage_combi') return 'storage_combi_boiler';
  if (hotWaterService === 'combi_plate_hex') return 'combi_boiler';
  switch (kind) {
    case 'regular_boiler': return 'regular_boiler';
    case 'system_boiler':  return 'system_boiler';
    case 'heat_pump':      return 'heat_pump';
    default:               return 'system_boiler';
  }
}

function controlsLabel(kind: ControlTopologyKind): { label: string; sublabel: string } {
  switch (kind) {
    case 'none':             return { label: 'Integral Controls',    sublabel: 'No external zone control' };
    case 'y_plan':           return { label: 'Y-Plan Controls',      sublabel: '3-port mid-position valve' };
    case 's_plan':           return { label: 'S-Plan Controls',      sublabel: '2-port zone valves' };
    case 's_plan_multi_zone':return { label: 'S-Plan Multi-Zone',    sublabel: 'Multiple zone valves' };
    case 'hp_diverter':      return { label: 'HP Buffer Diverter',   sublabel: 'Low-loss header arrangement' };
    default:                 return { label: 'Controls',             sublabel: '' };
  }
}

function controlsVisualId(kind: ControlTopologyKind): ModuleVisualId {
  switch (kind) {
    case 'none':             return 'controls_integral';
    case 'y_plan':           return 'y_plan';
    case 's_plan':           return 's_plan';
    case 's_plan_multi_zone':return 's_plan_multi_zone';
    case 'hp_diverter':      return 'hp_diverter';
    default:                 return 'controls_integral';
  }
}

function dhwLabel(kind: HotWaterServiceKind): { label: string; sublabel: string } {
  switch (kind) {
    case 'none':             return { label: 'No Storage',           sublabel: 'Heating only' };
    case 'combi_plate_hex':  return { label: 'On-Demand Hot Water',  sublabel: 'Via integrated plate HEX' };
    case 'storage_combi':    return { label: 'Integrated Store',     sublabel: 'Built-in thermal store' };
    case 'vented_cylinder':  return { label: 'Open-Vented Cylinder', sublabel: 'Tank-fed hot water' };
    case 'unvented_cylinder':return { label: 'Unvented Cylinder',    sublabel: 'Mains-pressure hot water' };
    case 'thermal_store':    return { label: 'Thermal Store',        sublabel: 'Primary-side heat store' };
    case 'mixergy':          return { label: 'Mixergy Cylinder',     sublabel: 'Stratified mains-pressure' };
    default:                 return { label: 'Hot Water',            sublabel: '' };
  }
}

function dhwVisualId(kind: HotWaterServiceKind): ModuleVisualId {
  switch (kind) {
    case 'none':             return 'combi_on_demand';
    case 'combi_plate_hex':  return 'combi_on_demand';
    case 'storage_combi':    return 'combi_on_demand';   // stored inside the heat source module
    case 'vented_cylinder':  return 'vented_cylinder';
    case 'unvented_cylinder':return 'unvented_cylinder';
    case 'thermal_store':    return 'thermal_store';
    case 'mixergy':          return 'mixergy_cylinder';
    default:                 return 'unvented_cylinder';
  }
}

function emitterLabel(kind: EmitterKind): { label: string; sublabel: string } {
  switch (kind) {
    case 'radiators': return { label: 'Radiators',          sublabel: 'Panel radiators' };
    case 'ufh':       return { label: 'Underfloor Heating', sublabel: 'UFH loops / manifold' };
    case 'mixed':     return { label: 'Mixed Emitters',     sublabel: 'Radiators + UFH' };
    default:          return { label: 'Emitters',           sublabel: '' };
  }
}

function emitterVisualId(kind: EmitterKind): ModuleVisualId {
  switch (kind) {
    case 'radiators': return 'radiators';
    case 'ufh':       return 'ufh';
    case 'mixed':     return 'mixed_emitters';
    default:          return 'radiators';
  }
}

// ─── Module builders ──────────────────────────────────────────────────────────

function buildHeatSourceModule(concept: SystemConceptModel, state: ModuleState): SystemModule {
  const visualId = heatSourceVisualId(concept.heatSource, concept.hotWaterService);
  // Override label for combi variants to make the appliance type clear
  const { label, sublabel } = concept.hotWaterService === 'storage_combi'
    ? { label: 'Storage Combi',   sublabel: 'Integrated store' }
    : concept.hotWaterService === 'combi_plate_hex'
      ? { label: 'Combi Boiler',  sublabel: 'Integrated plate HEX' }
      : heatSourceLabel(concept.heatSource);
  return { id: `heat_source_${state}`, role: 'heat_source', visualId, label, sublabel, state };
}

function buildControlsModule(concept: SystemConceptModel, state: ModuleState): SystemModule | null {
  // Combi systems have no external controls topology — suppress this layer
  if (concept.controls === 'none') return null;
  const { label, sublabel } = controlsLabel(concept.controls);
  const visualId = controlsVisualId(concept.controls);
  return { id: `controls_${state}`, role: 'controls', visualId, label, sublabel, state };
}

function buildDhwModule(concept: SystemConceptModel, state: ModuleState): SystemModule | null {
  // Suppress DHW layer when there is no separate hot-water service:
  //   'none'          — heating-only system
  //   'storage_combi' — the store is inside the boiler body (shown in heat_source module)
  if (concept.hotWaterService === 'none' || concept.hotWaterService === 'storage_combi') return null;
  const { label, sublabel } = dhwLabel(concept.hotWaterService);
  const visualId = dhwVisualId(concept.hotWaterService);
  return { id: `dhw_${state}`, role: 'dhw_storage', visualId, label, sublabel, state };
}

function buildEmitterModules(concept: SystemConceptModel, state: ModuleState): SystemModule[] {
  return concept.emitters.map((kind, i) => {
    const { label, sublabel } = emitterLabel(kind);
    const visualId = emitterVisualId(kind);
    return { id: `emitter_${kind}_${i}_${state}`, role: 'emitters' as ModuleRole, visualId, label, sublabel, state };
  });
}

function conceptToModules(concept: SystemConceptModel, state: ModuleState): SystemModuleSet {
  const modules: SystemModule[] = [];
  modules.push(buildHeatSourceModule(concept, state));
  const controls = buildControlsModule(concept, state);
  if (controls) modules.push(controls);
  const dhw = buildDhwModule(concept, state);
  if (dhw) modules.push(dhw);
  modules.push(...buildEmitterModules(concept, state));
  return modules;
}

// ─── Identity helpers ─────────────────────────────────────────────────────────

/** Returns a stable string identity for comparing heat-source layers. */
function heatSourceIdentity(concept: SystemConceptModel): string {
  // Combi identity is determined by the plate HEX — heat source alone is not enough
  if (concept.hotWaterService === 'storage_combi') return 'storage_combi_boiler';
  if (concept.hotWaterService === 'combi_plate_hex') return 'combi_boiler';
  return concept.heatSource;
}

function controlsIdentity(concept: SystemConceptModel): string {
  return concept.controls;
}

function dhwIdentity(concept: SystemConceptModel): string {
  return concept.hotWaterService;
}

function emittersIdentity(concept: SystemConceptModel): string {
  return [...concept.emitters].sort().join(',');
}

// ─── Future-ready module builder ──────────────────────────────────────────────

export type FuturePathwayId = 'solar_connection' | 'heat_pump_ready';

export interface FuturePathwayItem {
  id: FuturePathwayId;
  label?: string;
  sublabel?: string;
}

const DEFAULT_FUTURE_LABELS: Record<FuturePathwayId, { label: string; sublabel: string }> = {
  solar_connection: { label: 'Solar Connection',    sublabel: 'Solar thermal or PV-diverter ready' },
  heat_pump_ready:  { label: 'Heat Pump Pathway',   sublabel: 'Future ASHP upgrade route' },
};

function buildFutureModule(item: FuturePathwayItem): SystemModule {
  const defaults = DEFAULT_FUTURE_LABELS[item.id];
  return {
    id: `future_${item.id}`,
    role: 'dhw_storage',   // future items display at the end; role is informational
    visualId: item.id === 'solar_connection' ? 'solar_connection' : 'heat_pump_ready',
    label:    item.label    ?? defaults.label,
    sublabel: item.sublabel ?? defaults.sublabel,
    state:    'future_ready',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * conceptToCurrentModules
 *
 * Converts a single SystemConceptModel to a SystemModuleSet for the
 * 'current' view mode.  All modules are tagged 'current'.
 */
export function conceptToCurrentModules(concept: SystemConceptModel): SystemModuleSet {
  return conceptToModules(concept, 'current');
}

/**
 * conceptToRecommendedModules
 *
 * Converts a single SystemConceptModel to a SystemModuleSet for the
 * 'recommendation' view mode.  All modules are tagged 'recommended'.
 */
export function conceptToRecommendedModules(
  concept: SystemConceptModel,
  futureItems: FuturePathwayItem[] = [],
): SystemModuleSet {
  const modules = conceptToModules(concept, 'recommended');
  modules.push(...futureItems.map(buildFutureModule));
  return modules;
}

/**
 * diffConcepts
 *
 * Diffs a current system against a recommended system to produce a
 * SystemDiff with kept/removed/added/future_ready state tags.
 *
 * Comparison is role-by-role:
 *   heat_source  — identity = heatSourceIdentity (combi vs boiler type)
 *   controls     — identity = controls topology kind
 *   dhw_storage  — identity = hotWaterService kind
 *   emitters     — identity = sorted emitter kinds joined with comma
 *
 * @param current     - Current system concept model.
 * @param recommended - Recommended system concept model.
 * @param futureItems - Optional future-ready pathway items (appended to
 *                      the recommended list tagged 'future_ready').
 */
export function diffConcepts(
  current: SystemConceptModel,
  recommended: SystemConceptModel,
  futureItems: FuturePathwayItem[] = [],
): SystemDiff {
  const currentModules: SystemModule[] = [];
  const recommendedModules: SystemModule[] = [];

  // ─── Heat source layer ─────────────────────────────────────────────────────
  const heatSrcSame = heatSourceIdentity(current) === heatSourceIdentity(recommended);
  currentModules.push(buildHeatSourceModule(current, heatSrcSame ? 'kept' : 'removed'));
  recommendedModules.push(buildHeatSourceModule(recommended, heatSrcSame ? 'kept' : 'added'));

  // ─── Controls layer ────────────────────────────────────────────────────────
  const currentControls = buildControlsModule(current, 'current');
  const recControls     = buildControlsModule(recommended, 'recommended');

  if (currentControls || recControls) {
    const ctrlSame = controlsIdentity(current) === controlsIdentity(recommended);
    if (currentControls) {
      currentModules.push({ ...currentControls, state: ctrlSame ? 'kept' : 'removed' });
    }
    if (recControls) {
      recommendedModules.push({ ...recControls, state: ctrlSame ? 'kept' : 'added' });
    }
    // When recControls is null (moving to combi), no entry is needed in the
    // recommended list — the controls role is simply absent in the new system.
  }

  // ─── DHW storage layer ─────────────────────────────────────────────────────
  const dhwSame = dhwIdentity(current) === dhwIdentity(recommended);
  const currentDhw = buildDhwModule(current, dhwSame ? 'kept' : 'removed');
  const recDhw     = buildDhwModule(recommended, dhwSame ? 'kept' : 'added');
  if (currentDhw)  currentModules.push(currentDhw);
  if (recDhw)      recommendedModules.push(recDhw);

  // ─── Emitters layer ────────────────────────────────────────────────────────
  const emitSame = emittersIdentity(current) === emittersIdentity(recommended);
  const currentEmitters    = buildEmitterModules(current,     emitSame ? 'kept' : 'removed');
  const recommendedEmitters= buildEmitterModules(recommended, emitSame ? 'kept' : 'added');
  currentModules.push(...currentEmitters);
  recommendedModules.push(...recommendedEmitters);

  // ─── Future-ready items ────────────────────────────────────────────────────
  recommendedModules.push(...futureItems.map(buildFutureModule));

  return { current: currentModules, recommended: recommendedModules };
}
