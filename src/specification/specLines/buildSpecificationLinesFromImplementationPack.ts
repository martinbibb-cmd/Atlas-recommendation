import type {
  SuggestedComponent,
  SuggestedImplementationPackV1,
  UnresolvedRisk,
} from '../SuggestedImplementationPackV1';
import type {
  SpecificationLineConfidence,
  SpecificationLineSectionKey,
  SpecificationLineStatus,
  SpecificationLineType,
  SpecificationLineV1,
} from './SpecificationLineV1';

interface LineSeed {
  sectionKey: SpecificationLineSectionKey;
  idHint: string;
  label: string;
  description: string;
  lineType: SpecificationLineType;
  status?: SpecificationLineStatus;
  confidence: SpecificationLineConfidence;
  reason: string;
  customerVisible?: boolean;
  engineerVisible?: boolean;
  officeVisible?: boolean;
  linkedRiskIds?: readonly string[];
  linkedValidationIds?: readonly string[];
  quantity?: number;
  unit?: string;
}

const SECTION_ORDER: readonly SpecificationLineSectionKey[] = [
  'heat_source',
  'hot_water',
  'hydraulic_components',
  'water_quality',
  'safety_compliance',
  'pipework',
];

function confidenceFromComponent(component: SuggestedComponent): SpecificationLineConfidence {
  if (component.confidence === 'required') return 'confirmed';
  if (component.confidence === 'suggested') return 'inferred';
  return 'needs_survey';
}

