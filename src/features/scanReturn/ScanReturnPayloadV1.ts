export const SCAN_RETURN_PAYLOAD_SCHEMA = 'atlas.scan-return-payload' as const;
export const SCAN_RETURN_PAYLOAD_VERSION = '1.0' as const;

export interface ScanReturnSourceV1 {
  readonly surface: 'atlas_scan';
  readonly sessionId?: string;
  readonly deviceModel?: string;
}

export interface ScanRoomGeometryV1 {
  readonly roomId: string;
  readonly label?: string;
  readonly floorIndex?: number;
  readonly areaM2?: number;
}

export interface ScanObjectPlacementV1 {
  readonly placementId: string;
  readonly objectType: string;
  readonly roomId?: string;
  readonly label?: string;
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
}

export interface ScanMeasurementV1 {
  readonly measurementId: string;
  readonly roomId?: string;
  readonly label?: string;
  readonly value?: number;
  readonly unit?: string;
}

export interface ScanEvidenceUpdateBlockV1 {
  readonly photoRefs?: readonly string[];
  readonly voiceNoteRefs?: readonly string[];
  readonly roomGeometry?: readonly ScanRoomGeometryV1[];
  readonly objectPlacements?: readonly ScanObjectPlacementV1[];
  readonly measurements?: readonly ScanMeasurementV1[];
  readonly captureMetadata?: Readonly<Record<string, unknown>>;
}

export interface ScanSurveyObservationUpdateV1 {
  readonly topLevel?: Readonly<Record<string, unknown>>;
  readonly fullSurvey?: Readonly<Record<string, unknown>>;
}

export interface ScanReturnPayloadV1 {
  readonly schema: typeof SCAN_RETURN_PAYLOAD_SCHEMA;
  readonly version: typeof SCAN_RETURN_PAYLOAD_VERSION;
  readonly visitIdentity: {
    readonly visitId?: string;
    readonly visitReference?: string;
  };
  readonly returnedAt: string;
  readonly source: ScanReturnSourceV1;
  readonly updates: {
    readonly scanEvidence?: ScanEvidenceUpdateBlockV1;
    readonly surveyObservations?: ScanSurveyObservationUpdateV1;
  };
}

export type ScanReturnPayloadValidationResult =
  | { readonly ok: true; readonly payload: ScanReturnPayloadV1 }
  | { readonly ok: false; readonly errors: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  if (!hasText(value)) return false;
  return Number.isFinite(new Date(value).getTime());
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function validateIdentifiedArray(
  value: unknown,
  path: string,
  idKey: string,
): readonly string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [`${path} must be an array.`];
  const errors: string[] = [];
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`${path}[${index}] must be an object.`);
      return;
    }
    if (!hasText(entry[idKey])) {
      errors.push(`${path}[${index}].${idKey} must be a non-empty string.`);
    }
  });
  return errors;
}

export function validateScanReturnPayload(raw: unknown): ScanReturnPayloadValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, errors: ['Scan return payload root must be an object.'] };
  }

  if (raw['schema'] !== SCAN_RETURN_PAYLOAD_SCHEMA) {
    return {
      ok: false,
      errors: [
        `Schema mismatch: expected "${SCAN_RETURN_PAYLOAD_SCHEMA}" but received "${String(raw['schema'])}".`,
      ],
    };
  }

  if (raw['version'] !== SCAN_RETURN_PAYLOAD_VERSION) {
    return {
      ok: false,
      errors: [
        `Version mismatch: expected "${SCAN_RETURN_PAYLOAD_VERSION}" but received "${String(raw['version'])}".`,
      ],
    };
  }

  if (!isRecord(raw['visitIdentity'])) {
    return { ok: false, errors: ['visitIdentity must be an object.'] };
  }
  const visitIdentity = raw['visitIdentity'];
  if (!hasText(visitIdentity['visitId']) && !hasText(visitIdentity['visitReference'])) {
    return { ok: false, errors: ['visitIdentity must include visitId or visitReference.'] };
  }

  if (!isIsoDate(raw['returnedAt'])) {
    return { ok: false, errors: ['returnedAt must be a valid ISO-8601 timestamp string.'] };
  }

  if (!isRecord(raw['source'])) {
    return { ok: false, errors: ['source must be an object.'] };
  }
  if (raw['source']['surface'] !== 'atlas_scan') {
    return { ok: false, errors: ['source.surface must be "atlas_scan".'] };
  }

  if (!isRecord(raw['updates'])) {
    return { ok: false, errors: ['updates must be an object.'] };
  }

  const errors: string[] = [];
  const updates = raw['updates'];
  const scanEvidence = isRecord(updates['scanEvidence']) ? updates['scanEvidence'] : undefined;
  if (updates['scanEvidence'] != null && scanEvidence == null) {
    errors.push('updates.scanEvidence must be an object when provided.');
  }
  if (scanEvidence != null) {
    if (scanEvidence['photoRefs'] != null && !isStringArray(scanEvidence['photoRefs'])) {
      errors.push('updates.scanEvidence.photoRefs must be an array of strings.');
    }
    if (scanEvidence['voiceNoteRefs'] != null && !isStringArray(scanEvidence['voiceNoteRefs'])) {
      errors.push('updates.scanEvidence.voiceNoteRefs must be an array of strings.');
    }
    errors.push(...validateIdentifiedArray(scanEvidence['roomGeometry'], 'updates.scanEvidence.roomGeometry', 'roomId'));
    errors.push(...validateIdentifiedArray(scanEvidence['objectPlacements'], 'updates.scanEvidence.objectPlacements', 'placementId'));
    errors.push(...validateIdentifiedArray(scanEvidence['measurements'], 'updates.scanEvidence.measurements', 'measurementId'));
    if (scanEvidence['captureMetadata'] != null && !isRecord(scanEvidence['captureMetadata'])) {
      errors.push('updates.scanEvidence.captureMetadata must be an object.');
    }
  }

  const surveyObservations = updates['surveyObservations'];
  if (surveyObservations != null) {
    if (!isRecord(surveyObservations)) {
      errors.push('updates.surveyObservations must be an object when provided.');
    } else {
      if (surveyObservations['topLevel'] != null && !isRecord(surveyObservations['topLevel'])) {
        errors.push('updates.surveyObservations.topLevel must be an object.');
      }
      if (surveyObservations['fullSurvey'] != null && !isRecord(surveyObservations['fullSurvey'])) {
        errors.push('updates.surveyObservations.fullSurvey must be an object.');
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, payload: raw as unknown as ScanReturnPayloadV1 };
}

export function parseScanReturnPayload(input: string | unknown): ScanReturnPayloadValidationResult {
  if (typeof input !== 'string') {
    return validateScanReturnPayload(input);
  }
  try {
    return validateScanReturnPayload(JSON.parse(input) as unknown);
  } catch {
    return { ok: false, errors: ['Scan return payload is not valid JSON.'] };
  }
}
