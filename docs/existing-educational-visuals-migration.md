# Existing Educational Visuals — Migration Map

## Purpose

This document records the first library bridge pass for all existing educational
visuals in Atlas. No component has been moved. The goal of this pass is:

> **Register → Bridge → Audit → only then Migrate.**

---

## Asset Inventory

### 1. WhatIfLab

| Field | Value |
|---|---|
| Asset ID | `WhatIfLab` |
| Existing location | `src/components/explainers/WhatIfLab.tsx` |
| Component path | `src/components/explainers/WhatIfLab.tsx` |
| Concept mapping | `physics_myth_busting`, `system_fit_explanation` |
| Asset type | explainer |
| Motion / Accessibility | motionIntensity: medium · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: false · printStatus: needs\_static\_equivalent |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | partial |
| Next action | Author static fallback for reduced-motion and print modes; complete accessibility audit. |

---

### 2. BoilerCyclingAnimation

| Field | Value |
|---|---|
| Asset ID | `BoilerCyclingAnimation` |
| Existing location | `src/components/whatif/BoilerCyclingAnimation.tsx` |
| Component path | `src/components/whatif/BoilerCyclingAnimation.tsx` |
| Concept mapping | `boiler_cycling`, `load_matching` |
| Asset type | animation |
| Motion / Accessibility | motionIntensity: high · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: false · printStatus: needs\_static\_equivalent |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | partial |
| Next action | Add static reduced-motion frame; add dedicated print diagram. |

---

### 3. FlowRestrictionAnimation

| Field | Value |
|---|---|
| Asset ID | `FlowRestrictionAnimation` |
| Existing location | `src/components/whatif/FlowRestrictionAnimation.tsx` |
| Component path | `src/components/whatif/FlowRestrictionAnimation.tsx` |
| Concept mapping | `flow_restriction`, `pipework_constraint` |
| Asset type | animation |
| Motion / Accessibility | motionIntensity: high · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: false · printStatus: needs\_static\_equivalent |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | partial |
| Next action | Add static reduced-motion frame; add dedicated print diagram. |

---

### 4. RadiatorUpgradeAnimation

| Field | Value |
|---|---|
| Asset ID | `RadiatorUpgradeAnimation` |
| Existing location | `src/components/whatif/RadiatorUpgradeAnimation.tsx` |
| Component path | `src/components/whatif/RadiatorUpgradeAnimation.tsx` |
| Concept mapping | `emitter_sizing`, `flow_temperature` |
| Asset type | animation |
| Motion / Accessibility | motionIntensity: medium · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: false · printStatus: needs\_static\_equivalent |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | partial |
| Next action | Add static reduced-motion frame; add dedicated print diagram. |

---

### 5. ControlsVisual

| Field | Value |
|---|---|
| Asset ID | `ControlsVisual` |
| Existing location | `src/components/whatif/visuals/ControlsVisual.tsx` |
| Component path | `src/components/whatif/visuals/ControlsVisual.tsx` |
| Concept mapping | `weather_compensation`, `control_strategy` |
| Asset type | diagram |
| Motion / Accessibility | motionIntensity: none · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: true · printStatus: print\_ready |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | partial |
| Next action | Complete screen-reader and colour-contrast audit. |

---

### 6. DrivingStyleVisual

| Field | Value |
|---|---|
| Asset ID | `DrivingStyleVisual` |
| Existing location | `src/components/physics-visuals/visuals/DrivingStyleVisual.tsx` |
| Component path | `src/components/physics-visuals/visuals/DrivingStyleVisual.tsx` |
| Concept mapping | `driving_style`, `operating_behaviour` |
| Asset type | diagram |
| Motion / Accessibility | motionIntensity: low · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: true · printStatus: print\_ready |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | partial |
| Next action | Complete screen-reader audit; verify reduced-motion static path. |

---

### 7. SystemWorkExplainerCards

| Field | Value |
|---|---|
| Asset ID | `SystemWorkExplainerCards` |
| Existing location | `src/components/presentation/blocks/SystemWorkExplainerBlockView.tsx` |
| Component path | `src/components/presentation/blocks/SystemWorkExplainerBlockView.tsx` |
| Concept mapping | `system_work_explainer`, `scope_clarity` |
| Asset type | print\_sheet |
| Motion / Accessibility | motionIntensity: none · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: true · printStatus: print\_ready |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | not\_started |
| Next action | Run accessibility audit. |

