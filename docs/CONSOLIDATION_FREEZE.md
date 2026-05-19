# Atlas vNext — Consolidation Freeze

**Status: ACTIVE — Phase 1 Freeze Drift**

This document lists every surface area that is now **frozen** pending
canonical consolidation.  No new files may be added to these areas
without explicit approval.

---

## Frozen surface areas

### Visual galleries and registries
- `src/library/visualPrimitives/galleryQa.ts` — no new QA metadata layers.
- `src/library/visualPrimitives/visualPrimitiveRegistry.ts` — no new entries
  until canonical `FOOTPRINT` / `PORTS` exports are in place.
- `src/dev/devUiRegistry.tsx` — no new dev-only inventory entries.

### Overlay abstractions
- `src/explainers/lego/` — frozen; will be absorbed into
  `src/library/visualTopologies/` or deleted.
- `src/explainers/educational/` — frozen; content is being migrated to
  `src/library/content/` via re-export shims (see migration below).

### Educational routes
- No new routes may be added to `src/dev/devRouteRegistry.ts` under
  `access: 'dev_only'` without an explicit consolidation ticket.

### Diagram registries
- No new standalone diagram pages may be added to `src/library/diagrams/`.

---

## Pending migrations

| Source | Destination | Status |
|--------|-------------|--------|
| `src/explainers/educational/` | `src/library/content/explainers/` | In progress — re-export shims live at destination |
| `src/explainers/lego/` | `src/library/visualTopologies/` (topology composer) | Planned |
| `src/live/buildPrintData.ts` editorial rows | `src/library/content/educationalContentRegistry.ts` | Planned |
| `src/library/visualTopologies/topologies/visualTopologies.tsx` | `src/library/visualTopologies/templates/{topology}.tsx` | In progress |
| `src/contracts/*.ts` (fragmented visit models) | `src/contracts/VisitEnvelopeV1.ts` (canonical envelope) | In progress |
| PDF render-only pipeline | `EmbeddedPayloadPdfV1` embed/extract architecture | Planned |

---

## Canonical reference files

These are the authoritative sources of truth.  All work must derive from them.

| Concern | Canonical file |
|---------|----------------|
| Mechanical primitive spec | `docs/atlas-canonical-mechanical-primitive-spec.md` |
| Visit data ownership | `src/contracts/VisitEnvelopeV1.ts` |
| PDF payload schema | `src/contracts/EmbeddedPayloadPdfV1.ts` |
| Pipe colours / stroke widths | `src/library/visualPrimitives/primitiveTokens.ts` |
| Routing rails | `primitiveTokens.ts → ROUTING_RAILS` |
| Installation zones | `primitiveTokens.ts → INSTALLATION_ZONES` |
| Topology templates | `src/library/visualTopologies/templates/` |
| Educational content | `src/library/content/educationalContentRegistry.ts` |
| Terminology | `docs/atlas-terminology.md` |

---

## Freeze rules (enforcement)

1. **`// @freeze-drift`** — add this comment at the top of any gallery,
   overlay, or QA-abstraction file that is frozen.  CI will flag new files
   in frozen directories without this comment.

2. **No `Math.random()` in UI components** — all graph data must come from
   `EngineOutputV1` or core module results.

3. **No new educational routes** without a corresponding entry in
   `src/library/content/educationalContentRegistry.ts`.

4. **No visual promotion without human screenshot review** — metadata/test
   compliance alone does not imply recognisability or mechanical plausibility.
