import type { ComponentStateV1 } from './ComponentStateV1';
import type { DomainStateV1 } from './DomainStateV1';
import type { EdgeStateV1 } from './EdgeStateV1';

export interface LegoTechnixSimulationStateV1 {
  readonly schemaVersion: '1.0';
  readonly tickIndex: number;
  readonly wallClockMs: number;
  readonly componentStates: readonly ComponentStateV1[];
  readonly edgeStates: readonly EdgeStateV1[];
  readonly domainStates: readonly DomainStateV1[];
}
