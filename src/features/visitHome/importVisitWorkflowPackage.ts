/**
 * importVisitWorkflowPackage.ts
 *
 * Parse and validate a workflow export package (the JSON file produced by the
 * Visit Home "Export handover package" action).
 *
 * The export format is:
 *   {
 *     visitId:       string
 *     visitReference: string
 *     exportedAt:    ISO-8601 string
 *     engineInput?:  EngineInputV2_3
 *     surveyModel?:  FullSurveyModelV1
 *   }
 *
 * After import callers receive a canonical hydration payload that can be
 * applied to app state (setActiveVisitId, setLabEngineInput, etc.).
 * No engine logic runs here — that remains in App.tsx.
 */

import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

// ── Package shape ─────────────────────────────────────────────────────────────

export interface VisitWorkflowPackage {
  readonly visitId: string;
  readonly visitReference: string;
  readonly exportedAt: string;
  readonly engineInput?: EngineInputV2_3;
  readonly surveyModel?: FullSurveyModelV1;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface WorkflowPackageImportSuccess {
  readonly status: 'imported';
  readonly visitId: string;
  readonly visitReference: string;
  readonly exportedAt: string;
  readonly engineInput?: EngineInputV2_3;
  readonly surveyModel?: FullSurveyModelV1;
}

export interface WorkflowPackageImportFailure {
  readonly status: 'failed';
  readonly errors: readonly string[];
}

export type WorkflowPackageImportResult =
  | WorkflowPackageImportSuccess
  | WorkflowPackageImportFailure;

// ── Validation ────────────────────────────────────────────────────────────────

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validatePackageShape(raw: unknown): raw is VisitWorkflowPackage {
  if (raw == null || typeof raw !== 'object') return false;
  const pkg = raw as Partial<VisitWorkflowPackage>;
  if (!isNonEmptyString(pkg.visitId)) return false;
  if (!isNonEmptyString(pkg.visitReference)) return false;
  if (!isNonEmptyString(pkg.exportedAt)) return false;
  return true;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * parseWorkflowPackageJson — parse and validate a JSON string or object
 * representing a workflow export package.
 *
 * Accepts:
 *   - the raw JSON string from a file upload
 *   - a pre-parsed plain object (for tests)
 */
export function parseWorkflowPackageJson(
  input: string | unknown,
): WorkflowPackageImportResult {
  let parsed: unknown;

  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input) as unknown;
    } catch {
      return {
        status: 'failed',
        errors: ['File is not valid JSON. Ensure this is an Atlas workflow export package.'],
      };
    }
  } else {
    parsed = input;
  }

  if (!validatePackageShape(parsed)) {
    return {
      status: 'failed',
      errors: [
        'Package structure is invalid. Expected visitId, visitReference, and exportedAt fields.',
      ],
    };
  }

  return {
    status: 'imported',
    visitId: parsed.visitId,
    visitReference: parsed.visitReference,
    exportedAt: parsed.exportedAt,
    engineInput: (parsed as VisitWorkflowPackage).engineInput,
    surveyModel: (parsed as VisitWorkflowPackage).surveyModel,
  };
}

/**
 * readWorkflowPackageFile — read a File from a file input and parse it.
 *
 * Returns a Promise that resolves to a WorkflowPackageImportResult.
 */
export async function readWorkflowPackageFile(
  file: File,
): Promise<WorkflowPackageImportResult> {
  const text = await file.text();
  return parseWorkflowPackageJson(text);
}
