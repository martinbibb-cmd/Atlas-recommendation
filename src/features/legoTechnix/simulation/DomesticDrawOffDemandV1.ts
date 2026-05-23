export interface DomesticDrawOffDemandV1 {
  /** Domestic hot draw-off load component id (e.g. domestic_hot_draw_off). */
  readonly drawOffComponentId: string;
  /** Requested mixed outlet flow during this tick. */
  readonly drawOffFlowLpm: number;
  /** Target mixed outlet temperature. */
  readonly mixedOutletTargetTemperatureC: number;
  /** Cold inlet (mains/feed) temperature used for replenishment mixing. */
  readonly coldInletTemperatureC: number;
}
