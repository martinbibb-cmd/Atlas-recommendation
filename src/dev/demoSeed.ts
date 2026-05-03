/**
 * src/dev/demoSeed.ts
 *
 * Demo workspace and sample visit seed for Atlas.
 *
 * Purpose
 * ───────
 * Creates a polished, resettable demo journey for pitches and testing.
 * Populates client-side stores (localStorage) with:
 *   - Two demo user profiles (owner + engineer)
 *   - Sample analytics events across five demo visits
 *   - A sample external file manifest for the completed demo visit
 *
 * The "Demo Heating Co" workspace (tenantId: 'demo-heating') is a built-in
 * tenant in tenantRegistry.ts and requires no seeding.
 *
 * Design rules
 * ────────────
 * - No customer PII — all names/addresses are fictional.
 * - No real file contents — file references use placeholder URIs.
 * - No engine or recommendation logic changes.
 * - seedDemoData() is idempotent — safe to call multiple times.
 * - resetDemoData() clears then re-seeds for a guaranteed clean state.
 * - Developer-only — never imported by production paths.
 */

import { upsertUserProfile, saveUserProfileStore, loadUserProfileStore } from '../features/userProfiles/userProfileStore';
import { setActiveUserId, clearActiveUserId } from '../features/userProfiles/activeUserStore';
import { trackEvent, clearEvents } from '../features/analytics/analyticsStore';
import { saveManifest, deleteManifestForVisit } from '../features/externalFiles/externalVisitManifestStore';
import { buildManifestSummary } from '../contracts/ExternalVisitManifestV1';
import type { UserProfileV1 } from '../features/userProfiles/userProfile';
import type { AnalyticsEventV1 } from '../features/analytics/analyticsEvents';
import type { ExternalVisitManifestV1 } from '../contracts/ExternalVisitManifestV1';
import type { ClientFileReferenceV1 } from '../contracts/ClientFileReferenceV1';

// ─── Demo constants ───────────────────────────────────────────────────────────

export const DEMO_TENANT_ID = 'demo-heating' as const;

export const DEMO_USER_IDS = {
  owner: 'demo_user_owner',
  engineer: 'demo_user_engineer',
} as const;

/** Fixed visit IDs used throughout the demo dataset. */
export const DEMO_VISIT_IDS = {
  /** Fully completed, recommendation selected, quote won. */
  completed_won: 'demo_visit_001',
  /** Completed, recommendation selected, quote lost. */
  completed_lost: 'demo_visit_002',
  /** Completed, follow-up required. */
  completed_followup: 'demo_visit_003',
  /** Abandoned mid-survey. */
  abandoned: 'demo_visit_004',
  /** Recently created — survey in progress. */
  in_progress: 'demo_visit_005',
} as const;

// ─── Demo user profiles ───────────────────────────────────────────────────────

const DEMO_OWNER: UserProfileV1 = {
  version: '1.0',
  userId: DEMO_USER_IDS.owner,
  displayName: 'Alex Demo',
  defaultTenantId: DEMO_TENANT_ID,
  rolesByTenant: { [DEMO_TENANT_ID]: 'owner' },
  developerMode: true,
  createdAt: '2025-01-15T09:00:00.000Z',
  updatedAt: '2025-02-03T14:22:00.000Z',
};

const DEMO_ENGINEER: UserProfileV1 = {
  version: '1.0',
  userId: DEMO_USER_IDS.engineer,
  displayName: 'Jordan Demo',
  defaultTenantId: DEMO_TENANT_ID,
  rolesByTenant: { [DEMO_TENANT_ID]: 'engineer' },
  developerMode: false,
  createdAt: '2025-01-15T09:05:00.000Z',
  updatedAt: '2025-03-08T08:30:00.000Z',
};

// ─── Demo analytics events ────────────────────────────────────────────────────

/** Scenario IDs representative of Atlas recommendation output. */
const SCENARIO_COMBI = 'scenario_combi_replacement';
const SCENARIO_HEAT_PUMP = 'scenario_ashp_upgrade';

