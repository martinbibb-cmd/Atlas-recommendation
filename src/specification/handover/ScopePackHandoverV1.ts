import type {
  ImplementationNoteSeverity,
  RequiredComplianceItem,
  RequiredQualification,
  RequiredValidation,
  UnresolvedRisk,
} from '../SuggestedImplementationPackV1';
import type {
  SpecificationLineSectionKey,
  SpecificationLineType,
} from '../specLines/SpecificationLineV1';

export interface ScopePackHandoverLineItemV1 {
  readonly lineId: string;
  readonly packId: string;
  readonly packLabel: string;
  readonly sectionKey: SpecificationLineSectionKey;
  readonly lineType: SpecificationLineType;
  readonly label: string;
  readonly description: string;
}

export interface ScopePackHandoverPackSummaryV1 {
  readonly packId: string;
  readonly packLabel: string;
  readonly summary: string;
  readonly lines: readonly ScopePackHandoverLineItemV1[];
}

export interface ScopePackHandoverUnresolvedCheckV1 {
  readonly sourceType: 'pack' | 'line';
  readonly sourceId: string;
  readonly label: string;
  readonly detail: string;
}

export interface ScopePackExcludedOrDeferredItemV1 {
  readonly sourceType: 'pack' | 'line';
  readonly sourceId: string;
  readonly label: string;
  readonly detail: string;
  readonly status: string;
}

export interface ScopePackHandoverCustomerScopeSummaryV1 {
  readonly packs: readonly ScopePackHandoverPackSummaryV1[];
}

export interface ScopePackHandoverEngineerInstallNotesV1 {
  readonly packs: readonly ScopePackHandoverPackSummaryV1[];
  readonly validations: readonly RequiredValidation[];
  readonly risks: readonly UnresolvedRisk[];
  readonly commissioningNotes: readonly string[];
  readonly unresolvedChecks: readonly ScopePackHandoverUnresolvedCheckV1[];
}

export interface ScopePackHandoverOfficeReviewSummaryV1 {
  readonly packs: readonly ScopePackHandoverPackSummaryV1[];
  readonly qualifications: readonly RequiredQualification[];
  readonly compliance: readonly RequiredComplianceItem[];
  readonly unresolvedChecks: readonly ScopePackHandoverUnresolvedCheckV1[];
}

export interface ScopePackHandoverComplianceChecklistItemV1 {
  readonly id: string;
  readonly category: 'qualification' | 'compliance';
  readonly label: string;
  readonly detail: string;
}

export interface ScopePackHandoverValidationChecklistItemV1 {
  readonly id: string;
  readonly check: string;
  readonly reason: string;
  readonly severity: ImplementationNoteSeverity;
}

export interface ScopePackHandoverV1 {
  readonly handoverVersion: 'v1';
  readonly customerScopeSummary: ScopePackHandoverCustomerScopeSummaryV1;
  readonly engineerInstallNotes: ScopePackHandoverEngineerInstallNotesV1;
  readonly officeReviewSummary: ScopePackHandoverOfficeReviewSummaryV1;
  readonly complianceChecklist: readonly ScopePackHandoverComplianceChecklistItemV1[];
  readonly validationChecklist: readonly ScopePackHandoverValidationChecklistItemV1[];
  readonly excludedOrDeferredItems: readonly ScopePackExcludedOrDeferredItemV1[];
}
