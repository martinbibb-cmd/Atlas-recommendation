# Scan Import Boundary

Internal design documentation for the Atlas scan ingestion infrastructure.

---

## Purpose

This document explains the design of the scan import boundary for Atlas.

**SessionCaptureV1 is the canonical import format.** It is the only top-level
handoff produced by Atlas Scan iOS and consumed by Atlas Mind. No production
path depends on `ScanBundleV1` as the primary import contract.

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
a `SessionCaptureV1` payload.  Atlas ingests, validates, and converts this
evidence into editable draft data.  Scan data does not automatically become
canonical truth — it must pass through Atlas's import review step.

---

## Primary handoff: SessionCaptureV1

```
Atlas Scan iOS
       │
       │  session_capture.json  (SessionCaptureV1)
       │  + optional photo files
       ▼
┌──────────────────────────────────────────────────┐
│  src/features/scanImport/                        │  ← import boundary
│                                                  │
│  importer/                                       │
│    sessionCaptureImporter.ts  — primary importer │
│      importSessionCapture()   — validates + reviews │
│      isSessionCaptureJson()   — detection helper │
│                                                  │
│  ui/                                             │
│    SessionCaptureImportFlow.tsx  — import wizard │
│    SessionCaptureImportReview.tsx — review screen│
│                                                  │
│  fixtures/                                       │
│    session-capture-full.json  — full fixture     │
│                                                  │
│  __tests__/                                      │
│    sessionCaptureImporter.test.ts                │
└──────────────────────────────────────────────────┘
       │
       │  Evidence stored in D1 + R2
       │  (scan_sessions, scan_assets, transcripts)
       ▼
┌──────────────────────────────────────────────────┐
│  src/engine/modules/buildEngineerHandoff.ts       │  ← wired to engineer output
│    evidence populated from SessionCaptureV1       │
└──────────────────────────────────────────────────┘
```

Raw `SessionCaptureV1` types **must not** spread across the wider application.
Only the importer translates them into canonical Atlas entities.

---

## Boundary architecture (floor-plan path)

The `SessionCaptureV1` spatial data flows through a separate path:

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

### Current version: `1.0`

All session captures carry an explicit `version` field.  The importer uses
this to detect unsupported versions before attempting structural validation.

### Versioning rules

| Change type | Action |
|---|---|
| New optional field added | Increment **minor** — old importers may ignore the field |
| Required field added or semantics changed | Increment **major** — old importers must reject |
| Field removed | Increment **major** |

---

## Importer responsibilities

The importer pipeline (`importSessionCapture`) performs these steps in order:

1. **Structural validation** — validate via `@atlas/contracts` `validateSessionCapture`.
   Returns `rejected_invalid` with error list if the payload fails.

2. **Evidence inventory** — extract all captured rooms, objects, photos, notes,
   and transcript into a typed `SessionCaptureReview`.

3. **Readiness signals** — derive `missingFields` and `verificationRequired`
   lists so the review screen can surface gaps before import is confirmed.

4. **Evidence routing** — classify each evidence item as `customerSafe: true/false`.
   Session/room-scope photos are customer-safe; object photos, notes, and
   transcript are engineer-only.

5. **Warning derivation** — surface incomplete rooms, objects without photos,
   orphan photo references, and non-ready session status as import warnings.

---

## Evidence routing rules

| Evidence kind | Customer-safe | Engineer-visible |
|---|---|---|
| Rooms (captured) | ✓ | ✓ |
| Session-scope photos | ✓ | ✓ |
| Room-scope photos | ✓ | ✓ |
| Object-scope photos | ✗ | ✓ |
| Note markers | ✗ | ✓ |
| Transcript text | ✗ | ✓ |

Customer-facing outputs (portal, report, print pack) must not surface
engineer notes or object-level photos without explicit review approval.

---

## Persistence

After import review is confirmed:

1. A `scan_sessions` D1 record is created (session ID, address, review state).
2. Photo files are uploaded to R2 (`scan-sessions/:id/assets`).
3. Transcript text is stored in D1 (`scan-sessions/:id/transcripts`).
4. No raw audio is transmitted or stored.

---

