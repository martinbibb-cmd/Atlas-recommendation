/**
 * HandoffArrivalPage.tsx
 *
 * The canonical Atlas Mind arrival screen for an AtlasPropertyV1 handoff.
 *
 * This is the first real product UI surface that is canonically AtlasProperty-first.
 * It replaces the previous dev harness as the entry point for ?handoff=1 sessions
 * and provides a proper "captured truth" arrival experience before simulation.
 *
 * Sections rendered:
 *   1. HandoffSummaryCard   — address, source badge, capture counts
 *   2. HandoffEvidenceSummary — photos, voice notes, notes, QA flags
 *   3. HandoffKnowledgePanel — household / usage / system / priorities / constraints
 *   4. HandoffReadinessPanel — readiness, missing fields, warnings
 *   5. CTA area              — Open Atlas Mind (primary), review / back (secondary)
 *
 * Architecture rules
 * ──────────────────
 * - Source of truth: AtlasPropertyImportResult from importAtlasProperty()
 * - Display model: HandoffDisplayModel from buildHandoffDisplayModel()
 * - No raw ScanBundleV1 types used here
 * - No legacy survey payload shapes used here
 * - Migration / schema branching stays inside helpers/selectors
 */

import { useState, useCallback } from 'react';
import { importAtlasProperty } from '../../features/handoff/importer/importAtlasProperty';
import { buildHandoffDisplayModel } from '../../features/handoff/selectors/buildHandoffDisplayModel';
import { buildPresentationSeedFromAtlasProperty } from '../../features/handoff/importer/buildPresentationSeedFromAtlasProperty';
import type { AtlasPropertyImportResult } from '../../features/handoff/types/atlasPropertyHandoff.types';
import type { HandoffDisplayModel } from '../../features/handoff/types/handoffDisplay.types';
import HandoffSummaryCard from './HandoffSummaryCard';
import HandoffEvidenceSummary from './HandoffEvidenceSummary';
import HandoffKnowledgePanel from './HandoffKnowledgePanel';
import HandoffReadinessPanel from './HandoffReadinessPanel';

// ─── Minimal dev fixture (for ?handoff=1 without a payload) ──────────────────

