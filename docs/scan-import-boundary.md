# Scan Import Boundary

Internal design documentation for the Atlas scan ingestion infrastructure.

---

## Purpose

This document explains the design of the scan import boundary for Atlas.

**SessionCaptureV2 is the canonical import format.** It is the primary top-level
handoff produced by Atlas Scan iOS and consumed by Atlas Mind.  SessionCaptureV1
is retained for backward compatibility.  No production path depends on
`ScanBundleV1` as the primary import contract.

The goal is to make Atlas **scan-ready, not scan-dependent**. The repository
maintains a strict contract, validator, importer pipeline, and test infrastructure
so that Atlas Scan iOS can integrate cleanly against a stable surface.

---

## Atlas canonical ownership

Atlas remains the only canonical source of truth for:

- survey state
- floor-plan state (geometry, placement, connection layers)
- recommendation logic
- simulation / physics engine outputs
- advice and report outputs

Atlas Scan is an **external producer of session evidence only**.  It captures
rooms, objects, photos, audio, notes, and a timeline of events, then exports
a `SessionCaptureV2` (or V1) payload.  Atlas ingests, validates, and converts
this evidence into editable draft data.  Scan data does not automatically become
canonical truth — it must pass through Atlas's import review step.

---

## Primary handoff: SessionCaptureV2

```
Atlas Scan iOS
       │
       │  session_capture.json  (SessionCaptureV2, version "2.0")
       │  + optional photo files + floor-plan snapshot files
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  src/features/scanImport/                                        │  ← import boundary
│                                                                  │
│  contracts/                                                      │
│    sessionCaptureV2.ts        — V2 types + validator             │
│                                                                  │
│  importer/                                                       │
│    sessionCaptureV2Importer.ts  — primary V2 importer            │
│      importSessionCaptureV2()   — validates + reviews            │
│      isSessionCaptureV2Json()   — detection helper               │
│      buildEngineerEvidenceFromV2() — engineer output helper      │
│                                                                  │
│    sessionCaptureImporter.ts  — V1 importer (backward compat)   │
│      importSessionCapture()   — validates + reviews              │
│      isSessionCaptureJson()   — detection helper                 │
│                                                                  │
│  ui/                                                             │
│    SessionCaptureV2ImportFlow.tsx    — V2 import wizard          │
│    SessionCaptureV2ImportReview.tsx  — V2 review screen          │
│    SessionCaptureImportFlow.tsx      — V1 import wizard          │
│    SessionCaptureImportReview.tsx    — V1 review screen          │
│                                                                  │
│  fixtures/                                                       │
│    session_capture_v2_example.json  — canonical V2 fixture      │
│    session-capture-full.json        — V1 fixture                 │
│                                                                  │
│  __tests__/                                                      │
│    sessionCaptureV2Importer.test.ts — V2 importer tests          │
│    sessionCaptureImporter.test.ts   — V1 importer tests          │
└──────────────────────────────────────────────────────────────────┘
       │
       │  Evidence stored in D1 + R2
       │  (scan_sessions, scan_assets, transcripts)
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  src/engine/modules/buildEngineerHandoff.ts                      │  ← wired to engineer output
│    evidence populated from SessionCaptureV2 (V1 fallback)        │
└──────────────────────────────────────────────────────────────────┘
```

Raw `SessionCaptureV2` types **must not** spread across the wider application.
Only the importer translates them into canonical Atlas entities.

---

## Detection and routing in ReceiveScanPage

`ReceiveScanPage` routes incoming `.json` files in the following priority order:

1. **V2 detection** (`isSessionCaptureV2Json`) → `SessionCaptureV2ImportFlow`
2. **V1 detection** (`isSessionCaptureJson`) → `SessionCaptureImportFlow`
3. **Fallback** → `ScanPackageImportFlow` (legacy `ScanBundleV1` package bundles)

Detection reads only the first 4096 bytes of the file to check for version
discriminants without loading the full payload.

---

## SessionCaptureV2 contract

Version discriminant: `"2.0"`