---

### 8. PrimariesDiagram *(newly registered)*

| Field | Value |
|---|---|
| Asset ID | `PrimariesDiagram` |
| Existing location | `src/components/explainers/WhatIfLab.tsx` (named export) |
| Component path | `src/components/explainers/WhatIfLab.tsx` |
| Concept mapping | `primary_pipework_sizing`, `hydraulic_constraint` |
| Asset type | diagram |
| Motion / Accessibility | motionIntensity: none · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: true · printStatus: print\_ready |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | not\_started |
| Next action | Run accessibility audit; consider extracting to own file in next migration step. |

---

### 9. StorageDiagram *(newly registered)*

| Field | Value |
|---|---|
| Asset ID | `StorageDiagram` |
| Existing location | `src/components/explainers/WhatIfLab.tsx` (named export) |
| Component path | `src/components/explainers/WhatIfLab.tsx` |
| Concept mapping | `stored_hot_water_efficiency`, `short_draw_losses` |
| Asset type | diagram |
| Motion / Accessibility | motionIntensity: none · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: true · printStatus: print\_ready |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | not\_started |
| Next action | Run accessibility audit; consider extracting to own file in next migration step. |

---

### 10. HpCylinderDiagram *(newly registered)*

| Field | Value |
|---|---|
| Asset ID | `HpCylinderDiagram` |
| Existing location | `src/components/explainers/WhatIfLab.tsx` (named export) |
| Component path | `src/components/explainers/WhatIfLab.tsx` |
| Concept mapping | `hp_cylinder_temperature`, `legionella_pasteurisation` |
| Asset type | diagram |
| Motion / Accessibility | motionIntensity: none · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: true · printStatus: print\_ready |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | not\_started |
| Next action | Run accessibility audit; consider extracting to own file in next migration step. |

---

### 11. OversizingDiagram *(newly registered)*

| Field | Value |
|---|---|
| Asset ID | `OversizingDiagram` |
| Existing location | `src/components/explainers/WhatIfLab.tsx` (named export) |
| Component path | `src/components/explainers/WhatIfLab.tsx` |
| Concept mapping | `cylinder_sizing`, `standing_losses` |
| Asset type | diagram |
| Motion / Accessibility | motionIntensity: none · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: true · printStatus: print\_ready |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | not\_started |
| Next action | Run accessibility audit; consider extracting to own file in next migration step. |

---

### 12. VelocityDiagram *(newly registered)*

| Field | Value |
|---|---|
| Asset ID | `VelocityDiagram` |
| Existing location | `src/components/explainers/WhatIfLab.tsx` (named export) |
| Component path | `src/components/explainers/WhatIfLab.tsx` |
| Concept mapping | `flow_velocity`, `pipe_bore_sizing` |
| Asset type | diagram |
| Motion / Accessibility | motionIntensity: none · supportsReducedMotion: true |
| Print / static fallback | hasPrintEquivalent: true · printStatus: print\_ready |
| Lifecycle status | existing |
| Migration status | registered\_only |
| Accessibility audit | not\_started |
| Next action | Run accessibility audit; consider extracting to own file in next migration step. |

---

## Audit Summary

| Asset | Accessibility audit | Print status | Next action |
|---|---|---|---|
| WhatIfLab | partial | needs\_static\_equivalent | Author static fallback |
| BoilerCyclingAnimation | partial | needs\_static\_equivalent | Add static frame + print diagram |
| FlowRestrictionAnimation | partial | needs\_static\_equivalent | Add static frame + print diagram |
| RadiatorUpgradeAnimation | partial | needs\_static\_equivalent | Add static frame + print diagram |
| ControlsVisual | partial | print\_ready | Complete audit |
| DrivingStyleVisual | partial | print\_ready | Complete audit |
| SystemWorkExplainerCards | not\_started | print\_ready | Run audit |
| PrimariesDiagram | not\_started | print\_ready | Run audit; extract file |
| StorageDiagram | not\_started | print\_ready | Run audit; extract file |
| HpCylinderDiagram | not\_started | print\_ready | Run audit; extract file |
| OversizingDiagram | not\_started | print\_ready | Run audit; extract file |
| VelocityDiagram | not\_started | print\_ready | Run audit; extract file |

---

## Non-goals for this pass

- No UI redesign
- No visual rewrites
- No component moves
- No final content authoring

The principle: **Register → Bridge → Audit → only then Migrate.**
