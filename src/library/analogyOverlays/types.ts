import type { VisualTopologyId } from '../visualTopologies/visualTopologyRegistry';

export type AnalogyMode =
  | 'basic_household'
  | 'traffic'
  | 'medical'
  | 'electrical'
  | 'physics_engineering';

export type AnalogyTargetConcept =
  | 'abv_protected_loop'
  | 'magnetic_filter'
  | 'system_pressure'
  | 'stratified_mixergy'
  | 'powerflush';

export type AnalogyCognitiveLoad = 'low' | 'medium' | 'high';

export type AnalogyNarrationStyle =
  | 'plain_household'
  | 'flow_metaphor'
  | 'clinical_metaphor'
  | 'circuit_metaphor'
  | 'engineering_precision';

export interface AnalogyOverlayCalloutElement {
  id: string;
  type: 'callout';
  anchorId: string;
  label: string;
  offsetX: number;
  offsetY: number;
}

export interface AnalogyOverlayLinkElement {
  id: string;
  type: 'link';
  fromAnchorId: string;
  toAnchorId: string;
  label: string;
}

export type AnalogyOverlayElement =
  | AnalogyOverlayCalloutElement
  | AnalogyOverlayLinkElement;

export interface AnalogyOverlayEntry {
  id: string;
  analogyMode: AnalogyMode;
  topologyId: VisualTopologyId;
  targetConcept: AnalogyTargetConcept;
  overlayElements: AnalogyOverlayElement[];
  narrationStyle: AnalogyNarrationStyle;
  customerSafeSummary: string;
  accessibilitySummary: string;
  cognitiveLoad: AnalogyCognitiveLoad;
  allowedCustomerUse: boolean;
  qaNote: string;
}
