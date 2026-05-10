# Educational Content QA

## Purpose

Educational Content QA is a pre-expansion guardrail for authored educational content.

- It prevents wording drift and editorial regressions as the concept library grows.
- It validates grounding, accessibility, and explanation quality before new entries are scaled.
- It does **not** rewrite authored content and does **not** change recommendation logic.

## Scope boundary

QA checks wording, structure, and editorial safety.

- QA outputs findings only (`info`, `warning`, `error`).
- QA does not mutate content records.
- QA does not perform runtime AI editing.
- QA does not block production UI at this stage.

## Why banned phrases are enforced

Certain phrases are disallowed because they over-claim outcomes, imply guarantees, or conflict with controlled Atlas terminology.

Banned examples:

- `instantaneous hot water`
- `guaranteed savings`
- `maintenance-free`
- `zero disruption`
- `always cheaper`
- `never needs`

These are rejected to keep language evidence-bounded and consistent with `docs/atlas-terminology.md`.

## Safety wording exception rules

Scare framing words (`dangerous`, `catastrophic`, `fatal`) are blocked in general educational copy.

Exception:

- They are allowed only in explicit `safetyNotice` context where direct hazard wording is required.

This preserves calm educational tone while keeping mandatory safety communication possible.

## Analogy quality rules

Every content entry must provide:

- at least one analogy option
- at least one factual no-analogy option (`family: none`)

Every analogy option must include:

- `whereItWorks`
- `whereItBreaks`

This ensures analogies remain bounded, non-misleading, and easy to audit.

## Why dangerous oversimplification is mandatory

`dangerousOversimplification` is required in every entry to explicitly name a harmful shortcut users might otherwise adopt.

It acts as a structured anti-misinterpretation field that:

- supports safer customer understanding
- constrains future copy drift
- keeps educational content grounded in operational reality rather than sales framing
