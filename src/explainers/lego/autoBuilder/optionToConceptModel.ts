/**
 * optionToConceptModel.ts
 *
 * Maps an engine recommendation option ID to a SystemConceptModel
 * (the composable four-layer architecture model used by the Lego builder).
 *
 * Option IDs from OptionCardV1:
 *   'combi'           — combi boiler (no storage)
 *   'stored_vented'   — system/regular boiler with vented cylinder
 *   'stored_unvented' — system boiler with unvented cylinder
 *   'regular_vented'  — regular boiler with vented cylinder (legacy naming)
 *   'system_unvented' — system boiler with unvented cylinder (legacy naming)
 *   'ashp'            — air source heat pump with unvented cylinder
 *
 * The Mixergy variant is identified separately — Atlas may recommend a
 * Mixergy cylinder as an upgrade over a standard unvented cylinder.
 */

import type { SystemConceptModel } from '../model/types';
import type { OptionCardV1 } from '../../../contracts/EngineOutputV1';

// ─── Option ID type ───────────────────────────────────────────────────────────

export type OptionId = OptionCardV1['id'];

// ─── Mixergy flag ─────────────────────────────────────────────────────────────

/**
 * When true, the stored-system option uses a Mixergy stratified cylinder
 * instead of a standard unvented cylinder.
 */
export type MixergyFlag = boolean;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * optionToConceptModel
 *
 * Converts an engine recommendation option ID to a SystemConceptModel.
 *
 * @param optionId  - The OptionCardV1 id field.
 * @param mixergy   - When true (and option is an unvented stored system),
 *                    use 'mixergy' as the hot water service kind.
 * @param emitters  - Override the default emitter set.  Defaults to
 *                    ['radiators'] for boiler systems and ['ufh'] for ASHP.
 */
export function optionToConceptModel(
  optionId: OptionId,
  mixergy: MixergyFlag = false,
  emitters?: ('radiators' | 'ufh' | 'mixed')[],
): SystemConceptModel {
  switch (optionId) {
    case 'combi':
      return {
        heatSource:      'system_boiler',
        hotWaterService: 'combi_plate_hex',
        controls:        'none',
        emitters:        emitters ?? ['radiators'],
        traits: {
          integratedPump:      true,
          integratedExpansion: true,
          integratedPlateHex:  true,
        },
      };

    case 'stored_vented':
    case 'regular_vented':
      return {
        heatSource:      'regular_boiler',
        hotWaterService: 'vented_cylinder',
        controls:        'y_plan',
        emitters:        emitters ?? ['radiators'],
        traits: {
          integratedPump:      false,
          integratedExpansion: false,
          integratedPlateHex:  false,
        },
      };

    case 'stored_unvented':
    case 'system_unvented': {
      const hwService = mixergy ? 'mixergy' : 'unvented_cylinder';
      return {
        heatSource:      'system_boiler',
        hotWaterService: hwService,
        controls:        's_plan',
        emitters:        emitters ?? ['radiators'],
        traits: {
          integratedPump:      true,
          integratedExpansion: true,
          integratedPlateHex:  false,
        },
      };
    }

    case 'ashp':
      return {
        heatSource:      'heat_pump',
        hotWaterService: mixergy ? 'mixergy' : 'unvented_cylinder',
        controls:        'hp_diverter',
        emitters:        emitters ?? ['ufh'],
        traits: {
          integratedPump:      false,
          integratedExpansion: false,
          integratedPlateHex:  false,
        },
      };

    default:
      // Defensive fallback — render a combi concept for unknown IDs
      return {
        heatSource:      'system_boiler',
        hotWaterService: 'combi_plate_hex',
        controls:        'none',
        emitters:        emitters ?? ['radiators'],
        traits: {
          integratedPump:      true,
          integratedExpansion: true,
          integratedPlateHex:  true,
        },
      };
  }
}
