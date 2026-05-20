import type { CanonicalVisitPackageV1 } from '../visitPackage/CanonicalVisitPackageV1';
import type {
  ScanMeasurementV1,
  ScanObjectPlacementV1,
  ScanReturnPayloadV1,
  ScanRoomGeometryV1,
} from './ScanReturnPayloadV1';

interface ScanRecordAttributionV1 {
  readonly updatedAt: string;
  readonly source: 'atlas_scan';
  readonly sessionId?: string;
}

interface ScanAttributedRoomGeometryV1 extends ScanRoomGeometryV1 {
  readonly _meta: ScanRecordAttributionV1;
}

interface ScanAttributedObjectPlacementV1 extends ScanObjectPlacementV1 {
  readonly _meta: ScanRecordAttributionV1;
}

interface ScanAttributedMeasurementV1 extends ScanMeasurementV1 {
  readonly _meta: ScanRecordAttributionV1;
}

interface CanonicalScanEvidenceRefsV1 {
  readonly schema: 'atlas.scan-evidence-refs';
  readonly version: '1.0';
  readonly photoRefs: readonly string[];
  readonly voiceNoteRefs: readonly string[];
  readonly roomGeometry: readonly ScanAttributedRoomGeometryV1[];
  readonly objectPlacements: readonly ScanAttributedObjectPlacementV1[];
  readonly measurements: readonly ScanAttributedMeasurementV1[];
  readonly captureMetadata: Readonly<Record<string, unknown>>;
  readonly captureMetadataAttribution: Readonly<Record<string, ScanRecordAttributionV1>>;
  readonly attribution: {
    readonly lastMergedAt: string;
    readonly lastMergedFrom: 'atlas_scan';
    readonly mergeCount: number;
    readonly sources: readonly string[];
  };
}

export interface ScanReturnMergeConflictV1 {
  readonly path: string;
  readonly reason: string;
}

export interface ScanReturnMergeResultV1 {
  readonly pkg: CanonicalVisitPackageV1;
  readonly conflicts: readonly ScanReturnMergeConflictV1[];
}

const PROTECTED_SURVEY_KEYS = new Set(['recommendation', 'proposalTruth', 'generatedOutputStatus', 'visitEnvelope']);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function normaliseAttribution(raw: unknown): ScanRecordAttributionV1 | null {
  const record = asRecord(raw);
  if (record == null) return null;
  if (record['source'] !== 'atlas_scan') return null;
  if (typeof record['updatedAt'] !== 'string') return null;
  return {
    updatedAt: record['updatedAt'],
    source: 'atlas_scan',
    sessionId: typeof record['sessionId'] === 'string' ? record['sessionId'] : undefined,
  };
}

function toTimestamp(value: string | undefined): number {
  if (value == null) return Number.NaN;
  return new Date(value).getTime();
}

function asCanonicalScanEvidenceRefs(raw: unknown): CanonicalScanEvidenceRefsV1 {
  const record = asRecord(raw);
  const roomGeometryRaw = Array.isArray(record?.['roomGeometry']) ? record?.['roomGeometry'] : [];
  const objectPlacementsRaw = Array.isArray(record?.['objectPlacements']) ? record?.['objectPlacements'] : [];
  const measurementsRaw = Array.isArray(record?.['measurements']) ? record?.['measurements'] : [];
  const metadata = asRecord(record?.['captureMetadata']) ?? {};
  const metadataAttribution = asRecord(record?.['captureMetadataAttribution']) ?? {};
  const mergeCountRaw = typeof record?.['attribution'] === 'object'
    ? asRecord(record?.['attribution'])?.['mergeCount']
    : undefined;
  const mergeCount = typeof mergeCountRaw === 'number' && Number.isFinite(mergeCountRaw) ? mergeCountRaw : 0;
  const sources = asStringArray(asRecord(record?.['attribution'])?.['sources']);

  const mapWithAttribution = <T extends object>(input: unknown[]): T[] =>
    input
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => entry != null)
      .map((entry) => {
        const _meta = normaliseAttribution(entry['_meta']) ?? {
          updatedAt: '1970-01-01T00:00:00.000Z',
          source: 'atlas_scan' as const,
        };
        return { ...(entry as unknown as T), _meta };
      });

  return {
    schema: 'atlas.scan-evidence-refs',
    version: '1.0',
    photoRefs: asStringArray(record?.['photoRefs']),
    voiceNoteRefs: asStringArray(record?.['voiceNoteRefs']),
    roomGeometry: mapWithAttribution<ScanAttributedRoomGeometryV1>(roomGeometryRaw),
    objectPlacements: mapWithAttribution<ScanAttributedObjectPlacementV1>(objectPlacementsRaw),
    measurements: mapWithAttribution<ScanAttributedMeasurementV1>(measurementsRaw),
    captureMetadata: metadata,
    captureMetadataAttribution: Object.fromEntries(
      Object.entries(metadataAttribution)
        .map(([key, value]) => [key, normaliseAttribution(value)])
        .filter((entry): entry is [string, ScanRecordAttributionV1] => entry[1] != null),
    ),
    attribution: {
      lastMergedAt: typeof asRecord(record?.['attribution'])?.['lastMergedAt'] === 'string'
        ? (asRecord(record?.['attribution'])?.['lastMergedAt'] as string)
        : '1970-01-01T00:00:00.000Z',
      lastMergedFrom: 'atlas_scan',
      mergeCount,
      sources,
    },
  };
}

