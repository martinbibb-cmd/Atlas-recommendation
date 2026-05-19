/**
 * index.tsx — Canonical topology template entry point.
 *
 * Exports `renderVisualTopology` which dispatches to the appropriate
 * per-topology template file.
 *
 * Architecture: each topology lives in its own file under
 * `src/library/visualTopologies/templates/{topology}.tsx`.
 * This keeps individual files small (<200 lines), enables tree-shaking,
 * and makes per-topology diffs easy to review.
 *
 * Adding a new topology:
 *   1. Create `templates/{topologyId}.tsx` exporting a React component.
 *   2. Import it here and add a case to the switch.
 *   3. Register the topology ID in `visualTopologyRegistry.ts`.
 */

import type { ReactNode } from 'react';
import type { VisualTopologyId } from '../visualTopologyRegistry';
import type { VisualTopologyRenderOptions } from '../topologies/types';

import { OpenVentedVentedCylinderTopology } from './openVentedVentedCylinder';
import { SealedUnventedCylinderTopology } from './sealedUnventedCylinder';
import { CombiDirectHotWaterTopology } from './combiDirectHotWater';
import { MixergyStratifiedTopology } from './mixergyStratifiedCylinder';
import { ThermalStoreTopology } from './thermalStore';
import { PowerflushServiceTopology } from './powerflushService';
import { AbvProtectedLoopTopology } from './abvProtectedLoop';
import { MagneticFilterOnReturnTopology } from './magneticFilterOnReturn';
import { SystemPressureLayoutTopology } from './systemPressureLayout';

export function renderTopologyTemplate(
  topologyId: VisualTopologyId,
  options: VisualTopologyRenderOptions,
): ReactNode {
  switch (topologyId) {
    case 'open_vented_vented_cylinder':
      return <OpenVentedVentedCylinderTopology options={options} />;
    case 'sealed_unvented_cylinder':
      return <SealedUnventedCylinderTopology options={options} />;
    case 'combi_direct_hot_water':
      return <CombiDirectHotWaterTopology options={options} />;
    case 'mixergy_stratified_cylinder':
      return <MixergyStratifiedTopology options={options} />;
    case 'thermal_store_layout':
      return <ThermalStoreTopology options={options} />;
    case 'powerflush_service_layout':
      return <PowerflushServiceTopology options={options} />;
    case 'abv_protected_heating_loop':
      return <AbvProtectedLoopTopology options={options} />;
    case 'magnetic_filter_on_return':
      return <MagneticFilterOnReturnTopology options={options} />;
    case 'system_pressure_layout':
      return <SystemPressureLayoutTopology options={options} />;
    default:
      return null;
  }
}

// Re-export shared types for convenience
export type { VisualTopologyRenderOptions };
