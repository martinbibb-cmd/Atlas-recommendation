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
    case 'driving_style':
      return (
        <DrivingStyleVisual
          {...shared}
          mode="combi"
          {...(data as Omit<DrivingStyleVisualProps, keyof PhysicsVisualProps>)}
        />
      );

    case 'flow_split':
      return (
        <FlowSplitVisual
          {...shared}
          outletsActive={1}
          {...(data as Omit<FlowSplitVisualProps, keyof PhysicsVisualProps>)}
        />
      );

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
