/**
 * explorerData.ts
 *
 * Re-exports from systemConfigs.ts for backwards compatibility.
 * New code should import directly from systemConfigs.ts.
 */

export {
  DEMO_ROOMS,
  getSystemConfig,
  getRoomById,
  getEmitterById,
  getPhysicsForRoom,
  SYSTEM_CONFIGS,
  SYSTEM_TYPE_ORDER,
} from './systemConfigs';

// Legacy single-system exports (combi defaults)
import { SYSTEM_CONFIGS } from './systemConfigs';

export const DEMO_EMITTERS   = SYSTEM_CONFIGS['combi'].emitters;
export const DEMO_PIPES      = SYSTEM_CONFIGS['combi'].physics;   // unused by new code
export const DEMO_BOILER     = SYSTEM_CONFIGS['combi'].heatSource;
export const DEMO_BEHAVIOUR_EVENTS = SYSTEM_CONFIGS['combi'].behaviourEvents;
export const DEMO_PHYSICS    = SYSTEM_CONFIGS['combi'].physics;

export function getPipesForEmitter(_emitterId: string) { return []; }