Key changes from V1:
- `visitReference` (new) — links to a job/visit record
- `capturedAt` / `exportedAt` replace `startedAt` / `updatedAt` / `completedAt`
- `deviceModel` is a flat string (V1 had a nested `device` object)
- `roomScans` replaces `rooms`
- `voiceNotes` replaces `audio` — transcript text only, no raw audio URIs
- `objectPins` replaces `objects` — includes room context and photo IDs
- `floorPlanSnapshots` (new)
- `qaFlags` (new)

Types and validation are defined locally in
`src/features/scanImport/contracts/sessionCaptureV2.ts` until the shared
`@atlas/contracts` package is updated to own and export them.

---

## V1 backward compatibility path

```
Atlas Scan iOS
       │
       │  session_capture.json  (SessionCaptureV1, version "1.0")
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  importer/                                                       │
│    sessionCaptureImporter.ts  — V1 importer                      │
│      importSessionCapture()   — validates + reviews              │
└──────────────────────────────────────────────────────────────────┘
```

SessionCaptureV1 is imported and reviewed via the same review/confirm/store
pattern as V2.  No new production work should reference V1 as the primary format.

---

## Evidence routing rules

### V2 evidence routing

| Evidence kind | Customer-safe | Engineer-visible |
|---|---|---|
| Rooms (roomScans) | ✓ | ✓ |
| Session-scope photos | ✓ | ✓ |
| Room-scope photos | ✓ | ✓ |
| Object-scope photos | ✗ | ✓ |
| Voice note transcripts | ✗ | ✓ |
| Object pins | ✗ | ✓ |
| Floor-plan snapshots | ✓ | ✓ |
| QA flags | ✗ | ✓ |

### V1 evidence routing (unchanged)

| Evidence kind | Customer-safe | Engineer-visible |
|---|---|---|
| Rooms (captured) | ✓ | ✓ |
| Session-scope photos | ✓ | ✓ |
| Room-scope photos | ✓ | ✓ |
| Object-scope photos | ✗ | ✓ |
| Note markers | ✗ | ✓ |
| Transcript text | ✗ | ✓ |

Customer-facing outputs (portal, report, print pack) must not surface
engineer notes, object-level photos, voice note transcripts, or QA flags
without explicit review approval.

---

## Persistence

After import review is confirmed:

1. A `scan_sessions` D1 record is created (session ID, visit reference,
   address, review state, capture version).
2. Photo files are uploaded to R2 (`scan-sessions/:id/assets`) with their
   stable `photoId` as the asset key.  Photos are linked to their room and
   object-pin references.
3. Voice note transcripts are stored as text in D1
   (`scan-sessions/:id/transcripts`).  No raw audio is transmitted or stored.
4. Floor-plan snapshot files are uploaded to R2 with their stable
   `snapshotId` as the asset key.

---

## V2 importer pipeline

The `importSessionCaptureV2` pipeline performs these steps in order:

1. **Structural validation** — validate via the local `validateSessionCaptureV2`
   function in `contracts/sessionCaptureV2.ts`.  Returns `rejected_invalid`
   with error list if the payload fails.

2. **Evidence inventory** — extract all captured roomScans, objectPins, photos,
   voiceNotes, floorPlanSnapshots, and qaFlags into a typed
   `SessionCaptureV2Review`.

3. **Readiness signals** — derive `missingFields` (address, visitReference,
   empty room scans) and `verificationRequired` (incomplete rooms, pins
   without photos, QA error flags) so the review screen can surface gaps
   before import is confirmed.

4. **Evidence routing** — classify each evidence item as `customerSafe: true/false`.
   Session/room-scope photos and floor-plan snapshots are customer-safe;
   object photos, voice-note transcripts, object pins, and QA flags are
   engineer-only.

5. **Warning derivation** — surface orphan photos, QA flags, missing fields,
   and incomplete rooms as import warnings.

---

## Engineer handoff integration

`buildEngineerHandoff` accepts an optional `sessionCaptureV2` parameter.
When provided, V2 evidence takes precedence over any V1 capture.  V2 evidence
is surfaced via `buildEngineerEvidenceFromV2()` from the V2 importer.

