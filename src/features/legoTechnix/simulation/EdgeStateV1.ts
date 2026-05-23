export interface EdgeStateV1 {
  readonly connectionId: string;
  readonly isActive: boolean;
  readonly estimatedFlowKgPerS?: number;
  readonly estimatedInletTemperatureC?: number;
  readonly estimatedOutletTemperatureC?: number;
}