const DEV_FIXTURE = {
  version: '1.0',
  propertyId: 'dev_arrival_fixture_01',
  createdAt: '2024-06-01T10:00:00Z',
  updatedAt: '2024-06-01T10:05:00Z',
  status: 'ready_for_simulation',
  sourceApps: ['atlas_scan'],
  property: {
    address1: '42 Atlas Lane',
    town: 'Bristol',
    postcode: 'BS1 5TR',
    uprn: '100012345678',
    propertyType: { value: 'semi_detached',  source: 'atlas_scan', confidence: 'high' },
    buildEra:     { value: '1950_to_1966',   source: 'atlas_scan', confidence: 'medium' },
  },
  capture: {
    sessionId: 'session_arrival_fixture_01',
    startedAt: '2024-06-01T09:30:00Z',
    completedAt: '2024-06-01T10:00:00Z',
    operator: { engineerId: 'eng_001', engineerName: 'J. Smith' },
    device: { app: 'atlas_scan', appVersion: '2.1.0', deviceModel: 'iPhone 15 Pro' },
    walkthrough: { started: true, completed: true },
  },
  building: {
    floors: [
      { floorId: 'f1', index: 0, label: 'Ground Floor' },
      { floorId: 'f2', index: 1, label: 'First Floor' },
    ],
    rooms: [
      { roomId: 'r1', floorId: 'f1', label: 'Lounge',      areaM2: { value: 18, source: 'atlas_scan', confidence: 'high' }, heated: true },
      { roomId: 'r2', floorId: 'f1', label: 'Kitchen',     areaM2: { value: 12, source: 'atlas_scan', confidence: 'high' }, heated: true },
      { roomId: 'r3', floorId: 'f2', label: 'Bedroom 1',   areaM2: { value: 14, source: 'atlas_scan', confidence: 'high' }, heated: true },
      { roomId: 'r4', floorId: 'f2', label: 'Bathroom',    areaM2: { value:  5, source: 'atlas_scan', confidence: 'medium' }, heated: true },
    ],
    zones: [], boundaries: [], openings: [],
    emitters: [],
    systemComponents: [
      { componentId: 'c1', label: 'Combi Boiler', kind: 'boiler' },
    ],
    pipeRoutes: [],
  },
  household: {
    composition: {
      adultCount:                  { value: 2, source: 'customer_stated', confidence: 'high' },
      childCount0to4:              { value: 0, source: 'customer_stated', confidence: 'high' },
      childCount5to10:             { value: 1, source: 'customer_stated', confidence: 'high' },
      childCount11to17:            { value: 0, source: 'customer_stated', confidence: 'high' },
      youngAdultCount18to25AtHome: { value: 0, source: 'customer_stated', confidence: 'high' },
    },
    occupancyPattern: { value: 'steady_home', source: 'customer_stated', confidence: 'medium' },
    hotWaterUsage: {
      bathPresent:   { value: true, source: 'engineer_entered', confidence: 'high' },
      showerPresent: { value: true, source: 'engineer_entered', confidence: 'high' },
      bathroomCount: { value: 1,    source: 'engineer_entered', confidence: 'high' },
    },
  },
  currentSystem: {
    family:    { value: 'combi', source: 'engineer_entered', confidence: 'high' },
    dhwType:   { value: 'combi', source: 'engineer_entered', confidence: 'high' },
    heatSource: {
      ratedOutputKw: { value: 28, source: 'engineer_entered', confidence: 'high' },
      installYear:   { value: 2018, source: 'engineer_entered', confidence: 'high' },
    },
    distribution: {
      dominantPipeDiameterMm: { value: 22, source: 'engineer_entered', confidence: 'medium' },
    },
  },
  evidence: {
    photos: [
      { photoId: 'ph1', capturedAt: '2024-06-01T09:35:00Z', tag: 'boiler',       localFilename: 'boiler_01.jpg' },
      { photoId: 'ph2', capturedAt: '2024-06-01T09:40:00Z', tag: 'pipe_work',    localFilename: 'pipes_01.jpg' },
      { photoId: 'ph3', capturedAt: '2024-06-01T09:50:00Z', tag: 'room_overview', localFilename: 'lounge_01.jpg' },
    ],
    voiceNotes: [
      {
        voiceNoteId: 'vn1',
        capturedAt: '2024-06-01T09:38:00Z',
        durationSeconds: 22,
        transcript: 'The boiler is a Worcester 28i, installed around 2018. Customer confirmed they want to keep the existing pipework if possible.',
        kind: 'observation',
      },
    ],
    textNotes: [
      {
        noteId: 'tn1',
        createdAt: '2024-06-01T09:55:00Z',
        body: 'Loft hatch is accessible. No asbestos concerns flagged.',
      },
    ],
    qaFlags: [],
    events: [
      { eventId: 'ev1', occurredAt: '2024-06-01T09:30:00Z', type: 'session_started' },
      { eventId: 'ev2', occurredAt: '2024-06-01T10:00:00Z', type: 'session_completed' },
    ],
  },
  derived: {
    heatLoss: {
      peakWatts: { value: 7200, source: 'derived', confidence: 'medium' },
    },
    hydraulics: {
      dynamicPressureBar: { value: 2.8, source: 'measured', confidence: 'high' },
      mainsFlowLpm:       { value: 16,  source: 'measured', confidence: 'high' },
    },
  },
};

// ─── CTA area ─────────────────────────────────────────────────────────────────

