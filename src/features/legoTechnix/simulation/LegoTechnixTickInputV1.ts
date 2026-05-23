export interface LegoTechnixTickInputV1 {
  readonly wallClockMs: number;
  readonly timestepSeconds: number;
  /** Optional control/sensor overrides keyed by componentId. */
  readonly controlOverrides?: Readonly<Record<string, unknown>>;
}
