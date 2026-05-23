export const FLOW_RISK_BANDS_V1 = [
  'high_velocity',
  'microbore_bottleneck',
] as const;

export type FlowRiskBandV1 = (typeof FLOW_RISK_BANDS_V1)[number];

export interface EdgeStateV1 {
  readonly connectionId: string;
  readonly isActive: boolean;
  readonly estimatedFlowLps?: number;
  readonly estimatedFlowKgPerS?: number;
  readonly estimatedVelocityMps?: number;
  readonly flowRiskBand?: FlowRiskBandV1;
  readonly estimatedInletTemperatureC?: number;
  readonly estimatedOutletTemperatureC?: number;
}