function mergeById<T extends object & { _meta: ScanRecordAttributionV1 }>(
  existing: readonly T[],
  incoming: readonly Omit<T, '_meta'>[] | undefined,
  idKey: keyof Omit<T, '_meta'>,
  returnedAt: string,
  source: ScanReturnPayloadV1['source'],
  path: string,
  conflicts: ScanReturnMergeConflictV1[],
): T[] {
  if (!incoming || incoming.length === 0) return [...existing];
  const next = [...existing];
  const returnedTs = toTimestamp(returnedAt);

  for (const entry of incoming) {
    const idValue = entry[idKey];
    if (typeof idValue !== 'string' || idValue.trim().length === 0) continue;
    const index = next.findIndex((current) => current[idKey] === idValue);
    const withMeta = {
      ...entry,
      _meta: {
        updatedAt: returnedAt,
        source: 'atlas_scan' as const,
        sessionId: source.sessionId,
      },
    } as T;

    if (index < 0) {
      next.push(withMeta);
      continue;
    }

    const existingItem = next[index];
    const existingTs = toTimestamp(existingItem._meta.updatedAt);
    if (Number.isFinite(existingTs) && Number.isFinite(returnedTs) && existingTs > returnedTs) {
      conflicts.push({
        path: `${path}.${idValue}`,
        reason: `Incoming update (${returnedAt}) skipped because canonical entry is newer (${existingItem._meta.updatedAt}).`,
      });
      continue;
    }

    next[index] = withMeta;
  }

  return next;
}

function mergeSurveyDraft(
  baseSurveyDraft: CanonicalVisitPackageV1['surveyDraft'],
  updates: ScanReturnPayloadV1['updates']['surveyObservations'] | undefined,
  conflicts: ScanReturnMergeConflictV1[],
): CanonicalVisitPackageV1['surveyDraft'] {
  if (updates == null) return baseSurveyDraft;
  const next = { ...baseSurveyDraft } as Record<string, unknown>;

  for (const [key, value] of Object.entries(updates.topLevel ?? {})) {
    if (PROTECTED_SURVEY_KEYS.has(key)) {
      conflicts.push({
        path: `surveyDraft.${key}`,
        reason: 'Protected survey field cannot be overwritten by scan return updates.',
      });
      continue;
    }
    next[key] = value;
  }

  if (updates.fullSurvey != null) {
    const existingFullSurvey = asRecord(next['fullSurvey']) ?? {};
    next['fullSurvey'] = {
      ...existingFullSurvey,
      ...updates.fullSurvey,
    };
  }

  return next as unknown as CanonicalVisitPackageV1['surveyDraft'];
}

