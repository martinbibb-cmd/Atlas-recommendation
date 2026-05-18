export interface DiagramSimplificationRule {
  id: string;
  description: string;
  canBeSimplified: boolean;
}

export const DIAGRAM_SIMPLIFICATION_RULES: readonly DiagramSimplificationRule[] = [
  {
    id: 'simplify:component-internal-detail',
    description: 'Component internals may be simplified when external hydraulic role remains unambiguous.',
    canBeSimplified: true,
  },
  {
    id: 'simplify:port-connectivity',
    description: 'Port connectivity and directionality cannot be simplified away.',
    canBeSimplified: false,
  },
  {
    id: 'simplify:potable-primary-separation',
    description: 'Potable and primary separation cannot be simplified away.',
    canBeSimplified: false,
  },
  {
    id: 'simplify:g3-discharge-safety',
    description: 'Unvented G3 discharge path visibility cannot be simplified away.',
    canBeSimplified: false,
  },
  {
    id: 'simplify:stratification-matrix',
    description: 'Stratification semantics (standard vs Mixergy vs thermal store) cannot be simplified away.',
    canBeSimplified: false,
  },
  {
    id: 'simplify:temporary-service-state',
    description: 'Temporary service states (powerflush/filling loop) may be simplified only if temporariness is explicit.',
    canBeSimplified: true,
  },
] as const;
