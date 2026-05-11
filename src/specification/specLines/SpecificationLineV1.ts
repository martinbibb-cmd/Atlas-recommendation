export type SpecificationLineType =
  | 'included_scope'
  | 'required_validation'
  | 'provisional_allowance'
  | 'compliance_item'
  | 'installer_note'
  | 'material_suggestion';

export type SpecificationLineStatus =
  | 'suggested'
  | 'accepted'
  | 'edited'
  | 'removed'
  | 'needs_check';

export type SpecificationLineConfidence = 'confirmed' | 'inferred' | 'needs_survey';

export type SpecificationLineSectionKey =
  | 'heat_source'
  | 'hot_water'
  | 'hydraulic_components'
  | 'water_quality'
  | 'safety_compliance'
  | 'pipework';

export interface SpecificationLineV1 {
  readonly lineId: string;
  readonly sectionKey: SpecificationLineSectionKey;
  readonly sourceRecommendationId: string;
  readonly label: string;
  readonly description: string;
  readonly lineType: SpecificationLineType;
  readonly status: SpecificationLineStatus;
  readonly quantity?: number;
  readonly unit?: string;
  readonly confidence: SpecificationLineConfidence;
  readonly reason: string;
  readonly customerVisible: boolean;
  readonly engineerVisible: boolean;
  readonly officeVisible: boolean;
  readonly linkedRiskIds: readonly string[];
  readonly linkedValidationIds: readonly string[];
}