const DEMO_ANALYTICS_EVENTS: AnalyticsEventV1[] = [
  // ── Visit 1: completed + won ───────────────────────────────────────────────
  {
    eventId: 'demo_evt_001_created',
    eventType: 'visit_created',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_won,
    createdAt: '2025-03-10T10:00:00.000Z',
    createdByUserId: DEMO_USER_IDS.engineer,
  },
  {
    eventId: 'demo_evt_001_completed',
    eventType: 'visit_completed',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_won,
    createdAt: '2025-03-10T10:42:00.000Z',
    durationSeconds: 2520,
    createdByUserId: DEMO_USER_IDS.engineer,
  },
  {
    eventId: 'demo_evt_001_rec_viewed',
    eventType: 'recommendation_viewed',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_won,
    createdAt: '2025-03-10T10:43:00.000Z',
    scenarioIds: [SCENARIO_COMBI, SCENARIO_HEAT_PUMP],
  },
  {
    eventId: 'demo_evt_001_rec_selected',
    eventType: 'recommendation_selected',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_won,
    createdAt: '2025-03-10T10:45:00.000Z',
    selectedScenarioId: SCENARIO_COMBI,
  },
  {
    eventId: 'demo_evt_001_won',
    eventType: 'quote_marked_won',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_won,
    createdAt: '2025-03-12T14:00:00.000Z',
  },

  // ── Visit 2: completed + lost ──────────────────────────────────────────────
  {
    eventId: 'demo_evt_002_created',
    eventType: 'visit_created',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_lost,
    createdAt: '2025-03-14T11:00:00.000Z',
    createdByUserId: DEMO_USER_IDS.engineer,
  },
  {
    eventId: 'demo_evt_002_completed',
    eventType: 'visit_completed',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_lost,
    createdAt: '2025-03-14T11:38:00.000Z',
    durationSeconds: 2280,
    createdByUserId: DEMO_USER_IDS.engineer,
  },
  {
    eventId: 'demo_evt_002_rec_viewed',
    eventType: 'recommendation_viewed',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_lost,
    createdAt: '2025-03-14T11:39:00.000Z',
    scenarioIds: [SCENARIO_HEAT_PUMP, SCENARIO_COMBI],
  },
  {
    eventId: 'demo_evt_002_rec_selected',
    eventType: 'recommendation_selected',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_lost,
    createdAt: '2025-03-14T11:41:00.000Z',
    selectedScenarioId: SCENARIO_HEAT_PUMP,
  },
  {
    eventId: 'demo_evt_002_lost',
    eventType: 'quote_marked_lost',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_lost,
    createdAt: '2025-03-17T09:30:00.000Z',
  },

  // ── Visit 3: completed + follow-up required ────────────────────────────────
  {
    eventId: 'demo_evt_003_created',
    eventType: 'visit_created',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_followup,
    createdAt: '2025-03-20T14:00:00.000Z',
    createdByUserId: DEMO_USER_IDS.engineer,
  },
  {
    eventId: 'demo_evt_003_completed',
    eventType: 'visit_completed',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_followup,
    createdAt: '2025-03-20T14:55:00.000Z',
    durationSeconds: 3300,
    createdByUserId: DEMO_USER_IDS.engineer,
  },
  {
    eventId: 'demo_evt_003_rec_viewed',
    eventType: 'recommendation_viewed',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_followup,
    createdAt: '2025-03-20T14:56:00.000Z',
    scenarioIds: [SCENARIO_COMBI, SCENARIO_HEAT_PUMP],
  },
  {
    eventId: 'demo_evt_003_rec_selected',
    eventType: 'recommendation_selected',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_followup,
    createdAt: '2025-03-20T14:58:00.000Z',
    selectedScenarioId: SCENARIO_COMBI,
  },
  {
    eventId: 'demo_evt_003_followup',
    eventType: 'quote_follow_up_required',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.completed_followup,
    createdAt: '2025-03-22T16:00:00.000Z',
  },

  // ── Visit 4: abandoned ─────────────────────────────────────────────────────
  {
    eventId: 'demo_evt_004_created',
    eventType: 'visit_created',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.abandoned,
    createdAt: '2025-03-25T09:15:00.000Z',
    createdByUserId: DEMO_USER_IDS.engineer,
  },
  {
    eventId: 'demo_evt_004_abandoned',
    eventType: 'visit_abandoned',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.abandoned,
    createdAt: '2025-03-25T09:28:00.000Z',
  },

  // ── Visit 5: in progress ───────────────────────────────────────────────────
  {
    eventId: 'demo_evt_005_created',
    eventType: 'visit_created',
    tenantId: DEMO_TENANT_ID,
    visitId: DEMO_VISIT_IDS.in_progress,
    createdAt: '2025-04-01T10:00:00.000Z',
    createdByUserId: DEMO_USER_IDS.engineer,
  },
];

// ─── Demo external file manifest ──────────────────────────────────────────────

