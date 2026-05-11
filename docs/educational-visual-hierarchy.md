# Educational Visual Hierarchy and Density Rules

> **Status:** Implemented — `src/library/ui/hierarchy/`

## Purpose

Atlas now has enough sophistication that the primary failure mode is no longer *missing information* — it is *too much equally important information*. This document defines the visual hierarchy and density rules that keep the welcome pack calm, readable, and emotionally paced regardless of how much content complexity grows.

These rules are especially important for users with:

- ADHD
- Dyslexia
- Anxiety
- Low technical literacy
- Older readers

---

## Core Principle: One Idea at a Time

Every section of the welcome pack must have exactly one **primary** concept — the dominant idea. All other content is *supporting*, *optional*, or *deferred*. Silence and rest are mandatory, not optional.

---

## Visual Priority Levels

Defined in `src/library/ui/hierarchy/EducationalVisualPriorityV1.ts`.

| Level | Description | Card treatment | When it appears |
|---|---|---|---|
| **primary** | The dominant idea in the section | Full width, accent border, prominent heading | One per section — never two |
| **supporting** | Reinforces or contextualises the primary | Standard weight, grouped in pairs | Up to 2 adjacent |
| **optional** | Adds depth if the reader wants it | Visually subdued, collapsed by default | Softened appearance only |
| **deferred** | Engineering/physics detail | Not rendered inline — QR / deep-dive only | Never dominant |

Priority is derived from the educational sequencing stage via `priorityFromSequenceStage()`:

| Sequence stage | Priority level |
|---|---|
| `reassurance`, `expectation` | primary |
| `lived_experience`, `misconception` | supporting |
| `deeper_understanding` | optional |
| `technical_detail`, `appendix_only` | deferred |

---

## Layout Rules

Defined in `src/library/ui/hierarchy/visualHierarchyRules.ts`.

| Rule | Value |
|---|---|
| Max primary concepts per section | **1** |
| Max adjacent supporting cards | **2** |
| Max diagrams per section | **2** |
| Max diagrams total in pack | **4** |
| Max callouts per section | **3** |
| Max consecutive dense sections without rest | **3** |
| Max consecutive card-type changes | **4** |

After a heavy section (diagram + 2+ supporting cards), at least one visual rest beat (empty separator or ConceptDivider) must follow.

---

## Typography Rhythm

Defined in `src/library/ui/hierarchy/typographyRhythm.ts`.

| Rule | Value |
|---|---|
| Max section intro characters | **180** |
| Sentence length soft limit | **120 chars** |
| Sentence length hard limit | **180 chars** |
| Max emphasis word fraction | **15%** |
| Min body between same-level headings | **80 chars** |
| Max callout types per card | **2** |
| Max simultaneous callouts per section | **3** |

---

## Card Emphasis Rules

Defined in `src/library/ui/hierarchy/cardEmphasisRules.ts`.

### Primary
- Full width (`grid-column: 1 / -1`)
- Accent border (`#234a7d`)
- Accent background (`#eaf2fb`)
- Not collapsible
- Not grouped

### Supporting
- Standard weight (border `#c5cfdb`, white background)
- Grouped in visual clusters (up to 2 adjacent)
- Not collapsible

### Optional
- Visually subdued (muted text `#45576d`, light border `#e0e6ef`, subtle background `#f6f8fb`)
- Collapsed by default — requires user interaction to expand
- Must not visually compete with primary or supporting cards

### Deferred
- Not rendered inline in the pack
- Content is placed in QR / deep-dive destinations only
- If ever rendered inline (e.g. dev mode), uses dashed border and muted colour
- Must never be visually dominant on any page

---

## Visual Noise Audit

Defined in `src/library/ui/hierarchy/VisualNoiseAudit.ts`.

The `runVisualNoiseAudit()` function accepts a list of `SectionVisualPrioritySummaryV1` objects (one per non-empty section) and returns a `VisualNoiseAuditReportV1` with:

- `flags`: all violations, sorted errors-first
- `passed`: `true` when no error-severity flags are present
- `summary`: human-readable one-liner

### Flag kinds

| Kind | Severity | Description |
|---|---|---|
| `too_many_primary` | **error** | More than one primary card in a section |
| `deferred_card_dominant` | **error** | A deferred card is rendered inline in the pack body |
| `too_many_callouts` | warning | Section has more than 3 callout elements |
| `too_many_diagrams_in_section` | warning | More than 2 diagrams in one section |
| `too_many_diagrams_total` | warning | Pack total exceeds 4 diagrams |
| `excessive_emphasis` | warning | Too many bold/highlighted phrases in a card |
| `dense_section_stacking` | warning | More than 3 consecutive dense sections without rest |
| `excessive_card_switching` | warning | More than 4 card-type changes across the pack |
| `optional_card_not_softened` | warning | Optional card rendered without subdued styling |

### Integration points

The audit is integrated into:

1. **Visual Preview** (`WelcomePackDevPreview.tsx`) — a "Visual noise audit" panel appears in the storyboard view, showing flags per fixture in real time.
2. **CalmWelcomePack** (`CalmWelcomePack.tsx`) — cards receive `data-priority` attributes and priority CSS classes, allowing visual hierarchy to be enforced through CSS.

---

## CSS Classes

Priority-level BEM modifier classes (applied by `cardPriorityClass()`):

```css
.atlas-edu-card--priority-primary
.atlas-edu-card--priority-supporting
.atlas-edu-card--priority-optional
.atlas-edu-card--priority-deferred
```

These classes are defined in `calmWelcomePack.css` and can be reused in any renderer that uses CalmWelcomePack card structure.

---

## Non-goals

- No branding redesign
- No recommendation changes
- No production route changes
- No PDF generation

---

## File index

| File | Purpose |
|---|---|
| `src/library/ui/hierarchy/EducationalVisualPriorityV1.ts` | Contract: priority levels and section summary types |
| `src/library/ui/hierarchy/visualHierarchyRules.ts` | Layout density constants and priority rendering descriptors |
| `src/library/ui/hierarchy/typographyRhythm.ts` | Typography rhythm limits |
| `src/library/ui/hierarchy/cardEmphasisRules.ts` | Card-level CSS class helpers and grouping rules |
| `src/library/ui/hierarchy/VisualNoiseAudit.ts` | Audit engine and report types |
| `src/library/ui/hierarchy/index.ts` | Module exports |
| `src/library/__tests__/educationalVisualHierarchy.test.ts` | Full test suite |
| `docs/educational-visual-hierarchy.md` | This document |
