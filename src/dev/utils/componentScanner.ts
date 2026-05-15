import {
  DEV_ROUTE_REGISTRY,
  buildRouteAuditIndex,
  getRouteAuditStatus,
  type DevRouteMeta,
  type DevRouteAuditStatus,
} from '../devRouteRegistry';
import { DEV_UI_REGISTRY, type DevUiRegistryItem } from '../devUiRegistry';

export interface ComponentCandidate {
  codeName: string;
  filePath: string;
}

export interface RouteAuditRow {
  codeName: string;
  filePath: string;
  status: DevRouteAuditStatus;
  inUiInventory: boolean;
  routeMeta?: DevRouteMeta;
}

export interface UnroutedComponentRow {
  codeName: string;
  filePath: string;
  inUiInventory: boolean;
}

export interface ComponentDiscoveryReport {
  routeAuditRows: RouteAuditRow[];
  unroutedComponents: UnroutedComponentRow[];
  counts: {
    production: number;
    devOnly: number;
    unrouted: number;
  };
}

interface BuildComponentDiscoveryReportInput {
  candidateFilePaths: readonly string[];
  routeRegistry: readonly DevRouteMeta[];
  uiRegistry: readonly DevUiRegistryItem[];
}

const PAGE_MODULES = import.meta.glob('/src/components/**/*Page.tsx');
const FEATURE_PAGE_MODULES = import.meta.glob('/src/features/**/*Page.tsx');
const DEV_PAGE_MODULES = import.meta.glob('/src/dev/**/*Page.tsx');
const VISUALIZER_MODULES = import.meta.glob('/src/components/visualizers/**/*.tsx');
const PHYSICS_MODULES = import.meta.glob('/src/components/physics-visuals/**/*.tsx');
const DEV_COMPONENT_MODULES = import.meta.glob('/src/components/dev/**/*.tsx');
const PRESENTATION_DEBUG_MODULES = import.meta.glob('/src/components/presentation/**/*DebugDeck.tsx');

function normalizeVitePath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

function isScannablePath(path: string): boolean {
  return !path.includes('__tests__/') && !path.includes('.test.') && !path.includes('.spec.');
}

function toCodeName(path: string): string {
  const fileName = path.split('/').pop() ?? '';
  return fileName.replace(/\.(tsx|ts)$/i, '');
}

function isPascalCodeName(codeName: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(codeName);
}

function toCandidates(paths: readonly string[]): ComponentCandidate[] {
  return paths
    .map(filePath => {
      const normalized = normalizeVitePath(filePath);
      return { filePath: normalized, codeName: toCodeName(normalized) };
    })
    .filter(candidate => isScannablePath(candidate.filePath) && isPascalCodeName(candidate.codeName))
    .sort((a, b) => a.codeName.localeCompare(b.codeName) || a.filePath.localeCompare(b.filePath));
}

function dedupeCandidates(candidates: readonly ComponentCandidate[]): ComponentCandidate[] {
  const seen = new Set<string>();
  const deduped: ComponentCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.codeName}|${candidate.filePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function collectCandidateFilePaths(): string[] {
  return [
    ...Object.keys(PAGE_MODULES),
    ...Object.keys(FEATURE_PAGE_MODULES),
    ...Object.keys(DEV_PAGE_MODULES),
    ...Object.keys(VISUALIZER_MODULES),
    ...Object.keys(PHYSICS_MODULES),
    ...Object.keys(DEV_COMPONENT_MODULES),
    ...Object.keys(PRESENTATION_DEBUG_MODULES),
  ];
}

export function buildComponentDiscoveryReport({
  candidateFilePaths,
  routeRegistry,
  uiRegistry,
}: BuildComponentDiscoveryReportInput): ComponentDiscoveryReport {
  const routeIndex = new Map(routeRegistry.map(meta => [meta.codeName, meta]));
  const uiCodeNames = new Set(uiRegistry.map(item => item.codeName));
  const allCandidates = dedupeCandidates(toCandidates(candidateFilePaths));

  const pageCandidates = allCandidates.filter(candidate => candidate.filePath.endsWith('Page.tsx'));
  const visualAndDevCandidates = allCandidates.filter(candidate => !candidate.filePath.endsWith('Page.tsx'));

  const routeAuditRows: RouteAuditRow[] = pageCandidates.map(candidate => {
    const routeMeta = routeIndex.get(candidate.codeName);
    return {
      codeName: candidate.codeName,
      filePath: candidate.filePath,
      status: getRouteAuditStatus(routeMeta),
      inUiInventory: uiCodeNames.has(candidate.codeName),
      routeMeta,
    };
  });

  const unroutedComponents: UnroutedComponentRow[] = visualAndDevCandidates
    .filter(candidate => getRouteAuditStatus(routeIndex.get(candidate.codeName)) === 'unrouted')
    .map(candidate => ({
      codeName: candidate.codeName,
      filePath: candidate.filePath,
      inUiInventory: uiCodeNames.has(candidate.codeName),
    }));

  const counts = routeAuditRows.reduce(
    (acc, row) => {
      if (row.status === 'production') acc.production += 1;
      else if (row.status === 'dev_only') acc.devOnly += 1;
      else acc.unrouted += 1;
      return acc;
    },
    { production: 0, devOnly: 0, unrouted: 0 },
  );

  return {
    routeAuditRows,
    unroutedComponents,
    counts,
  };
}

export function getComponentDiscoveryReport(): ComponentDiscoveryReport {
  const candidateFilePaths = collectCandidateFilePaths();
  return buildComponentDiscoveryReport({
    candidateFilePaths,
    routeRegistry: DEV_ROUTE_REGISTRY,
    uiRegistry: DEV_UI_REGISTRY,
  });
}

export function getRouteRegistryIndex(): ReadonlyMap<string, DevRouteMeta> {
  return buildRouteAuditIndex();
}
