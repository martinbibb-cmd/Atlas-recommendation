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
import SystemWorkExplainerBlockView from '../../components/presentation/blocks/SystemWorkExplainerBlockView';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EducationalComponentMap = Record<string, ComponentType<any>>;

/**
 * Maps every registered asset id to its current React component.
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
  DrivingStyleVisual,
  SystemWorkExplainerCards: SystemWorkExplainerBlockView,
  PrimariesDiagram,
  StorageDiagram,
  HpCylinderDiagram,
  OversizingDiagram,
  VelocityDiagram,
};
