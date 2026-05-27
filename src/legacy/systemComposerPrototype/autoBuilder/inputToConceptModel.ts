/**
 * inputToConceptModel.ts
 *
 * Derives a SystemConceptModel from the subset of EngineInputV2_3 fields
 * that describe the CURRENT system.  Used by the presentation layer to
 * render the current system architecture without requiring access to
 * the original SystemBuilderState.
 *
 * Available current-system signals in EngineInputV2_3:
 *   input.currentHeatSourceType  — 'combi' | 'system' | 'regular' | 'ashp' | 'other'
 *   input.dhwStorageType          — 'none' | 'vented' | 'unvented' | 'mixergy' | ...
 *   input.emitterType             — 'radiators' | 'ufh' | 'mixed'
 *
 * Controls topology is inferred from heat-source + DHW combination because
 * the raw control family is not propagated into EngineInputV2_3.
 */

import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { SystemConceptModel, HeatSourceKind, HotWaterServiceKind, ControlTopologyKind, EmitterKind } from '../model/types';

// ─── Type helpers ─────────────────────────────────────────────────────────────

type InputHeatSourceType = NonNullable<EngineInputV2_3['currentHeatSourceType']>;
type InputDhwStorageType = NonNullable<EngineInputV2_3['dhwStorageType']>;
type InputEmitterType    = NonNullable<EngineInputV2_3['emitterType']>;

// ─── Mapping functions ────────────────────────────────────────────────────────

function mapInputHeatSource(type: InputHeatSourceType | undefined): HeatSourceKind {
  switch (type) {
    case 'regular': return 'regular_boiler';
    case 'system':  return 'system_boiler';
    case 'combi':   return 'system_boiler';  // combi is a system_boiler + plate HEX
    case 'ashp':    return 'heat_pump';
    default:        return 'system_boiler';   // safe fallback
  }
}

function mapInputDhwStorage(
  heatSourceType: InputHeatSourceType | undefined,
  dhwStorage: InputDhwStorageType | undefined,
): HotWaterServiceKind {
  // Combi always delivers DHW via integrated plate HEX — no cylinder
  if (heatSourceType === 'combi') return 'combi_plate_hex';

  switch (dhwStorage) {
    case 'vented':             return 'vented_cylinder';
    case 'unvented':           return 'unvented_cylinder';
    case 'mixergy':            return 'mixergy';
    case 'thermal_store':      return 'thermal_store';
    case 'heat_pump_cylinder': return 'unvented_cylinder';   // HP systems use sealed cylinder
    case 'none':               return 'combi_plate_hex';     // no storage = on-demand
    default:                   return 'vented_cylinder';     // safe fallback
  }
}

function inferControls(
  heatSource: HeatSourceKind,
  hotWaterService: HotWaterServiceKind,
): ControlTopologyKind {
  if (hotWaterService === 'combi_plate_hex' || hotWaterService === 'storage_combi') return 'none';
  if (heatSource === 'heat_pump') return 'hp_diverter';
  if (heatSource === 'regular_boiler') return 'y_plan';   // regular boilers typically Y-plan
  // system_boiler with cylinder → S-plan is standard
  return 's_plan';
}

function mapInputEmitters(type: InputEmitterType | undefined): EmitterKind[] {
  switch (type) {
    case 'ufh':   return ['ufh'];
    case 'mixed': return ['mixed'];
    default:      return ['radiators'];   // radiators or undefined → radiators
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * inputToConceptModel
 *
 * Derives a SystemConceptModel for the CURRENT system from the available
 * EngineInputV2_3 fields.  Returns undefined if no meaningful system
 * information is present (i.e. heatSourceType is not recorded).
 *
 * @param input - The EngineInputV2_3 passed to the presentation layer.
 * @returns A SystemConceptModel, or undefined when input lacks system data.
 */
export function inputToConceptModel(input: EngineInputV2_3): SystemConceptModel | undefined {
  // If no heat source type is recorded, we cannot produce a meaningful model
  if (!input.currentHeatSourceType) return undefined;

  const heatSource     = mapInputHeatSource(input.currentHeatSourceType);
  const hotWaterService= mapInputDhwStorage(input.currentHeatSourceType, input.dhwStorageType);
  const controls       = inferControls(heatSource, hotWaterService);
  const emitters       = mapInputEmitters(input.emitterType);

  return {
    heatSource,
    hotWaterService,
    controls,
    emitters,
    traits: {
      integratedPump:      heatSource !== 'regular_boiler',
      integratedExpansion: heatSource !== 'regular_boiler',
      integratedPlateHex:  hotWaterService === 'combi_plate_hex' || hotWaterService === 'storage_combi',
    },
  };
}
