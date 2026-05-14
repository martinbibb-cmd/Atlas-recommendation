import {
  TRIAL_READINESS_PACK_REQUIRED_FILES,
  TRIAL_READINESS_PACK_SCHEMA,
  TRIAL_READINESS_PACK_VERSION,
  type TrialReadinessPackV1,
} from './TrialReadinessPackV1';

export type TrialReadinessPackValidationResult =
  | { readonly ok: true; readonly pack: TrialReadinessPackV1 }
  | { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasAllRequiredFiles(files: Record<string, unknown>): boolean {
  return TRIAL_READINESS_PACK_REQUIRED_FILES.every((name) => name in files);
}

function hasCustomerVisitPayloads(scenarios: unknown): boolean {
  if (!Array.isArray(scenarios)) return false;
  return scenarios.some((entry) => isRecord(entry) && ('visit' in entry || 'workflowState' in entry));
}

export function validateTrialReadinessPack(raw: unknown): TrialReadinessPackValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: 'Import failed: pack root must be an object.' };
  }
  if (raw['schema'] !== TRIAL_READINESS_PACK_SCHEMA) {
    return { ok: false, reason: `Import failed: schema mismatch. Expected "${TRIAL_READINESS_PACK_SCHEMA}".` };
  }
  if (raw['version'] !== TRIAL_READINESS_PACK_VERSION) {
    return { ok: false, reason: `Import failed: version mismatch. Expected "${TRIAL_READINESS_PACK_VERSION}".` };
  }
  if (typeof raw['folderName'] !== 'string') {
    return { ok: false, reason: 'Import failed: missing folderName.' };
  }
  if (!isRecord(raw['files'])) {
    return { ok: false, reason: 'Import failed: files must be an object.' };
  }

  const files = raw['files'];
  if (!hasAllRequiredFiles(files)) {
    return { ok: false, reason: 'Import failed: pack is missing required files.' };
  }

  const manifest = files['manifest.json'];
  if (!isRecord(manifest)) {
    return { ok: false, reason: 'Import failed: manifest.json must be an object.' };
  }
  if (manifest['schema'] !== TRIAL_READINESS_PACK_SCHEMA || manifest['version'] !== TRIAL_READINESS_PACK_VERSION) {
    return { ok: false, reason: 'Import failed: manifest schema/version mismatch.' };
  }
  if (typeof manifest['exportedAt'] !== 'string') {
    return { ok: false, reason: 'Import failed: manifest missing exportedAt.' };
  }

  if (hasCustomerVisitPayloads(files['workspace-lifecycle-scenarios.json'])) {
    return { ok: false, reason: 'Import failed: workspace lifecycle scenarios include customer visit payloads.' };
  }

  return { ok: true, pack: raw as TrialReadinessPackV1 };
}
