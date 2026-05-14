import type { WorkflowVisibility } from './WorkflowVisibilityV1';

export interface ClassifyWorkflowVisibilityInput {
  readonly text: string;
  readonly preferCustomerSummary?: boolean;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stableUnique(values: readonly WorkflowVisibility[]): WorkflowVisibility[] {
  const seen = new Set<WorkflowVisibility>();
  const unique: WorkflowVisibility[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

export function classifyWorkflowVisibility(
  input: ClassifyWorkflowVisibilityInput,
): readonly WorkflowVisibility[] {
  const text = normalize(input.text);
  const policies: WorkflowVisibility[] = [];

  if (/customer|consent|permission|access|disruption|occupant|confirm with customer/.test(text)) {
    policies.push('customer_action_required');
  }

  if (/g3|mcs|qualification|certificate|certification|benchmark|bs7593|compliance|audit/.test(text)) {
    policies.push('office_only', 'compliance_audit');
  }

  if (/inhibitor|dosing|fill pressure|filling loop|zone valve|commissioning|water quality treatment|expansion vessel|powerflush|pipework|mechanic/.test(text)) {
    policies.push('installer_only');
  }

  if (input.preferCustomerSummary || /may be required|confirmed|suitability|location to confirm on survey|impact|outcome/.test(text)) {
    policies.push('customer_summary');
  }

  if (policies.length === 0) {
    policies.push('installer_only');
  }

  return stableUnique(policies);
}
