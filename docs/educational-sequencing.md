# Educational Sequencing and Progressive Disclosure

## Purpose

This layer controls **when** a concept is introduced in an educational journey —
not which content to show, but at what stage, with what emotional weight, and how
to space it relative to other concepts.

The sequencing engine ensures that journeys achieve:

- **rhythm** — alternating heavy and light concepts.
- **escalation** — simple framing before complex physics.
- **pacing** — cognitive cooldowns after cautionary information.
- **emotional flow** — reassurance before caution.
- **"aha" moments** — lived experience before deeper understanding.
- **cognitive cooldowns** — mandatory spacing after dense concept clusters.

---

## The Problem Being Solved

Without sequencing rules, a journey can be technically correct but humanly exhausting:

**Bad flow**

```
Hydraulic explanation
→ compensation explanation
→ emitter explanation
→ modulation explanation
→ flow-temperature explanation
```

**Better flow**

1. What you may notice
2. Why this is normal
3. What this improves
4. What not to worry about
5. Only then: deeper explanation

---

## Contract: `EducationalSequenceRuleV1`

Located at: `src/library/sequencing/EducationalSequenceRuleV1.ts`

| Field | Type | Description |
|---|---|---|
| `ruleId` | `string` | Unique rule identifier |
| `conceptId` | `string` | The concept this rule governs |
| `sequenceStage` | `SequenceStage` | Where in the journey this concept belongs |
| `prerequisites?` | `string[]` | Concepts that must appear first; missing prereqs defer this concept |
| `deferUntilSeen?` | `string[]` | Concepts that, if already seen, allow this one to be deferred |
| `suppressIfAlreadyExplained?` | `boolean` | Suppress if the concept was explained earlier in the same pack |
| `emotionalWeight` | `EmotionalWeight` | `calming` \| `neutral` \| `cautionary` |
| `maxSimultaneousConcepts` | `number` | Max concepts allowed in the same section slot as this one |
| `cooldownAfter?` | `number` | Empty slots required after this concept before the next heavy one |
| `idealCardTypes?` | `string[]` | Advisory preferred UI card types for this stage |
| `avoidAdjacentConceptIds?` | `string[]` | Concepts that must not immediately precede or follow this one |

### Sequence Stages

| Stage | Role |
|---|---|
| `reassurance` | Opening calm — safety, normality, comfort. Always shown first. |
| `expectation` | Accurate expectation-setting before lived experience begins. |
| `lived_experience` | What the customer will actually notice day-to-day. |
| `misconception` | Correct a common wrong mental model. Needs trust established first. |
| `deeper_understanding` | Meaningful depth once context and trust exist. |
| `technical_detail` | Physics or engineering — always deferred unless explicitly requested. |
| `appendix_only` | QR/portal only — never in the core pack. |

---

## Engine: `buildEducationalSequence`

Located at: `src/library/sequencing/buildEducationalSequence.ts`

### Inputs

```typescript
interface BuildEducationalSequenceInputV1 {
  selectedConceptIds: readonly string[];
  sequenceRules: readonly EducationalSequenceRuleV1[];
  archetypeId: string;
  accessibilityPreferences?: EducationalRoutingAccessibilityPreferencesV1;
  contextTags?: SequencingContextTagsV1;
  alreadyExplainedConceptIds?: readonly string[];
}
```

### Outputs

```typescript
interface BuildEducationalSequenceOutputV1 {
  orderedSequence: SequencedConceptV1[];     // Concepts in display order
  deferredConcepts: DeferredConceptV1[];     // Excluded with reasons
  overloadWarnings: string[];                 // Cognitive load alerts
  pacingMetadata: StagePacingMetadataV1[];   // Per-stage summary
  appliedMaxSimultaneous: number;             // Effective cap applied
}
```

### Engine behaviour

