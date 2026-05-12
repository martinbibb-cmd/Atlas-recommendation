import type { EngineInputV2_3Contract } from '../../../contracts/EngineInputV2_3';
import type { SuggestedImplementationPackV1 } from '../../SuggestedImplementationPackV1';
import type { ScanDataInput } from '../../buildSuggestedImplementationPack';
import type { SpecificationLineV1 } from '../../specLines/SpecificationLineV1';

export type EngineerJobLocationType =
  | 'room'
  | 'boiler_location'
  | 'cylinder_location'
  | 'loft'
  | 'external_wall'
  | 'flue_route'
  | 'condensate_route'
  | 'discharge_route'
  | 'gas_route'
  | 'radiator'
  | 'unknown';

export type EngineerJobLocationConfidence = 'confirmed' | 'inferred' | 'needs_survey';

export interface EngineerJobLocationV1 {
  readonly locationId: string;
  readonly label: string;
  readonly type: EngineerJobLocationType;
  readonly confidence: EngineerJobLocationConfidence;
  readonly evidenceRefs: readonly string[];
}

export interface ResolveEngineerJobLocationInput {
  readonly text: string;
  readonly sourceLineId?: string;
  readonly surveyData?: EngineInputV2_3Contract;
  readonly scanData?: ScanDataInput;
  readonly implementationPack: SuggestedImplementationPackV1;
  readonly specificationLines: readonly SpecificationLineV1[];
}

