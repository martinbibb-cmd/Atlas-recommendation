export type WorkflowVisibility =
  | 'internal_hidden'
  | 'installer_only'
  | 'office_only'
  | 'customer_summary'
  | 'customer_action_required'
  | 'compliance_audit';

export type WorkflowAudienceRole = 'customer' | 'installer' | 'office' | 'audit';

export type ReadinessCheckSeverityV1 = 'blocker' | 'warning' | 'info';

export interface ReadinessCheckV1 {
  readonly checkId: string;
  readonly text: string;
  readonly severity: ReadinessCheckSeverityV1;
  readonly visibility: readonly WorkflowVisibility[];
}

export interface ChecklistLineV1 {
  readonly lineId: string;
  readonly label: string;
  readonly detail?: string;
  readonly visibility: readonly WorkflowVisibility[];
}