1. **Stage assignment** — each concept is assigned to a stage via its matching `EducationalSequenceRuleV1`. Concepts with no rule fall through to `technical_detail`.
2. **Prerequisite gate** — if any prerequisite conceptId is not in the selected set, the concept is deferred.
3. **Suppression gate** — if `suppressIfAlreadyExplained` is `true` and the concept appears in `alreadyExplainedConceptIds`, it is suppressed.
4. **Stage + emotional sort** — concepts are sorted by stage order, then by emotional weight (calming → neutral → cautionary within each stage).
5. **Adjacency enforcement** — `avoidAdjacentConceptIds` violations emit an `overloadWarning`.
6. **Max-simultaneous cap** — when a stage exceeds the accessibility-adjusted cap, an overload warning is emitted.
7. **Cooldown detection** — cautionary concepts followed immediately by other cautionary concepts emit consecutive-cautionary warnings.
8. **Pacing metadata** — per-stage summary of concept counts and warning flags for renderer use.

---

## Accessibility Impact

Accessibility profiles reduce the `maxSimultaneousConcepts` cap:

| Profile | Cap |
|---|---|
| `adhd` | 1 |
| `dyslexia` | 2 |
| `low_technical_literacy` | 2 |
| `print_first` | 3 |
| `reduced_motion` | 3 |
| `technical_appendix_requested` | 4 |
| *(default)* | 4 |

When multiple profiles are active, the most restrictive cap applies.

---

## Canonical Sequencing Rules

Located at: `src/library/sequencing/educationalSequenceRules.ts`

Covers the following concept IDs across all seven stages:

**Reassurance:** `system_fit_explanation`, `HYD-02`

**Expectation:** `emitter_sizing`, `flow_temperature`, `stored_hot_water_efficiency`

**Lived experience:** `operating_behaviour`, `driving_style`, `control_strategy`, `hp_cylinder_temperature`

**Misconception:** `boiler_cycling`, `load_matching`, `flow_restriction`

**Deeper understanding:** `weather_compensation`, `legionella_pasteurisation`, `scope_clarity`

**Technical detail:** `SIZ-01`, `SIZ-02`, `HYD-01`, `pipework_constraint`

**Appendix only:** `future_ready_pathways`, `system_work_explainer`, `CON-01`

---

## Integration with Golden Journeys

Each golden journey demonstrator exposes a `getXxxJourneySequencingPlan()` function
that calls `buildEducationalSequence` with the journey's concept list:

| Journey | Export |
|---|---|
| Heat pump reality | `getHeatPumpRealityJourneySequencingPlan()` |
| Open vented to sealed/unvented | `getOpenVentedToSealedUnventedJourneySequencingPlan()` |
| Regular to regular unvented | `getRegularToRegularUnventedJourneySequencingPlan()` |
| Water constraint reality | `getWaterConstraintJourneySequencingPlan()` |

These return a `BuildEducationalSequenceOutputV1` that can be used by:

- Dev preview surfaces to visualise journey pacing.
- QA tooling to detect overload clusters before pack sign-off.
- Accessibility audit layers to check simultaneous-concept density.

---

## Non-goals

- This layer does **not** alter recommendations.
- It does **not** add, remove, or reorder assets in the registry.
- It does **not** affect production routes or PDF generation.
- It does **not** change routing rules.

---

## Tests

Located at: `src/library/__tests__/buildEducationalSequence.test.ts`

Key coverage:

- Engine is deterministic across repeated calls.
- Reassurance always appears before cautionary concepts.
- `technical_detail` always appears after `lived_experience`.
- Prerequisites missing → concept deferred with reason.
- `suppressIfAlreadyExplained` suppresses with clear reason.
- ADHD profile reduces simultaneous cap to 1.
- Dyslexia profile reduces simultaneous cap to 2.
- Most restrictive of multiple profiles wins.
- Overload warning emitted when stage exceeds cap.
- Consecutive cautionary concepts emit warning.
- Within a stage, calming concepts always precede cautionary ones.
- Unknown conceptIds fall through to `technical_detail` without error.
- Canonical rule set has unique ruleIds, valid stages, valid weights.