function CtaArea({
  model,
  onOpenAtlasMind,
  onReviewData,
}: {
  model: HandoffDisplayModel;
  onOpenAtlasMind: () => void;
  onReviewData: () => void;
}) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
        What to do next
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>
        {model.readiness.readyForSimulation
          ? "We've captured the home. Here's what we know. Now let's see the solutions."
          : 'Review the missing fields below before opening the simulator.'}
      </p>

      {/* Primary CTA */}
      <button
        onClick={onOpenAtlasMind}
        disabled={!model.readiness.readyForSimulation}
        style={{
          display: 'block',
          width: '100%',
          padding: '14px 0',
          fontSize: 15,
          fontWeight: 700,
          color: '#ffffff',
          background: model.readiness.readyForSimulation ? '#6366f1' : '#a5b4fc',
          border: 'none',
          borderRadius: 8,
          cursor: model.readiness.readyForSimulation ? 'pointer' : 'default',
          marginBottom: 12,
          transition: 'background 0.15s',
        }}
      >
        Open Atlas Mind →
      </button>

      {/* Secondary CTAs */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onReviewData}
          style={{
            flex: 1,
            padding: '10px 0',
            fontSize: 13,
            color: '#6366f1',
            background: '#eef2ff',
            border: '1px solid #c7d2fe',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Review captured data
        </button>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface HandoffArrivalPageProps {
  /**
   * Raw handoff payload.  When provided (e.g. from a deep-link or scan handoff
   * navigation state) the page imports it immediately.
   * When absent the page loads the built-in dev fixture.
   */
  handoffPayload?: unknown;
  /**
   * Called when the user confirms they want to proceed into the Atlas Mind
   * simulator / recommendation hub.
   */
  onOpenAtlasMind?: (seed: ReturnType<typeof buildPresentationSeedFromAtlasProperty>) => void;
  /** Called when the user wants to go back or exit the arrival flow. */
  onBack?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HandoffArrivalPage({
  handoffPayload,
  onOpenAtlasMind,
  onBack,
}: HandoffArrivalPageProps) {
  const [result, setResult]     = useState<AtlasPropertyImportResult | null>(null);
  const [displayModel, setDisplayModel] = useState<HandoffDisplayModel | null>(null);
  const [importError, setImportError]   = useState<string | null>(null);
  const [loaded, setLoaded]     = useState(false);

  // ── Initialise on first render ───────────────────────────────────────────
  if (!loaded) {
    const payload = handoffPayload ?? DEV_FIXTURE;
    try {
      const imported = importAtlasProperty(payload, handoffPayload ? 'atlas_scan_handoff' : 'dev_fixture');
      setResult(imported);
      setDisplayModel(buildHandoffDisplayModel(imported));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
    setLoaded(true);
  }

  const handleOpenAtlasMind = useCallback(() => {
    if (!result) return;
    const seed = buildPresentationSeedFromAtlasProperty(result);
    if (onOpenAtlasMind) {
      onOpenAtlasMind(seed);
    }
  }, [result, onOpenAtlasMind]);

  const handleReviewData = useCallback(() => {
    // Placeholder — future PR will add a detail review view
  }, []);

  // ── Error state ───────────────────────────────────────────────────────────
  if (importError) {
    return (
      <div style={{ maxWidth: 640, margin: '48px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 10,
          padding: '20px 24px',
        }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 16, color: '#b91c1c' }}>
            Handoff payload could not be loaded
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d', wordBreak: 'break-word' }}>
            {importError}
          </p>
          {onBack && (
            <button
              onClick={onBack}
              style={{ marginTop: 16, fontSize: 13, padding: '6px 14px', cursor: 'pointer' }}
            >
              ← Go back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!result || !displayModel) {
    return null;
  }

  return (
    <div style={{
      maxWidth: 760,
      margin: '0 auto',
      padding: '24px 20px 48px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Back link */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: '#64748b',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 0 16px',
          }}
        >
          ← Back
        </button>
      )}

      {/* Section label */}
      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#6366f1', letterSpacing: 0.8, textTransform: 'uppercase' }}>
        Atlas Mind — Handoff Arrival
      </p>

      {/* 1. Summary card */}
      <HandoffSummaryCard model={displayModel} />

      {/* 2. Evidence summary */}
      <HandoffEvidenceSummary model={displayModel} atlasProperty={result.atlasProperty} />

      {/* 3. Knowledge panel */}
      <HandoffKnowledgePanel model={displayModel} />

      {/* 4. Readiness panel */}
      <HandoffReadinessPanel model={displayModel} />

      {/* 5. CTA area */}
      <CtaArea
        model={displayModel}
        onOpenAtlasMind={handleOpenAtlasMind}
        onReviewData={handleReviewData}
      />
    </div>
  );
}
