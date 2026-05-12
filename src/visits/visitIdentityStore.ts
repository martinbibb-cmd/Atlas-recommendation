export interface VisitIdentityV1 {
  version: '1.0';
  visitId: string;
  workspaceId: string;
  atlasUserId: string;
  createdAt: string;
  updatedAt: string;
}

const VISIT_IDENTITY_STORE_KEY = 'atlas:visit-identities:v1';

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage unavailable.
  }
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // sessionStorage unavailable.
  }
  return null;
}

function readStore(): Record<string, VisitIdentityV1> {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(VISIT_IDENTITY_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, VisitIdentityV1>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, VisitIdentityV1>): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(VISIT_IDENTITY_STORE_KEY, JSON.stringify(store));
  } catch {
    // best effort
  }
}

export function getVisitIdentity(visitId: string): VisitIdentityV1 | null {
  const identity = readStore()[visitId];
  return identity ?? null;
}

export function upsertVisitIdentity(visitId: string, workspaceId: string, atlasUserId: string): VisitIdentityV1 {
  const existing = getVisitIdentity(visitId);
  const now = new Date().toISOString();
  const identity: VisitIdentityV1 = {
    version: '1.0',
    visitId,
    workspaceId,
    atlasUserId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const store = readStore();
  store[visitId] = identity;
  writeStore(store);
  return identity;
}
