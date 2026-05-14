import { OpenVentedToUnventedDiagram } from './OpenVentedToUnventedDiagram';
import { PressureVsStorageDiagram } from './PressureVsStorageDiagram';
import { StoredHotWaterRecoveryTimelineDiagram } from './StoredHotWaterRecoveryTimelineDiagram';
import { SystemFitDecisionMapDiagram } from './SystemFitDecisionMapDiagram';
import { WarmVsHotRadiatorsDiagram } from './WarmVsHotRadiatorsDiagram';
import { WarmRadiatorEmitterSizingDiagram } from './WarmRadiatorEmitterSizingDiagram';
import { WaterMainLimitationDiagram } from './WaterMainLimitationDiagram';
import { FlowRestrictionBottleneckDiagram } from './FlowRestrictionBottleneckDiagram';
import { WeatherCompensationCurveDiagram } from './WeatherCompensationCurveDiagram';

export interface DiagramRendererProps {
  diagramId: string;
  printSafe?: boolean;
  reducedMotion?: boolean;
}

export const DIAGRAM_COMPONENTS = {
  pressure_vs_storage: PressureVsStorageDiagram,
  warm_vs_hot_radiators: WarmVsHotRadiatorsDiagram,
  water_main_limitation: WaterMainLimitationDiagram,
  open_vented_to_unvented: OpenVentedToUnventedDiagram,
  system_fit_decision_map: SystemFitDecisionMapDiagram,
  stored_hot_water_recovery_timeline: StoredHotWaterRecoveryTimelineDiagram,
  warm_radiator_emitter_sizing: WarmRadiatorEmitterSizingDiagram,
  flow_restriction_bottleneck: FlowRestrictionBottleneckDiagram,
  weather_compensation_curve: WeatherCompensationCurveDiagram,
} as const;

export type SupportedDiagramRendererId = keyof typeof DIAGRAM_COMPONENTS;
export const SUPPORTED_DIAGRAM_RENDERER_IDS = Object.keys(DIAGRAM_COMPONENTS) as SupportedDiagramRendererId[];

export function isDiagramRendererIdSupported(diagramId: string): diagramId is SupportedDiagramRendererId {
  return diagramId in DIAGRAM_COMPONENTS;
}

export function DiagramRenderer({
  diagramId,
  printSafe = false,
  reducedMotion = false,
}: DiagramRendererProps) {
  const DiagramComponent = DIAGRAM_COMPONENTS[diagramId as keyof typeof DIAGRAM_COMPONENTS];
  if (!DiagramComponent) {
    if (import.meta.env.DEV) {
      return <p className="atlas-edu-diagram__caption">Diagram unavailable: {diagramId}</p>;
    }
    return null;
  }

  return (
    <div data-motion={reducedMotion ? 'reduce' : undefined} data-testid={`diagram-renderer-${diagramId}`}>
      <DiagramComponent printSafe={printSafe} />
    </div>
  );
}
