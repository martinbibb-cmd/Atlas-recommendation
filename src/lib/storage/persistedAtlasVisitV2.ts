import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

export interface PersistedAtlasVisitV2 {
  schemaVersion: 2;
  visitId: string;
  updatedAt: string;
  survey: FullSurveyModelV1;
  engine?: EngineOutputV1;
  decision?: AtlasDecisionV1;
  scenarios?: ScenarioResult[];
  customerSummary?: CustomerSummaryV1;
  scanCapture?: unknown;
  quotePlan?: unknown;
}

interface PersistedAtlasVisitReadResult {
  visit: PersistedAtlasVisitV2 | null;
  restoredFromTemp: boolean;
  schemaMismatch: boolean;
}

function mainKey(visitId: string): string {
  return `atlas_visit_${visitId}`;
}

function tempKey(visitId: string): string {
  return `atlas_visit_${visitId}_tmp`;
}

function parsePersisted(raw: string | null): PersistedAtlasVisitV2 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAtlasVisitV2> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.schemaVersion !== 2) return null;
    if (typeof parsed.visitId !== 'string' || parsed.visitId.trim().length === 0) return null;
    if (typeof parsed.updatedAt !== 'string' || parsed.updatedAt.trim().length === 0) return null;
    if (!parsed.survey || typeof parsed.survey !== 'object') return null;
    return parsed as PersistedAtlasVisitV2;
  } catch {
    return null;
  }
}

function hasSchemaMismatch(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: number } | null;
    return typeof parsed?.schemaVersion === 'number' && parsed.schemaVersion !== 2;
  } catch {
    return false;
  }
}

export function saveVisitAtomically(visit: PersistedAtlasVisitV2): void {
  const main = mainKey(visit.visitId);
  const tmp = tempKey(visit.visitId);
  try {
    const json = JSON.stringify(visit);
    localStorage.setItem(tmp, json);
    localStorage.setItem(main, json);
    localStorage.removeItem(tmp);
  } catch {
    // best effort only
  }
}

export function readPersistedAtlasVisitV2(visitId: string): PersistedAtlasVisitReadResult {
  const main = mainKey(visitId);
  const tmp = tempKey(visitId);

  let restoredFromTemp = false;
  const tmpRaw = localStorage.getItem(tmp);
  const mainRaw = localStorage.getItem(main);
  const tmpVisit = parsePersisted(tmpRaw);

  if (tmpVisit && tmpVisit.visitId === visitId) {
    saveVisitAtomically(tmpVisit);
    restoredFromTemp = true;
    return {
      visit: tmpVisit,
      restoredFromTemp,
      schemaMismatch: false,
    };
  }

  if (tmpRaw != null) {
    try {
      localStorage.removeItem(tmp);
    } catch {
      // best effort
    }
  }

  const mainVisit = parsePersisted(mainRaw);
  if (mainVisit && mainVisit.visitId === visitId) {
    return {
      visit: mainVisit,
      restoredFromTemp,
      schemaMismatch: false,
    };
  }

  return {
    visit: null,
    restoredFromTemp: false,
    schemaMismatch: hasSchemaMismatch(mainRaw) || hasSchemaMismatch(tmpRaw),
  };
}

export function clearPersistedAtlasVisitV2(visitId: string): void {
  try {
    localStorage.removeItem(mainKey(visitId));
    localStorage.removeItem(tempKey(visitId));
  } catch {
    // best effort
  }
}