/**
 * Sample file references for the completed+won demo visit.
 * URIs are placeholder strings — no real file contents are referenced.
 */
const DEMO_FILE_REFS: ClientFileReferenceV1[] = [
  {
    version: '1',
    referenceId: 'demo_ref_photo_001',
    fileKind: 'photo',
    provider: 'local_device',
    accessMode: 'local_only',
    uri: 'demo://placeholder/boiler-photo-front.jpg',
    displayName: 'Boiler photo (front)',
    createdAt: '2025-03-10T10:20:00.000Z',
  },
  {
    version: '1',
    referenceId: 'demo_ref_scan_001',
    fileKind: 'scan',
    provider: 'local_device',
    accessMode: 'local_only',
    uri: 'demo://placeholder/loft-scan.atlas',
    displayName: 'Loft scan capture',
    createdAt: '2025-03-10T10:25:00.000Z',
  },
  {
    version: '1',
    referenceId: 'demo_ref_report_001',
    fileKind: 'report',
    provider: 'google_drive',
    accessMode: 'owner_controlled',
    uri: 'demo://placeholder/atlas-report-demo-visit-001.pdf',
    displayName: 'Atlas recommendation report',
    createdAt: '2025-03-10T10:48:00.000Z',
  },
];

const DEMO_MANIFEST: ExternalVisitManifestV1 = {
  version: '1',
  visitId: DEMO_VISIT_IDS.completed_won,
  tenantId: DEMO_TENANT_ID,
  createdAt: '2025-03-10T10:20:00.000Z',
  updatedAt: '2025-03-10T10:48:00.000Z',
  files: DEMO_FILE_REFS,
  summary: buildManifestSummary(DEMO_FILE_REFS),
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Seeds demo data into client-side stores.
 *
 * Writes:
 *   - Two demo user profiles (owner + engineer)
 *   - Sets the active user to the demo engineer
 *   - Five demo analytics events sequences
 *   - One demo external file manifest
 *
 * This function is idempotent — re-running it overwrites existing demo records
 * with the same IDs without touching other stored data.
 *
 * The "Demo Heating Co" workspace is a built-in tenant and requires no seeding.
 */
export function seedDemoData(): void {
  // ── User profiles ─────────────────────────────────────────────────────────
  upsertUserProfile(DEMO_OWNER);
  upsertUserProfile(DEMO_ENGINEER);

  // ── Active user: engineer (a typical pitch starting point) ────────────────
  setActiveUserId(DEMO_USER_IDS.engineer);

  // ── Analytics events ──────────────────────────────────────────────────────
  for (const event of DEMO_ANALYTICS_EVENTS) {
    trackEvent(event);
  }

  // ── External file manifest ────────────────────────────────────────────────
  saveManifest(DEMO_MANIFEST);
}

/**
 * Removes all demo data from client-side stores, then re-seeds from the
 * canonical demo fixtures.
 *
 * Specifically:
 *   - Clears all analytics events and re-seeds demo events
 *   - Removes demo user profiles by ID and re-creates them
 *   - Clears the active user and re-sets to the demo engineer
 *   - Removes demo visit manifests by visit ID and re-creates the demo manifest
 *
 * Non-demo user profiles and brand profiles are left untouched.
 */
export function resetDemoData(): void {
  // ── Analytics: clear all events, then re-seed demo events ─────────────────
  clearEvents();
  for (const event of DEMO_ANALYTICS_EVENTS) {
    trackEvent(event);
  }

  // ── User profiles: drop demo profiles, then re-create ─────────────────────
  // Load the current store, strip demo user IDs, write back, then upsert fresh.
  const existing = loadUserProfileStore();
  const stripped: Record<string, UserProfileV1> = {};
  for (const [id, profile] of Object.entries(existing)) {
    if (id !== DEMO_USER_IDS.owner && id !== DEMO_USER_IDS.engineer) {
      stripped[id] = profile;
    }
  }
  saveUserProfileStore(stripped);
  upsertUserProfile(DEMO_OWNER);
  upsertUserProfile(DEMO_ENGINEER);

  // ── Active user ────────────────────────────────────────────────────────────
  clearActiveUserId();
  setActiveUserId(DEMO_USER_IDS.engineer);

  // ── Visit manifests: drop demo manifests, then re-create ───────────────────
  for (const visitId of Object.values(DEMO_VISIT_IDS)) {
    deleteManifestForVisit(visitId);
  }
  saveManifest(DEMO_MANIFEST);
}
