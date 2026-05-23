# Customer Evidence Bridge

**Location:** `src/features/legoTechnix/customerEvidence/`

This document describes the canonical bridge between LegoTechnix explainability/projection outputs and future customer-facing surfaces (PDF, portal, simulator).

---

## Core philosophy

Three distinct authorities exist in the Atlas system:

| Authority | Responsibility |
|---|---|
| **Recommendation engine** | Chooses system, ranks options, determines suitability |
| **LegoTechnix** | Validates, simulates, explains, projects evidence |
| **Customer surfaces** | Consume projection/evidence only — never derive physics independently |

The evidence bridge enforces this separation. It assembles customer-safe payloads from LegoTechnix outputs. It does **not** rerun calculations, infer topology independently, or reinterpret recommendation selection logic.

---

## Evidence authority chain

```
Recommendation engine
  └─ locked summary only (systemLabel, systemType)
       ↓
LegoTechnix outputs (authoritative)
  ├─ LegoTechnixExplainabilityReportV1
  ├─ HydraulicConfidenceReportV1
  ├─ DhwRecoveryMetricsV1
  ├─ ScenarioResultV1
  └─ ProjectionTimelineV1
       ↓
buildCustomerEvidencePackV1
       ↓
CustomerEvidencePackV1  ← stable contract for customer surfaces
       ↓
Future surfaces (PDF / portal / simulator)
  — consume evidence only
  — never derive physics independently
  — never reinterpret recommendation truth
```

---

## Contracts

### CustomerEvidencePackV1

Top-level container. Holds locked system identity (from recommendation engine) and all sections.

```ts
interface CustomerEvidencePackV1 {
  schemaVersion: '1.0';
  systemLabel: string;   // verbatim from locked recommendation — never regenerated here
  systemType: string;
  recommendationSummary: string; // verbatim locked summary from recommendation engine
  sections: readonly CustomerEvidenceSectionV1[];
}
```

### CustomerEvidenceSectionV1

One of ten customer-facing sections. Each section has cards, warnings, and optional timeline summaries.

```ts
interface CustomerEvidenceSectionV1 {
  id: CustomerEvidenceSectionIdV1;
  heading: string;
  summary: string;
  cards: readonly CustomerEvidenceCardV1[];
  warnings: readonly CustomerEvidenceWarningV1[];
  timelineSummaries: readonly CustomerEvidenceTimelineV1[];
}
```

**Section IDs** (in order):

| ID | Heading |
|---|---|
| `home_understanding` | About your home and heating system |
| `what_atlas_found` | What Atlas found during the survey |
| `heating_behaviour` | How your heating system behaves |
| `hot_water_behaviour` | Your hot water |
| `comfort_expectations` | Comfort expectations |
| `energy_efficiency` | Energy and efficiency observations |
| `confidence_and_assumptions` | Confidence and assumptions |
| `engineer_confirmation` | What may need engineer confirmation |
| `future_flexibility` | Future flexibility and upgrade readiness |
| `safety_protection` | Safety and protection observations |

### CustomerEvidenceCardV1

An individual evidence payload within a section.

```ts
interface CustomerEvidenceCardV1 {
  type: CustomerEvidenceCardTypeV1;
  heading: string;
  summary: string;
  metrics: readonly CustomerEvidenceMetricV1[];
  warnings: readonly CustomerEvidenceWarningV1[];
  confidenceWording?: string;
  timelineEntries?: readonly CustomerEvidenceTimelineV1[];
}
```

**Card types:**

| Type | Purpose |
|---|---|
| `thermal_story` | Room warming trend, return-temperature trend, condensing |
| `hot_water_story` | Shower availability, bath fill, recovery, stratified/mixed |
| `confidence_story` | Overall confidence wording, measured/manufacturer inputs |
| `warning_story` | Observations from the assessment |
| `efficiency_story` | COP band, condensing efficiency observations |
| `comfort_story` | Room comfort expectations |
| `timeline_story` | Timeline playback entries (future use) |
| `assumption_story` | Assumptions made, items for engineer confirmation |
| `system_behaviour_story` | System overview, circuit behaviour, future flexibility |

### CustomerEvidenceMetricV1

A single labelled data point with confidence wording.

```ts
interface CustomerEvidenceMetricV1 {
  label: string;
  value: string | number;
  unit?: string;
  confidenceWording: string;  // always customer-safe — see wording rules below
}
```

### CustomerEvidenceTimelineV1

A single customer-safe timeline annotation for playback surfaces.

```ts
interface CustomerEvidenceTimelineV1 {
  offsetSeconds: number;
  label: string;       // e.g. "Cylinder recovering"
  description: string; // e.g. "Cylinder recovering after hot water usage."
}
```

### CustomerEvidenceWarningV1

A customer-safe observation. Never exposes raw engineering codes.