```typescript
buildEngineerHandoff(
  decision,
  scenarios,
  engineInput,
  propertyPlan,
  undefined,           // no V1 capture
  sessionCaptureV2,    // V2 evidence populates the evidence section
);
```

---

## Legacy ScanBundleV1

`ScanBundleV1` package import (`manifest.json` + `scan_bundle.json`) is retained
as a fallback path in `ReceiveScanPage` for backward compatibility, but is not
promoted as the primary route.  No new work should reference `ScanBundleV1` as
the canonical handoff format.

---

## Boundary architecture (floor-plan path)

The `SessionCaptureV1` spatial data flows through a separate path (V2 spatial
integration is planned but not yet implemented):

```
SessionCaptureV1
       │
       ▼
buildInitialSpatialTwinFromCapture()   ← spatialTwin/import
       │
       ▼
SpatialTwinModelV1                     ← editable spatial model
       │
       ▼
AtlasSpatialModelV1                    ← canonical floor-plan model
       │
       ▼
HeatLossModelV1 / EngineInputV2_3
```

---

## Contract versioning policy

### Current versions

| Format | Version | Status |
|---|---|---|
| SessionCaptureV2 | `"2.0"` | Primary |
| SessionCaptureV1 | `"1.0"` | Backward compatible |
| ScanBundleV1 | `"1.0"` | Legacy fallback only |

### Versioning rules

| Change type | Action |
|---|---|
| New optional field added | Increment **minor** — old importers may ignore the field |
| Required field added or semantics changed | Increment **major** — old importers must reject |
| Field removed | Increment **major** |

---

## V2 test fixtures

| Fixture | Expected result |
|---|---|
| `session_capture_v2_example.json` | `success_with_warnings` (QA flags + visit reference + pins without photos) |

Acceptance criteria covered by `sessionCaptureV2Importer.test.ts`:

1. Import the shared fixture successfully
2. Confirm transcript text imports without raw audio
3. Confirm photos are evidence records with IDs and room/object links
4. Confirm object pins survive import
5. Confirm empty/invalid SessionCaptureV2 fails cleanly
6. Confirm ScanBundleV1 is not the primary import route

---

## Related files

| Path | Purpose |
|---|---|
| `src/features/scanImport/contracts/sessionCaptureV2.ts` | SessionCaptureV2 types and validator |
| `src/features/scanImport/contracts/scanContracts.ts` | ScanBundle types and version constants |
| `src/features/scanImport/contracts/scanValidation.ts` | validateScanBundle shim (deprecated) |
| `src/features/scanImport/importer/sessionCaptureV2Importer.ts` | V2 importer, evidence derivation |
| `src/features/scanImport/importer/sessionCaptureImporter.ts` | V1 importer |
| `src/features/scanImport/importer/scanMapper.ts` | mapScanBundleToFloorPlanDraft |
| `src/features/scanImport/ui/SessionCaptureV2ImportFlow.tsx` | V2 import wizard |
| `src/features/scanImport/ui/SessionCaptureV2ImportReview.tsx` | V2 review screen |
| `src/features/scanImport/ui/SessionCaptureImportFlow.tsx` | V1 import wizard |
| `src/features/scanImport/ui/SessionCaptureImportReview.tsx` | V1 review screen |
| `src/features/scanImport/ui/ReceiveScanPage.tsx` | File routing (V2 → V1 → legacy) |
| `src/features/scanImport/dev/ScanImportHarness.tsx` | Dev-only harness UI |
| `src/features/scanImport/__tests__/sessionCaptureV2Importer.test.ts` | V2 importer tests |
| `src/features/scanImport/__tests__/sessionCaptureImporter.test.ts` | V1 importer tests |
| `src/features/scanImport/fixtures/session_capture_v2_example.json` | Canonical V2 fixture |
| `src/engine/modules/buildEngineerHandoff.ts` | Engineer handoff (V2 evidence wired) |
| `src/components/floorplan/propertyPlan.types.ts` | Canonical floor-plan entities |
| `docs/atlas-terminology.md` | Approved user-facing terminology |