## Legacy ScanBundleV1

`ScanBundleV1` package import (`manifest.json` + `scan_bundle.json`) is retained
as a fallback path in `ReceiveScanPage` for backward compatibility, but is not
promoted as the primary route.  No new work should reference `ScanBundleV1` as
the canonical handoff format.

       │
       │  CanonicalFloorPlanDraft
       │  (canonical Atlas entities with provenance)
       ▼
┌──────────────────────────────────────┐
│  src/components/floorplan/           │  ← canonical model
│    propertyPlan.types.ts             │
│    FloorPlanBuilder.tsx              │
└──────────────────────────────────────┘
```

Raw scan bundle types (`ScanBundleV1`, `ScanRoom`, etc.) **must not** spread
across the wider application. Only the importer translates them into canonical
Atlas entities. Downstream code consumes `Room`, `Wall`, `Opening`, etc. from
`propertyPlan.types.ts` — the same types used for manually drawn floor plans.

---

## Contract versioning policy

### Current version: `1.0`

All scan bundles carry an explicit `version` field. The importer uses this to:

1. Detect **unsupported versions** before attempting structural validation.
   This produces a `rejected_unsupported_version` result, distinct from a
   structurally malformed bundle.
2. Apply the correct structural validator for the detected version.

### Versioning rules

| Change type | Action |
|---|---|
| New optional field added to bundle | Increment **minor** (e.g. `1.0` → `1.1`) — old importers may ignore the field |
| Required field added or field semantics changed | Increment **major** (e.g. `1.x` → `2.0`) — old importers must reject |
| Field removed | Increment **major** |

Supported versions are declared in `SUPPORTED_SCAN_BUNDLE_VERSIONS` in
`scanContracts.ts`. The importer rejects any version not in this list.

### Future version support

When a new contract version needs to be supported:

1. Add the version string to `SUPPORTED_SCAN_BUNDLE_VERSIONS`.
2. Add a new versioned interface (e.g. `ScanBundleV2`) to `scanContracts.ts`.
3. Update `validateScanBundle` to dispatch to the new structural validator.
4. Add new fixture files for the new version.
5. Add tests covering the new version path.

---

## Importer responsibilities

The importer pipeline (`importScanBundle`) performs these steps in order:

1. **Version check** — detect unsupported version first, so the result type
   is `rejected_unsupported_version` rather than `rejected_invalid`.

2. **Structural validation** — check every required field for the detected
   version. Returns `rejected_invalid` with human-readable error strings on
   failure. Does not silently accept malformed bundles.

3. **Coordinate normalisation** — translate scan coordinate space (metric metres,
   arbitrary origin) into Atlas canvas units (50 px/m, with margin). Returns a
   new normalised bundle; does not mutate the original.

4. **Entity mapping** — convert scan rooms / walls / openings into canonical
   `Room`, `Wall`, `Opening` types. Applies heuristics for room type inference
   from label text. Collects warnings for low confidence, missing openings,
   unknown types, etc.

5. **Provenance attachment** — every imported entity gets an `EntityProvenance`
   record with:
   - `source: 'scanned'`
   - `sourceBundleVersion` and `sourceBundleId`
   - `confidence` (numeric 0–1) and `confidenceBand` ('high' | 'medium' | 'low')
   - `reviewStatus: 'unreviewed'`

6. **Result construction** — returns a `ScanImportResult` discriminated union:
   - `success` — valid, no warnings
   - `success_with_warnings` — valid, some confidence/QA issues
   - `rejected_invalid` — failed structural validation
   - `rejected_unsupported_version` — unknown version field

### What the importer does NOT do

- Mutate recommendation or simulation state.
- Write engine outputs or survey state.
- Accept raw scan types outside the `scanImport` feature boundary.
- Silently absorb malformed or partially invalid bundles.

---

## Provenance semantics

Provenance is tracked at the entity level via the optional `provenance` field
on `Room`, `Wall`, and `Opening` in `propertyPlan.types.ts`.

### `EntitySource`

| Value | Meaning |
|---|---|
| `scanned` | Measured by a native scan client |
| `inferred` | Derived algorithmically from other data |
| `manual` | Entered or drawn by a user inside Atlas |
| `imported_legacy` | Migrated from an older data format |

### `EntityReviewStatus`

| Value | Meaning |
|---|---|
| `unreviewed` | Imported but not yet inspected by a user |
| `reviewed` | A user has confirmed the entity looks correct |
| `corrected` | A user has edited the entity after import |

Imported scan geometry enters Atlas as **editable draft data**, not unquestioned
truth. Users can review and correct imported entities; doing so should update
`reviewStatus` to `'reviewed'` or `'corrected'` accordingly.

Provenance fields are optional on all canonical entity types so that existing
`PropertyPlan` documents without provenance remain valid.

---

## Dev harness

The `ScanImportHarness` component (`src/features/scanImport/dev/`) provides a
development-only UI for testing scan bundle ingestion. It is accessible via
the `?scan-import=1` URL flag.

### Access

```
http://localhost:5173/?scan-import=1
```

### Features

- Load any of the six fixture bundles with one click.
- Paste raw JSON for ad-hoc testing.
- See the import result status badge.
- Inspect validation errors or warnings.
- View the mapped floor-plan entities with provenance annotations.
- Inspect the provenance summary (confidence distribution, bundle metadata).

### Production safety

The harness is gated behind `SCAN_IMPORT_ENABLED` in `App.tsx`, which is only
`true` when `?scan-import=1` is in the URL. It is not reachable from any
production navigation path.

---

## Test fixtures

Six fixture bundles are provided under `src/features/scanImport/fixtures/`:

| Fixture | Expected result |
|---|---|
| `valid-single-room.json` | `success` |
| `valid-multi-room.json` | `success` (two floors) |
| `low-confidence.json` | `success_with_warnings` (LOW_CONFIDENCE_ROOM, BUNDLE_QA_WARNING) |
| `partial-missing-openings.json` | `success_with_warnings` (MISSING_OPENINGS) |
| `invalid-schema.json` | `rejected_invalid` |
| `unsupported-version.json` | `rejected_unsupported_version` |

---

## Future native client integration

When an iOS (or other) scan client is ready to integrate:

1. The client produces a `ScanBundleV1` JSON payload matching the contract in
   `src/features/scanImport/contracts/scanContracts.ts`.

2. The client submits the bundle to Atlas via a network API or file-based
   handoff (the exact transport is out of scope here).

3. Atlas calls `importScanBundle(payload)` and inspects the result.

4. On `success` or `success_with_warnings`, Atlas merges the
   `CanonicalFloorPlanDraft` into the active `PropertyPlan` (or creates a new
   one), with all provenance flags intact.

5. The user reviews imported entities (rooms, walls, openings) in the
   `FloorPlanBuilder` editor and confirms or corrects them.

6. Corrected entities have their `provenance.reviewStatus` updated to
   `'corrected'`.

### What the client must NOT do

- Write directly to Atlas survey state, recommendation state, or engine outputs.
- Assume its geometry is accepted without review.
- Depend on Atlas internal types beyond the published `ScanBundleV1` contract.
- Send bundles without a `version` field or with a non-string version value.

---

## Related files

| Path | Purpose |
|---|---|
| `src/features/scanImport/contracts/scanContracts.ts` | ScanBundle types and version constants |
| `src/features/scanImport/contracts/scanValidation.ts` | validateScanBundle, isUnsupportedVersion |
| `src/features/scanImport/importer/scanNormaliser.ts` | normaliseScanCoordinates |
| `src/features/scanImport/importer/scanMapper.ts` | mapScanBundleToFloorPlanDraft, buildScanImportWarnings |
| `src/features/scanImport/importer/scanImporter.ts` | importScanBundle, ScanImportResult |
| `src/features/scanImport/dev/ScanImportHarness.tsx` | Dev-only harness UI |
| `src/features/scanImport/__tests__/scanImporter.test.ts` | Importer tests |
| `src/features/scanImport/fixtures/` | Six test fixture bundles |
| `src/components/floorplan/propertyPlan.types.ts` | Canonical floor-plan entities (now with provenance) |
| `docs/atlas-terminology.md` | Approved user-facing terminology |
