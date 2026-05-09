# Educational Asset Inventory (Initial Manual Registry)

Current registry file: `src/library/registry/educationalAssetRegistry.ts`

This inventory intentionally registers existing Atlas assets only. Components are not moved in this PR.

## Registered Assets

1. `WhatIfLab`
   - Component: `src/components/explainers/WhatIfLab.tsx`
   - Type: explainer
2. `BoilerCyclingAnimation`
   - Component: `src/components/whatif/BoilerCyclingAnimation.tsx`
   - Type: animation
3. `FlowRestrictionAnimation`
   - Component: `src/components/whatif/FlowRestrictionAnimation.tsx`
   - Type: animation
4. `RadiatorUpgradeAnimation`
   - Component: `src/components/whatif/RadiatorUpgradeAnimation.tsx`
   - Type: animation
5. `ControlsVisual`
   - Component: `src/components/whatif/visuals/ControlsVisual.tsx`
   - Type: diagram
6. `DrivingStyleVisual`
   - Component: `src/components/physics-visuals/visuals/DrivingStyleVisual.tsx`
   - Type: diagram
7. `SystemWorkExplainerCards`
   - Component: `src/components/presentation/blocks/SystemWorkExplainerBlockView.tsx`
   - Type: print_sheet

## Audit Helpers

`src/library/audit/listEducationalAssets.ts` exports:

- `getAllEducationalAssets()`
- `getAssetsByConcept(conceptId)`
- `getAssetsByTrigger(triggerTag)`
- `getPrintableAssets()`
- `getMotionAssets()`
- `getAssetsMissingStaticFallback()`
- `getAssetsMissingPrintEquivalent()`
