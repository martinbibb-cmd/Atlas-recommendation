import type { LegoTechnixSimulationStateV1 } from './LegoTechnixSimulationStateV1';

export interface LegoTechnixSimulationEventV1 {
  readonly type: string;
  readonly componentId?: string;
  readonly message: string;
}

export interface LegoTechnixSimulationWarningV1 {
  readonly code: string;
  readonly message: string;
  readonly componentId?: string;
}

export interface LegoTechnixTickResultV1 {
  readonly nextState: LegoTechnixSimulationStateV1;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
  /** True when the tick was blocked and nextState equals previousState. */
  readonly tickBlocked: boolean;
  readonly blockReason?: string;
}
