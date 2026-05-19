# Installed-System Visual Language Rules

## Purpose

Define what makes Atlas diagrams feel like installed domestic systems rather than labelled abstractions.

## 1) Spacing rhythm

- Keep equipment spacing intentional and serviceable.
- Reserve visible maintenance clearance around serviceable components (filter caps, valves, pump bodies).
- Avoid stretched horizontal rails that separate equipment masses from their connection context.

## 2) Pipe routing discipline

- Prefer disciplined orthogonal routing with clear branch logic.
- Minimise crossings and avoid decorative pipe paths.
- Show true connection origin/termination at equipment ports.
- Never allow floating stubs that do not terminate at an equipment surface.

## 3) Service grouping

- Group service components where installers expect them (boiler-adjacent service cluster, return-side filter positioning, charging/service-only elements in obvious service zones).
- Preserve consistent ordering of repeated service cues across views.

## 4) Depth and overlap hierarchy

- Main equipment silhouettes dominate visual weight.
- Pipes and service connectors are secondary; annotation cues are tertiary.
- Overlaps must clarify connection order, not obscure it.

## 5) Domestic vs schematic balance

- Domestic plausibility comes from silhouette, spacing, and service grouping.
- Schematic readability comes from disciplined routing and reduced clutter.
- Neither can dominate: avoid photoreal clutter and avoid abstract iconification.

## Anti-patterns (must fail review)

- **Stretched rails:** long unbroken rails that flatten spatial logic.
- **Disconnected visual weight:** heavy components with weak or unclear connection anchoring.
- **Placeholder equipment feel:** generic capsule/box forms lacking recognisable product cues.
- **No installed-system read:** components appear arranged as labels rather than as a physically plausible install.

## Enforcement in review

Screenshot-first review must include explicit anti-pattern checks against the four failure modes above before any primitive redraw is accepted.