function deduplicate(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function findValidationIdsBySubstringMatch(pack: SuggestedImplementationPackV1, text: string): string[] {
  const lower = text.toLowerCase();
  return pack.allRequiredValidations
    .filter((validation) => {
      const check = validation.check.toLowerCase();
      const reason = validation.reason.toLowerCase();
      return check.includes(lower) || reason.includes(lower);
    })
    .map((validation) => validation.id);
}

function buildRiskValidationLink(pack: SuggestedImplementationPackV1, risk: UnresolvedRisk): string[] {
  const validationForRisk = pack.allRequiredValidations.find((validation) => validation.id === `validation_${risk.id}`);
  if (validationForRisk) return [validationForRisk.id];
  return findValidationIdsBySubstringMatch(pack, risk.description);
}

function findNoteByKeywords(notes: readonly string[], keywords: readonly string[]): string | undefined {
  return notes.find((note) => {
    const lower = note.toLowerCase();
    return keywords.every((keyword) => lower.includes(keyword.toLowerCase()));
  });
}

export function buildSpecificationLinesFromImplementationPack(
  pack: SuggestedImplementationPackV1,
): SpecificationLineV1[] {
  const seeds: LineSeed[] = [];

  const unventedCylinder = pack.hotWater.suggestedComponents.find((component) => component.id === 'unvented_cylinder');
  if (unventedCylinder) {
    seeds.push({
      sectionKey: 'hot_water',
      idHint: 'unvented-cylinder-material',
      label: 'Unvented cylinder specification',
      description: unventedCylinder.suggestedSpec ?? unventedCylinder.description,
      lineType: 'material_suggestion',
      confidence: confidenceFromComponent(unventedCylinder),
      reason: unventedCylinder.rationale,
    });
    seeds.push({
      sectionKey: 'hot_water',
      idHint: 'unvented-cylinder-scope',
      label: 'Install unvented cylinder package',
      description: 'Include cylinder installation, connections, safety controls, and commissioning scope.',
      lineType: 'included_scope',
      confidence: 'confirmed',
      reason: 'Stored unvented strategy selected for this recommendation.',
    });
  }

  const g3Qualification = pack.safetyCompliance.requiredQualifications.find((qualification) => qualification.id === 'g3_unvented');
  if (g3Qualification) {
    seeds.push({
      sectionKey: 'safety_compliance',
      idHint: 'g3-qualification',
      label: g3Qualification.label,
      description: g3Qualification.triggeredBy,
      lineType: 'compliance_item',
      confidence: 'confirmed',
      reason: g3Qualification.reference ?? 'G3 qualification requirement present in implementation pack.',
    });
  }

  const unventedCylinderComponent = pack.hotWater.suggestedComponents.find((component) => component.id === 'unvented_cylinder' || component.id === 'mixergy_cylinder');
  const tundishNote = pack.hotWater.dischargeRequirements?.find((line) => line.toLowerCase().includes('tundish'));
  if (tundishNote) {
    seeds.push({
      sectionKey: 'hot_water',
      idHint: 'tundish-validation',
      label: 'Validate tundish and discharge route',
      description: tundishNote,
      lineType: 'required_validation',
      confidence: 'needs_survey',
      reason: 'Atlas cannot confirm discharge route accessibility from survey data alone.',
      linkedValidationIds: deduplicate(
        findValidationIdsBySubstringMatch(pack, 'discharge')
          .concat(findValidationIdsBySubstringMatch(pack, 'tundish')),
      ),
    });

    seeds.push({
      sectionKey: 'hot_water',
      idHint: 'tundish-material',
      label: 'Tundish and discharge materials',
      description: 'Include tundish and compliant discharge pipe sizing/fittings to suit final route.',
      lineType: 'material_suggestion',
      confidence: unventedCylinderComponent ? confidenceFromComponent(unventedCylinderComponent) : 'inferred',
      reason: 'Unvented discharge safeguards require compliant tundish and discharge pipework.',
      customerVisible: false,
    });
  }

  const expansionLines = pack.hotWater.expansionManagement ?? [];
  if (expansionLines.length > 0) {
    const expansionSizing = expansionLines.find((line) => line.toLowerCase().includes('expansion vessel'));
    if (expansionSizing) {
      seeds.push({
        sectionKey: 'hot_water',
        idHint: 'expansion-installer-note',
        label: 'Expansion vessel sizing note',
        description: expansionSizing,
        lineType: 'installer_note',
        confidence: 'needs_survey',
        reason: 'Expansion vessel and pressure settings require final site confirmation.',
        customerVisible: false,
      });
    }

    seeds.push({
      sectionKey: 'hot_water',
      idHint: 'expansion-material',
      label: 'Expansion management kit',
      description: 'Include expansion vessel, PRV, ERV, and T&P valve hardware to manufacturer sizing.',
      lineType: 'material_suggestion',
      confidence: 'inferred',
      reason: 'Stored hot water design requires expansion and relief management hardware.',
      customerVisible: false,
    });
  }

  const fillingLoop = pack.hydraulicComponents.suggestedComponents.find((component) => component.id === 'filling_loop');
  if (fillingLoop) {
    seeds.push({
      sectionKey: 'hydraulic_components',
      idHint: 'filling-loop-material',
      label: 'Filling loop assembly',
      description: fillingLoop.suggestedSpec ?? fillingLoop.description,
      lineType: 'material_suggestion',
      confidence: confidenceFromComponent(fillingLoop),
      reason: fillingLoop.rationale,
      customerVisible: false,
    });
  }

  const loftCapping = pack.pipework.suggestedComponents.find((component) => component.id === 'loft_pipework_capping');
  const loftRisk = pack.pipework.unresolvedRisks.find((risk) => risk.id === 'loft_pipe_routes_unconfirmed');
  if (loftCapping) {
    seeds.push({
      sectionKey: 'pipework',
      idHint: 'loft-capping-scope',
      label: 'Loft vent/cold-feed capping scope',
      description: loftCapping.description,
      lineType: 'included_scope',
      confidence: confidenceFromComponent(loftCapping),
      reason: loftCapping.rationale,
      linkedRiskIds: loftRisk ? [loftRisk.id] : [],
      linkedValidationIds: loftRisk ? buildRiskValidationLink(pack, loftRisk) : [],
    });
  }
  const loftRemovalNote =
    findNoteByKeywords(pack.pipework.topologyNotes, ['loft', 'tank', 'capped'])
    ?? findNoteByKeywords(pack.pipework.topologyNotes, ['loft', 'tank', 'removed']);
  if (loftRemovalNote) {
    seeds.push({
      sectionKey: 'pipework',
      idHint: 'loft-removal-scope',
      label: 'Loft tank removal scope',
      description: loftRemovalNote,
      lineType: 'included_scope',
      confidence: 'inferred',
      reason: 'Open-vented conversion requires removal/capping of legacy loft-fed connections.',
    });
  }
  if (loftRisk) {
    seeds.push({
      sectionKey: 'pipework',
      idHint: 'loft-capping-validation',
      label: 'Validate loft vent/cold-feed routes',
      description: loftRisk.resolution,
      lineType: 'required_validation',
      confidence: 'needs_survey',
      reason: loftRisk.description,
      linkedRiskIds: [loftRisk.id],
      linkedValidationIds: buildRiskValidationLink(pack, loftRisk),
    });
  }

  const magneticFilter = pack.waterQuality.suggestedComponents.find((component) => component.id === 'magnetic_filter');
  if (magneticFilter) {
    seeds.push({
      sectionKey: 'water_quality',
      idHint: 'magnetic-filter-material',
      label: 'Magnetic filter',
      description: magneticFilter.suggestedSpec ?? magneticFilter.description,
      lineType: 'material_suggestion',
      confidence: confidenceFromComponent(magneticFilter),
      reason: magneticFilter.rationale,
    });
  }

  if (pack.waterQuality.flushStrategy) {
    seeds.push({
      sectionKey: 'water_quality',
      idHint: 'flush-strategy',
      label: 'Primary circuit flush strategy',
      description: pack.waterQuality.flushStrategy,
      lineType: 'included_scope',
      status: 'needs_check',
      confidence: 'needs_survey',
      reason: 'Final flush method depends on confirmed on-site water condition before commissioning.',
    });
  }

  const inhibitor = pack.waterQuality.suggestedComponents.find((component) => component.id === 'inhibitor');
  if (inhibitor) {
    seeds.push({
      sectionKey: 'water_quality',
      idHint: 'inhibitor-material',
      label: 'Inhibitor dosing',
      description: inhibitor.suggestedSpec ?? inhibitor.description,
      lineType: 'material_suggestion',
      confidence: confidenceFromComponent(inhibitor),
      reason: inhibitor.rationale,
    });
  }

  const mcsQualification = pack.safetyCompliance.requiredQualifications.find((qualification) => qualification.id === 'mcs_installer');
  if (mcsQualification) {
    seeds.push({
      sectionKey: 'safety_compliance',
      idHint: 'mcs-compliance',
      label: mcsQualification.label,
      description: mcsQualification.triggeredBy,
      lineType: 'compliance_item',
      confidence: 'confirmed',
      reason: mcsQualification.reference ?? 'MCS route selected by implementation pack.',
    });
  }

  const emitterRisk = pack.heatSource.unresolvedRisks.find((risk) => risk.id === 'emitter_review_required');
  if (emitterRisk) {
    seeds.push({
      sectionKey: 'heat_source',
      idHint: 'emitter-review-validation',
      label: 'Emitter suitability review',
      description: emitterRisk.resolution,
      lineType: 'required_validation',
      confidence: 'needs_survey',
      reason: emitterRisk.description,
      linkedRiskIds: [emitterRisk.id],
      linkedValidationIds: buildRiskValidationLink(pack, emitterRisk),
      customerVisible: false,
    });
  }

  const counts = new Map<string, number>();
  const lines = seeds
    .sort((a, b) => {
      const sectionDelta = SECTION_ORDER.indexOf(a.sectionKey) - SECTION_ORDER.indexOf(b.sectionKey);
      if (sectionDelta !== 0) return sectionDelta;
      return a.idHint.localeCompare(b.idHint);
    })
    .map((seed) => {
      const baseId = `${seed.sectionKey}:${seed.idHint}`;
      const nextCount = (counts.get(baseId) ?? 0) + 1;
      counts.set(baseId, nextCount);
      return {
        lineId: `${baseId}:${nextCount}`,
        sectionKey: seed.sectionKey,
        sourceRecommendationId: pack.recommendedScenarioId,
        label: seed.label,
        description: seed.description,
        lineType: seed.lineType,
        status: seed.status ?? 'suggested',
        confidence: seed.confidence,
        reason: seed.reason,
        customerVisible: seed.customerVisible ?? true,
        engineerVisible: seed.engineerVisible ?? true,
        officeVisible: seed.officeVisible ?? true,
        linkedRiskIds: seed.linkedRiskIds ?? [],
        linkedValidationIds: seed.linkedValidationIds ?? [],
        ...(seed.quantity !== undefined ? { quantity: seed.quantity } : {}),
        ...(seed.unit !== undefined ? { unit: seed.unit } : {}),
      } satisfies SpecificationLineV1;
    });

  return lines;
}
