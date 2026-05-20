import { VISUAL_TOPOLOGY_REGISTRY, type VisualTopologyId } from './visualTopologyRegistry';
import { getHydraulicTruthModel, runHydraulicTopologyQa } from '../hydraulicTruth';

export interface TopologyRenderAssertionDefinition {
  id: string;
  description: string;
}

export interface TopologyTemplateComplianceResult {
  topologyId: VisualTopologyId;
  templateId: string;
  passed: boolean;
  templatePassed: boolean;
  humanVisualReviewRequired: boolean;
  humanVisualReviewNote?: string;
  statusLabel: 'Compliant' | 'Blocked' | 'Human review required';
  blockingIssues: string[];
  renderAssertions: TopologyRenderAssertionDefinition[];
  knownSimplification: string;
}

const TOPOLOGY_RENDER_ASSERTIONS: Record<VisualTopologyId, TopologyRenderAssertionDefinition[]> = {
  open_vented_vented_cylinder: [
    {
      id: 'open_vented_pump_downstream_close_coupled_vent_feed',
      description: 'Pump is on primary flow and downstream of close-coupled vent/feed pair.',
    },
  ],
  sealed_unvented_cylinder: [
    {
      id: 'sealed_unvented_cylinder_zone_valve_control_cue',
      description: 'Cylinder primary flow shows an S-plan style two-port zone valve control cue.',
    },
    {
      id: 'sealed_unvented_expansion_vessel_on_primary_return',
      description: 'Expansion vessel is shown on primary return in sealed/unvented layout.',
    },
    {
      id: 'filling_loop_disconnected_default',
      description: 'Filling loop is shown disconnected/ghosted in normal state.',
    },
    {
      id: 'sealed_unvented_primary_potable_path_separation',
      description: 'Primary flow/return, mains cold, hot draw-off, and D2 discharge remain visually distinct.',
    },
  ],
  combi_direct_hot_water: [
    {
      id: 'combi_on_demand_hot_water_without_storage',
      description: 'Combi topology keeps on-demand hot-water path without storage vessel.',
    },
  ],
  mixergy_stratified_cylinder: [
    {
      id: 'mixergy_stratification_visible',
      description: 'Mixergy topology retains thermocline and stratification cues.',
    },
  ],
  thermal_store_layout: [
    {
      id: 'thermal_store_potable_primary_path_separation',
      description: 'Thermal store potable path remains separate from primary store water.',
    },
  ],
  powerflush_service_layout: [
    {
      id: 'powerflush_dirty_clean_path_distinction',
      description: 'Powerflush topology preserves dirty-vs-clean service path distinction.',
    },
  ],
  abv_protected_heating_loop: [
    {
      id: 'abv_downstream_of_boiler_upstream_of_restrictions',
      description: 'ABV is downstream of boiler and upstream of branch restrictions.',
    },
  ],
  magnetic_filter_on_return: [
    {
      id: 'magnetic_filter_final_on_return_before_boiler',
      description: 'Magnetic filter is final on return before boiler entry.',
    },
  ],
  system_pressure_layout: [
    {
      id: 'sealed_pressure_reference_states',
      description: 'Pressure reference topology keeps low/normal/high sealed-state cues.',
    },
  ],
};

export function getTopologyRenderAssertions(topologyId: VisualTopologyId): TopologyRenderAssertionDefinition[] {
  return TOPOLOGY_RENDER_ASSERTIONS[topologyId];
}

export function evaluateTopologyTemplateCompliance(topologyId: VisualTopologyId): TopologyTemplateComplianceResult {
  const hydraulicQa = runHydraulicTopologyQa(topologyId);
  const truthModel = getHydraulicTruthModel(topologyId);
  const topologyEntry = VISUAL_TOPOLOGY_REGISTRY.find((entry) => entry.id === topologyId);
  const knownSimplification = truthModel.knownSimplifications[0] ?? 'No known simplification declared.';
  const renderAssertions = getTopologyRenderAssertions(topologyId);
  const blockingIssues = [
    ...hydraulicQa.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message),
  ];
  if (renderAssertions.length === 0) {
    blockingIssues.push('No render assertions registered for topology template compliance.');
  }
  const templatePassed = blockingIssues.length === 0;
  const humanVisualReviewRequired = topologyEntry?.humanVisualReviewState === 'human_visual_review_required';
  if (humanVisualReviewRequired) {
    blockingIssues.push(
      topologyEntry?.humanVisualReviewNote
        ?? 'Human visual review is still required because metadata-only checks cannot prove the drawing is understandable without labels.',
    );
  }
  const passed = blockingIssues.length === 0;
  const statusLabel = !templatePassed
    ? 'Blocked'
    : humanVisualReviewRequired
      ? 'Human review required'
      : 'Compliant';

  return {
    topologyId,
    templateId: hydraulicQa.templateId,
    passed,
    templatePassed,
    humanVisualReviewRequired,
    humanVisualReviewNote: topologyEntry?.humanVisualReviewNote,
    statusLabel,
    blockingIssues,
    renderAssertions,
    knownSimplification,
  };
}
