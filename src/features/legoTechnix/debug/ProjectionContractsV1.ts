import type { LegoTechnixConfidence } from '../confidence';
import type { LegoTechnixDomain } from '../domains';
import type { LegoTechnixComponentRole } from '../roles';
import type { LegoTechnixPortDirection } from '../types';
import type { ComponentOperatingModeV1, FlowRiskBandV1 } from '../simulation';

export type ProjectionDemandStateV1 = 'none' | 'demanding' | 'unknown';

export interface ProjectionPortV1 {
  readonly portId: string;
  readonly label: string;
  readonly domain: LegoTechnixDomain;
  readonly direction: LegoTechnixPortDirection;
  readonly required: boolean;
  readonly isActive: boolean;
}

export interface ProjectionNodeTemperatureV1 {
  readonly label: string;
  readonly temperatureC: number;
}

export interface ProjectionNodeV1 {
  readonly componentId: string;
  readonly label: string;
  readonly family: string;
  readonly role: LegoTechnixComponentRole | 'unknown';
  readonly x: number;
  readonly y: number;
  readonly ports: readonly ProjectionPortV1[];
  readonly operatingMode: ComponentOperatingModeV1;
  readonly confidence: LegoTechnixConfidence;
  readonly warnings: readonly string[];
  readonly temperatures: readonly ProjectionNodeTemperatureV1[];
  readonly demandState: ProjectionDemandStateV1;
  readonly engineeringMetadata: {
    readonly domains: readonly LegoTechnixDomain[];
    readonly behaviours: readonly string[];
    readonly stateOwnerId?: string;
    readonly isActive: boolean;
  };
}

export type ProjectionInferredVsMeasuredStateV1 = 'measured' | 'inferred' | 'assumed' | 'unknown';

export interface ProjectionEdgeV1 {
  readonly connectionId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly active: boolean;
  readonly estimatedFlowLps?: number;
  readonly estimatedVelocityMps?: number;
  readonly estimatedInletTemperatureC?: number;
  readonly estimatedOutletTemperatureC?: number;
  readonly confidence: LegoTechnixConfidence;
  readonly warnings: readonly string[];
  readonly inferredVsMeasuredState: ProjectionInferredVsMeasuredStateV1;
  readonly thermalLossKw?: number;
}

export interface ProjectionOverlayEntryV1 {
  readonly id: string;
  readonly label: string;
  readonly targetType: 'node' | 'edge' | 'timeline';
  readonly targetId?: string;
  readonly status: 'active' | 'inactive' | 'info' | 'warning' | 'critical';
  readonly confidence?: LegoTechnixConfidence;
  readonly evidence?: readonly string[];
  readonly metadata?: {
    readonly flowRiskBand?: FlowRiskBandV1;
    readonly measuredState?: ProjectionInferredVsMeasuredStateV1;
    readonly noteCategory?: string;
    readonly noteSeverity?: string;
  };
}

export interface ProjectionOverlayV1 {
  readonly overlayId: 'hydraulic' | 'thermal' | 'confidence' | 'explainability';
  readonly label: string;
  readonly entries: readonly ProjectionOverlayEntryV1[];
}

export interface ProjectionFrameV1 {
  readonly frameId: string;
  readonly tickIndex: number;
  readonly offsetSeconds: number;
  readonly wallClockMs: number;
  readonly nodes: readonly ProjectionNodeV1[];
  readonly edges: readonly ProjectionEdgeV1[];
  readonly overlays: readonly ProjectionOverlayV1[];
}

export interface ProjectionTimelineV1 {
  readonly schemaVersion: '1.0';
  readonly templateId?: string;
  readonly frameCount: number;
  readonly timestepSeconds: number;
  readonly frames: readonly ProjectionFrameV1[];
}