```ts
interface CustomerEvidenceWarningV1 {
  category: CustomerEvidenceWarningCategoryV1;
  severity: CustomerEvidenceWarningSeverityV1;
  message: string;
}
```

**Warning categories:** `comfort` | `hot_water` | `efficiency` | `uncertainty` | `hydraulic_risk` | `future_upgrade` | `installation_complexity`

**Severity levels:** `info` | `attention` | `important`

---

## Customer-safe wording rules

All confidence levels are translated before reaching customer surfaces:

| LegoTechnix confidence | Customer wording |
|---|---|
| `measured` | Measured during the visit |
| `manufacturer` | Based on manufacturer information |
| `user_entered` | Entered by your installer |
| `derived` | Estimated from the visible system layout |
| `estimated` | Estimated from the visible system layout |
| `assumed` | Pipe route not fully confirmed |
| `unknown` | Requires installer confirmation |

**Rules:**
- No raw engineering jargon (`kPa`, `l/min`, `coefficient`, `modulation range`)
- No fake certainty (do not claim measurements that were estimated)
- No scary language (`panic`, `critical failure`, `catastrophic`)
- Unknowns direct to installer confirmation, not alarm

Helper: `getCustomerConfidenceWording(confidence: LegoTechnixConfidence): string`

---

## Builder

```ts
import { buildCustomerEvidencePackV1 } from 'src/features/legoTechnix';

const pack = buildCustomerEvidencePackV1({
  lockedRecommendation: {
    systemLabel: 'Heat pump + unvented cylinder',   // from recommendation engine
    systemType: 'heat_pump_unvented_weather_comp',
    recommendationSummary: 'This is the locked recommendation summary shown to the customer.',
  },
  explainabilityReport,        // LegoTechnixExplainabilityReportV1
  hydraulicConfidenceReport,   // HydraulicConfidenceReportV1
  dhwRecoveryMetrics,          // optional DhwRecoveryMetricsV1
  scenarioResult,              // optional ScenarioResultV1 (for timeline summaries)
});
```

**Inputs the builder may consume:**
- `CustomerEvidenceLockedRecommendationSummaryV1` — locked label + system type only
- `LegoTechnixExplainabilityReportV1`
- `HydraulicConfidenceReportV1`
- `DhwRecoveryMetricsV1` (optional)
- `ScenarioResultV1` (optional — used for timeline summaries only)

**The builder must NOT:**
- Rerun physics calculations
- Infer topology independently
- Reinterpret recommendation selection logic
- Generate ranking or sales wording

---

## Renderer non-authority rule

Future renderers (PDF, portal, simulator) **must not** derive physics or confidence values themselves. They must:

1. Receive a `CustomerEvidencePackV1`
2. Render only what the pack provides
3. Treat `confidenceWording` as opaque strings — never substitute their own
4. Treat `systemLabel` as opaque — it was chosen by the recommendation engine
5. Treat `recommendationSummary` as opaque locked copy from the recommendation engine
6. Never add engineering context not present in the pack

This ensures the recommendation engine and LegoTechnix remain the single sources of truth. Customer surface changes (styling, layout, copy polish) never silently change what evidence is presented.

---

## Future PDF / portal usage

When a PDF or portal surface is built:

1. Call `buildCustomerEvidencePackV1(...)` with the outputs from a completed LegoTechnix run
2. Iterate `pack.sections` in order — they are pre-sorted into the canonical 10-section sequence
3. For each section, render `section.cards` in array order
4. For timeline playback, use `section.timelineSummaries` — entries are sorted by `offsetSeconds`
5. For warnings, render `section.warnings` and `card.warnings` — never filter by engineering code

The pack is fully serializable (`JSON.stringify` / `JSON.parse` safe) and suitable for storage, caching, or transmission to a rendering service.

---

## Exports

All contracts and builders are exported through `src/features/legoTechnix/index.ts`:

```ts
// Builders
buildCustomerEvidencePackV1
getCustomerConfidenceWording

// Constants
CUSTOMER_EVIDENCE_CARD_TYPES_V1
CUSTOMER_EVIDENCE_CONFIDENCE_WORDING_V1
CUSTOMER_EVIDENCE_SECTION_IDS_V1
CUSTOMER_EVIDENCE_WARNING_CATEGORIES_V1
CUSTOMER_EVIDENCE_WARNING_SEVERITIES_V1

// Types
BuildCustomerEvidencePackV1Input
CustomerEvidenceCardTypeV1
CustomerEvidenceCardV1
CustomerEvidenceLockedRecommendationSummaryV1
CustomerEvidenceMetricV1
CustomerEvidencePackV1
CustomerEvidenceSectionIdV1
CustomerEvidenceSectionV1
CustomerEvidenceTimelineV1
CustomerEvidenceWarningCategoryV1
CustomerEvidenceWarningSeverityV1
CustomerEvidenceWarningV1
```
