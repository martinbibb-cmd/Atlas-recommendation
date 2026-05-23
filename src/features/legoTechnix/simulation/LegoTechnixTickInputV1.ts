import type { DomesticDrawOffDemandV1 } from './DomesticDrawOffDemandV1';

export interface LegoTechnixTickInputV1 {
  readonly wallClockMs: number;
  readonly timestepSeconds: number;
  /** Optional control/sensor overrides keyed by componentId. */
  readonly controlOverrides?: Readonly<Record<string, unknown>>;
  /** Optional domestic draw-off demand events applied over this tick duration. */
  readonly domesticDrawOffDemands?: readonly DomesticDrawOffDemandV1[];
}
