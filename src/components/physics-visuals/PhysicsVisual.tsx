/**
 * PhysicsVisual.tsx
 *
 * Shared renderer for the Atlas Physics Visual Library.
 *
 * Accepts a typed `id` and dispatches to the correct visual component.
 * Pages and consumers should use this component rather than importing individual
 * visual components directly — this keeps the switch logic in one place.
 *
 * Usage:
 *   <PhysicsVisual id="driving_style" data={{ mode: 'combi' }} />
 *   <PhysicsVisual id="flow_split" data={{ outletsActive: 2 }} reducedMotion />
 */

import type { PhysicsVisualId } from './physicsVisualTypes';
import type {
  PhysicsVisualProps,
  DrivingStyleVisualProps,
  FlowSplitVisualProps,
  SolarMismatchVisualProps,
  CylinderChargeVisualProps,
} from './physicsVisualTypes';

import DrivingStyleVisual from './visuals/DrivingStyleVisual';
import FlowSplitVisual from './visuals/FlowSplitVisual';
import SolarMismatchVisual from './visuals/SolarMismatchVisual';
import CylinderChargeVisual from './visuals/CylinderChargeVisual';
import BoilerCyclingAnimation from '../whatif/BoilerCyclingAnimation';
import FlowRestrictionAnimation from '../whatif/FlowRestrictionAnimation';
import RadiatorUpgradeAnimation from '../whatif/RadiatorUpgradeAnimation';
import ControlsVisual from '../whatif/visuals/ControlsVisual';

// ─── Typed data union ──────────────────────────────────────────────────────────

/** Data payloads keyed by visual id. */
export type PhysicsVisualDataMap = {
  driving_style: Omit<DrivingStyleVisualProps, keyof PhysicsVisualProps>;
  flow_split: Omit<FlowSplitVisualProps, keyof PhysicsVisualProps>;
  solar_mismatch: Omit<SolarMismatchVisualProps, keyof PhysicsVisualProps>;
  cylinder_charge: Omit<CylinderChargeVisualProps, keyof PhysicsVisualProps>;
  // Future visuals — currently no data required beyond shared props
  heat_particles: Record<string, never>;
  bees_vs_tortoise: Record<string, never>;
  sponge: Record<string, never>;
  u_gauge: Record<string, never>;
  trv_flow: Record<string, never>;
  // Wired whatif animations — no domain-specific data required
  boiler_cycling: Record<string, never>;
  flow_restriction: Record<string, never>;
  radiator_upgrade: Record<string, never>;
  controls_upgrade: Record<string, never>;
};

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface PhysicsVisualRendererProps<T extends PhysicsVisualId> extends PhysicsVisualProps {
  id: T;
  /** Domain-specific data for the chosen visual. */
  data?: PhysicsVisualDataMap[T];
}

// ─── Renderer ──────────────────────────────────────────────────────────────────

export default function PhysicsVisual<T extends PhysicsVisualId>({
  id,
  data,
  reducedMotion,
  emphasis,
  caption,
}: PhysicsVisualRendererProps<T>) {
  const shared: PhysicsVisualProps = { reducedMotion, emphasis, caption };

  switch (id) {
    case 'driving_style': {
      const typedData = data as Omit<DrivingStyleVisualProps, keyof PhysicsVisualProps> | undefined;
      const mode: import('./physicsVisualTypes').DrivingStyleMode = typedData?.mode ?? 'combi';
      return <DrivingStyleVisual {...shared} mode={mode} />;
    }

    case 'flow_split': {
      const typedData = data as Omit<FlowSplitVisualProps, keyof PhysicsVisualProps> | undefined;
      const outletsActive: 1 | 2 | 3 = typedData?.outletsActive ?? 1;
      return <FlowSplitVisual {...shared} outletsActive={outletsActive} pressureLevel={typedData?.pressureLevel} />;
    }

    case 'solar_mismatch':
      return (
        <SolarMismatchVisual
          {...shared}
          {...(data as Omit<SolarMismatchVisualProps, keyof PhysicsVisualProps>)}
        />
      );

    case 'cylinder_charge':
      return (
        <CylinderChargeVisual
          {...shared}
          {...(data as Omit<CylinderChargeVisualProps, keyof PhysicsVisualProps>)}
        />
      );

    case 'boiler_cycling':
      return <BoilerCyclingAnimation />;

    case 'flow_restriction':
      return <FlowRestrictionAnimation />;

    case 'radiator_upgrade':
      return <RadiatorUpgradeAnimation />;

    case 'controls_upgrade':
      return <ControlsVisual />;

    default:
      // Visual not yet implemented — show a placeholder
      return (
        <div
          style={{
            padding: '1rem',
            background: 'var(--surface-subtle)',
            border: '1px dashed var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-xs)',
            textAlign: 'center',
          }}
        >
          Visual <strong>{id}</strong> coming soon
        </div>
      );
  }
}
