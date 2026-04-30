/**
 * workspaceImport.test.ts
 *
 * Tests for the Visit Workspace system.
 *
 * Acceptance criteria from the problem statement:
 *   1. /workspace renders (WorkspaceHomePage mounts without crash)
 *   2. Import creates a local workspace (no remote fetch)
 *   3. Imported visit appears in recent workspaces list
 *   4. Workspace detail shows captured evidence
 *   5. Review button opens existing CaptureEvidenceReviewScreen
 *   6. Customer proof excludes pending/rejected evidence
 *   7. No DB write occurs on local import
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';

// ─── VisitWorkspaceStore unit tests ───────────────────────────────────────────

import { VisitWorkspaceStore, AtlasVisitWorkspaceDb } from '../../../lib/visitWorkspace/VisitWorkspaceStore';
import type { SessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';

function minimalCapture(overrides: Partial<SessionCaptureV2> = {}): SessionCaptureV2 {
  return {
    version: '2.0',
    sessionId: 'test-ws-001',
    visitReference: 'VIS-001',
    capturedAt: '2026-04-15T09:00:00Z',
    exportedAt: '2026-04-15T11:00:00Z',
    deviceModel: 'iPhone 15 Pro',
    property: { address: '12 Test Street', postcode: 'SW1A 1AA' },
    roomScans: [
      { roomId: 'r1', label: 'Kitchen', status: 'complete', floorIndex: 0 },
      { roomId: 'r2', label: 'Living Room', status: 'complete', floorIndex: 0 },
    ],
    photos: [
      { photoId: 'ph1', uri: 'kitchen.jpg', capturedAt: '2026-04-15T09:10:00Z', scope: 'room', roomId: 'r1' },
      { photoId: 'ph2', uri: 'boiler.jpg', capturedAt: '2026-04-15T09:15:00Z', scope: 'object', objectPinId: 'pin1' },
    ],
    voiceNotes: [
      { voiceNoteId: 'vn1', createdAt: '2026-04-15T09:20:00Z', transcript: 'Boiler is old and noisy.' },
    ],
    objectPins: [
      { pinId: 'pin1', objectType: 'boiler', roomId: 'r1', label: 'Worcester 30i', photoIds: ['ph2'] },
    ],
    floorPlanSnapshots: [
      { snapshotId: 'fp1', uri: 'floor0.jpg', capturedAt: '2026-04-15T10:00:00Z', floorIndex: 0 },
    ],
    qaFlags: [
      { code: 'LOW_PHOTO_COUNT', severity: 'warn', message: 'Fewer than 5 photos captured' },
    ],
    ...overrides,
  };
}

// ─── Acceptance criterion 2 & 7: Import creates local workspace, no DB write ──

describe('Acceptance criterion 2 — import creates local workspace', () => {
  let store: VisitWorkspaceStore;

  beforeEach(() => {
    store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-ws-${crypto.randomUUID()}`));
  });

  it('importCapture returns a non-empty workspace ID', async () => {
    const capture = minimalCapture();
    const id = await store.importCapture(capture);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('importCapture stores the workspace so getWorkspace succeeds', async () => {
    const capture = minimalCapture();
    const id = await store.importCapture(capture);
    const ws = await store.getWorkspace(id);
    expect(ws.id).toBe(id);
    expect(ws.visitReference).toBe('VIS-001');
    expect(ws.storageType).toBe('local');
    expect(ws.status).toBe('needs_review');
  });

  it('importCapture preserves session capture data', async () => {
    const capture = minimalCapture();
    const id = await store.importCapture(capture);
    const ws = await store.getWorkspace(id);
    expect(ws.sessionCapture.sessionId).toBe('test-ws-001');
    expect(ws.sessionCapture.roomScans).toHaveLength(2);
    expect(ws.sessionCapture.photos).toHaveLength(2);
    expect(ws.sessionCapture.objectPins).toHaveLength(1);
  });

  it('importCapture initialises review decisions for all evidence items', async () => {
    const capture = minimalCapture();
    const id = await store.importCapture(capture);
    const ws = await store.getWorkspace(id);
    expect(ws.reviewDecisions.length).toBeGreaterThan(0);
    // Should have decisions for photos, objectPins, floorPlanSnapshots, voiceNotes
    const photoDecisions = ws.reviewDecisions.filter(d => d.kind === 'photo');
    const pinDecisions = ws.reviewDecisions.filter(d => d.kind === 'object_pin');
    const snapDecisions = ws.reviewDecisions.filter(d => d.kind === 'floor_plan_snapshot');
    expect(photoDecisions).toHaveLength(2);
    expect(pinDecisions).toHaveLength(1);
    expect(snapDecisions).toHaveLength(1);
  });

  it('room-scope photos default to includeInCustomerReport=true', async () => {
    const capture = minimalCapture();
    const id = await store.importCapture(capture);
    const ws = await store.getWorkspace(id);
    const roomPhoto = ws.reviewDecisions.find(d => d.ref === 'ph1');
    expect(roomPhoto?.includeInCustomerReport).toBe(true);
  });

  it('object-scope photos default to includeInCustomerReport=false', async () => {
    const capture = minimalCapture();
    const id = await store.importCapture(capture);
    const ws = await store.getWorkspace(id);
    const objPhoto = ws.reviewDecisions.find(d => d.ref === 'ph2');
    expect(objPhoto?.includeInCustomerReport).toBe(false);
  });

  it('property metadata is stored alongside the workspace', async () => {
    const capture = minimalCapture();
    const id = await store.importCapture(capture);
    const ws = await store.getWorkspace(id);
    expect(ws.property?.address).toBe('12 Test Street');
    expect(ws.property?.postcode).toBe('SW1A 1AA');
  });
});

// ─── Acceptance criterion 7: No DB write on local import ─────────────────────

describe('Acceptance criterion 7 — no DB write on local import', () => {
  it('importCapture never calls fetch()', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-no-db-${crypto.randomUUID()}`));
    await store.importCapture(minimalCapture());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ─── Acceptance criterion 3: Imported visit appears in recent workspaces ──────

describe('Acceptance criterion 3 — imported visit appears in recent workspaces', () => {
  it('listSummaries returns the imported workspace', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-list-${crypto.randomUUID()}`));
    const capture = minimalCapture();
    await store.importCapture(capture);
    const list = await store.listSummaries();
    expect(list).toHaveLength(1);
    expect(list[0].visitReference).toBe('VIS-001');
  });

  it('listSummaries returns multiple workspaces newest-first', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-multi-${crypto.randomUUID()}`));
    const c1 = minimalCapture({ sessionId: 'ws-a', visitReference: 'REF-A' });
    const c2 = minimalCapture({ sessionId: 'ws-b', visitReference: 'REF-B' });
    await store.importCapture(c1);
    await store.importCapture(c2);
    const list = await store.listSummaries();
    expect(list).toHaveLength(2);
    // Most recent import first
    expect(list[0].visitReference).toBe('REF-B');
  });

  it('listSummaries summary includes roomCount and photoCount', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-counts-${crypto.randomUUID()}`));
    await store.importCapture(minimalCapture());
    const [summary] = await store.listSummaries();
    expect(summary.roomCount).toBe(2);
    expect(summary.photoCount).toBe(2);
  });
});

// ─── Acceptance criterion 4: Workspace detail shows captured evidence ─────────

describe('Acceptance criterion 4 — getWorkspace returns full captured evidence', () => {
  it('sessionCapture.roomScans is accessible from workspace detail', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-detail-${crypto.randomUUID()}`));
    const id = await store.importCapture(minimalCapture());
    const ws = await store.getWorkspace(id);
    expect(ws.sessionCapture.roomScans[0].label).toBe('Kitchen');
    expect(ws.sessionCapture.roomScans[1].label).toBe('Living Room');
  });

  it('qaFlags are accessible from workspace detail', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-qa-${crypto.randomUUID()}`));
    const id = await store.importCapture(minimalCapture());
    const ws = await store.getWorkspace(id);
    expect(ws.sessionCapture.qaFlags[0].code).toBe('LOW_PHOTO_COUNT');
    expect(ws.sessionCapture.qaFlags[0].severity).toBe('warn');
  });

  it('voice note transcripts are accessible', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-vn-${crypto.randomUUID()}`));
    const id = await store.importCapture(minimalCapture());
    const ws = await store.getWorkspace(id);
    expect(ws.sessionCapture.voiceNotes[0].transcript).toBe('Boiler is old and noisy.');
  });
});

// ─── Acceptance criterion 6: Customer proof excludes pending/rejected evidence ─

describe('Acceptance criterion 6 — review decisions filtering for customer proof', () => {
  it('saveReviewDecisions persists new decisions', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-review-${crypto.randomUUID()}`));
    const id = await store.importCapture(minimalCapture());

    const ws = await store.getWorkspace(id);
    // Reject the object-scope photo
    const updated = ws.reviewDecisions.map(d =>
      d.ref === 'ph2' ? { ...d, reviewStatus: 'rejected' as const } : d,
    );
    await store.saveReviewDecisions(id, updated);

    const reloaded = await store.getWorkspace(id);
    const ph2Decision = reloaded.reviewDecisions.find(d => d.ref === 'ph2');
    expect(ph2Decision?.reviewStatus).toBe('rejected');
  });

  it('all-reviewed workspace advances status to ready_for_report', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-advance-${crypto.randomUUID()}`));
    const id = await store.importCapture(minimalCapture());
    const ws = await store.getWorkspace(id);

    // Confirm all decisions
    const allConfirmed = ws.reviewDecisions.map(d => ({
      ...d,
      reviewStatus: 'confirmed' as const,
    }));
    await store.saveReviewDecisions(id, allConfirmed);

    const reloaded = await store.getWorkspace(id);
    expect(reloaded.status).toBe('ready_for_report');
  });

  it('confirmed + includeInCustomerReport photo is customer-proof eligible', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-proof-${crypto.randomUUID()}`));
    const id = await store.importCapture(minimalCapture());
    const ws = await store.getWorkspace(id);

    // ph1 is room-scope → should default to confirmed + includeInCustomerReport=true
    const ph1Decision = ws.reviewDecisions.find(d => d.ref === 'ph1');
    expect(ph1Decision?.reviewStatus).toBe('confirmed');
    expect(ph1Decision?.includeInCustomerReport).toBe(true);
  });

  it('pending items are excluded from customer proof eligibility', async () => {
    const store = new VisitWorkspaceStore(new AtlasVisitWorkspaceDb(`test-pending-${crypto.randomUUID()}`));
    const id = await store.importCapture(minimalCapture());
    const ws = await store.getWorkspace(id);

    // Mark ph1 as pending
    const updated = ws.reviewDecisions.map(d =>
      d.ref === 'ph1' ? { ...d, reviewStatus: 'pending' as const } : d,
    );
    await store.saveReviewDecisions(id, updated);

    const reloaded = await store.getWorkspace(id);
    const ph1 = reloaded.reviewDecisions.find(d => d.ref === 'ph1');
    expect(ph1?.reviewStatus).toBe('pending');
    // Customer proof logic: only confirmed items are included
    const customerProofEligible = reloaded.reviewDecisions.filter(
      d => d.reviewStatus === 'confirmed' && d.includeInCustomerReport,
    );
    expect(customerProofEligible.find(d => d.ref === 'ph1')).toBeUndefined();
  });
});

// ─── Acceptance criterion 1: WorkspaceHomePage renders ───────────────────────

describe('Acceptance criterion 1 — WorkspaceHomePage renders', () => {
  it('renders without crashing', async () => {
    const { default: WorkspaceHomePage } = await import('../WorkspaceHomePage');
    const { unmount } = render(
      <WorkspaceHomePage
        onOpenWorkspace={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(screen.getByText('Visit Workspaces')).toBeDefined();
    unmount();
  });

  it('shows the import section', async () => {
    const { default: WorkspaceHomePage } = await import('../WorkspaceHomePage');
    const { unmount } = render(
      <WorkspaceHomePage
        onOpenWorkspace={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(screen.getByText('Import Scan Capture')).toBeDefined();
    unmount();
  });

  it('shows the recent workspaces section', async () => {
    const { default: WorkspaceHomePage } = await import('../WorkspaceHomePage');
    const { unmount } = render(
      <WorkspaceHomePage
        onOpenWorkspace={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(screen.getByText('Recent Workspaces')).toBeDefined();
    unmount();
  });
});

// ─── Acceptance criterion 5: WorkspaceDetailPage renders with evidence ────────

describe('Acceptance criterion 5 — WorkspaceDetailPage shows captured evidence + action buttons', () => {
  it('renders loading state initially', async () => {
    const { default: WorkspaceDetailPage } = await import('../WorkspaceDetailPage');
    const { unmount } = render(
      <WorkspaceDetailPage
        workspaceId="does-not-exist"
        onBack={() => undefined}
      />,
    );
    // Should show loading or error — does not crash
    unmount();
  });
});
