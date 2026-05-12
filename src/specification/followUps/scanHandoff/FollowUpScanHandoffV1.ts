export type FollowUpScanCaptureMode =
  | 'photo'
  | 'measurement'
  | 'scan_pin'
  | 'note'
  | 'qualification_check'
  | 'customer_confirmation';

export type FollowUpScanHandoffPriority = 'blocker' | 'important' | 'optional';

export interface FollowUpScanCaptureItemV1 {
  readonly captureItemId: string;
  readonly evidenceId: string;
  readonly prompt: string;
  readonly captureMode: FollowUpScanCaptureMode;
  readonly targetLocation?: string;
  readonly acceptanceCriteria: readonly string[];
  readonly linkedTaskIds: readonly string[];
  readonly linkedLineIds: readonly string[];
  readonly linkedMaterialIds: readonly string[];
  readonly priority: FollowUpScanHandoffPriority;
}

export interface FollowUpScanUnresolvedDependencyV1 {
  readonly dependencyId: string;
  readonly evidenceId: string;
  readonly prompt: string;
  readonly dependencyType: Extract<FollowUpScanCaptureMode, 'qualification_check' | 'customer_confirmation'>;
  readonly linkedTaskIds: readonly string[];
  readonly priority: FollowUpScanHandoffPriority;
}

export interface FollowUpScanHandoffV1 {
  readonly handoffId: string;
  readonly visitReference?: string;
  readonly sourcePlanId: string;
  readonly createdAt: string;
  readonly captureItems: readonly FollowUpScanCaptureItemV1[];
  readonly unresolvedDependencies: readonly FollowUpScanUnresolvedDependencyV1[];
}