function toLocationId(type: EngineerJobLocationType, label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${type}:${slug || 'default'}`;
}

function makeLocation(
  type: EngineerJobLocationType,
  label: string,
  confidence: EngineerJobLocationConfidence,
  evidenceRefs: readonly string[],
): EngineerJobLocationV1 {
  return {
    locationId: toLocationId(type, label),
    label,
    type,
    confidence,
    evidenceRefs: Array.from(new Set(evidenceRefs)),
  };
}

function findSpecificationLine(
  sourceLineId: string | undefined,
  specificationLines: readonly SpecificationLineV1[],
): SpecificationLineV1 | undefined {
  if (!sourceLineId) return undefined;
  return specificationLines.find((line) => line.lineId === sourceLineId);
}

function buildEvidenceRefs(input: ResolveEngineerJobLocationInput): string[] {
  const refs: string[] = [];
  const line = findSpecificationLine(input.sourceLineId, input.specificationLines);
  if (line) {
    refs.push(`spec_line:${line.lineId}`);
    for (const riskId of line.linkedRiskIds) refs.push(`risk:${riskId}`);
    for (const validationId of line.linkedValidationIds) refs.push(`validation:${validationId}`);
    refs.push(`spec_section:${line.sectionKey}`);
  }
  if (input.scanData?.loftInspected) refs.push('scan:loftInspected');
  if (input.scanData?.flueInspected) refs.push('scan:flueInspected');
  if (input.scanData?.pipeworkInspected) refs.push('scan:pipeworkInspected');
  if (input.scanData?.engineerNotes) refs.push('scan:engineerNotes');
  if (input.surveyData?.occupancy?.peakConcurrentOutlets != null) refs.push('survey:occupancy.peakConcurrentOutlets');
  if (input.surveyData?.property?.peakHeatLossKw != null) refs.push('survey:property.peakHeatLossKw');
  refs.push(`pack:hotWater.strategy:${input.implementationPack.hotWater.strategy}`);
  return refs;
}

function hasAnyScanEvidence(scanData: ScanDataInput | undefined): boolean {
  if (!scanData) return false;
  return Boolean(
    scanData.loftInspected
      || scanData.flueInspected
      || scanData.pipeworkInspected
      || (scanData.engineerNotes && scanData.engineerNotes.trim().length > 0),
  );
}

export function resolveEngineerJobLocation(input: ResolveEngineerJobLocationInput): EngineerJobLocationV1 {
  const text = input.text.toLowerCase();
  const evidenceRefs = buildEvidenceRefs(input);
  const hasScan = hasAnyScanEvidence(input.scanData);
  const isStoredCylinder =
    input.implementationPack.hotWater.strategy === 'stored_unvented'
    || input.implementationPack.hotWater.strategy === 'stored_vented'
    || input.implementationPack.hotWater.strategy === 'stored_mixergy'
    || input.implementationPack.hotWater.strategy === 'heat_pump_cylinder';

  if (text.includes('kitchen')) {
    return makeLocation('room', 'Kitchen', 'inferred', evidenceRefs);
  }

  if (text.includes('airing cupboard') || text.includes('cylinder cupboard')) {
    return makeLocation('room', 'Airing cupboard', 'inferred', evidenceRefs);
  }

  if (text.includes('loft') && (text.includes('tank') || text.includes('cold-feed') || text.includes('vent'))) {
    return makeLocation('loft', 'Loft', input.scanData?.loftInspected ? 'confirmed' : 'inferred', [
      ...evidenceRefs,
      'pack:pipework.topologyNotes',
    ]);
  }

  if (text.includes('tundish') || text.includes('discharge')) {
    return makeLocation('discharge_route', 'Discharge route', 'needs_survey', [
      ...evidenceRefs,
      'pack:hotWater.dischargeRequirements',
    ]);
  }

  if (text.includes('expansion vessel')) {
    return makeLocation(
      isStoredCylinder ? 'cylinder_location' : 'boiler_location',
      isStoredCylinder ? 'Airing cupboard' : 'Boiler location',
      'inferred',
      [...evidenceRefs, 'pack:hotWater.expansionManagement'],
    );
  }

  if (text.includes('filling loop')) {
    return makeLocation('boiler_location', 'Boiler location', 'inferred', [
      ...evidenceRefs,
      'pack:hydraulicComponents.suggestedComponents:filling_loop',
    ]);
  }

  if (text.includes('magnetic filter') || text.includes('primary return')) {
    return makeLocation('boiler_location', 'Boiler return / boiler location', 'inferred', [
      ...evidenceRefs,
      'pack:waterQuality.filterRecommendation',
    ]);
  }

  if (text.includes('gas') && (text.includes('pipe') || text.includes('upgrade') || text.includes('route'))) {
    return makeLocation('gas_route', 'Gas route', 'needs_survey', [
      ...evidenceRefs,
      'pack:pipework.routingNotes',
    ]);
  }

  if (text.includes('condensate')) {
    if (text.includes('external') || text.includes('outside') || text.includes('outdoor') || text.includes('wall')) {
      return makeLocation('external_wall', 'External wall', 'needs_survey', [
        ...evidenceRefs,
        'pack:heatSource.installNotes',
      ]);
    }
    return makeLocation('condensate_route', 'Condensate route', 'needs_survey', [
      ...evidenceRefs,
      'pack:heatSource.installNotes',
    ]);
  }

  if (text.includes('flue')) {
    if (text.includes('external') || text.includes('wall')) {
      return makeLocation('external_wall', 'External wall', input.scanData?.flueInspected ? 'confirmed' : 'needs_survey', [
        ...evidenceRefs,
        'pack:heatSource.installNotes',
      ]);
    }
    return makeLocation('flue_route', 'Flue route', input.scanData?.flueInspected ? 'confirmed' : 'needs_survey', [
      ...evidenceRefs,
      'pack:heatSource.installNotes',
    ]);
  }

  if (text.includes('radiator') || text.includes('emitter')) {
    if (hasScan) {
      return makeLocation('radiator', 'Radiators / emitter rooms', 'inferred', [
        ...evidenceRefs,
        'pack:risk:emitter_review_required',
      ]);
    }
    return makeLocation('unknown', 'Needs survey', 'needs_survey', evidenceRefs);
  }

  if (text.includes('cylinder')) {
    return makeLocation('cylinder_location', 'Airing cupboard', 'inferred', evidenceRefs);
  }

  if (text.includes('boiler')) {
    return makeLocation('boiler_location', 'Boiler location', 'inferred', evidenceRefs);
  }

  if (text.includes('external wall') || text.includes('outside') || text.includes('outdoor')) {
    return makeLocation('external_wall', 'External wall', 'needs_survey', evidenceRefs);
  }

  return makeLocation('unknown', 'Needs survey', 'needs_survey', evidenceRefs);
}