export function mergeScanReturnIntoCanonicalVisitPackage(
  basePkg: CanonicalVisitPackageV1,
  payload: ScanReturnPayloadV1,
): ScanReturnMergeResultV1 {
  const conflicts: ScanReturnMergeConflictV1[] = [];

  const baseVisitId = basePkg.visitIdentity.visitId;
  const baseVisitReference = basePkg.visitIdentity.visitReference;
  if (
    payload.visitIdentity.visitId != null
    && baseVisitId != null
    && payload.visitIdentity.visitId !== baseVisitId
  ) {
    conflicts.push({
      path: 'visitIdentity.visitId',
      reason: 'Payload visitId does not match canonical package visitId; merge skipped.',
    });
    return { pkg: basePkg, conflicts };
  }
  if (
    payload.visitIdentity.visitReference != null
    && baseVisitReference != null
    && payload.visitIdentity.visitReference !== baseVisitReference
  ) {
    conflicts.push({
      path: 'visitIdentity.visitReference',
      reason: 'Payload visitReference does not match canonical package visitReference; merge skipped.',
    });
    return { pkg: basePkg, conflicts };
  }

  const existingEvidence = asCanonicalScanEvidenceRefs(basePkg.scanEvidenceRefs);
  const incomingEvidence = payload.updates.scanEvidence;

  const mergedRoomGeometry = mergeById<ScanAttributedRoomGeometryV1>(
    existingEvidence.roomGeometry,
    incomingEvidence?.roomGeometry as readonly Omit<ScanAttributedRoomGeometryV1, '_meta'>[] | undefined,
    'roomId',
    payload.returnedAt,
    payload.source,
    'scanEvidenceRefs.roomGeometry',
    conflicts,
  );
  const mergedObjectPlacements = mergeById<ScanAttributedObjectPlacementV1>(
    existingEvidence.objectPlacements,
    incomingEvidence?.objectPlacements as readonly Omit<ScanAttributedObjectPlacementV1, '_meta'>[] | undefined,
    'placementId',
    payload.returnedAt,
    payload.source,
    'scanEvidenceRefs.objectPlacements',
    conflicts,
  );
  const mergedMeasurements = mergeById<ScanAttributedMeasurementV1>(
    existingEvidence.measurements,
    incomingEvidence?.measurements as readonly Omit<ScanAttributedMeasurementV1, '_meta'>[] | undefined,
    'measurementId',
    payload.returnedAt,
    payload.source,
    'scanEvidenceRefs.measurements',
    conflicts,
  );

  const metadata = { ...existingEvidence.captureMetadata };
  const metadataAttribution = { ...existingEvidence.captureMetadataAttribution };
  const returnedTs = toTimestamp(payload.returnedAt);
  for (const [key, value] of Object.entries(incomingEvidence?.captureMetadata ?? {})) {
    const existingAttribution = metadataAttribution[key];
    const existingTs = toTimestamp(existingAttribution?.updatedAt);
    if (Number.isFinite(existingTs) && Number.isFinite(returnedTs) && existingTs > returnedTs) {
      conflicts.push({
        path: `scanEvidenceRefs.captureMetadata.${key}`,
        reason: `Incoming metadata update (${payload.returnedAt}) skipped because canonical metadata is newer (${existingAttribution.updatedAt}).`,
      });
      continue;
    }
    metadata[key] = value;
    metadataAttribution[key] = {
      updatedAt: payload.returnedAt,
      source: 'atlas_scan',
      sessionId: payload.source.sessionId,
    };
  }

  const mergedScanEvidence: CanonicalScanEvidenceRefsV1 = {
    schema: 'atlas.scan-evidence-refs',
    version: '1.0',
    photoRefs: [...new Set([...existingEvidence.photoRefs, ...(incomingEvidence?.photoRefs ?? [])])],
    voiceNoteRefs: [...new Set([...existingEvidence.voiceNoteRefs, ...(incomingEvidence?.voiceNoteRefs ?? [])])],
    roomGeometry: mergedRoomGeometry,
    objectPlacements: mergedObjectPlacements,
    measurements: mergedMeasurements,
    captureMetadata: metadata,
    captureMetadataAttribution: metadataAttribution,
    attribution: {
      lastMergedAt: payload.returnedAt,
      lastMergedFrom: 'atlas_scan',
      mergeCount: existingEvidence.attribution.mergeCount + 1,
      sources: [...new Set([...existingEvidence.attribution.sources, payload.source.surface])],
    },
  };

  const mergedSurveyDraft = mergeSurveyDraft(basePkg.surveyDraft, payload.updates.surveyObservations, conflicts);

  const mergedPkg: CanonicalVisitPackageV1 = {
    ...basePkg,
    visitIdentity: {
      ...basePkg.visitIdentity,
      updatedAt: payload.returnedAt,
    },
    surveyDraft: mergedSurveyDraft,
    scanEvidenceRefs: mergedScanEvidence,
    importExportMetadata: {
      ...basePkg.importExportMetadata,
      importedAt: payload.returnedAt,
      importSource: 'atlas_scan_return',
    },
    proposalTruth: basePkg.proposalTruth,
    generatedOutputStatus: basePkg.generatedOutputStatus,
  };

  return { pkg: mergedPkg, conflicts };
}
