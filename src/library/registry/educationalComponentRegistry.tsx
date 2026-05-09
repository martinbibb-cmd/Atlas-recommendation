/**
 * educationalComponentRegistry.tsx
 *
 * Bridge map: assetId → existing React component.
 *
 * This file makes the Atlas Accessibility Library aware of every registered
 * educational visual without moving any component from its current location.
 * Components remain in their original source paths; only a reference is held
 * here so that EducationalAssetRenderer and audit helpers can locate them.
 *
 * Migration stage: registered_only
 * Next step:       wrap each component with EducationalAssetRenderer
 * Final step:      move components into src/library/components/
 *
 * Data-driven components (DrivingStyleVisual, SystemWorkExplainerCards) cannot
 * be rendered without structured data. They are included via zero-prop preview
 * wrappers so the bridge type remains consistent. These wrappers are NOT
 * intended for production use — they exist solely to satisfy the registry
 * interface during this bridge pass.
 */

import type { ComponentType } from 'react';

import WhatIfLab, {
  PrimariesDiagram,
  StorageDiagram,
  HpCylinderDiagram,
  OversizingDiagram,
  VelocityDiagram,
} from '../../components/explainers/WhatIfLab';
import BoilerCyclingAnimation from '../../components/whatif/BoilerCyclingAnimation';
import FlowRestrictionAnimation from '../../components/whatif/FlowRestrictionAnimation';
import RadiatorUpgradeAnimation from '../../components/whatif/RadiatorUpgradeAnimation';
import ControlsVisual from '../../components/whatif/visuals/ControlsVisual';
import DrivingStyleVisual from '../../components/physics-visuals/visuals/DrivingStyleVisual';

export type EducationalComponentMap = Record<string, ComponentType>;

// ─── Zero-prop preview wrappers ───────────────────────────────────────────────
// Used only for data-driven components during this bridge-only pass.
// Do not render these in production — they exist to satisfy the registry type.

/**
 * Preview wrapper for DrivingStyleVisual which requires a `mode` prop.
 * Defaults to 'combi' so the bridge renderer has a renderable component.
 */
function DrivingStyleVisualPreview() {
  return <DrivingStyleVisual mode="combi" />;
}

/**
 * Preview wrapper for SystemWorkExplainerCards which requires a `block` data prop.
 * Shows an informational placeholder rather than requiring structured data.
 */
function SystemWorkExplainerCardsPreview() {
  return (
    <div role="note" aria-label="SystemWorkExplainerCards preview">
      <p>System work explainer cards — requires installation scope data to render.</p>
    </div>
  );
}

// ─── Bridge map ───────────────────────────────────────────────────────────────

/**
 * Maps every registered asset id to its current React component (or a zero-prop
 * preview wrapper for data-driven components).
 *
 * Keys must exactly match the `id` field in educationalAssetRegistry.ts.
 * Do not rename or remove entries here — update the registry and docs first.
 */
export const educationalComponentRegistry: EducationalComponentMap = {
  WhatIfLab,
  BoilerCyclingAnimation,
  FlowRestrictionAnimation,
  RadiatorUpgradeAnimation,
  ControlsVisual,
  DrivingStyleVisual: DrivingStyleVisualPreview,
  SystemWorkExplainerCards: SystemWorkExplainerCardsPreview,
  PrimariesDiagram,
  StorageDiagram,
  HpCylinderDiagram,
  OversizingDiagram,
  VelocityDiagram,
};
